import csv
import io
import secrets
from datetime import datetime, timezone

from app.models.solicitud_acceso import SolicitudAcceso
from app.models.usuario import Usuario
from app.repositories.rol_repository import RolRepository
from app.repositories.solicitud_acceso_repository import SolicitudAccesoRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.services.email_service import EmailService, SmtpNoConfiguradoError
from app.services.supabase_admin_service import crear_o_recuperar_usuario_supabase
from app.services.usuario_rol_service import UsuarioRolService

ENCABEZADOS_CSV = [
    "idSolicitud",
    "nombre",
    "email",
    "numeroDocumento",
    "rolSolicitado",
    "motivo",
    "estado",
    "motivoRechazo",
    "fechaSolicitud",
    "fechaResolucion",
    "idAdminResolvio",
]


class SolicitudAccesoService:
    @staticmethod
    def a_response(solicitud: SolicitudAcceso, rol) -> dict:
        """Serializa una solicitud con el nombre del rol ya resuelto -- no
        obliga al frontend a pedirlo aparte (mismo criterio que
        HorarioService.a_response)."""
        return {
            "idSolicitud": solicitud.idSolicitud,
            "nombre": solicitud.nombre,
            "email": solicitud.email,
            "numeroDocumento": solicitud.numeroDocumento,
            "idRolSolicitado": solicitud.idRolSolicitado,
            "rolSolicitado": rol.nombre if rol else None,
            "motivo": solicitud.motivo,
            "estado": solicitud.estado,
            "motivoRechazo": solicitud.motivoRechazo,
            "fechaSolicitud": solicitud.fechaSolicitud,
            "fechaResolucion": solicitud.fechaResolucion,
            "idAdminResolvio": solicitud.idAdminResolvio,
        }

    @staticmethod
    def crear(db, data):
        rol = RolRepository.obtener_por_id(db, data.idRolSolicitado)
        if not rol:
            return "ROL_NO_EXISTE"

        if SolicitudAccesoRepository.obtener_pendiente_por_email(db, data.email):
            return "YA_PENDIENTE"

        solicitud = SolicitudAcceso(
            nombre=data.nombre,
            email=data.email,
            numeroDocumento=data.numeroDocumento,
            idRolSolicitado=data.idRolSolicitado,
            motivo=data.motivo,
        )
        SolicitudAccesoRepository.crear(db, solicitud)

        return SolicitudAccesoService.a_response(solicitud, rol)

    @staticmethod
    def listar(db, estado: str | None = None):
        filas = SolicitudAccesoRepository.listar(db, estado)
        return [SolicitudAccesoService.a_response(solicitud, rol) for solicitud, rol in filas]

    @staticmethod
    def exportar_csv(db, estado: str | None = None) -> str:
        """Botón "Exportar Registro (CSV)" del Panel de Administración --
        mismo filtro por estado que usa GET /solicitudes-acceso/."""
        filas = SolicitudAccesoRepository.listar(db, estado)

        buffer = io.StringIO()
        escritor = csv.writer(buffer)
        escritor.writerow(ENCABEZADOS_CSV)

        for solicitud, rol in filas:
            escritor.writerow(
                [
                    solicitud.idSolicitud,
                    solicitud.nombre,
                    solicitud.email,
                    solicitud.numeroDocumento,
                    rol.nombre,
                    solicitud.motivo,
                    solicitud.estado,
                    solicitud.motivoRechazo or "",
                    solicitud.fechaSolicitud.isoformat() if solicitud.fechaSolicitud else "",
                    solicitud.fechaResolucion.isoformat() if solicitud.fechaResolucion else "",
                    str(solicitud.idAdminResolvio) if solicitud.idAdminResolvio else "",
                ]
            )

        return buffer.getvalue()

    @staticmethod
    def aprobar(db, id_solicitud: int, id_rol_otorgado: int, admin_usuario):
        """Flujo literal del mockup, sección "Flujo al Aprobar":
        1. Crear/reutilizar la cuenta de Supabase Auth (Admin API,
           supabase_admin_service -- mismo código que scripts/crear_admin.py).
        2. Crear la fila en "usuarios" si no existe.
        3. Asignar el rol (UsuarioRolService.asignar, sin reimplementar
           esa validación).
        4. usuarios.debe_cambiar_clave = true.
        5. Marcar la solicitud aprobada.
        6. Enviar la credencial temporal (EmailService -- si SMTP no está
           configurado todavía, no se bloquea la aprobación, ver
           _Docs/Documentación general/DECISION_ENVIO_CREDENCIAL_TEMPORAL.md).
        La auditoría (paso 7 del ticket) la deja el router, igual que
        POST /usuario-rol/asignar."""
        fila = SolicitudAccesoRepository.obtener_por_id(db, id_solicitud)
        if not fila:
            return "SOLICITUD_NO_EXISTE"

        solicitud, rol_solicitado = fila

        if solicitud.estado != "pendiente":
            return "NO_PENDIENTE"

        rol_otorgado = RolRepository.obtener_por_id(db, id_rol_otorgado)
        if not rol_otorgado:
            return "ROL_NO_EXISTE"

        password_temporal = secrets.token_urlsafe(9)
        usuario_supabase, _creado = crear_o_recuperar_usuario_supabase(solicitud.email, password_temporal)
        id_usuario = usuario_supabase["id"]

        usuario = UsuarioRepository.obtener_por_id(db, id_usuario)
        if not usuario:
            usuario = Usuario(idUsuario=id_usuario, nombre=solicitud.nombre, email=solicitud.email)
            db.add(usuario)
            db.commit()
            db.refresh(usuario)

        UsuarioRolService.asignar(db, id_usuario, id_rol_otorgado)

        usuario.debe_cambiar_clave = True
        db.commit()

        solicitud.estado = "aprobada"
        solicitud.fechaResolucion = datetime.now(timezone.utc)
        solicitud.idAdminResolvio = admin_usuario.idUsuario
        db.commit()
        db.refresh(solicitud)

        try:
            EmailService.enviar_credencial_temporal(
                destinatario_email=solicitud.email,
                destinatario_nombre=solicitud.nombre,
                password_temporal=password_temporal,
            )
        except SmtpNoConfiguradoError:
            # Ver DECISION_ENVIO_CREDENCIAL_TEMPORAL.md: la cuenta y el rol
            # ya quedaron creados igual, el envío del correo es lo único
            # pendiente de que exista la configuración SMTP.
            pass

        # `rolSolicitado` en la respuesta refleja el rol que se pidió
        # originalmente (idRolSolicitado no cambia) -- el rol realmente
        # otorgado es el que ya envió el caller en `data.idRol`.
        return SolicitudAccesoService.a_response(solicitud, rol_solicitado)

    @staticmethod
    def rechazar(db, id_solicitud: int, motivo_rechazo: str, admin_usuario):
        fila = SolicitudAccesoRepository.obtener_por_id(db, id_solicitud)
        if not fila:
            return "SOLICITUD_NO_EXISTE"

        solicitud, rol = fila

        if solicitud.estado != "pendiente":
            return "NO_PENDIENTE"

        solicitud.estado = "rechazada"
        solicitud.motivoRechazo = motivo_rechazo
        solicitud.fechaResolucion = datetime.now(timezone.utc)
        solicitud.idAdminResolvio = admin_usuario.idUsuario
        db.commit()
        db.refresh(solicitud)

        try:
            EmailService.enviar_rechazo_solicitud(
                destinatario_email=solicitud.email,
                destinatario_nombre=solicitud.nombre,
                motivo_rechazo=motivo_rechazo,
            )
        except SmtpNoConfiguradoError:
            pass

        return SolicitudAccesoService.a_response(solicitud, rol)
