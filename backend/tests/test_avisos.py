"""SCRUM-111: Módulo de Avisos y Comunicados de Coordinación — 100% nuevo,
no reusa nada existente. Escritura solo Coordinador/Administrador, lectura
cualquier usuario autenticado, con filtros opcionales por categoría/ficha."""

from datetime import date

from app.api.v1.avisos import router as avisos_router
from app.main import app
from app.models.aviso import Aviso
from app.models.coordinacion import Coordinacion
from app.models.ficha import Ficha
from app.models.programa import Programa
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario

# El router de avisos todavía no está registrado en app/main.py (lo hace el
# integrador central para no pisar a otros módulos que se están agregando
# en paralelo) — se registra acá, de forma idempotente, para poder probar
# el flujo real end-to-end contra el TestClient mientras tanto.
if not any(getattr(ruta, "path", "").startswith("/api/v1/avisos") for ruta in app.routes):
    app.include_router(avisos_router, prefix="/api/v1")


def _crear_tablas_extra(db_session):
    from app.core.database import Base

    tablas = [
        Coordinacion.__table__,
        Programa.__table__,
        Trimestre.__table__,
        Sede.__table__,
        Ficha.__table__,
        Usuario.__table__,
        Aviso.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _poblar_catalogos_basicos(db_session):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
        nivelFormacion="Técnico", activo=True, idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo",
    )
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ficha_1 = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)
    ficha_2 = Ficha(idFicha=2, codigoFicha="FICHA-002", idPrograma=1, idTrimestre=1)

    db_session.add_all([coordinacion, programa, trimestre, sede, ficha_1, ficha_2])
    db_session.commit()


def test_crear_aviso_requiere_coordinador_o_administrador(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/avisos/",
        json={"titulo": "Cambio de aula", "cuerpo": "Se traslada la clase", "categoria": "reprog"},
        headers=headers,
    )

    assert respuesta.status_code == 403


def test_crear_y_listar_avisos(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _poblar_catalogos_basicos(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/avisos/",
        json={
            "titulo": "Suspensión de clases",
            "cuerpo": "Por mantenimiento eléctrico",
            "categoria": "sede",
            "idSede": 1,
        },
        headers=headers,
    )
    assert respuesta.status_code == 200
    aviso = respuesta.json()
    assert aviso["titulo"] == "Suspensión de clases"
    assert aviso["idSede"] == 1

    listado = client.get("/api/v1/avisos/", headers=headers)
    assert listado.status_code == 200
    assert len(listado.json()) == 1


def test_listar_avisos_filtrado_por_categoria_y_ficha(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _poblar_catalogos_basicos(db_session)
    _, headers = autenticar_como("Administrador")

    client.post(
        "/api/v1/avisos/",
        json={"titulo": "Evento cultural", "cuerpo": "Feria de talentos", "categoria": "eventos"},
        headers=headers,
    )
    client.post(
        "/api/v1/avisos/",
        json={"titulo": "Cancelación de clase", "cuerpo": "Instructor incapacitado", "categoria": "reprog", "idFicha": 1},
        headers=headers,
    )
    client.post(
        "/api/v1/avisos/",
        json={"titulo": "Otra reprogramación", "cuerpo": "Cambio de horario", "categoria": "reprog", "idFicha": 2},
        headers=headers,
    )

    por_categoria = client.get("/api/v1/avisos/", params={"categoria": "reprog"}, headers=headers)
    assert por_categoria.status_code == 200
    assert len(por_categoria.json()) == 2

    por_ficha = client.get("/api/v1/avisos/", params={"idFicha": 1}, headers=headers)
    assert por_ficha.status_code == 200
    assert len(por_ficha.json()) == 1
    assert por_ficha.json()[0]["titulo"] == "Cancelación de clase"

    aprendiz_puede_leer = client.get(
        "/api/v1/avisos/",
        headers=(lambda: autenticar_como("Aprendiz")[1])(),
    )
    assert aprendiz_puede_leer.status_code == 200


def test_actualizar_y_eliminar_aviso(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _poblar_catalogos_basicos(db_session)
    _, headers = autenticar_como("Coordinador")

    creado = client.post(
        "/api/v1/avisos/",
        json={"titulo": "Original", "cuerpo": "Cuerpo original", "categoria": "eventos"},
        headers=headers,
    ).json()
    id_aviso = creado["idAviso"]

    actualizado = client.put(
        f"/api/v1/avisos/{id_aviso}",
        json={"titulo": "Editado", "cuerpo": "Cuerpo editado", "categoria": "extraordinario"},
        headers=headers,
    )
    assert actualizado.status_code == 200
    assert actualizado.json()["titulo"] == "Editado"
    assert actualizado.json()["categoria"] == "extraordinario"

    eliminado = client.delete(f"/api/v1/avisos/{id_aviso}", headers=headers)
    assert eliminado.status_code == 200

    listado = client.get("/api/v1/avisos/", headers=headers)
    assert listado.json() == []


def test_actualizar_aviso_inexistente_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Administrador")

    respuesta = client.put(
        "/api/v1/avisos/999",
        json={"titulo": "X", "cuerpo": "Y", "categoria": "eventos"},
        headers=headers,
    )

    assert respuesta.status_code == 404
