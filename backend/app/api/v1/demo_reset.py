"""Preflight seguro del reset DEMO; no modifica datos de aplicación."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user
from app.services.demo_reset_guard_service import DemoResetGuardService
from app.services.demo_reset_service import DemoResetService
from app.services.auditoria_service import AuditoriaService
from app.schemas.demo_reset import ResetDemoRequest

router = APIRouter(prefix="/demo/reset", tags=["demo"])


@router.post("/preflight", status_code=status.HTTP_204_NO_CONTENT)
def preflight_reset_demo(
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
) -> None:
    """Comprueba y audita las guardas antes de exponer el reset real (#189)."""
    DemoResetGuardService.verificar(db, usuario)


@router.post("", status_code=status.HTTP_200_OK)
def resetear_demo(
    datos: ResetDemoRequest,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
) -> dict:
    """Restaura el escenario DEMO; no crea ni elimina cuentas de Auth."""
    DemoResetGuardService.verificar(db, usuario)
    try:
        AuditoriaService.registrar_transaccional(
            db, accion="RESET_DEMO_INICIADO", entidad="demo_reset", usuario=usuario,
            detalle=f"idempotencyKey={datos.idempotencyKey}",
        )
        resultado = DemoResetService.resetear(db)
        AuditoriaService.registrar_transaccional(
            db, accion="RESET_DEMO_EXITOSO", entidad="demo_reset", usuario=usuario,
            detalle=f"idempotencyKey={datos.idempotencyKey}; conteos={resultado}",
        )
        db.commit()
        return {"idempotencyKey": datos.idempotencyKey, **resultado}
    except ValueError as error:
        db.rollback()
        AuditoriaService.registrar(
            db, accion="RESET_DEMO_ERROR", entidad="demo_reset", usuario=usuario,
            detalle=f"idempotencyKey={datos.idempotencyKey}; error={error}",
        )
        raise HTTPException(status_code=503, detail=str(error)) from None
    except Exception as error:
        db.rollback()
        AuditoriaService.registrar(
            db, accion="RESET_DEMO_ERROR", entidad="demo_reset", usuario=usuario,
            detalle=f"idempotencyKey={datos.idempotencyKey}; error={type(error).__name__}",
        )
        raise
