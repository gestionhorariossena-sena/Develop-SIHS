from app.services.importacion_instructores_service import ImportacionInstructoresService
from app.models.rol import Rol
from app.models.lote_importacion_instructor import LoteImportacionInstructor
from app.models.horario import Horario
from app.models.usuario import Usuario
import uuid


def test_lee_csv_de_instructores_valido():
    filas, errores = ImportacionInstructoresService.leer_csv(
        b"documento,nombre,correo,contrato,horas,especialidades\n"
        b"1001,Ana Perez,ana@sena.edu.co,planta,32,Desarrollo de software;Redes\n"
    )
    assert errores == []
    assert filas[0]["especialidades"] == ["Desarrollo de software", "Redes"]
    assert filas[0]["horas"] == 32


def test_rechaza_tope_y_documento_duplicado():
    filas, errores = ImportacionInstructoresService.leer_csv(
        b"documento,nombre,correo,contrato,horas\n"
        b"1001,Ana Perez,ana@sena.edu.co,planta,32\n"
        b"1001,Bea Perez,bea@sena.edu.co,contrato,40\n"
        b"1002,Camila Perez,camila@sena.edu.co,planta,40\n"
    )
    assert len(filas) == 1
    assert len(errores) == 2
    mensajes = [error["mensaje"] for error in errores]
    assert any("horas" in mensaje for mensaje in mensajes)
    assert any("duplicado" in mensaje for mensaje in mensajes)


def test_importa_filas_validas_aunque_otras_tengan_errores(db_session, monkeypatch):
    db_session.add(Rol(nombre="Instructor"))
    db_session.commit()
    monkeypatch.setattr(
        "app.services.importacion_instructores_service.crear_o_recuperar_usuario_supabase",
        lambda correo, clave: ({"id": str(uuid.uuid4())}, True),
    )

    resultado = ImportacionInstructoresService.importar(
        db_session,
        b"documento,nombre,correo,contrato,horas\n"
        b"1001,Ana Perez,ana@sena.edu.co,planta,32\n"
        b"1002,Bea Perez,bea@sena.edu.co,planta,40\n",
    )

    assert resultado["creados"] == 1
    assert resultado["existentes"] == 0
    assert resultado["idLote"] is not None
    assert resultado["errores"] == [{"fila": 3, "mensaje": "horas debe ser 32 para planta o 40 para contrato"}]
    assert db_session.query(Usuario).filter(Usuario.numeroDocumento == "1001").one()


def test_rechaza_archivo_que_no_es_utf8():
    filas, errores = ImportacionInstructoresService.leer_csv(b"\xff\xfe")
    assert filas == []
    assert errores == [{"fila": 0, "mensaje": "El archivo debe estar codificado en UTF-8."}]


def test_lote_se_puede_eliminar_si_no_tiene_horarios(db_session, monkeypatch):
    lote = LoteImportacionInstructor()
    db_session.add(lote)
    db_session.flush()
    instructor = Usuario(
        idUsuario=uuid.uuid4(), nombre="Importado", email="importado@example.com",
        idLoteImportacionInstructor=lote.idLote, creadoAuthPorLote=True,
    )
    db_session.add(instructor)
    db_session.commit()
    eliminados_auth = []
    monkeypatch.setattr(
        "app.services.importacion_instructores_service.eliminar_usuario_supabase",
        lambda id_usuario: eliminados_auth.append(id_usuario),
    )

    resultado = ImportacionInstructoresService.eliminar_lote(db_session, lote.idLote)

    assert resultado == {"eliminados": 1}
    assert eliminados_auth == [str(instructor.idUsuario)]
    assert db_session.get(Usuario, instructor.idUsuario) is None


def test_lote_no_se_elimina_si_el_instructor_ya_tiene_horarios(db_session, monkeypatch):
    lote = LoteImportacionInstructor()
    db_session.add(lote)
    db_session.flush()
    instructor = Usuario(
        idUsuario=uuid.uuid4(), nombre="Importado", email="ocupado@example.com",
        idLoteImportacionInstructor=lote.idLote, creadoAuthPorLote=True,
    )
    db_session.add(instructor)
    db_session.commit()
    # No es necesario persistir un horario completo: la consulta se sustituye
    # para aislar esta regla de las FK no relevantes para el lote.
    class ConsultaConHorario:
        def filter(self, *_): return self
        def first(self): return object()
    consulta_original = db_session.query
    monkeypatch.setattr(db_session, "query", lambda modelo: ConsultaConHorario() if modelo is Horario else consulta_original(modelo))
    eliminar_auth = monkeypatch.setattr(
        "app.services.importacion_instructores_service.eliminar_usuario_supabase",
        lambda _: (_ for _ in ()).throw(AssertionError("No debe borrar Auth")),
    )

    try:
        ImportacionInstructoresService.eliminar_lote(db_session, lote.idLote)
        assert False, "Se esperaba bloqueo por horario"
    except ValueError as error:
        assert "horarios asignados" in str(error)
    assert db_session.get(Usuario, instructor.idUsuario) is not None
