"""S5: aisla SolicitudAccesoService de sus repositorios con dobles."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock

from app.models.solicitud_acceso import SolicitudAcceso
from app.schemas.solicitud_acceso import SolicitudAccesoCreate
from app.services import solicitud_acceso_service as service


def _datos_solicitud():
    return SolicitudAccesoCreate(
        nombre="Ada Lovelace",
        email="ada@example.com",
        numeroDocumento="12345678",
        idRolSolicitado=3,
        motivo="Necesito acceso para coordinar.",
    )


class _FakeSolicitudAccesoRepository:
    """Fake en memoria: conserva solicitudes creadas sin usar SQLAlchemy."""

    def __init__(self, pendiente=None):
        self.pendiente = pendiente
        self.solicitudes = []
        self.consultas_email = []

    def obtener_pendiente_por_email(self, db, email):
        self.consultas_email.append(email)
        if self.pendiente and self.pendiente.email == email:
            return self.pendiente
        return None

    def crear(self, db, solicitud):
        solicitud.idSolicitud = len(self.solicitudes) + 1
        solicitud.estado = "pendiente"
        solicitud.fechaSolicitud = datetime(2026, 1, 1, tzinfo=timezone.utc)
        solicitud.fechaResolucion = None
        solicitud.motivoRechazo = None
        solicitud.idAdminResolvio = None
        self.solicitudes.append(solicitud)
        return solicitud


def test_rol_inexistente_no_consulta_duplicados_ni_persiste(monkeypatch):
    # Arrange: mocks verifican que el repositorio de solicitudes no se use
    # después de que el repositorio de roles rechaza el rol.
    db = Mock()
    obtener_rol = Mock(return_value=None)
    buscar_pendiente = Mock()
    crear_solicitud = Mock()
    notificar = Mock()
    monkeypatch.setattr(
        service.RolRepository, "obtener_por_id", staticmethod(obtener_rol)
    )
    monkeypatch.setattr(
        service.SolicitudAccesoRepository,
        "obtener_pendiente_por_email",
        staticmethod(buscar_pendiente),
    )
    monkeypatch.setattr(
        service.SolicitudAccesoRepository, "crear", staticmethod(crear_solicitud)
    )
    monkeypatch.setattr(
        service.NotificacionService,
        "notificar_roles_transaccional",
        staticmethod(notificar),
    )

    # Act
    resultado = service.SolicitudAccesoService.crear(db, _datos_solicitud())

    # Assert
    obtener_rol.assert_called_once_with(db, 3)
    buscar_pendiente.assert_not_called()
    crear_solicitud.assert_not_called()
    notificar.assert_not_called()
    db.commit.assert_not_called()
    assert resultado == "ROL_NO_EXISTE"


def test_email_pendiente_no_guarda_ni_notifica(monkeypatch):
    # Arrange: el repositorio falso devuelve una solicitud existente y
    # permite inspeccionar que el camino de duplicado no altere estado.
    db = Mock()
    solicitud_existente = SimpleNamespace(email="ada@example.com")
    fake_repository = _FakeSolicitudAccesoRepository(
        pendiente=solicitud_existente
    )
    rol = SimpleNamespace(idRol=3, nombre="Instructor")
    notificar = Mock()
    monkeypatch.setattr(
        service.RolRepository,
        "obtener_por_id",
        staticmethod(Mock(return_value=rol)),
    )
    monkeypatch.setattr(
        service.SolicitudAccesoRepository,
        "obtener_pendiente_por_email",
        staticmethod(fake_repository.obtener_pendiente_por_email),
    )
    monkeypatch.setattr(
        service.SolicitudAccesoRepository,
        "crear",
        staticmethod(fake_repository.crear),
    )
    monkeypatch.setattr(
        service.NotificacionService,
        "notificar_roles_transaccional",
        staticmethod(notificar),
    )

    # Act
    resultado = service.SolicitudAccesoService.crear(db, _datos_solicitud())

    # Assert
    assert resultado == "YA_PENDIENTE"
    assert fake_repository.consultas_email == ["ada@example.com"]
    assert fake_repository.solicitudes == []
    notificar.assert_not_called()
    db.commit.assert_not_called()


def test_solicitud_valida_se_guarda_en_fake_y_devuelve_respuesta(monkeypatch):
    # Arrange: el fake en memoria prueba el estado guardado; los mocks
    # aíslan roles y notificaciones, que no son el objetivo de este test.
    db = Mock()
    fake_repository = _FakeSolicitudAccesoRepository()
    rol = SimpleNamespace(idRol=3, nombre="Instructor")
    notificar = Mock()
    monkeypatch.setattr(
        service.RolRepository,
        "obtener_por_id",
        staticmethod(Mock(return_value=rol)),
    )
    monkeypatch.setattr(
        service.SolicitudAccesoRepository,
        "obtener_pendiente_por_email",
        staticmethod(fake_repository.obtener_pendiente_por_email),
    )
    monkeypatch.setattr(
        service.SolicitudAccesoRepository,
        "crear",
        staticmethod(fake_repository.crear),
    )
    monkeypatch.setattr(
        service.NotificacionService,
        "notificar_roles_transaccional",
        staticmethod(notificar),
    )

    # Act
    respuesta = service.SolicitudAccesoService.crear(db, _datos_solicitud())

    # Assert
    assert len(fake_repository.solicitudes) == 1
    guardada = fake_repository.solicitudes[0]
    assert isinstance(guardada, SolicitudAcceso)
    assert guardada.nombre == "Ada Lovelace"
    assert guardada.email == "ada@example.com"
    assert guardada.idRolSolicitado == 3
    assert respuesta["idSolicitud"] == guardada.idSolicitud
    assert respuesta["email"] == guardada.email
    assert respuesta["rolSolicitado"] == "Instructor"
    assert respuesta["estado"] == "pendiente"
    notificar.assert_called_once_with(
        db,
        roles=service.ROLES_ADMINISTRACION,
        tipo=service.TIPO_SISTEMA,
        mensaje="Nueva solicitud de acceso de Ada Lovelace como Instructor.",
        entidad_relacionada="solicitudes_acceso",
        id_entidad_relacionada=guardada.idSolicitud,
    )
    db.commit.assert_called_once_with()
