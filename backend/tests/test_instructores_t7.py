"""T-7 (SCRUM-139): módulo de instructores — listado filtrado en el servidor
y validaciones de rol que antes faltaban."""

import pytest

from app.models.especialidad import Especialidad
from app.services import instructor_service
from app.services.instructor_service import CodigoNoDisponibleError, InstructorService


def test_listar_instructores_solo_devuelve_rol_instructor_ordenado(client, autenticar_como, crear_usuario, crear_rol):
    _, headers = autenticar_como("Coordinador")
    rol_instructor = crear_rol("Instructor")
    crear_usuario(nombre="Zoila", roles=[rol_instructor])
    crear_usuario(nombre="andrés", roles=[rol_instructor])
    crear_usuario(nombre="Aprendiz", roles=[crear_rol("Aprendiz")])

    respuesta = client.get("/api/v1/usuarios/instructores", headers=headers)

    assert respuesta.status_code == 200
    assert [u["nombre"] for u in respuesta.json()] == ["andrés", "Zoila"]


def test_listar_instructores_filtra_por_busqueda_y_especialidad(
    client, autenticar_como, crear_usuario, crear_rol, db_session
):
    _, headers = autenticar_como("Administrador")
    rol_instructor = crear_rol("Instructor")
    redes = Especialidad(nombre="Redes")
    db_session.add(redes)
    db_session.commit()
    con_redes = crear_usuario(nombre="Diana Castro", roles=[rol_instructor])
    con_redes.especialidades = [redes]
    con_redes.sigla = "DC"
    db_session.commit()
    crear_usuario(nombre="Luis Mora", roles=[rol_instructor])

    por_sigla = client.get("/api/v1/usuarios/instructores?busqueda=dc", headers=headers).json()
    assert [u["nombre"] for u in por_sigla] == ["Diana Castro"]

    por_especialidad = client.get(
        f"/api/v1/usuarios/instructores?id_especialidad={redes.idEspecialidad}", headers=headers
    ).json()
    assert [u["nombre"] for u in por_especialidad] == ["Diana Castro"]


def test_listar_instructores_exige_rol_de_gestion(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    assert client.get("/api/v1/usuarios/instructores", headers=headers).status_code == 403


def test_generar_codigo_a_quien_no_es_instructor_da_400(client, autenticar_como, crear_usuario, crear_rol):
    _, headers = autenticar_como("Coordinador")
    aprendiz = crear_usuario(nombre="Aprendiz", roles=[crear_rol("Aprendiz")])

    respuesta = client.post(
        "/api/v1/usuarios/instructor/codigo/generar",
        json={"idUsuario": str(aprendiz.idUsuario)},
        headers=headers,
    )

    assert respuesta.status_code == 400
    assert aprendiz.codigoInstructor is None


def test_generar_codigo_por_api_devuelve_codigo(client, autenticar_como, crear_usuario, crear_rol):
    _, headers = autenticar_como("Coordinador")
    instructor = crear_usuario(nombre="Sergio", roles=[crear_rol("Instructor")])

    respuesta = client.post(
        "/api/v1/usuarios/instructor/codigo/generar",
        json={"idUsuario": str(instructor.idUsuario)},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["codigo"].startswith("INS-")


def test_generar_codigo_sin_codigo_libre_falla_en_vez_de_repetir(db_session, crear_usuario, crear_rol, monkeypatch):
    rol_instructor = crear_rol("Instructor")
    ocupado = crear_usuario(nombre="Ocupado", roles=[rol_instructor])
    ocupado.codigoInstructor = "INS-AAAAAA"
    db_session.commit()
    nuevo = crear_usuario(nombre="Nuevo", roles=[rol_instructor])
    monkeypatch.setattr(InstructorService, "_nuevo_codigo", staticmethod(lambda: "INS-AAAAAA"))

    with pytest.raises(CodigoNoDisponibleError):
        InstructorService.generar_codigo(db_session, nuevo.idUsuario)

    db_session.refresh(nuevo)
    assert nuevo.codigoInstructor is None


def test_validar_codigo_no_expone_a_quien_pertenece(client, db_session, crear_usuario, crear_rol):
    instructor = crear_usuario(nombre="Laura", roles=[crear_rol("Instructor")])
    instructor.codigoInstructor = "INS-ZZ1234"
    db_session.commit()

    respuesta = client.post("/api/v1/usuarios/instructor/codigo/validar", json={"codigo": " ins-zz1234 "})

    assert respuesta.status_code == 200
    assert respuesta.json() == {"valido": True, "codigo": "INS-ZZ1234"}


def test_validar_codigo_de_usuario_sin_rol_instructor_no_es_valido(db_session, crear_usuario):
    sin_rol = crear_usuario(nombre="SinRol")
    sin_rol.codigoInstructor = "INS-QQ0000"
    db_session.commit()

    assert InstructorService.validar_codigo(db_session, "INS-QQ0000")["valido"] is False


def test_especialidades_solo_para_instructores(client, autenticar_como, crear_usuario, crear_rol):
    _, headers = autenticar_como("Coordinador")
    aprendiz = crear_usuario(nombre="Aprendiz", roles=[crear_rol("Aprendiz")])

    respuesta = client.put(
        f"/api/v1/usuarios/{aprendiz.idUsuario}/especialidades",
        json={"idsEspecialidades": []},
        headers=headers,
    )

    assert respuesta.status_code == 400


def test_es_instructor():
    class _Rol:
        def __init__(self, nombre):
            self.nombre = nombre

    class _Usuario:
        def __init__(self, *roles):
            self.roles = [_Rol(r) for r in roles]

    assert instructor_service.es_instructor(_Usuario("Instructor", "Coordinador"))
    assert not instructor_service.es_instructor(_Usuario("Aprendiz"))
