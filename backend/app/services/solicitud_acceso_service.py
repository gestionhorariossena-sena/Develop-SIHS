"""Alta de personas que todavía NO tienen cuenta: alguien pide acceso
desde el registro, un Administrador la aprueba y recién ahí se le crea la
cuenta de Supabase Auth con su rol y una clave temporal.

Es la otra mitad de SCRUM-109: la tabla (`models/solicitud_acceso.py`) y
el servicio que crea la cuenta (`credencial_temporal_service.py`) ya
existían y estaban probados, pero nunca se escribió el módulo que los
conectara, así que las dos pantallas que lo consumen (Registro.tsx y
PanelAdministracion.tsx) llamaban a un 404 — H-3.
"""

from datetime import datetime, timezone

from app.models.rol import Rol
from app.models.solicitud_acceso import SolicitudAcceso
from app.models.usuario import Usuario
from app.repositories.solicitud_acceso_repository import SolicitudAccesoRepository
from app.services.credencial_temporal_service import CredencialTemporalService

# El formulario público del registro es "¿Eres coordinador? Solicita
# acceso" y no tiene selector de rol: si no viene ninguno, es este.
ROL_SOLICITADO_POR_DEFECTO = "Coordinador"


class SolicitudAccesoError(Exception):
    """Algo que el cliente puede corregir. `estado_http` es el código con
    el que el router debe responder."""

    def __init__(self, mensaje: str, estado_http: int = 422):
        super().__init__(mensaje)
        self.estado_http = estado_http


class SolicitudAccesoService:
    @staticmethod
    def crear(db, data) -> SolicitudAcceso:
        email = str(data.email).strip().lower()

        if db.query(Usuario).filter(Usuario.email == email).first():
            raise SolicitudAccesoError(
                "Ese correo ya tiene una cuenta. Inicia sesión o usa "
                "«¿Olvidaste tu contraseña?» para recuperarla.",
                409,
            )

        if SolicitudAccesoRepository.obtener_pendiente_por_email(db, email):
            raise SolicitudAccesoError(
                "Ya hay una solicitud pendiente con ese correo. Te avisaremos "
                "cuando la coordinación la revise.",
                409,
            )

        id_rol = data.idRolSolicitado or SolicitudAccesoService._id_rol_por_defecto(db)

        if not db.get(Rol, id_rol):
            raise SolicitudAccesoError("El rol solicitado no existe", 422)

        solicitud = SolicitudAcceso(
            nombre=data.nombre.strip(),
            email=email,
            numeroDocumento=(data.numeroDocumento or "").strip() or None,
            idRolSolicitado=id_rol,
            motivo=data.motivo.strip(),
            estado="pendiente",
        )
        return SolicitudAccesoRepository.crear(db, solicitud)

    @staticmethod
    def _id_rol_por_defecto(db) -> int:
        rol = db.query(Rol).filter(Rol.nombre == ROL_SOLICITADO_POR_DEFECTO).first()
        if not rol:
            raise SolicitudAccesoError(
                f"El rol '{ROL_SOLICITADO_POR_DEFECTO}' no existe en la base de datos", 500
            )
        return rol.idRol

    @staticmethod
    def obtener_todas(db, estado: str | None = None) -> list[SolicitudAcceso]:
        return SolicitudAccesoRepository.obtener_todas(db, estado)

    @staticmethod
    def aprobar(db, id_solicitud: int, id_admin, id_rol: int) -> dict:
        """Crea la cuenta con clave temporal y deja la solicitud resuelta.

        La cuenta se crea PRIMERO: si Supabase falla, la solicitud sigue
        pendiente y se puede reintentar — al revés quedaría marcada como
        aprobada sin que exista ninguna cuenta detrás.
        """
        solicitud = SolicitudAccesoService._pendiente(db, id_solicitud)

        if not db.get(Rol, id_rol):
            raise SolicitudAccesoError("El rol indicado no existe", 422)

        try:
            credencial = CredencialTemporalService.crear_cuenta_con_clave_temporal(
                db, email=solicitud.email, nombre=solicitud.nombre, id_rol=id_rol
            )
        except SolicitudAccesoError:
            raise
        except Exception as exc:
            raise SolicitudAccesoError(
                "No se pudo crear la cuenta en Supabase. La solicitud sigue "
                "pendiente: inténtalo de nuevo en unos minutos.",
                503,
            ) from exc

        # El rol con el que se aprueba manda sobre el que se pidió: el
        # panel deja cambiarlo (alguien pide Coordinador y se le da
        # Instructor), y lo que quede registrado debe ser lo que de verdad
        # se le otorgó.
        solicitud.idRolSolicitado = id_rol

        solicitud = SolicitudAccesoRepository.resolver(
            db,
            solicitud,
            estado="aprobada",
            id_admin=id_admin,
            fecha_resolucion=datetime.now(timezone.utc),
        )

        return {
            "solicitud": solicitud,
            "email": credencial["email"],
            "passwordTemporal": credencial["passwordTemporal"],
            # Hoy siempre False: el correo depende del SMTP del proyecto de
            # Supabase, que sigue sin configurar (H-15 / SCRUM-129). El
            # campo existe para que el cliente no tenga que cambiar cuando
            # eso se resuelva.
            "correoEnviado": False,
        }

    @staticmethod
    def rechazar(db, id_solicitud: int, id_admin, motivo_rechazo: str) -> SolicitudAcceso:
        solicitud = SolicitudAccesoService._pendiente(db, id_solicitud)

        motivo = (motivo_rechazo or "").strip()
        if not motivo:
            raise SolicitudAccesoError("El rechazo necesita un motivo", 422)

        return SolicitudAccesoRepository.resolver(
            db,
            solicitud,
            estado="rechazada",
            id_admin=id_admin,
            fecha_resolucion=datetime.now(timezone.utc),
            motivo_rechazo=motivo,
        )

    @staticmethod
    def _pendiente(db, id_solicitud: int) -> SolicitudAcceso:
        solicitud = SolicitudAccesoRepository.obtener_por_id(db, id_solicitud)

        if not solicitud:
            raise SolicitudAccesoError("Solicitud no encontrada", 404)

        if solicitud.estado != "pendiente":
            # Dos administradores con el panel abierto a la vez: el segundo
            # debe enterarse, no pisar la decisión del primero.
            raise SolicitudAccesoError(
                f"Esta solicitud ya fue {solicitud.estado}. Recarga el panel para ver su estado actual.",
                409,
            )

        return solicitud
