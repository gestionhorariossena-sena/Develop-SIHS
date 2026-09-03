"""Historia "Código de instructor: completar el flujo frontend y vincularlo
a un trimestre". codigoInstructor sigue siendo fijo una vez creado
(UsuarioService.generar_codigo_instructor ya era idempotente) — lo nuevo es
que, al generarse, se anota en qué trimestre activo se emitió."""

from datetime import date

from app.models.trimestre import Trimestre
from app.services.usuario_service import UsuarioService


def test_generar_codigo_instructor_asigna_el_trimestre_activo(db_session, crear_usuario):
    trimestre = Trimestre(
        nombre="2026-3",
        fechaInicio=date(2026, 9, 1),
        fechaFin=date(2026, 12, 15),
        estado="activo",
    )
    db_session.add(trimestre)
    db_session.commit()

    instructor = crear_usuario(nombre="Sergio")

    resultado = UsuarioService.generar_codigo_instructor(db_session, instructor.idUsuario)

    assert resultado["codigo"].startswith("INS-")
    assert resultado["idTrimestre"] == trimestre.idTrimestre
    db_session.refresh(instructor)
    assert instructor.idTrimestre == trimestre.idTrimestre


def test_generar_codigo_instructor_sin_trimestre_activo_deja_idtrimestre_en_null(db_session, crear_usuario):
    db_session.add(
        Trimestre(nombre="2026-4", fechaInicio=date(2027, 1, 1), fechaFin=date(2027, 3, 31), estado="planeado")
    )
    db_session.commit()

    instructor = crear_usuario(nombre="Laura")

    resultado = UsuarioService.generar_codigo_instructor(db_session, instructor.idUsuario)

    assert resultado["codigo"].startswith("INS-")
    assert resultado["idTrimestre"] is None


def test_generar_codigo_instructor_es_idempotente_no_cambia_codigo_ni_trimestre(db_session, crear_usuario):
    trimestre_1 = Trimestre(nombre="2026-3", fechaInicio=date(2026, 9, 1), fechaFin=date(2026, 12, 15), estado="activo")
    db_session.add(trimestre_1)
    db_session.commit()

    instructor = crear_usuario(nombre="Marcela")
    primero = UsuarioService.generar_codigo_instructor(db_session, instructor.idUsuario)

    # Cambia el trimestre activo antes de "regenerar" — el código y el
    # trimestre anotado no deben moverse, es fijo desde la primera vez.
    trimestre_1.estado = "finalizado"
    trimestre_2 = Trimestre(nombre="2026-4", fechaInicio=date(2027, 1, 1), fechaFin=date(2027, 3, 31), estado="activo")
    db_session.add(trimestre_2)
    db_session.commit()

    segundo = UsuarioService.generar_codigo_instructor(db_session, instructor.idUsuario)

    assert segundo["codigo"] == primero["codigo"]
    assert segundo["idTrimestre"] == trimestre_1.idTrimestre
