"""Preflight seguro del reset DEMO; no modifica datos de aplicación."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user
from app.services.demo_reset_guard_service import DemoResetGuardService

router = APIRouter(prefix="/demo/reset", tags=["demo"])


@router.post("/preflight", status_code=status.HTTP_204_NO_CONTENT)
def preflight_reset_demo(
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
) -> None:
    """Comprueba y audita las guardas antes de exponer el reset real (#189)."""
    DemoResetGuardService.verificar(db, usuario)
