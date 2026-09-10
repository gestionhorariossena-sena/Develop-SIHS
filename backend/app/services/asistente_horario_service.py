"""Servicio del asistente de programación (wizard de 4 pasos). Dos
responsabilidades separadas a propósito:

1. `previsualizar_excel`: solo lee y clasifica un Excel real, nunca
   escribe nada -- pasos 1-2 del wizard ("Subir archivo" / "Así lo
   entendimos").
2. `generar_propuesta`: solo trabaja con fichas que YA existen en el
   catálogo de SIHS -- si el Excel trae una ficha nueva, el import la
   señala como pendiente en vez de inventarla en la BD. Programar una
   ficha que no existe todavía en el sistema no es un caso de este
   asistente; primero se crea en Fichas, después se programa acá. Paso 3
   ("Así quedaría el horario").

Ninguna de las dos persiste horarios -- eso lo hace
`HorarioService.crear`, llamado directo desde el paso 4 (confirmar) del
frontend, reusando la validación de cruces que ya existe.
"""

from io import BytesIO

import openpyxl
from sqlalchemy.orm import Session

from app.ai.tasks.classify_document import clasificar_columnas
from app.models.ambiente import Ambiente
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.ficha import Ficha
from app.models.horario import Horario
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.usuario import Usuario
from app.schemas.asistente_horario import (
    BloquePropuesto,
    ColumnaClasificada,
    FilaImportada,
    GenerarPropuestaResponse,
    ImportarExcelPreviewResponse,
)
from app.scheduling.generator import NecesidadHorario, generar_horario

CONFIANZA_MINIMA = 0.7
MAX_FILAS_PREVIA = 50

# Ver app/scheduling/generator.py -- mismo catálogo de 3 jornadas.
JORNADAS_VALIDAS = ("MAÑANA", "TARDE", "NOCHE")
_ID_JORNADA_POR_CLAVE = {"MAÑANA": 1, "TARDE": 2, "NOCHE": 3}


def _fila_con_mas_datos(ws, filas_a_revisar: int = 10) -> int:
    """Heurística simple: la fila de encabezado real suele tener más
    celdas no vacías que las filas de título que suelen venir antes (ver
    LIDERES DE FICHA 2026_pruebas.xlsx: título en la fila 1, encabezado
    real en la fila 3)."""
    mejor_fila, mejor_conteo = 1, 0
    for fila in range(1, min(ws.max_row, filas_a_revisar) + 1):
        conteo = sum(1 for celda in ws[fila] if celda.value not in (None, "", "\xa0"))
        if conteo > mejor_conteo:
            mejor_fila, mejor_conteo = fila, conteo
    return mejor_fila


def previsualizar_excel(db: Session, contenido: bytes, nombre_archivo: str) -> ImportarExcelPreviewResponse:
    wb = openpyxl.load_workbook(BytesIO(contenido), data_only=True)
    ws = wb.worksheets[0]
    fila_encabezado = _fila_con_mas_datos(ws)

    encabezados_crudos = [c.value for c in ws[fila_encabezado]]
    idx = {str(nombre).strip(): i for i, nombre in enumerate(encabezados_crudos) if nombre not in (None, "", "\xa0")}
    encabezados = list(idx.keys())

    clasificacion = clasificar_columnas(encabezados) if encabezados else None
    columnas: list[ColumnaClasificada] = []
    campo_a_columna: dict[str, str] = {}
    if clasificacion:
        for original, c in clasificacion.root.items():
            columnas.append(ColumnaClasificada(columnaOriginal=original, campo=c.campo, confianza=c.confianza))
            if c.campo and c.confianza >= CONFIANZA_MINIMA:
                campo_a_columna[c.campo] = original

    def _valor(fila_valores: tuple, campo: str) -> str | None:
        columna = campo_a_columna.get(campo)
        if not columna or columna not in idx:
            return None
        valor = fila_valores[idx[columna]]
        return str(valor).strip() if valor not in (None, "", "\xa0") else None

    filas: list[FilaImportada] = []
    for numero_fila, fila_valores in enumerate(
        ws.iter_rows(min_row=fila_encabezado + 1, values_only=True), start=fila_encabezado + 1
    ):
        if all(v in (None, "", "\xa0") for v in fila_valores):
            continue

        ficha_texto = _valor(fila_valores, "ficha")
        id_ficha: int | None = None
        advertencia: str | None = None
        ficha_existe = False

        if ficha_texto is None:
            advertencia = "No se reconoció la columna de ficha en esta fila."
        else:
            try:
                id_ficha = int(ficha_texto)
            except ValueError:
                advertencia = f"Ficha en formato no reconocido ({ficha_texto!r}) -- requiere revisión manual."
            else:
                ficha_existe = db.get(Ficha, id_ficha) is not None
                if not ficha_existe:
                    advertencia = f"La ficha {id_ficha} no existe todavía en el catálogo de SIHS."

        filas.append(
            FilaImportada(
                fila=numero_fila,
                idFicha=id_ficha,
                fichaExiste=ficha_existe,
                programa=_valor(fila_valores, "programa"),
                jornada=_valor(fila_valores, "jornada"),
                instructorNombre=_valor(fila_valores, "instructor"),
                advertencia=advertencia,
            )
        )
        if len(filas) >= MAX_FILAS_PREVIA:
            break

    advertencia_general = None
    if filas and all(f.idFicha is None for f in filas):
        if "ficha" not in campo_a_columna:
            advertencia_general = (
                "No se encontró ninguna columna de ficha reconocible en este archivo. Si es un "
                "formato de matriz o pivote (varias filas por ficha, ej. una fila de temas, otra de "
                "instructor y otra de ambiente por cada ficha), el asistente todavía no lo soporta -- "
                "usa un archivo con una fila por ficha."
            )
        else:
            advertencia_general = (
                "Se encontró una columna de ficha, pero ningún valor de esa columna se pudo leer "
                "como un número de ficha -- revisa si el archivo trae el número de ficha mezclado con "
                "otro texto en la misma celda."
            )

    return ImportarExcelPreviewResponse(
        nombreArchivo=nombre_archivo,
        hoja=ws.title,
        filaEncabezado=fila_encabezado,
        columnas=columnas,
        filas=filas,
        totalFilas=len(filas),
        filasConAdvertencia=sum(1 for f in filas if f.advertencia),
        advertenciaGeneral=advertencia_general,
    )


def _resultados_pendientes(db: Session, ficha: Ficha, id_trimestre: int) -> list[ResultadoAprendizaje]:
    """Resultados de aprendizaje del programa de la ficha que todavía no
    tienen un horario activo en este trimestre -- son los que hay que
    programar. No depende del Excel: usa las relaciones reales ya
    existentes en la BD (Ficha -> Programa -> CompetenciaFormacion ->
    ResultadoAprendizaje)."""
    competencias = db.query(CompetenciaFormacion).filter(CompetenciaFormacion.idPrograma == ficha.idPrograma).all()
    ids_competencia = [c.idCompetencia for c in competencias]
    if not ids_competencia:
        return []

    resultados = (
        db.query(ResultadoAprendizaje).filter(ResultadoAprendizaje.idCompetencia.in_(ids_competencia)).all()
    )

    ids_con_horario = {
        h.idResultado
        for h in db.query(Horario)
        .filter(Horario.idFicha == ficha.idFicha, Horario.idTrimestre == id_trimestre, Horario.activo.is_(True))
        .all()
    }
    return [r for r in resultados if r.idResultado not in ids_con_horario]


def generar_propuesta(
    db: Session, id_trimestre: int, ids_ficha: list[int], jornada: str
) -> GenerarPropuestaResponse:
    if jornada not in JORNADAS_VALIDAS:
        raise ValueError(f"Jornada '{jornada}' no reconocida -- debe ser una de {JORNADAS_VALIDAS}.")

    instructores = db.query(Usuario).filter(Usuario.tipoContrato.isnot(None), Usuario.estado == "activo").all()
    if not instructores:
        return GenerarPropuestaResponse(bloques=[], factible=False, mensaje="No hay instructores activos en el catálogo.")
    ids_instructor = [str(i.idUsuario) for i in instructores]
    nombres_instructor = {str(i.idUsuario): i.nombre for i in instructores}

    necesidades: list[NecesidadHorario] = []
    fichas_por_id: dict[int, Ficha] = {}
    resultados_por_id: dict[int, ResultadoAprendizaje] = {}

    for id_ficha in ids_ficha:
        ficha = db.get(Ficha, id_ficha)
        if not ficha:
            continue
        fichas_por_id[id_ficha] = ficha

        ambientes = db.query(Ambiente).filter(Ambiente.estado_ambiente == "disponible")
        if ficha.idSede:
            ambientes = ambientes.filter(Ambiente.sede_id == ficha.idSede)
        ids_ambiente = [a.id for a in ambientes.all()]
        if not ids_ambiente:
            continue

        for resultado in _resultados_pendientes(db, ficha, id_trimestre):
            resultados_por_id[resultado.idResultado] = resultado
            necesidades.append(
                NecesidadHorario(
                    id_ficha=id_ficha,
                    id_resultado=resultado.idResultado,
                    jornada=jornada,
                    instructores_candidatos=ids_instructor,
                    ambientes_candidatos=ids_ambiente,
                )
            )

    if not necesidades:
        return GenerarPropuestaResponse(
            bloques=[], factible=True, mensaje="Las fichas seleccionadas ya tienen todos sus resultados programados."
        )

    asignacion = generar_horario(necesidades)
    if asignacion is None:
        return GenerarPropuestaResponse(
            bloques=[], factible=False,
            mensaje="No se encontró una combinación sin choques con los instructores y ambientes disponibles.",
        )

    ambientes_por_id = {a.id: a for a in db.query(Ambiente).all()}
    id_jornada = _ID_JORNADA_POR_CLAVE[jornada]

    bloques = [
        BloquePropuesto(
            idFicha=b.id_ficha,
            fichaCodigo=fichas_por_id[b.id_ficha].codigoFicha,
            idResultado=b.id_resultado,
            resultadoDescripcion=resultados_por_id[b.id_resultado].descripcion,
            idInstructor=b.id_instructor,
            instructorNombre=nombres_instructor[b.id_instructor],
            idAmbiente=b.id_ambiente,
            ambienteNombre=ambientes_por_id[b.id_ambiente].nombre,
            idJornada=id_jornada,
            dias=list(b.dias),
            horaInicio=b.hora_inicio,
            horaFin=b.hora_fin,
        )
        for b in asignacion
    ]
    return GenerarPropuestaResponse(bloques=bloques, factible=True, mensaje=f"{len(bloques)} bloques propuestos.")
