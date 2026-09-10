"""Servicio del asistente de programación. Mockea httpx.post para la
parte de IA (mismo patrón que test_ai_classify_document.py) y usa
SQLite en memoria para la parte de catálogo (mismo patrón que
test_horarios_auditoria_cruces.py)."""

import json
import uuid
from datetime import date, time
from io import BytesIO

import openpyxl
import pytest

from app.models.ambiente import Ambiente
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.coordinacion import Coordinacion
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario
from app.services.asistente_horario_service import generar_propuesta, previsualizar_excel


def _crear_tablas_extra(db_session):
    from app.core.database import Base

    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[
            Coordinacion.__table__, Programa.__table__, Trimestre.__table__, Sede.__table__,
            Ambiente.__table__, Ficha.__table__, CompetenciaFormacion.__table__,
            ResultadoAprendizaje.__table__, Horario.__table__, horario_dia,
        ],
    )


def _catalogo_base(db_session, id_ficha=100, codigo_ficha=None):
    # id_ficha (PK interno, SERIAL) y codigo_ficha (el número real de SENA,
    # texto) son columnas DISTINTAS -- default codigo_ficha=str(id_ficha)
    # solo por conveniencia en los tests que no les importa la diferencia;
    # test_previsualizar_excel_reconoce_ficha_existente los desacopla a
    # propósito para no repetir el bug real que encontramos (buscar por PK
    # en vez de por codigoFicha).
    codigo_ficha = codigo_ficha or str(id_ficha)
    db_session.add(Coordinacion(idCoordinacion=1, nombreCoordinacion="Demo"))
    db_session.add(Programa(idPrograma=1, codigoPrograma="P1", nombrePrograma="ADSO", nivelFormacion="Tecnólogo", activo=True, idCoordinacion=1))
    db_session.add(Trimestre(idTrimestre=1, nombre="2026-3", fechaInicio=date(2026, 7, 1), fechaFin=date(2026, 9, 30), estado="activo"))
    db_session.add(Sede(id=1, nombre="Sede Demo", direccion="Calle 1", tipo="principal"))
    db_session.add(Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1))
    db_session.add(Ficha(idFicha=id_ficha, codigoFicha=codigo_ficha, idPrograma=1, idTrimestre=1, idSede=1))
    db_session.add(CompetenciaFormacion(idCompetencia=1, codigo="C1", descripcion="Competencia demo", idPrograma=1))
    db_session.add(ResultadoAprendizaje(idResultado=1, codigo="RA-1", descripcion="Resultado demo", idCompetencia=1, horasAsignadas=20))
    db_session.commit()


def _xlsx_con_encabezado(filas: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["TÍTULO DEL REPORTE"])
    ws.append([])
    for fila in filas:
        ws.append(fila)
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


class _RespuestaFalsa:
    def __init__(self, cuerpo_json):
        self._cuerpo_json = cuerpo_json

    def json(self):
        return self._cuerpo_json

    def raise_for_status(self):
        pass


def _mock_clasificacion(monkeypatch, mapa: dict[str, tuple]):
    """mapa: {columna_original: (campo, confianza)}"""
    payload = {col: {"campo": campo, "confianza": conf} for col, (campo, conf) in mapa.items()}
    texto_llm = json.dumps(payload)

    def fake_post(url, headers=None, json=None, timeout=None):
        return _RespuestaFalsa({"candidates": [{"content": {"parts": [{"text": texto_llm}]}}]})

    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")
    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)


def test_previsualizar_excel_marca_ficha_inexistente(db_session, monkeypatch):
    _crear_tablas_extra(db_session)
    contenido = _xlsx_con_encabezado([["FICHA", "PROGRAMA"], [999999, "ADSO"]])
    _mock_clasificacion(monkeypatch, {"FICHA": ("ficha", 1.0), "PROGRAMA": ("programa", 1.0)})

    resultado = previsualizar_excel(db_session, contenido, "archivo.xlsx")

    assert resultado.totalFilas == 1
    assert resultado.filas[0].codigoFicha == "999999"
    assert resultado.filas[0].idFicha is None
    assert resultado.filas[0].fichaExiste is False
    assert "no existe" in resultado.filas[0].advertencia


def test_previsualizar_excel_sin_columna_de_ficha_da_advertencia_general(db_session, monkeypatch):
    # Caso real encontrado en pruebas: un formato de matriz/pivote donde
    # ninguna columna se clasifica como "ficha" -- en vez de 40 filas con
    # el mismo mensaje sin contexto, un solo aviso a nivel de archivo.
    _crear_tablas_extra(db_session)
    contenido = _xlsx_con_encabezado([["ITEMS", "TEMAS_"], ["a", "TEMAS_7_TRM_2996161_(DM)_ALGO"]])
    _mock_clasificacion(monkeypatch, {"ITEMS": (None, 0.0), "TEMAS_": (None, 0.0)})

    resultado = previsualizar_excel(db_session, contenido, "archivo.xlsx")

    assert resultado.advertenciaGeneral is not None
    assert "formato de matriz o pivote" in resultado.advertenciaGeneral


def test_previsualizar_excel_reconoce_ficha_existente(db_session, monkeypatch):
    # idFicha (PK interno) != codigoFicha (número real de SENA) a propósito
    # -- si el servicio buscara por PK en vez de por codigoFicha, esta
    # ficha real "2895566" no se encontraría aunque exista en la BD.
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session, id_ficha=7, codigo_ficha="2895566")
    contenido = _xlsx_con_encabezado([["FICHA", "PROGRAMA"], [2895566, "ADSO"]])
    _mock_clasificacion(monkeypatch, {"FICHA": ("ficha", 1.0), "PROGRAMA": ("programa", 1.0)})

    resultado = previsualizar_excel(db_session, contenido, "archivo.xlsx")

    assert resultado.filas[0].codigoFicha == "2895566"
    assert resultado.filas[0].fichaExiste is True
    assert resultado.filas[0].idFicha == 7
    assert resultado.filas[0].advertencia is None


def test_generar_propuesta_sin_resultados_pendientes(db_session):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session, id_ficha=100)
    # Ya existe un horario activo para el único resultado de esta ficha.

    instructor_id = uuid.uuid4()
    db_session.add(Usuario(idUsuario=instructor_id, nombre="Ana", email="ana@demo.sihs", tipoContrato="contrato", estado="activo"))
    db_session.add(Horario(
        idHorario=1, horaInicio=time(7, 0), horaFin=time(9, 0), idJornada=1, idTrimestre=1,
        idAmbiente=1, idInstructor=instructor_id, idFicha=100, idResultado=1, activo=True,
    ))
    db_session.commit()

    resultado = generar_propuesta(db_session, id_trimestre=1, ids_ficha=[100], jornada="MAÑANA")

    assert resultado.bloques == []
    assert resultado.factible is True
    assert "ya tienen todos sus resultados" in resultado.mensaje


def test_generar_propuesta_genera_un_bloque_real(db_session):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session, id_ficha=100)

    instructor_id = uuid.uuid4()
    db_session.add(Usuario(idUsuario=instructor_id, nombre="Ana", email="ana@demo.sihs", tipoContrato="contrato", estado="activo"))
    db_session.commit()

    resultado = generar_propuesta(db_session, id_trimestre=1, ids_ficha=[100], jornada="MAÑANA")

    assert resultado.factible is True
    assert len(resultado.bloques) == 1
    bloque = resultado.bloques[0]
    assert bloque.idFicha == 100
    assert bloque.idResultado == 1
    assert bloque.instructorNombre == "Ana"
    assert bloque.idAmbiente == 1


def test_generar_propuesta_jornada_invalida_lanza_value_error(db_session):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session, id_ficha=100)

    with pytest.raises(ValueError, match="no reconocida"):
        generar_propuesta(db_session, id_trimestre=1, ids_ficha=[100], jornada="MADRUGADA")
