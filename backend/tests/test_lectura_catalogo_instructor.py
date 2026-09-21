"""Ambientes, fichas, resultados de aprendizaje, competencias de
formación y días de la semana — lectura ampliada a Instructor (antes
solo Coordinador/Administrador, algunas incluso solo Administrador) para
que "Detalle de Franja y Ambiente" (MiHorario.tsx →
DetalleFranjaAmbiente.tsx) pueda mostrar datos reales de la PROPIA
sesión del instructor sin necesitar un rol de coordinación.
`require_lectura_catalogo_o_instructor` (app/core/supabase_auth.py) es
la ampliación — solo de LECTURA, la escritura de estos catálogos sigue
siendo exclusiva de Administrador."""

from datetime import date

from app.models.ambiente import Ambiente
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.trimestre import Trimestre


def _crear_tablas_extra(db_session):
    from app.core.database import Base

    tablas = [
        Coordinacion.__table__,
        Programa.__table__,
        Trimestre.__table__,
        Sede.__table__,
        Ambiente.__table__,
        DiaSemana.__table__,
        Ficha.__table__,
        CompetenciaFormacion.__table__,
        ResultadoAprendizaje.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _poblar(db_session):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
        nivelFormacion="Técnico", activo=True, idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5),
        fechaFin=date(2026, 4, 30), estado="activo",
    )
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(
        id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular",
        estado_ambiente="disponible", sede_id=1,
    )
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)
    competencia = CompetenciaFormacion(
        idCompetencia=1, codigo="220501096", descripcion="Construcción de software", idPrograma=1,
    )
    resultado = ResultadoAprendizaje(
        idResultado=1, codigo="RAP1", descripcion="Construir el sistema de información.", idCompetencia=1,
    )
    dia = DiaSemana(idDia=1, nombreDia="Lunes")

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente, ficha, competencia, resultado, dia])
    db_session.commit()

    return {
        "idAmbiente": ambiente.id,
        "idFicha": ficha.idFicha,
        "idCompetencia": competencia.idCompetencia,
        "idResultado": resultado.idResultado,
    }


def test_instructor_puede_leer_ambiente(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    datos = _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/ambientes/{datos['idAmbiente']}", headers=headers)

    assert respuesta.status_code == 200


def test_instructor_puede_leer_ficha(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    datos = _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/fichas/{datos['idFicha']}", headers=headers)

    assert respuesta.status_code == 200


def test_instructor_puede_leer_resultado_aprendizaje(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    datos = _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/resultados-aprendizaje/{datos['idResultado']}", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["idCompetencia"] == datos["idCompetencia"]


def test_instructor_puede_leer_competencia_formacion(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    datos = _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/competencias-formacion/{datos['idCompetencia']}", headers=headers)

    assert respuesta.status_code == 200


def test_instructor_puede_leer_dias_semana(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/dias-semana/", headers=headers)

    assert respuesta.status_code == 200


def test_aprendiz_sigue_sin_acceso_a_catalogos(client, db_session, autenticar_como):
    """Aprendiz NO se agregó a require_lectura_catalogo_o_instructor — la
    ampliación es solo para Instructor, sigue dando 403 para Aprendiz."""
    _crear_tablas_extra(db_session)
    datos = _poblar(db_session)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get(f"/api/v1/ambientes/{datos['idAmbiente']}", headers=headers)

    assert respuesta.status_code == 403


def test_horarios_por_ficha_sigue_solo_lectura_catalogo(client, db_session, autenticar_como):
    """El sub-recurso .../horarios (el horario COMPLETO de una ficha
    ajena) NO se amplió — solo el detalle liviano de catálogo (ficha,
    ambiente, resultado, competencia) que necesita esta pantalla."""
    _crear_tablas_extra(db_session)
    datos = _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/fichas/{datos['idFicha']}/horarios", headers=headers)

    assert respuesta.status_code == 403


def test_competencia_escritura_sigue_solo_administrador(client, db_session, autenticar_como):
    """La ampliación es solo de LECTURA — crear competencias sigue siendo
    exclusivo de Administrador, ni siquiera Coordinador puede."""
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.post(
        "/api/v1/competencias-formacion/",
        json={"descripcion": "Nueva competencia", "idPrograma": 1},
        headers=headers,
    )

    assert respuesta.status_code == 403
