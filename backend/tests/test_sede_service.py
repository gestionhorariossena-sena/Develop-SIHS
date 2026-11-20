"""SedeService no tenía ninguna prueba propia (0% antes de este archivo) --
inyecta un repositorio falso en vez de tocar la BD real, mismo patrón que
AsistenciaGateway en el cliente móvil: aísla la lógica de SedeService
(404/409, delegación) de SedeRepository, que ya tiene su propio dueño."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.sede import SedeCreate, SedeUpdate
from app.services.sede_service import SedeService

# El servicio llama db.rollback() en el except IntegrityError -- con
# repositorio falso no hay sesión real, solo hace falta que ese método exista.
_DB = SimpleNamespace(rollback=lambda: None)


class _RepositorioFalso:
    def __init__(self, sedes=None, fallar_en: set[str] = frozenset()):
        self.sedes = sedes or {}
        self.fallar_en = fallar_en
        self.llamadas = []

    def list(self, db):
        self.llamadas.append(("list",))
        return list(self.sedes.values())

    def get(self, db, sede_id):
        self.llamadas.append(("get", sede_id))
        return self.sedes.get(sede_id)

    def create(self, db, data):
        self.llamadas.append(("create", data))
        if "create" in self.fallar_en:
            raise IntegrityError("insert", {}, Exception("duplicado"))
        sede = SimpleNamespace(id=99, **data.model_dump(by_alias=False))
        self.sedes[99] = sede
        return sede

    def update(self, db, sede, data):
        self.llamadas.append(("update", sede, data))
        if "update" in self.fallar_en:
            raise IntegrityError("update", {}, Exception("duplicado"))
        for campo, valor in data.model_dump(by_alias=False).items():
            setattr(sede, campo, valor)
        return sede

    def delete(self, db, sede):
        self.llamadas.append(("delete", sede))
        if "delete" in self.fallar_en:
            raise IntegrityError("delete", {}, Exception("ambientes asociados"))
        del self.sedes[sede.id]


def _sede(id_sede=1, nombre="Sede principal"):
    return SimpleNamespace(id=id_sede, nombre=nombre, direccion=None, tipo=None)


def test_list_delega_en_el_repositorio():
    repo = _RepositorioFalso(sedes={1: _sede()})
    servicio = SedeService(repository=repo)

    resultado = servicio.list(db=_DB)

    assert resultado == [repo.sedes[1]]
    assert repo.llamadas == [("list",)]


def test_get_devuelve_la_sede_cuando_existe():
    repo = _RepositorioFalso(sedes={1: _sede()})
    servicio = SedeService(repository=repo)

    assert servicio.get(db=_DB, sede_id=1) is repo.sedes[1]


def test_get_lanza_404_cuando_no_existe():
    servicio = SedeService(repository=_RepositorioFalso())

    with pytest.raises(HTTPException) as error:
        servicio.get(db=_DB, sede_id=999)

    assert error.value.status_code == 404


def test_create_devuelve_la_sede_creada():
    servicio = SedeService(repository=_RepositorioFalso())
    datos = SedeCreate(nombreSede="Sede Norte")

    creada = servicio.create(db=_DB, data=datos)

    assert creada.nombre == "Sede Norte"


def test_create_traduce_integrity_error_en_409():
    repo = _RepositorioFalso(fallar_en={"create"})
    servicio = SedeService(repository=repo)

    with pytest.raises(HTTPException) as error:
        servicio.create(db=_DB, data=SedeCreate(nombreSede="Duplicada"))

    assert error.value.status_code == 409


def test_update_cambia_los_campos_de_una_sede_existente():
    repo = _RepositorioFalso(sedes={1: _sede(nombre="Vieja")})
    servicio = SedeService(repository=repo)

    actualizada = servicio.update(db=_DB, sede_id=1, data=SedeUpdate(nombreSede="Nueva"))

    assert actualizada.nombre == "Nueva"


def test_update_sobre_sede_inexistente_lanza_404_sin_llegar_al_repositorio():
    repo = _RepositorioFalso()
    servicio = SedeService(repository=repo)

    with pytest.raises(HTTPException) as error:
        servicio.update(db=_DB, sede_id=999, data=SedeUpdate(nombreSede="Nueva"))

    assert error.value.status_code == 404
    assert not any(llamada[0] == "update" for llamada in repo.llamadas)


def test_update_traduce_integrity_error_en_409():
    repo = _RepositorioFalso(sedes={1: _sede()}, fallar_en={"update"})
    servicio = SedeService(repository=repo)

    with pytest.raises(HTTPException) as error:
        servicio.update(db=_DB, sede_id=1, data=SedeUpdate(nombreSede="Duplicada"))

    assert error.value.status_code == 409


def test_delete_quita_la_sede_del_repositorio():
    repo = _RepositorioFalso(sedes={1: _sede()})
    servicio = SedeService(repository=repo)

    servicio.delete(db=_DB, sede_id=1)

    assert 1 not in repo.sedes


def test_delete_con_ambientes_asociados_traduce_integrity_error_en_409():
    repo = _RepositorioFalso(sedes={1: _sede()}, fallar_en={"delete"})
    servicio = SedeService(repository=repo)

    with pytest.raises(HTTPException) as error:
        servicio.delete(db=_DB, sede_id=1)

    assert error.value.status_code == 409
    assert "ambientes" in error.value.detail.lower()
