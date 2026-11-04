"""Semana 2 (Nicol): reglas de autorización de lectura de horarios.

Pruebas unitarias aisladas: sin PostgreSQL, Supabase ni API externa.
Los dobles de db simulan únicamente el resultado de pertenencia/relación.
"""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services.horario_acceso_service import HorarioAccesoService


def _usuario(rol: str, identificador: str = "usuario-1"):
    return SimpleNamespace(idUsuario=identificador, roles=[SimpleNamespace(nombre=rol)])


def _db_con_relacion(existe: bool):
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = object() if existe else None
    return db


def _bloque(*, activo=True, publicado=True, instructor="usuario-1", ficha=21):
    return SimpleNamespace(
        activo=activo,
        publicado=publicado,
        idInstructor=instructor,
        idFicha=ficha,
    )


@pytest.mark.parametrize("rol", ["Administrador", "Coordinador"])
def test_gestor_puede_ver_ficha_sin_consultar_relaciones(rol):
    db = Mock()
    assert HorarioAccesoService.puede_ver_ficha(db, _usuario(rol), 21) is True
    db.query.assert_not_called()


@pytest.mark.parametrize("pertenece,permitido", [(True, True), (False, False)])
def test_aprendiz_solo_puede_ver_ficha_a_la_que_pertenece(pertenece, permitido):
    db = _db_con_relacion(pertenece)
    assert HorarioAccesoService.puede_ver_ficha(db, _usuario("Aprendiz"), 21) is permitido
    db.query.assert_called_once()


@pytest.mark.parametrize("tiene_horario_publicado,permitido", [(True, True), (False, False)])
def test_instructor_solo_puede_ver_ficha_si_tiene_horario_vinculado(
    tiene_horario_publicado, permitido
):
    # El doble representa la consulta del servicio por horario activo/publicado.
    db = _db_con_relacion(tiene_horario_publicado)
    assert HorarioAccesoService.puede_ver_ficha(db, _usuario("Instructor"), 21) is permitido
    db.query.assert_called_once()


def test_instructor_puede_ver_bloque_propio_activo_y_publicado():
    db = Mock()
    assert HorarioAccesoService.puede_ver_bloque(
        db, _usuario("Instructor"), _bloque()
    ) is True
    db.query.assert_not_called()


@pytest.mark.parametrize(
    "activo,publicado",
    [
        (False, True),  # límite: desactivado aunque ya esté publicado
        (True, False),  # límite: activo pero todavía no publicado
        (False, False),
    ],
)
def test_instructor_no_puede_ver_bloque_si_falta_una_condicion_de_visibilidad(
    activo, publicado
):
    db = Mock()
    assert HorarioAccesoService.puede_ver_bloque(
        db, _usuario("Instructor"), _bloque(activo=activo, publicado=publicado)
    ) is False
    db.query.assert_not_called()


def test_instructor_no_puede_ver_bloque_ajeno():
    db = Mock()
    assert HorarioAccesoService.puede_ver_bloque(
        db, _usuario("Instructor"), _bloque(instructor="otro-usuario")
    ) is False
    db.query.assert_not_called()


@pytest.mark.parametrize("pertenece,permitido", [(True, True), (False, False)])
def test_aprendiz_puede_ver_bloque_publicado_solo_si_pertenece_a_ficha(
    pertenece, permitido
):
    db = _db_con_relacion(pertenece)
    assert HorarioAccesoService.puede_ver_bloque(
        db, _usuario("Aprendiz"), _bloque()
    ) is permitido
    db.query.assert_called_once()
