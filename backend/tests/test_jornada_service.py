"""JornadaService no tenia ninguna prueba propia (48% de cobertura). Mismo
motivo que TrimestreService/ProgramaService: metodos estaticos sin punto de
inyeccion. Requirio agregar Jornada a conftest.py -- ninguna prueba
anterior la necesitaba como tabla propia."""
from app.models.jornada import Jornada
from app.schemas.jornada import JornadaCreate, JornadaUpdate
from app.services.jornada_service import JornadaService


def _jornada(db, nombre="Mañana"):
    jornada = Jornada(nombreJornada=nombre)
    db.add(jornada)
    db.commit()
    return jornada


def test_obtener_todos_sin_jornadas_devuelve_lista_vacia(db_session):
    assert JornadaService.obtener_todos(db_session) == []


def test_obtener_todos_devuelve_las_jornadas_guardadas(db_session):
    _jornada(db_session)
    _jornada(db_session, nombre="Tarde")

    assert len(JornadaService.obtener_todos(db_session)) == 2


def test_obtener_por_id_existente(db_session):
    creada = _jornada(db_session)

    assert JornadaService.obtener_por_id(db_session, creada.idJornada) is creada


def test_obtener_por_id_inexistente_devuelve_none(db_session):
    assert JornadaService.obtener_por_id(db_session, 999) is None


def test_crear_persiste_la_jornada(db_session):
    creada = JornadaService.crear(db_session, JornadaCreate(nombreJornada="Noche"))

    assert creada.idJornada is not None
    assert JornadaService.obtener_por_id(db_session, creada.idJornada).nombreJornada == "Noche"


def test_actualizar_una_jornada_existente(db_session):
    creada = _jornada(db_session)

    actualizada = JornadaService.actualizar(db_session, creada.idJornada, JornadaUpdate(nombreJornada="Renombrada"))

    assert actualizada.nombreJornada == "Renombrada"


def test_actualizar_una_jornada_inexistente_devuelve_none(db_session):
    assert JornadaService.actualizar(db_session, 999, JornadaUpdate(nombreJornada="X")) is None


def test_eliminar_una_jornada_existente_devuelve_true_y_la_borra(db_session):
    creada = _jornada(db_session)

    assert JornadaService.eliminar(db_session, creada.idJornada) is True
    assert JornadaService.obtener_por_id(db_session, creada.idJornada) is None


def test_eliminar_una_jornada_inexistente_devuelve_false(db_session):
    assert JornadaService.eliminar(db_session, 999) is False
