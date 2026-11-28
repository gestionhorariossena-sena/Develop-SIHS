"""TrimestreService no tenia ninguna prueba propia (47% de cobertura, solo
por el uso incidental de otros tests). Usa la BD real de pruebas (SQLite en
memoria) porque sus metodos son estaticos y delegan directo en
TrimestreRepository, sin punto de inyeccion -- no hay un repositorio para
reemplazar como en SedeService."""
from datetime import date

from app.models.trimestre import Trimestre
from app.schemas.trimestre import TrimestreCreate, TrimestreUpdate
from app.services.trimestre_service import TrimestreService


def _trimestre(db, nombre="Trimestre 1"):
    trimestre = Trimestre(nombre=nombre, fechaInicio=date(2026, 1, 1), fechaFin=date(2026, 3, 31), estado="planeado")
    db.add(trimestre)
    db.commit()
    return trimestre


def test_obtener_todos_sin_trimestres_devuelve_lista_vacia(db_session):
    assert TrimestreService.obtener_todos(db_session) == []


def test_obtener_todos_devuelve_los_trimestres_guardados(db_session):
    _trimestre(db_session)
    _trimestre(db_session, nombre="Trimestre 2")

    assert len(TrimestreService.obtener_todos(db_session)) == 2


def test_obtener_por_id_existente(db_session):
    creado = _trimestre(db_session)

    assert TrimestreService.obtener_por_id(db_session, creado.idTrimestre) is creado


def test_obtener_por_id_inexistente_devuelve_none(db_session):
    assert TrimestreService.obtener_por_id(db_session, 999) is None


def test_crear_persiste_el_trimestre(db_session):
    datos = TrimestreCreate(nombre="Trimestre 3", fechaInicio=date(2026, 4, 1), fechaFin=date(2026, 6, 30), estado="activo")

    creado = TrimestreService.crear(db_session, datos)

    assert creado.idTrimestre is not None
    assert TrimestreService.obtener_por_id(db_session, creado.idTrimestre).nombre == "Trimestre 3"


def test_actualizar_un_trimestre_existente(db_session):
    creado = _trimestre(db_session)
    datos = TrimestreUpdate(nombre="Renombrado", fechaInicio=date(2026, 1, 1), fechaFin=date(2026, 3, 31), estado="finalizado")

    actualizado = TrimestreService.actualizar(db_session, creado.idTrimestre, datos)

    assert actualizado.nombre == "Renombrado"
    assert actualizado.estado == "finalizado"


def test_actualizar_un_trimestre_inexistente_devuelve_none(db_session):
    datos = TrimestreUpdate(nombre="X", fechaInicio=date(2026, 1, 1), fechaFin=date(2026, 3, 31))

    assert TrimestreService.actualizar(db_session, 999, datos) is None


def test_eliminar_un_trimestre_existente_devuelve_true_y_lo_borra(db_session):
    creado = _trimestre(db_session)

    assert TrimestreService.eliminar(db_session, creado.idTrimestre) is True
    assert TrimestreService.obtener_por_id(db_session, creado.idTrimestre) is None


def test_eliminar_un_trimestre_inexistente_devuelve_false(db_session):
    assert TrimestreService.eliminar(db_session, 999) is False
