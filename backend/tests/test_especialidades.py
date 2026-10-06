"""T-27/T-25 (SCRUM-142): este módulo no tenía ningún test -- fue así como
pasó inadvertido que GET /especialidades/ exigía Administrador mientras
PUT /usuarios/{id}/especialidades (que depende de leer este catálogo)
admite Coordinador. Ver el comentario en app/api/v1/especialidades.py.
"""


def _payload(nombre: str = "Bases de datos") -> dict:
    return {"nombre": nombre, "descripcion": "Diseño y consultas SQL", "activo": True}


def test_listar_especialidades_requiere_autenticacion(client):
    respuesta = client.get("/api/v1/especialidades/")

    assert respuesta.status_code == 401


def test_crear_especialidad_rechaza_no_admin(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post("/api/v1/especialidades/", json=_payload(), headers=headers)

    assert respuesta.status_code == 403


def test_crear_especialidad_como_admin(client, autenticar_como):
    _, headers = autenticar_como("Administrador")

    respuesta = client.post("/api/v1/especialidades/", json=_payload(), headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["nombre"] == "Bases de datos"
    assert "idEspecialidad" in cuerpo


def test_coordinador_puede_listar_especialidades(client, autenticar_como):
    """Antes de T-27 esto daba 403: un Coordinador no podía leer el
    catálogo que necesita para PUT /usuarios/{id}/especialidades."""
    admin, headers_admin = autenticar_como("Administrador")
    client.post("/api/v1/especialidades/", json=_payload(), headers=headers_admin)

    _, headers_coordinador = autenticar_como("Coordinador")
    respuesta = client.get("/api/v1/especialidades/", headers=headers_coordinador)

    assert respuesta.status_code == 200
    assert any(e["nombre"] == "Bases de datos" for e in respuesta.json())


def test_instructor_no_puede_listar_especialidades(client, autenticar_como):
    """require_lectura_catalogo es Coordinador/Administrador -- a
    diferencia de require_lectura_catalogo_o_instructor que usan otros
    catálogos, acá un Instructor no es lector habitual."""
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/especialidades/", headers=headers)

    assert respuesta.status_code == 403


def test_obtener_especialidad_por_id(client, autenticar_como):
    _, headers_admin = autenticar_como("Administrador")
    creada = client.post("/api/v1/especialidades/", json=_payload(), headers=headers_admin).json()

    _, headers_coordinador = autenticar_como("Coordinador")
    respuesta = client.get(f"/api/v1/especialidades/{creada['idEspecialidad']}", headers=headers_coordinador)

    assert respuesta.status_code == 200
    assert respuesta.json()["nombre"] == "Bases de datos"


def test_obtener_especialidad_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Administrador")

    respuesta = client.get("/api/v1/especialidades/9999", headers=headers)

    assert respuesta.status_code == 404


def test_actualizar_especialidad_rechaza_no_admin(client, autenticar_como):
    _, headers_admin = autenticar_como("Administrador")
    creada = client.post("/api/v1/especialidades/", json=_payload(), headers=headers_admin).json()

    _, headers_coordinador = autenticar_como("Coordinador")
    respuesta = client.put(
        f"/api/v1/especialidades/{creada['idEspecialidad']}",
        json=_payload("Redes"),
        headers=headers_coordinador,
    )

    assert respuesta.status_code == 403


def test_eliminar_especialidad_como_admin(client, autenticar_como):
    _, headers = autenticar_como("Administrador")
    creada = client.post("/api/v1/especialidades/", json=_payload(), headers=headers).json()

    respuesta = client.delete(f"/api/v1/especialidades/{creada['idEspecialidad']}", headers=headers)

    assert respuesta.status_code == 200
    assert client.get(f"/api/v1/especialidades/{creada['idEspecialidad']}", headers=headers).status_code == 404
