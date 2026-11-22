"""Pruebas de alta de instructores sin servicios externos."""
import io
import uuid

from openpyxl import Workbook

from app.api.v1 import alta_instructores
from app.models.usuario import Usuario


def _datos():
    return {"nombre": "Camila Rodríguez", "correo": "camila@sena.edu.co", "documento": "10334455", "sigla": "CR"}


def _excel(filas):
    libro = Workbook()
    hoja = libro.active
    hoja.append(["nombre", "correo", "documento", "tipoContrato", "horasContratadasSemana", "sigla"])
    for fila in filas:
        hoja.append(fila)
    archivo = io.BytesIO()
    libro.save(archivo)
    return archivo.getvalue()


def test_instructor_no_puede_registrar_otros_instructores(client, autenticar_como):
    _, headers = autenticar_como("Instructor")
    respuesta = client.post("/api/v1/instructores/alta/", headers=headers, json=_datos())
    assert respuesta.status_code == 403


def test_previa_excel_valida_errores_sin_crear_cuentas(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")
    archivo = _excel([
        ["Camila Rodríguez", "camila@sena.edu.co", "10334455", "planta", 32, "CR"],
        ["Falta correo", "", "10334456", "", "", ""],
    ])
    respuesta = client.post("/api/v1/instructores/alta/importar", headers=headers, files={"archivo": ("instructores.xlsx", archivo)})
    assert respuesta.status_code == 200
    assert respuesta.json()["confirmado"] is False
    assert respuesta.json()["validas"] == 1
    assert respuesta.json()["filas"][1]["valido"] is False


def test_duplicados_en_excel_invalidan_confirmacion(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    archivo = _excel([
        ["Camila Rodríguez", "camila@sena.edu.co", "10334455", "", "", ""],
        ["Otro nombre", "camila@sena.edu.co", "88884455", "", "", ""],
    ])
    respuesta = client.post("/api/v1/instructores/alta/importar", headers=headers, data={"confirmar": "true"}, files={"archivo": ("instructores.xlsx", archivo)})
    assert respuesta.status_code == 422


def test_excel_rechaza_documentos_duplicados(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")
    archivo = _excel([
        ["Laura", "laura@sena.edu.co", "12345678", "", "", ""],
        ["Pedro", "pedro@sena.edu.co", "12345678", "", "", ""],
    ])
    respuesta = client.post("/api/v1/instructores/alta/importar", headers=headers, files={"archivo": ("coordinacion.xlsx", archivo)})
    assert respuesta.status_code == 200
    assert respuesta.json()["validas"] == 1
    assert respuesta.json()["filas"][1]["error"] == "Documento duplicado dentro del Excel."


def test_no_crea_cuentas_si_smtp_no_esta_configurado(client, autenticar_como, monkeypatch):
    _, headers = autenticar_como("Coordinador")
    monkeypatch.setattr(alta_instructores.settings, "smtp_user", "")
    monkeypatch.setattr(alta_instructores.settings, "smtp_password", "")
    respuesta = client.post("/api/v1/instructores/alta/", headers=headers, json=_datos())
    assert respuesta.status_code == 503


def test_alta_individual_crea_instructor_y_no_devuelve_clave(
    client, crear_rol, autenticar_como, db_session, monkeypatch
):
    crear_rol("Instructor")
    _, headers = autenticar_como("Coordinador")
    id_nuevo = uuid.uuid4()
    enviados = []
    monkeypatch.setattr(alta_instructores.settings, "smtp_user", "prueba@sena.edu.co")
    monkeypatch.setattr(alta_instructores.settings, "smtp_password", "clave-de-prueba")
    monkeypatch.setattr(alta_instructores, "buscar_usuario_supabase_por_email", lambda correo: None)
    monkeypatch.setattr(alta_instructores, "crear_o_recuperar_usuario_supabase", lambda correo, clave: ({"id": str(id_nuevo)}, True))
    monkeypatch.setattr(alta_instructores.EmailService, "enviar_alta_instructor", lambda **kwargs: enviados.append(kwargs))

    respuesta = client.post("/api/v1/instructores/alta/", headers=headers, json=_datos())
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "creado"
    assert "password" not in str(respuesta.json()).lower()
    creado = db_session.get(Usuario, id_nuevo)
    assert creado.debeCambiarClave is True
    assert any(rol.nombre == "Instructor" for rol in creado.roles)
    assert len(enviados) == 1
    assert enviados[0]["destinatario_email"] == "camila@sena.edu.co"


def test_no_reasigna_cuenta_de_correo_existente(client, crear_rol, autenticar_como, monkeypatch):
    crear_rol("Instructor")
    _, headers = autenticar_como("Administrador")
    monkeypatch.setattr(alta_instructores.settings, "smtp_user", "prueba@sena.edu.co")
    monkeypatch.setattr(alta_instructores.settings, "smtp_password", "clave-de-prueba")
    monkeypatch.setattr(alta_instructores, "buscar_usuario_supabase_por_email", lambda correo: {"id": "existente"})
    respuesta = client.post("/api/v1/instructores/alta/", headers=headers, json=_datos())
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "omitido"
