"""Verificación del cargador Excel de aprendices sin crear identidades reales."""
import io
from openpyxl import Workbook

from app.api.v1 import alta_aprendices


def _excel(filas):
    libro = Workbook()
    hoja = libro.active
    hoja.append(["nombre", "correo", "documento", "codigoFicha", "programaFormacion", "claveDemoLocal"])
    for fila in filas:
        hoja.append(fila)
    salida = io.BytesIO()
    libro.save(salida)
    return salida.getvalue()


def test_reconoce_excel_piloto_e_ignora_clave_demo():
    filas = alta_aprendices._leer_excel(_excel([
        ["Aprendiz Prueba", "aprendiz@example.com", "91000001", "3407178", "", "Demo123!"]
    ]))
    assert len(filas) == 1
    assert filas[0]["valido"]
    assert filas[0]["datos"]["codigoFicha"] == "3407178"
    assert "claveDemoLocal" not in filas[0]["datos"]
    assert "Demo123!" not in str(filas)


def test_detecta_duplicado_por_documento_en_excel():
    filas = alta_aprendices._leer_excel(_excel([
        ["Aprendiz Uno", "a@example.com", "91000001", "3407178", "", ""],
        ["Aprendiz Dos", "b@example.com", "91000001", "3407179", "", ""],
    ]))
    assert filas[0]["valido"] is True
    assert filas[1]["valido"] is False
    assert "duplicado" in filas[1]["error"].lower()


def test_bloquea_importacion_si_no_hay_permiso(client, autenticar_como):
    _, headers = autenticar_como("Instructor")
    respuesta = client.post(
        "/api/v1/aprendices/alta/importar", headers=headers,
        files={"archivo": ("aprendices.xlsx", _excel([
            ["Aprendiz Uno", "a@example.com", "91000001", "3407178", "", ""]
        ]))},
    )
    assert respuesta.status_code == 403


def test_preview_valida_ficha_antes_de_crear(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    respuesta = client.post(
        "/api/v1/aprendices/alta/importar", headers=headers,
        files={"archivo": ("aprendices.xlsx", _excel([
            ["Aprendiz Uno", "a@example.com", "91000001", "FICHA-QUE-NO-EXISTE", "", ""]
        ]))},
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["validas"] == 0
    assert "no existe" in respuesta.json()["filas"][0]["error"].lower()
