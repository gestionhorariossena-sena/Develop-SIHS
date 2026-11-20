"""ProgramaService no tenia ninguna prueba propia (42% de cobertura, solo
por el uso incidental de otros tests). Mismo motivo que TrimestreService:
metodos estaticos sin punto de inyeccion, se prueba contra la BD real de
pruebas en vez de un repositorio falso."""
from app.models.programa import Programa
from app.schemas.programa import ProgramaCreate, ProgramaUpdate
from app.services.programa_service import ProgramaService


def _programa(db, codigo="ADSO"):
    programa = Programa(codigoPrograma=codigo, nombrePrograma=f"Programa {codigo}", nivelFormacion="Tecnólogo", activo=True, idCoordinacion=1)
    db.add(programa)
    db.commit()
    return programa


def test_obtener_todos_sin_programas_devuelve_lista_vacia(db_session):
    assert ProgramaService.obtener_todos(db_session) == []


def test_obtener_todos_devuelve_los_programas_guardados(db_session):
    _programa(db_session)
    _programa(db_session, codigo="COCI")

    assert len(ProgramaService.obtener_todos(db_session)) == 2


def test_obtener_por_id_existente(db_session):
    creado = _programa(db_session)

    assert ProgramaService.obtener_por_id(db_session, creado.idPrograma) is creado


def test_obtener_por_id_inexistente_devuelve_none(db_session):
    assert ProgramaService.obtener_por_id(db_session, 999) is None


def test_crear_persiste_el_programa(db_session):
    datos = ProgramaCreate(codigoPrograma="TEIN", nombrePrograma="Teleinformática", nivelFormacion="Tecnólogo", activo=True, idCoordinacion=1)

    creado = ProgramaService.crear(db_session, datos)

    assert creado.idPrograma is not None
    assert ProgramaService.obtener_por_id(db_session, creado.idPrograma).nombrePrograma == "Teleinformática"


def test_actualizar_un_programa_existente(db_session):
    creado = _programa(db_session)
    datos = ProgramaUpdate(codigoPrograma="ADSO", nombrePrograma="Renombrado", nivelFormacion="Tecnólogo", activo=False, idCoordinacion=2)

    actualizado = ProgramaService.actualizar(db_session, creado.idPrograma, datos)

    assert actualizado.nombrePrograma == "Renombrado"
    assert actualizado.activo is False
    assert actualizado.idCoordinacion == 2


def test_actualizar_un_programa_inexistente_devuelve_none(db_session):
    datos = ProgramaUpdate(codigoPrograma="X", nombrePrograma="X", idCoordinacion=1)

    assert ProgramaService.actualizar(db_session, 999, datos) is None


def test_eliminar_un_programa_existente_devuelve_true_y_lo_borra(db_session):
    creado = _programa(db_session)

    assert ProgramaService.eliminar(db_session, creado.idPrograma) is True
    assert ProgramaService.obtener_por_id(db_session, creado.idPrograma) is None


def test_eliminar_un_programa_inexistente_devuelve_false(db_session):
    assert ProgramaService.eliminar(db_session, 999) is False
