from datetime import time

from app.core.database import Base
from app.models.ambiente import Ambiente
from app.models.dia_semana import DiaSemana
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede


def test_vincular_requiere_aprendiz(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Instructor")

    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers
    )

    assert respuesta.status_code == 403


def test_vincular_caso_feliz(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["idFicha"] == ficha.idFicha
    assert cuerpo["codigoFicha"] == ficha.codigoFicha


def test_vincular_ficha_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": "0000000"}, headers=headers
    )

    assert respuesta.status_code == 404


def test_vincular_usuario_ya_vinculado_da_400(client, autenticar_como, crear_ficha):
    ficha_1 = crear_ficha(codigo="2874521")
    ficha_2 = crear_ficha(codigo="3068356")
    _, headers = autenticar_como("Aprendiz")

    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha_1.codigoFicha}, headers=headers)
    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha_2.codigoFicha}, headers=headers
    )

    assert respuesta.status_code == 400


def test_mi_ficha_requiere_aprendiz(client, autenticar_como):
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/ficha-usuario/mi-ficha", headers=headers)

    assert respuesta.status_code == 403


def test_mi_ficha_caso_feliz(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Aprendiz")
    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers)

    respuesta = client.get("/api/v1/ficha-usuario/mi-ficha", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["idFicha"] == ficha.idFicha


def test_mi_ficha_sin_vincular_da_404(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/ficha-usuario/mi-ficha", headers=headers)

    assert respuesta.status_code == 404


def _crear_tablas_horario(db_session):
    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[
            Sede.__table__,
            Ambiente.__table__,
            Jornada.__table__,
            DiaSemana.__table__,
            ResultadoAprendizaje.__table__,
            Horario.__table__,
            horario_dia,
        ],
    )


def test_mi_horario_requiere_aprendiz(client, autenticar_como):
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/ficha-usuario/mi-horario", headers=headers)

    assert respuesta.status_code == 403


def test_mi_horario_sin_ficha_vinculada_da_404(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/ficha-usuario/mi-horario", headers=headers)

    assert respuesta.status_code == 404


def test_mi_horario_caso_feliz(client, db_session, autenticar_como, crear_usuario, crear_ficha):
    _crear_tablas_horario(db_session)

    ficha = crear_ficha(codigo="2874521")
    instructor = crear_usuario(nombre="Carlos")

    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10)
    db_session.add_all([sede, ambiente, jornada, dia_lunes, resultado])
    db_session.commit()

    horario = Horario(
        idHorario=100, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1,
        idTrimestre=ficha.idTrimestre, idAmbiente=1, idInstructor=instructor.idUsuario,
        idFicha=ficha.idFicha, idResultado=9,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=1))
    db_session.commit()

    _, headers = autenticar_como("Aprendiz")
    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers)

    respuesta = client.get("/api/v1/ficha-usuario/mi-horario", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["idHorario"] == 100
    assert cuerpo[0]["instructorNombre"] == "Carlos"
    assert cuerpo[0]["fichaCodigo"] == ficha.codigoFicha
    assert cuerpo[0]["dias"] == [1]
