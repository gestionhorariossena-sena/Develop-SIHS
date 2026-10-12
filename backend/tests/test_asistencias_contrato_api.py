"""Contrato HTTP de /api/v1/asistencias: códigos de respuesta, forma exacta
del payload y validación de entrada (pydantic -> 422).

test_asistencias.py fija las reglas de negocio; acá se fija lo que un
cliente (web o móvil) puede asumir de la API.
"""

from datetime import timedelta

import pytest

from tests.test_asistencias import _lunes_pasado, escenario  # noqa: F401  (fixture)

URL = "/api/v1/asistencias"


def _marca(aprendiz, estado="presente", **extra):
    return {"idUsuarioAprendiz": str(aprendiz.idUsuario), "estado": estado, **extra}


def _cuerpo(escenario, marcas=None):
    return {
        "idHorario": 100,
        "fechaSesion": escenario["fecha"],
        "marcas": marcas if marcas is not None else [_marca(escenario["aprendiz"])],
    }


# --- 200: forma exacta del payload -------------------------------------


def test_get_sesion_200_devuelve_exactamente_los_campos_del_contrato(client, escenario):
    r = client.get(f"{URL}/sesion?idHorario=100&fecha={escenario['fecha']}", headers=escenario["headers"])

    assert r.status_code == 200
    cuerpo = r.json()
    assert set(cuerpo) == {
        "idHorario", "fechaSesion", "fichaCodigo", "resultadoDescripcion", "ambienteNombre",
        "horaInicio", "horaFin", "aprendices", "registradaEn", "registradaPor",
    }
    assert cuerpo["idHorario"] == 100
    assert cuerpo["fechaSesion"] == escenario["fecha"]
    assert cuerpo["horaInicio"] == "11:00:00"
    assert set(cuerpo["aprendices"][0]) == {
        "idUsuario", "nombre", "numeroDocumento", "rolEnFicha", "estado", "horaMarcacion", "referenciaExcusa",
    }


def test_post_sesion_200_devuelve_exactamente_guardadas_corregidas_y_eraPrimeraVez(client, escenario):
    r = client.post(f"{URL}/sesion", json=_cuerpo(escenario), headers=escenario["headers"])

    assert r.status_code == 200
    assert r.json() == {"guardadas": 1, "corregidas": 0, "eraPrimeraVez": True}


def test_post_sesion_acepta_lista_vacia_de_marcas(client, escenario):
    r = client.post(f"{URL}/sesion", json=_cuerpo(escenario, marcas=[]), headers=escenario["headers"])

    assert r.status_code == 200
    assert r.json() == {"guardadas": 0, "corregidas": 0, "eraPrimeraVez": True}


def test_get_mias_200_devuelve_exactamente_resumen_y_sesiones(client, escenario, fake_supabase):
    client.post(f"{URL}/sesion", json=_cuerpo(escenario), headers=escenario["headers"])
    fake_supabase("tok-aprendiz", id=str(escenario["aprendiz"].idUsuario), email=escenario["aprendiz"].email)

    r = client.get(f"{URL}/mias", headers={"Authorization": "Bearer tok-aprendiz"})

    assert r.status_code == 200
    cuerpo = r.json()
    assert set(cuerpo) == {"resumen", "sesiones"}
    assert set(cuerpo["resumen"]) == {"registradas", "presente", "tardanza", "excusa", "ausente", "porcentaje"}
    assert set(cuerpo["sesiones"][0]) == {
        "idAsistencia", "idHorario", "fechaSesion", "estado", "referenciaExcusa",
        "resultadoDescripcion", "instructorNombre", "ambienteNombre", "horaInicio", "horaFin",
    }


def test_get_mias_200_sin_historial_devuelve_lista_vacia(client, escenario, fake_supabase):
    fake_supabase("tok-aprendiz", id=str(escenario["aprendiz"].idUsuario), email=escenario["aprendiz"].email)

    r = client.get(f"{URL}/mias", headers={"Authorization": "Bearer tok-aprendiz"})

    assert r.status_code == 200
    assert r.json()["sesiones"] == []
    assert r.json()["resumen"]["registradas"] == 0


# --- 422: validación de entrada (pydantic) -----------------------------


@pytest.mark.parametrize("campo", ["idHorario", "fechaSesion", "marcas"])
def test_post_sesion_422_si_falta_un_campo_obligatorio(client, escenario, campo):
    cuerpo = _cuerpo(escenario)
    del cuerpo[campo]

    r = client.post(f"{URL}/sesion", json=cuerpo, headers=escenario["headers"])

    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["body", campo]
    assert r.json()["detail"][0]["type"] == "missing"


def test_post_sesion_422_si_el_estado_no_es_uno_de_los_cuatro(client, escenario):
    marcas = [_marca(escenario["aprendiz"], estado="dormido")]

    r = client.post(f"{URL}/sesion", json=_cuerpo(escenario, marcas), headers=escenario["headers"])

    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"][-1] == "estado"


@pytest.mark.parametrize("estado", ["presente", "tardanza", "excusa", "ausente"])
def test_post_sesion_200_con_cada_estado_valido(client, escenario, estado):
    marcas = [_marca(escenario["aprendiz"], estado=estado)]

    r = client.post(f"{URL}/sesion", json=_cuerpo(escenario, marcas), headers=escenario["headers"])

    assert r.status_code == 200


def test_post_sesion_422_si_el_id_del_aprendiz_no_es_uuid(client, escenario):
    marcas = [{"idUsuarioAprendiz": "123", "estado": "presente"}]

    r = client.post(f"{URL}/sesion", json=_cuerpo(escenario, marcas), headers=escenario["headers"])

    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"][-1] == "idUsuarioAprendiz"


def test_post_sesion_422_si_la_fecha_tiene_formato_invalido(client, escenario):
    cuerpo = _cuerpo(escenario)
    cuerpo["fechaSesion"] = "12/10/2026"

    r = client.post(f"{URL}/sesion", json=cuerpo, headers=escenario["headers"])

    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["body", "fechaSesion"]


def test_post_sesion_422_si_idHorario_no_es_entero(client, escenario):
    cuerpo = _cuerpo(escenario)
    cuerpo["idHorario"] = "abc"

    r = client.post(f"{URL}/sesion", json=cuerpo, headers=escenario["headers"])

    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["body", "idHorario"]


def test_post_sesion_422_si_marcas_no_es_una_lista(client, escenario):
    cuerpo = _cuerpo(escenario)
    cuerpo["marcas"] = "todos presentes"

    r = client.post(f"{URL}/sesion", json=cuerpo, headers=escenario["headers"])

    assert r.status_code == 422


def test_post_sesion_422_con_cuerpo_vacio(client, escenario):
    r = client.post(f"{URL}/sesion", json={}, headers=escenario["headers"])

    assert r.status_code == 422
    assert {e["loc"][-1] for e in r.json()["detail"]} == {"idHorario", "fechaSesion", "marcas"}


@pytest.mark.parametrize("query", ["", "?idHorario=100", "?fecha=2026-01-05", "?idHorario=x&fecha=2026-01-05", "?idHorario=100&fecha=ayer"])
def test_get_sesion_422_si_faltan_o_son_invalidos_los_query_params(client, escenario, query):
    r = client.get(f"{URL}/sesion{query}", headers=escenario["headers"])

    assert r.status_code == 422


@pytest.mark.parametrize("query", ["?desde=ayer", "?hasta=2026-13-45"])
def test_get_mias_422_si_las_fechas_del_filtro_son_invalidas(client, escenario, fake_supabase, query):
    fake_supabase("tok-aprendiz", id=str(escenario["aprendiz"].idUsuario), email=escenario["aprendiz"].email)

    r = client.get(f"{URL}/mias{query}", headers={"Authorization": "Bearer tok-aprendiz"})

    assert r.status_code == 422


# --- 404: recurso inexistente ------------------------------------------


def test_get_sesion_404_si_el_horario_no_existe(client, escenario):
    r = client.get(f"{URL}/sesion?idHorario=99999&fecha={escenario['fecha']}", headers=escenario["headers"])

    assert r.status_code == 404
    assert r.json() == {"detail": "Esa clase no existe"}


def test_post_sesion_404_si_el_horario_no_existe(client, db_session, escenario):
    from app.models.asistencia import Asistencia

    cuerpo = _cuerpo(escenario)
    cuerpo["idHorario"] = 99999

    r = client.post(f"{URL}/sesion", json=cuerpo, headers=escenario["headers"])

    assert r.status_code == 404
    assert r.json() == {"detail": "Esa clase no existe"}
    assert db_session.query(Asistencia).count() == 0


def test_ruta_inexistente_bajo_asistencias_es_404(client, escenario):
    assert client.get(f"{URL}/no-existe", headers=escenario["headers"]).status_code == 404


def test_metodo_no_permitido_es_405(client, escenario):
    assert client.delete(f"{URL}/sesion", headers=escenario["headers"]).status_code == 405


# --- 401 / 403: autenticación y rol ------------------------------------


@pytest.mark.parametrize("metodo,ruta", [
    ("get", "/sesion?idHorario=100&fecha=2026-01-05"),
    ("post", "/sesion"),
    ("get", "/mias"),
])
def test_sin_token_responde_401(client, escenario, metodo, ruta):
    r = getattr(client, metodo)(f"{URL}{ruta}", **({"json": {}} if metodo == "post" else {}))

    assert r.status_code == 401


def test_aprendiz_no_puede_leer_la_nomina_403(client, autenticar_como, escenario):
    _, headers = autenticar_como("Aprendiz")

    r = client.get(f"{URL}/sesion?idHorario=100&fecha={escenario['fecha']}", headers=headers)

    assert r.status_code == 403


def test_la_validacion_de_negocio_422_trae_detail_como_texto(client, escenario):
    """A diferencia del 422 de pydantic (detail = lista), el de negocio
    trae `detail` como string: el cliente debe tolerar ambas formas."""
    martes = (_lunes_pasado() + timedelta(days=1)).isoformat()
    cuerpo = _cuerpo(escenario)
    cuerpo["fechaSesion"] = martes

    r = client.post(f"{URL}/sesion", json=cuerpo, headers=escenario["headers"])

    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)
