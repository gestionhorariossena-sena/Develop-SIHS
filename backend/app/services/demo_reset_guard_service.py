"""Barreras no destructivas que toda operación de reset DEMO debe usar."""
from urllib.parse import urlparse

from fastapi import HTTPException, status

from app.core.config import settings
from app.services.auditoria_service import AuditoriaService


class DemoResetGuardService:
    """Autoriza el reset solo en el proyecto DEMO explícitamente permitido.

    El servicio registra tanto rechazos como preflights exitosos. El endpoint
    transaccional de #189 debe invocar ``verificar`` antes de tocar datos.
    """

    @staticmethod
    def verificar(db, usuario) -> None:
        motivo = DemoResetGuardService._motivo_rechazo(usuario)
        if motivo:
            AuditoriaService.registrar(
                db,
                accion="RESET_DEMO_RECHAZADO",
                entidad="demo_reset",
                usuario=usuario,
                detalle=motivo,
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=motivo)

        AuditoriaService.registrar(
            db,
            accion="RESET_DEMO_PREVALIDADO",
            entidad="demo_reset",
            usuario=usuario,
            detalle="Guardas DEMO verificadas; no se modificaron datos.",
        )

    @staticmethod
    def _motivo_rechazo(usuario) -> str | None:
        if not any(rol.nombre == "Administrador" for rol in usuario.roles):
            return "Solo un Administrador puede ejecutar el reset DEMO."
        if not settings.demo_mode:
            return "Reset DEMO deshabilitado: DEMO_MODE=true es obligatorio."
        if settings.app_env != "demo":
            return "El reset solo puede ejecutarse con APP_ENV=demo."
        if not settings.sihs_demo_project_ref:
            return "Falta la allow-list SIHS_DEMO_PROJECT_REF."

        host = (urlparse(settings.supabase_url).hostname or "").lower()
        ref = host.removesuffix(".supabase.co") if host.endswith(".supabase.co") else ""
        if ref != settings.sihs_demo_project_ref:
            return "SUPABASE_URL no pertenece al proyecto DEMO permitido."
        return None
