"""Servicio de importación de currículo (competencias + resultados).
Sin IA -- prueba directamente con Excel sintéticos que imitan el
Formato de Planeación Pedagógica real de SENA."""

from io import BytesIO

import openpyxl
import pytest

from app.services.curriculo_service import previsualizar_curriculo


def _xlsx_curriculo(filas_encabezado_extra: int = 18) -> bytes:
    """Imita el formato real: título/metadatos arriba, encabezado
    "COMPETENCIA" / "RESULTADOS DE APRENDIZAJE" en la fila 16, datos con
    COMPETENCIA en celdas combinadas (vacía salvo la primera fila del
    grupo)."""
    wb = openpyxl.Workbook()
    ws = wb.active
    for _ in range(15):
        ws.append([])
    ws.append(["FASE", "ACTIVIDAD", "COMPETENCIA", "RESULTADOS DE APRENDIZAJE", "DURACIÓN ACTIVIDAD (HORAS)"])
    ws.append([None, None, None, None, None])
    ws.append([None, None, "Desarrollar componentes de software", "01. Diseñar el modelo de datos", 66])
    ws.append([None, None, None, "02. Construir la base de datos", None])
    ws.append([None, None, "Construir interfaces de usuario", "01. Elaborar prototipos", 40])
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def test_previsualizar_curriculo_agrupa_resultados_por_competencia():
    contenido = _xlsx_curriculo()

    resultado = previsualizar_curriculo(contenido, "curriculo.xlsx")

    assert resultado.totalCompetencias == 2
    assert resultado.totalResultados == 3
    assert resultado.competencias[0].descripcion == "Desarrollar componentes de software"
    assert len(resultado.competencias[0].resultados) == 2
    assert resultado.competencias[0].resultados[0].descripcion == "01. Diseñar el modelo de datos"
    assert resultado.competencias[0].resultados[0].horasAsignadas == 66
    assert resultado.competencias[0].resultados[1].horasAsignadas is None
    assert resultado.competencias[1].descripcion == "Construir interfaces de usuario"
    assert len(resultado.competencias[1].resultados) == 1


def _agregar_hoja_trim(wb, nombre_hoja: str, filas: list[tuple]) -> None:
    ws = wb.create_sheet(nombre_hoja)
    for _ in range(15):
        ws.append([])
    ws.append(["FASE", "ACTIVIDAD", "COMPETENCIA", "RESULTADOS DE APRENDIZAJE", "DURACIÓN ACTIVIDAD (HORAS)"])
    ws.append([None, None, None, None, None])
    for fila in filas:
        ws.append(list(fila))


def test_previsualizar_curriculo_con_hojas_por_trimestre_etiqueta_la_fase():
    # Reproduce el archivo real "Planeación Cadena de Formación.xlsx":
    # hoja combinada sin fase (que se ignora si hay hojas TRIM) + hojas
    # TRIM I/TRIM II, con un resultado que se repite en ambas (se dicta
    # progresivamente) -- debe quedar como dos filas, una por fase.
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    _agregar_hoja_trim(
        wb, "TRIM I",
        [
            (None, None, "Desarrollar componentes de software", "01. Diseñar el modelo de datos", 66),
            (None, None, None, "02. Construir la base de datos", None),
        ],
    )
    _agregar_hoja_trim(
        wb, "TRIM II",
        [
            (None, None, "Desarrollar componentes de software", "02. Construir la base de datos", None),
            (None, None, "Construir interfaces de usuario", "01. Elaborar prototipos", 40),
        ],
    )
    buffer = BytesIO()
    wb.save(buffer)

    resultado = previsualizar_curriculo(buffer.getvalue(), "cadena.xlsx")

    assert resultado.hoja == "TRIM I, TRIM II"
    assert resultado.totalCompetencias == 2
    competencia_software = resultado.competencias[0]
    assert competencia_software.descripcion == "Desarrollar componentes de software"
    # 3 filas: "01. Diseñar..." (fase 1), "02. Construir..." (fase 1) y
    # "02. Construir..." otra vez (fase 2, repetido en TRIM II).
    assert len(competencia_software.resultados) == 3
    assert competencia_software.resultados[0].numeroFase == 1
    assert competencia_software.resultados[1].numeroFase == 1
    assert competencia_software.resultados[2].numeroFase == 2
    assert competencia_software.resultados[2].descripcion == "02. Construir la base de datos"

    competencia_interfaces = resultado.competencias[1]
    assert competencia_interfaces.resultados[0].numeroFase == 2


def test_previsualizar_curriculo_sin_hojas_trim_no_etiqueta_fase():
    contenido = _xlsx_curriculo()

    resultado = previsualizar_curriculo(contenido, "curriculo.xlsx")

    assert all(r.numeroFase is None for c in resultado.competencias for r in c.resultados)


def test_previsualizar_curriculo_archivo_sin_formato_reconocible_lanza_error():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["FICHA", "PROGRAMA"])
    ws.append([100, "ADSO"])
    buffer = BytesIO()
    wb.save(buffer)

    with pytest.raises(ValueError, match="Formato de Planeación Pedagógica"):
        previsualizar_curriculo(buffer.getvalue(), "archivo.xlsx")
