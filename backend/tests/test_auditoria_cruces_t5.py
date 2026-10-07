"""T-5 (SCRUM-136): huecos de la auditoría de cruces que la versión
anterior (validar_dry_run por horario) no reportaba."""

import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario
from tests.test_horarios_auditoria_cruces import _catalogo_base, _crear_tablas_extra

URL = "/api/v1/horarios/auditoria-cruces"


def _instructor(db_session, nombre="Carlos López", contrato="contrato"):
    instructor = Usuario(
        idUsuario=uuid.uuid4(), nombre=nombre, email=f"{uuid.uuid4().hex[:6]}@example.com", tipoContrato=contrato
    )
    db_session.add(instructor)
    db_session.commit()
    return instructor


def _ficha(db_session, id_ficha, id_trimestre=1):
    db_session.add(Ficha(idFicha=id_ficha, codigoFicha=f"FICHA-{id_ficha:03d}", idPrograma=1, idTrimestre=id_trimestre))
    db_session.commit()


def _horario(db_session, id_horario, *, instructor, ficha, inicio=8, fin=10, ambiente=1, resultado=9,
             jornada=1, trimestre=1, dias=(1,)):
    db_session.add(Horario(
        idHorario=id_horario, horaInicio=time(inicio, 0), horaFin=time(fin, 0), idJornada=jornada,
        idTrimestre=trimestre, idAmbiente=ambiente, idInstructor=instructor.idUsuario, idFicha=ficha,
        idResultado=resultado,
    ))
    db_session.commit()
    for dia in dias:
        db_session.execute(horario_dia.insert().values(idHorario=id_horario, idDia=dia))
    db_session.commit()


def _de_tipo(body, tipo):
    return [c for c in body["conflictos"] if c["tipo"] == tipo]


def test_triple_cruce_reporta_los_tres_pares(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session)
    _, headers = autenticar_como("Coordinador")
    for id_ficha in (1, 2, 3):
        _ficha(db_session, id_ficha)
    # Tres fichas e instructores distintos en el mismo ambiente y franja.
    for id_horario, id_ficha in ((100, 1), (101, 2), (102, 3)):
        _horario(db_session, id_horario, instructor=_instructor(db_session, f"I{id_horario}"), ficha=id_ficha)

    body = client.get(URL, headers=headers).json()

    pares = {(c["idHorario"], c["idHorarioExistente"]) for c in _de_tipo(body, "cruce_ambiente")}
    # Antes: (100, 101) y (100, 102); el par 101–102 se perdía.
    assert pares == {(100, 101), (100, 102), (101, 102)}
    assert body["resumen"]["porTipo"]["cruce_ambiente"] == 3
    assert body["resumen"]["horariosAfectados"] == 3


def test_cada_par_va_con_el_id_menor_primero_y_describe_ambos_lados(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session)
    _, headers = autenticar_como("Coordinador")
    _ficha(db_session, 1)
    instructor = _instructor(db_session)
    _horario(db_session, 300, instructor=instructor, ficha=1, ambiente=1)
    _horario(db_session, 200, instructor=instructor, ficha=1, ambiente=1, resultado=10)

    body = client.get(URL, headers=headers).json()

    for tipo in ("cruce_ficha", "cruce_instructor", "cruce_ambiente"):
        conflictos = _de_tipo(body, tipo)
        assert len(conflictos) == 1, tipo
        assert (conflictos[0]["idHorario"], conflictos[0]["idHorarioExistente"]) == (200, 300)
        assert "choca con" in conflictos[0]["mensaje"]


def test_planta_con_exceso_de_horas_y_noche_reporta_ambas_reglas(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session)
    db_session.add_all([Jornada(idJornada=2, nombreJornada="Noche")] + [
        DiaSemana(idDia=d, nombreDia=n) for d, n in ((2, "Martes"), (3, "Miércoles"), (4, "Jueves"), (5, "Viernes"))
    ])
    db_session.commit()
    _, headers = autenticar_como("Coordinador")
    _ficha(db_session, 1)
    instructor = _instructor(db_session, "Planta Uno", contrato="planta")
    # 5 días × 7 h = 35 h > 32 h de planta, y además dos bloques nocturnos.
    _horario(db_session, 100, instructor=instructor, ficha=1, inicio=6, fin=13, dias=(1, 2, 3, 4, 5))
    _horario(db_session, 101, instructor=instructor, ficha=1, inicio=18, fin=20, jornada=2, ambiente=1, dias=(1,),
             resultado=10)
    _horario(db_session, 102, instructor=instructor, ficha=1, inicio=20, fin=21, jornada=2, ambiente=1, dias=(2,),
             resultado=10)

    reglas = _de_tipo(client.get(URL, headers=headers).json(), "regla_instructor")

    topes = [r for r in reglas if "supera el máximo" in r["mensaje"]]
    noches = [r for r in reglas if "jornada Noche" in r["mensaje"]]
    assert len(topes) == 1
    assert "38.0h/semana" in topes[0]["mensaje"]
    # Uno por bloque nocturno, no uno por instructor.
    assert sorted(r["idHorario"] for r in noches) == [101, 102]


def test_tope_suma_horas_de_otras_sedes_aunque_se_filtre_una(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session)
    db_session.add_all([
        Sede(id=2, nombre="Sede Sur", direccion="Calle 2", tipo="secundaria"),
        DiaSemana(idDia=2, nombreDia="Martes"),
    ])
    db_session.commit()
    db_session.add(Ambiente(id=2, numero_ambiente=202, nombre="Ambiente", tipo_ambiente="regular",
                            estado_ambiente="disponible", sede_id=2))
    db_session.commit()
    _, headers = autenticar_como("Coordinador")
    _ficha(db_session, 1)
    instructor = _instructor(db_session, contrato="contrato")
    # 23 h en la sede 1 y 23 h en la sede 2: 46 h > 40 h de contrato.
    _horario(db_session, 100, instructor=instructor, ficha=1, inicio=0, fin=23, ambiente=1, dias=(1,))
    _horario(db_session, 101, instructor=instructor, ficha=1, inicio=0, fin=23, ambiente=2, dias=(2,), resultado=10)

    reglas = _de_tipo(client.get(f"{URL}?idSede=1", headers=headers).json(), "regla_instructor")

    assert len(reglas) == 1
    assert "46.0h/semana" in reglas[0]["mensaje"]


def test_reporta_horario_de_ficha_fuera_de_su_trimestre(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session)
    db_session.add(Trimestre(idTrimestre=2, nombre="2026-2", fechaInicio=date(2026, 5, 1),
                             fechaFin=date(2026, 8, 30), estado="activo"))
    db_session.commit()
    _, headers = autenticar_como("Coordinador")
    _ficha(db_session, 1, id_trimestre=2)
    _horario(db_session, 100, instructor=_instructor(db_session), ficha=1, trimestre=1)

    body = client.get(URL, headers=headers).json()

    fuera = _de_tipo(body, "ficha_trimestre")
    assert len(fuera) == 1
    assert fuera[0]["idHorario"] == 100
    assert fuera[0]["idHorarioExistente"] is None


def test_sin_conflictos_resumen_vacio(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session)
    _, headers = autenticar_como("Coordinador")
    _ficha(db_session, 1)
    _horario(db_session, 100, instructor=_instructor(db_session), ficha=1)

    body = client.get(URL, headers=headers).json()

    assert body["conflictos"] == []
    assert body["resumen"] == {"totalCruces": 0, "tipos": [], "porTipo": {}, "horariosAfectados": 0}


def test_auditoria_exige_rol_de_programacion(client, autenticar_como):
    _, headers = autenticar_como("Instructor")

    assert client.get(URL, headers=headers).status_code == 403
