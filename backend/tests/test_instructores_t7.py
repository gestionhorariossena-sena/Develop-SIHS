"""T-7 (SCRUM-139): módulo de instructores — listado filtrado en el servidor
y validaciones de rol que antes faltaban."""

from app.models.especialidad import Especialidad
from app.services import instructor_service


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
    con_redes = crear_usuario(
        nombre="Diana Castro",
        email="diana.castro@example.com",
        roles=[rol_instructor],
    )
    con_redes.especialidades = [redes]
    con_redes.sigla = "DC"
    db_session.commit()
    crear_usuario(nombre="Luis Mora", email="luis.mora@example.com", roles=[rol_instructor])

    por_sigla = client.get("/api/v1/usuarios/instructores?busqueda=dc", headers=headers).json()
    assert [u["nombre"] for u in por_sigla] == ["Diana Castro"]

    por_especialidad = client.get(
        f"/api/v1/usuarios/instructores?id_especialidad={redes.idEspecialidad}", headers=headers
    ).json()
    assert [u["nombre"] for u in por_especialidad] == ["Diana Castro"]


def test_listar_instructores_exige_rol_de_gestion(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    assert client.get("/api/v1/usuarios/instructores", headers=headers).status_code == 403


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
