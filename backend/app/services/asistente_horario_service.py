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

from datetime import date, datetime
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


def _elegir_hoja(wb) -> tuple:
    """Si el archivo tiene varias hojas, no asume que la útil es la
    primera -- ver PROGRAMACIÓN CGMLTI I TRM 2026 (4).xlsx, donde la hoja
    limpia de fichas (FICHAS) es la #14 de 15, y hojas anteriores como
    PLANEACION también tienen una columna que se LLAMA "ficha" pero con
    valores compuestos, no el número solo.

    Heurística barata (sin IA, solo para elegir la hoja): busca en cada
    hoja TODOS los encabezados que contengan "ficha" (puede haber más de
    uno en la misma hoja -- ver PE-04 de SOFIA Plus, que trae a la vez
    "IDENTIFICADOR_FICHA" y "IDENTIFICADOR_UNICO_FICHA" con un prefijo
    extra, y semánticamente ambos "suenan" a ficha) y cuenta, para cada
    uno, cuántas de sus primeras filas de datos son un valor puramente
    numérico. La columna ganadora es la que tenga más -- entre TODAS las
    columnas de TODAS las hojas, no solo la primera candidata de cada
    hoja. También se devuelve cuál era esa columna ganadora: es una señal
    más confiable que la IA para el campo "ficha" específicamente (ver
    _clasificar_hoja) -- ahí es donde de verdad importa, porque solo una
    de las columnas candidatas tiene el número real que coincide con el
    resto de archivos, y eso se puede medir, no hay que adivinarlo por
    el nombre de la columna."""
    mejor_ws, mejor_fila_encabezado, mejor_puntaje, mejor_columna_ficha = (
        wb.worksheets[0], _fila_con_mas_datos(wb.worksheets[0]), -1, None,
    )
    for ws in wb.worksheets:
        fila_encabezado = _fila_con_mas_datos(ws)
        encabezados = [str(c.value).strip() if c.value not in (None, "") else "" for c in ws[fila_encabezado]]
        indices_candidatos = [i for i, h in enumerate(encabezados) if "ficha" in h.lower()]
        if not indices_candidatos:
            continue

        puntajes = dict.fromkeys(indices_candidatos, 0)
        for fila_valores in ws.iter_rows(
            min_row=fila_encabezado + 1, max_row=fila_encabezado + 30, values_only=True
        ):
            for idx_ficha in indices_candidatos:
                if idx_ficha < len(fila_valores):
                    valor = fila_valores[idx_ficha]
                    if valor is not None and str(valor).strip().isdigit():
                        puntajes[idx_ficha] += 1

        idx_mejor_de_la_hoja = max(puntajes, key=lambda i: puntajes[i])
        puntaje = puntajes[idx_mejor_de_la_hoja]
        if puntaje > mejor_puntaje:
            mejor_ws, mejor_fila_encabezado, mejor_puntaje = ws, fila_encabezado, puntaje
            mejor_columna_ficha = encabezados[idx_mejor_de_la_hoja]
    return mejor_ws, mejor_fila_encabezado, mejor_columna_ficha


def _clasificar_hoja(wb) -> tuple:
    """Elige la mejor hoja (_elegir_hoja) y clasifica sus encabezados con
    IA una sola vez -- devuelve todo lo necesario para leer filas de ella
    sin volver a llamar a la IA por cada uso."""
    ws, fila_encabezado, columna_ficha_detectada = _elegir_hoja(wb)
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

    # Para "ficha" específicamente, la columna que _elegir_hoja ya midió
    # por densidad de valores numéricos reales gana sobre lo que haya
    # dicho la IA por semántica del nombre -- ver docstring de _elegir_hoja.
    if columna_ficha_detectada and columna_ficha_detectada in idx:
        campo_a_columna["ficha"] = columna_ficha_detectada

    return ws, fila_encabezado, idx, campo_a_columna, columnas


def _valor_texto(fila_valores: tuple, idx: dict, campo_a_columna: dict, campo: str) -> str | None:
    columna = campo_a_columna.get(campo)
    if not columna or columna not in idx or idx[columna] >= len(fila_valores):
        return None
    valor = fila_valores[idx[columna]]
    return str(valor).strip() if valor not in (None, "", "\xa0") else None


_FORMATOS_FECHA_TEXTO = ("%d/%m/%Y", "%Y-%m-%d")


def _valor_fecha(fila_valores: tuple, idx: dict, campo_a_columna: dict, campo: str) -> date | None:
    columna = campo_a_columna.get(campo)
    if not columna or columna not in idx or idx[columna] >= len(fila_valores):
        return None
    valor = fila_valores[idx[columna]]
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str):
        # Algunos exports oficiales (ej. PE-04 de SOFIA Plus) guardan la
        # fecha como texto "DD/MM/YYYY", no como celda de fecha real.
        for formato in _FORMATOS_FECHA_TEXTO:
            try:
                return datetime.strptime(valor.strip(), formato).date()
            except ValueError:
                continue
    return None


def _datos_complementarios_por_ficha(contenido: bytes) -> tuple[dict[str, dict], str]:
    """Lee un archivo complementario y devuelve {codigoFicha: {...}} con
    lo que traiga de nivel/coordinación/fechas -- para cruzar con el
    archivo principal por número de ficha. LIDERES DE FICHA no trae estos
    campos, pero por ejemplo la hoja FICHAS de PROGRAMACIÓN CGMLTI sí."""
    wb = openpyxl.load_workbook(BytesIO(contenido), data_only=True)
    ws, fila_encabezado, idx, campo_a_columna, _ = _clasificar_hoja(wb)

    datos: dict[str, dict] = {}
    for fila_valores in ws.iter_rows(min_row=fila_encabezado + 1, values_only=True):
        ficha_texto = _valor_texto(fila_valores, idx, campo_a_columna, "ficha")
        if not ficha_texto or not ficha_texto.isdigit():
            continue
        datos[ficha_texto] = {
            "nivelFormacion": _valor_texto(fila_valores, idx, campo_a_columna, "nivel_formacion"),
            "coordinacion": _valor_texto(fila_valores, idx, campo_a_columna, "coordinacion"),
            "codigoPrograma": _valor_texto(fila_valores, idx, campo_a_columna, "codigo_programa"),
            "fechaInicioLectiva": _valor_fecha(fila_valores, idx, campo_a_columna, "fecha_inicio_lectiva"),
            "fechaFinLectiva": _valor_fecha(fila_valores, idx, campo_a_columna, "fecha_fin_lectiva"),
            "fechaFinProductiva": _valor_fecha(fila_valores, idx, campo_a_columna, "fecha_fin_productiva"),
        }
    return datos, ws.title


def previsualizar_excel(
    db: Session,
    contenido: bytes,
    nombre_archivo: str,
    contenido_complementario: bytes | None = None,
    nombre_complementario: str | None = None,
) -> ImportarExcelPreviewResponse:
    wb = openpyxl.load_workbook(BytesIO(contenido), data_only=True)
    ws, fila_encabezado, idx, campo_a_columna, columnas = _clasificar_hoja(wb)

    datos_complementarios: dict[str, dict] = {}
    hoja_complementaria: str | None = None
    if contenido_complementario:
        datos_complementarios, hoja_complementaria = _datos_complementarios_por_ficha(contenido_complementario)

    filas: list[FilaImportada] = []
    for numero_fila, fila_valores in enumerate(
        ws.iter_rows(min_row=fila_encabezado + 1, values_only=True), start=fila_encabezado + 1
    ):
        if all(v in (None, "", "\xa0") for v in fila_valores):
            continue

        ficha_texto = _valor_texto(fila_valores, idx, campo_a_columna, "ficha")
        codigo_ficha: str | None = None
        id_ficha: int | None = None
        advertencia: str | None = None
        ficha_existe = False

        if ficha_texto is None:
            advertencia = "No se reconoció la columna de ficha en esta fila."
        elif not ficha_texto.isdigit():
            # Dato real sucio (ej. "3171645-65-668", celda combinada con
            # varias fichas) -- no es un codigoFicha válido de un vistazo.
            advertencia = f"Ficha en formato no reconocido ({ficha_texto!r}) -- requiere revisión manual."
        else:
            codigo_ficha = ficha_texto
            # codigoFicha es texto (el número real de SENA), NO el idFicha
            # interno -- son columnas distintas, nunca hay que buscar por PK acá.
            ficha_db = db.query(Ficha).filter(Ficha.codigoFicha == codigo_ficha).first()
            if ficha_db:
                ficha_existe = True
                id_ficha = ficha_db.idFicha
            else:
                advertencia = f"La ficha {codigo_ficha} no existe todavía en el catálogo de SIHS."

        extra = datos_complementarios.get(codigo_ficha, {}) if codigo_ficha else {}

        filas.append(
            FilaImportada(
                fila=numero_fila,
                codigoFicha=codigo_ficha,
                fichaExiste=ficha_existe,
                idFicha=id_ficha,
                programa=_valor_texto(fila_valores, idx, campo_a_columna, "programa"),
                jornada=_valor_texto(fila_valores, idx, campo_a_columna, "jornada"),
                instructorNombre=_valor_texto(fila_valores, idx, campo_a_columna, "instructor"),
                advertencia=advertencia,
                nivelFormacion=extra.get("nivelFormacion"),
                coordinacion=extra.get("coordinacion"),
                codigoPrograma=extra.get("codigoPrograma"),
                fechaInicioLectiva=extra.get("fechaInicioLectiva"),
                fechaFinLectiva=extra.get("fechaFinLectiva"),
                fechaFinProductiva=extra.get("fechaFinProductiva"),
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
        archivoComplementario=nombre_complementario if contenido_complementario else None,
        hojaComplementaria=hoja_complementaria,
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
    # Para distinguir "ya está todo programado" (tiene resultados, todos
    # con horario) de "este programa no tiene resultados de aprendizaje
    # definidos todavía" (nada que programar porque no hay currículo
    # cargado) -- son causas muy distintas y el mensaje debe decir cuál es.
    hay_programas_sin_resultados = False

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

        tiene_algun_resultado_definido = (
            db.query(CompetenciaFormacion.idCompetencia)
            .filter(CompetenciaFormacion.idPrograma == ficha.idPrograma)
            .first()
            is not None
        )
        if not tiene_algun_resultado_definido:
            hay_programas_sin_resultados = True

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
        if hay_programas_sin_resultados:
            mensaje = (
                "El programa de una o más de las fichas seleccionadas no tiene resultados de "
                "aprendizaje (competencias) definidos todavía -- no hay nada que programar hasta que "
                "se cargue ese contenido curricular."
            )
        else:
            mensaje = "Las fichas seleccionadas ya tienen todos sus resultados programados."
        return GenerarPropuestaResponse(bloques=[], factible=True, mensaje=mensaje)

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
