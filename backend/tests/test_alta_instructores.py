"""Pruebas de alta de instructores sin servicios externos."""
import io
import uuid


from app.api.v1 import alta_instructores
from app.models.usuario import Usuario


def _datos():
    return {"nombre": "Camila Rodríguez", "correo": "camila@sena.edu.co", "documento": "10334455", "sigla": "CR"}


def _csv(filas, *, delimitador=",", encabezados=None, codificacion="utf-8-sig"):
    import csv

    salida = io.StringIO(newline="")
    escritor = csv.writer(salida, delimiter=delimitador, lineterminator="\r\n")
    escritor.writerow(encabezados or ["nombre", "correo", "documento", "contrato", "horas", "sigla"])
    escritor.writerows(filas)
    return salida.getvalue().encode(codificacion)


def test_instructor_no_puede_registrar_otros_instructores(client, autenticar_como):
    _, headers = autenticar_como("Instructor")
    respuesta = client.post("/api/v1/instructores/alta/", headers=headers, json=_datos())
    assert respuesta.status_code == 403


def test_previa_csv_valida_errores_sin_crear_cuentas(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")
    archivo = _csv([
        ["Camila Rodríguez", "camila@sena.edu.co", "10334455", "planta", 32, "CR"],
        ["Falta correo", "", "10334456", "", "", ""],
    ])
    respuesta = client.post("/api/v1/instructores/alta/importar", headers=headers, files={"archivo": ("instructores.csv", archivo)})
    assert respuesta.status_code == 200
    assert respuesta.json()["confirmado"] is False
    assert respuesta.json()["validas"] == 1
    assert respuesta.json()["filas"][1]["valido"] is False


def test_duplicados_en_csv_invalidan_confirmacion(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    archivo = _excel([
        ["Camila Rodríguez", "camila@sena.edu.co", "10334455", "planta", 32, ""],
        ["Otro nombre", "camila@sena.edu.co", "88884455", "contrato", 40, ""],
    ])
    respuesta = client.post("/api/v1/instructores/alta/importar", headers=headers, data={"confirmar": "true"}, files={"archivo": ("instructores.xlsx", archivo)})
    assert respuesta.status_code == 422


def test_csv_rechaza_documentos_duplicados(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")
    archivo = _excel([
        ["Laura", "laura@sena.edu.co", "12345678", "planta", 32, ""],
        ["Pedro", "pedro@sena.edu.co", "12345678", "contrato", 40, ""],
    ])
    respuesta = client.post("/api/v1/instructores/alta/importar", headers=headers, files={"archivo": ("coordinacion.csv", archivo)})
    assert respuesta.status_code == 200
    assert respuesta.json()["validas"] == 1
    assert respuesta.json()["filas"][1]["error"] == "Documento duplicado dentro del Excel."


def test_no_crea_cuentas_si_smtp_no_esta_configurado(client, autenticar_como, monkeypatch):
    _, headers = autenticar_como("Coordinador")
    monkeypatch.setattr(alta_instructores.settings, "app_env", "development")
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
    monkeypatch.setattr(alta_instructores.settings, "supabase_url", "http://supabase.local")
    monkeypatch.setattr(alta_instructores.settings, "supabase_service_role_key", "test-service-key")
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
    monkeypatch.setattr(alta_instructores.settings, "supabase_url", "http://supabase.local")
    monkeypatch.setattr(alta_instructores.settings, "supabase_service_role_key", "test-service-key")
    monkeypatch.setattr(alta_instructores.settings, "smtp_user", "prueba@sena.edu.co")
    monkeypatch.setattr(alta_instructores.settings, "smtp_password", "clave-de-prueba")
    monkeypatch.setattr(alta_instructores, "buscar_usuario_supabase_por_email", lambda correo: {"id": "existente"})
    respuesta = client.post("/api/v1/instructores/alta/", headers=headers, json=_datos())
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "omitido"


def _preview(client, headers, archivo, nombre="instructores.csv"):
    return client.post(
        "/api/v1/instructores/alta/importar", headers=headers,
        files={"archivo": (nombre, archivo, "text/csv")},
    )


def test_csv_comas_y_punto_y_coma_con_comillas_y_saltos(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    for separador in (",", ";"):
        archivo = _csv([
            ["María, del Pilar\nGómez", "maria@example.com", "10334455", "planta", 32, "MP"],
        ], delimitador=separador)
        respuesta = _preview(client, headers, archivo)
        assert respuesta.status_code == 200
        assert respuesta.json()["validas"] == 1
        assert respuesta.json()["filas"][0]["datos"]["nombre"] == "María, del Pilar\nGómez"


def test_csv_utf8_bom_y_alias_de_encabezados(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    archivo = _csv([
        ["Ángela María", "angela@example.com", "10445566", "contrato", 40, "AM"],
    ], encabezados=[" NÓMBRE ", "EMAIL", " Documento ", "tipo_contrato", "horas_contratadas_semana", "SIGLA"])
    respuesta = _preview(client, headers, archivo)
    assert respuesta.status_code == 200
    assert respuesta.json()["validas"] == 1
    datos = respuesta.json()["filas"][0]["datos"]
    assert datos["tipoContrato"] == "contrato"
    assert datos["horasContratadasSemana"] == 40


def test_csv_windows_1252_con_tildes(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")
    archivo = _csv([
        ["Peña Muñoz", "pena@example.com", "10445567", "planta", 32, "PM"],
    ], codificacion="cp1252", delimitador=";")
    respuesta = _preview(client, headers, archivo)
    assert respuesta.status_code == 200
    assert respuesta.json()["filas"][0]["datos"]["nombre"] == "Peña Muñoz"


def test_csv_faltan_columnas_obligatorias(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    archivo = _csv([
        ["Ana Torres", "ana@example.com", "10334455"],
    ], encabezados=["nombre", "correo", "documento"])
    respuesta = _preview(client, headers, archivo)
    assert respuesta.status_code == 422
    assert "contrato" in respuesta.json()["detail"]
    assert "horas" in respuesta.json()["detail"]


def test_rechaza_excel_xlsx(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    respuesta = _preview(client, headers, b"PK\\x03\\x04", "instructores.xlsx")
    assert respuesta.status_code == 422
    assert ".csv" in respuesta.json()["detail"]


def test_detecta_documento_y_correo_duplicados(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    archivo = _csv([
        ["Uno Prueba", "a@example.com", "11111111", "planta", 32, ""],
        ["Dos Prueba", "a@example.com", "22222222", "planta", 32, ""],
        ["Tres Prueba", "c@example.com", "11111111", "planta", 32, ""],
    ])
    respuesta = _preview(client, headers, archivo)
    assert respuesta.status_code == 200
    assert respuesta.json()["validas"] == 1
    assert "Correo duplicado" in respuesta.json()["filas"][1]["error"]
    assert "Documento duplicado" in respuesta.json()["filas"][2]["error"]


def test_vista_previa_no_crea_cuentas_ni_envia_correos(client, autenticar_como, monkeypatch):
    _, headers = autenticar_como("Coordinador")
    def fallo(*args, **kwargs):
        raise AssertionError("No se deben crear cuentas o enviar correos en la vista previa")
    monkeypatch.setattr(alta_instructores, "_alta", fallo)
    monkeypatch.setattr(alta_instructores.EmailService, "enviar_alta_instructor", fallo)
    respuesta = _preview(client, headers, _csv([
        ["Laura Prueba", "laura@example.com", "12345678", "planta", 32, ""],
    ]))
    assert respuesta.status_code == 200
    assert respuesta.json()["validas"] == 1


def test_csv_limite_200_filas(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    filas = [[f"Instructor {n}", f"instructor{n}@example.com", str(10000000 + n), "planta", 32, ""] for n in range(201)]
    respuesta = _preview(client, headers, _csv(filas))
    assert respuesta.status_code == 422
    assert "200" in respuesta.json()["detail"]


def test_csv_maximo_2mb(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    respuesta = _preview(client, headers, b"a" * (2 * 1024 * 1024 + 1))
    assert respuesta.status_code == 413


def test_csv_acepta_encabezados_camel_case(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    archivo = _csv([
        ["Juan Carlos", "juan@example.com", "11002233", "planta", 32, ""],
    ], encabezados=["nombre", "correo", "documento", "tipoContrato", "horasContratadasSemana", "sigla"])
    respuesta = _preview(client, headers, archivo)
    assert respuesta.status_code == 200
    assert respuesta.json()["validas"] == 1

