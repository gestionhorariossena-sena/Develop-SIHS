"""Cableado del endpoint de importar currículo -- la lógica de parseo ya
se prueba a fondo en test_curriculo_service.py."""

from io import BytesIO

import openpyxl


def _xlsx_curriculo() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    for _ in range(15):
        ws.append([])
    ws.append(["FASE", "ACTIVIDAD", "COMPETENCIA", "RESULTADOS DE APRENDIZAJE"])
    ws.append([None, None, "Desarrollar componentes de software", "01. Diseñar el modelo de datos"])
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def test_importar_curriculo_requiere_autenticacion(client, db_session):
    respuesta = client.post(
        "/api/v1/competencias-formacion/importar-vista-previa",
        files={"archivo": ("c.xlsx", _xlsx_curriculo(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert respuesta.status_code in (401, 403)


def test_importar_curriculo_requiere_admin_no_solo_coordinador(client, db_session, autenticar_como):
    _, headers = autenticar_como("Coordinador")
    respuesta = client.post(
        "/api/v1/competencias-formacion/importar-vista-previa",
        files={"archivo": ("c.xlsx", _xlsx_curriculo(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )
    assert respuesta.status_code == 403


def test_importar_curriculo_devuelve_vista_previa(client, db_session, autenticar_como):
    _, headers = autenticar_como("Administrador")
    respuesta = client.post(
        "/api/v1/competencias-formacion/importar-vista-previa",
        files={"archivo": ("c.xlsx", _xlsx_curriculo(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["totalCompetencias"] == 1
    assert cuerpo["totalResultados"] == 1
