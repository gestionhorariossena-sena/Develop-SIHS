import csv
import io

from app.models.solicitud_acceso import SolicitudAcceso


def _crear_solicitud(db_session, rol, *, nombre="Maritza Benítez", estado="pendiente", motivo_rechazo=None):
    solicitud = SolicitudAcceso(
        nombre=nombre,
        email=f"{nombre.lower().replace(' ', '.')}@sena.edu.co",
        numeroDocumento="1234567890",
        idRolSolicitado=rol.idRol,
        motivo="Necesito acceso para coordinar la ficha.",
        estado=estado,
        motivoRechazo=motivo_rechazo,
    )
    db_session.add(solicitud)
    db_session.commit()
    db_session.refresh(solicitud)
    return solicitud


def test_exportar_requiere_admin(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get("/api/v1/solicitudes-acceso/exportar", headers=headers)

    assert respuesta.status_code == 403


def test_exportar_devuelve_csv_con_todas_las_solicitudes(client, autenticar_como, crear_rol, db_session):
    rol = crear_rol("Coordinador")
    _crear_solicitud(db_session, rol, nombre="Maritza Benítez", estado="pendiente")
    _crear_solicitud(
        db_session, rol, nombre="Mauricio Ríos", estado="rechazada", motivo_rechazo="Correo no institucional"
    )
    _, headers = autenticar_como("Administrador")

    respuesta = client.get("/api/v1/solicitudes-acceso/exportar", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"].startswith("text/csv")
    assert "attachment" in respuesta.headers["content-disposition"]

    filas = list(csv.reader(io.StringIO(respuesta.text)))
    encabezado, *datos = filas
    assert encabezado[0] == "idSolicitud"
    assert len(datos) == 2
    nombres = {fila[1] for fila in datos}
    assert nombres == {"Maritza Benítez", "Mauricio Ríos"}


def test_exportar_filtra_por_estado(client, autenticar_como, crear_rol, db_session):
    rol = crear_rol("Instructor")
    _crear_solicitud(db_session, rol, nombre="Gabriel Ospina", estado="pendiente")
    _crear_solicitud(db_session, rol, nombre="Jorge Herrera", estado="aprobada")
    _, headers = autenticar_como("Administrador")

    respuesta = client.get("/api/v1/solicitudes-acceso/exportar?estado=aprobada", headers=headers)

    assert respuesta.status_code == 200
    filas = list(csv.reader(io.StringIO(respuesta.text)))
    _, *datos = filas
    assert len(datos) == 1
    assert datos[0][1] == "Jorge Herrera"
    assert datos[0][6] == "aprobada"
