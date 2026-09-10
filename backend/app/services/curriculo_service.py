"""Importa contenido curricular (competencias + resultados de
aprendizaje) real desde el "Formato Planeación Pedagógica" de SENA --
ver PLAN_INTEGRACION_IA.md. Sin IA a propósito: el formato tiene
encabezados fijos ("COMPETENCIA" / "RESULTADOS DE APRENDIZAJE"), no hace
falta clasificación semántica para reconocerlo -- validado contra dos
archivos reales del usuario (27 resultados / 7 competencias, y una
variante similar).

Solo `previsualizar_curriculo` -- no persiste nada. El frontend confirma
llamando a POST /competencias-formacion/ y POST /resultados-aprendizaje/
(ya existentes) por cada fila, igual que ImportarArchivo.tsx hace para
otros catálogos -- no hace falta un endpoint de "crear todo junto"
nuevo.

Fases del pénsum (2026-09-10): el archivo real "Planeación Cadena de
Formación.xlsx" trae, además de la hoja combinada con todo el pénsum
("Planeacion Cadena", que es la que se leía antes de este cambio, sin
ninguna fase), hojas separadas por trimestre ("TRIM I".."TRIM IV") con
el mismo formato de columnas. Cuando existen esas hojas se usan en vez
de la combinada: cada resultado queda etiquetado con su
`numeroFase` (1=TRIM I..4=TRIM IV) -- necesario para que
`generar_propuesta` no intente programar los ~30 resultados de todo un
programa de 2 años en una sola semana (ver el bug real documentado en
PLAN_INTEGRACION_IA.md). Un mismo resultado puede aparecer en dos hojas
de trimestre consecutivas en el Excel real (se dicta progresivamente) --
eso se respeta tal cual: dos filas, una por fase.
"""

import re
from io import BytesIO

import openpyxl

from app.schemas.curriculo import CompetenciaExtraida, PreviewCurriculoResponse, ResultadoExtraido

_FILAS_A_BUSCAR_ENCABEZADO = 30

_ROMANOS_A_NUMERO = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}
_PATRON_HOJA_TRIMESTRE = re.compile(r"^TRIM\.?\s*([IVX]+)$", re.IGNORECASE)


def _numero_fase_de_hoja(nombre_hoja: str) -> int | None:
    coincidencia = _PATRON_HOJA_TRIMESTRE.match(nombre_hoja.strip())
    if not coincidencia:
        return None
    return _ROMANOS_A_NUMERO.get(coincidencia.group(1).upper())


def _fila_encabezado_curriculo(ws) -> tuple[int, int, int, int | None] | None:
    """Busca la fila con los encabezados "COMPETENCIA" y "RESULTADOS DE
    APRENDIZAJE" (pueden estar en cualquier columna). Devuelve
    (fila, columna_competencia, columna_resultados, columna_horas) o
    None si no aparecen -- este archivo no es de este formato."""
    for fila in range(1, min(ws.max_row, _FILAS_A_BUSCAR_ENCABEZADO) + 1):
        valores = [str(c.value).strip().upper() if c.value not in (None, "") else "" for c in ws[fila]]
        if "COMPETENCIA" not in valores:
            continue
        idx_resultados = next((i for i, v in enumerate(valores) if "RESULTADOS DE APRENDIZAJE" in v), None)
        if idx_resultados is None:
            continue
        idx_competencia = valores.index("COMPETENCIA")
        idx_horas = next((i for i, v in enumerate(valores) if "DURACIÓN" in v or "DURACION" in v), None)
        return fila, idx_competencia, idx_resultados, idx_horas
    return None


def _extraer_de_hoja(
    ws,
    numero_fase: int | None,
    resultados_por_competencia: dict[str, list[ResultadoExtraido]],
    orden_competencias: list[str],
) -> None:
    encabezado = _fila_encabezado_curriculo(ws)
    if encabezado is None:
        return
    fila_encabezado, idx_competencia, idx_resultados, idx_horas = encabezado

    # COMPETENCIA suele venir en celdas combinadas -- el valor solo
    # aparece en la primera fila del grupo, las siguientes están vacías
    # (mismo patrón que Excel real de SENA en ambos archivos probados).
    competencia_actual: str | None = None

    for fila_valores in ws.iter_rows(min_row=fila_encabezado + 1, values_only=True):
        valor_competencia = fila_valores[idx_competencia] if idx_competencia < len(fila_valores) else None
        valor_resultado = fila_valores[idx_resultados] if idx_resultados < len(fila_valores) else None

        if valor_competencia not in (None, ""):
            competencia_actual = str(valor_competencia).strip()
            if competencia_actual not in resultados_por_competencia:
                resultados_por_competencia[competencia_actual] = []
                orden_competencias.append(competencia_actual)

        if valor_resultado in (None, "") or competencia_actual is None:
            continue

        horas = None
        if idx_horas is not None and idx_horas < len(fila_valores):
            valor_horas = fila_valores[idx_horas]
            if isinstance(valor_horas, (int, float)):
                horas = int(valor_horas)

        resultados_por_competencia[competencia_actual].append(
            ResultadoExtraido(descripcion=str(valor_resultado).strip(), horasAsignadas=horas, numeroFase=numero_fase)
        )


def previsualizar_curriculo(contenido: bytes, nombre_archivo: str) -> PreviewCurriculoResponse:
    wb = openpyxl.load_workbook(BytesIO(contenido), data_only=True)

    hojas_trimestre = [
        (ws, _numero_fase_de_hoja(ws.title)) for ws in wb.worksheets if _numero_fase_de_hoja(ws.title) is not None
    ]

    resultados_por_competencia: dict[str, list[ResultadoExtraido]] = {}
    orden_competencias: list[str] = []

    if hojas_trimestre:
        # Preferir las hojas por trimestre (TRIM I..IV) sobre la hoja
        # combinada -- traen la fase de cada resultado, la combinada no.
        hojas_trimestre.sort(key=lambda par: par[1])
        for ws, numero_fase in hojas_trimestre:
            _extraer_de_hoja(ws, numero_fase, resultados_por_competencia, orden_competencias)
        nombre_hoja_reportado = ", ".join(ws.title for ws, _ in hojas_trimestre)
    else:
        ws = wb.worksheets[0]
        _extraer_de_hoja(ws, None, resultados_por_competencia, orden_competencias)
        nombre_hoja_reportado = ws.title

    if not orden_competencias:
        raise ValueError(
            'No se encontraron las columnas "COMPETENCIA" y "RESULTADOS DE APRENDIZAJE" en este '
            "archivo -- no parece ser un Formato de Planeación Pedagógica."
        )

    competencias = [
        CompetenciaExtraida(descripcion=nombre, resultados=resultados_por_competencia[nombre])
        for nombre in orden_competencias
        if resultados_por_competencia[nombre]
    ]

    return PreviewCurriculoResponse(
        nombreArchivo=nombre_archivo,
        hoja=nombre_hoja_reportado,
        competencias=competencias,
        totalCompetencias=len(competencias),
        totalResultados=sum(len(c.resultados) for c in competencias),
    )
