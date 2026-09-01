from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin
from app.schemas.auditoria import AuditoriaResponse, IntentoLoginFallido
from app.services.auditoria_service import AuditoriaService

router = APIRouter(prefix="/auditoria", tags=["auditoria"])


@router.post("/intento-fallido-login", status_code=status.HTTP_204_NO_CONTENT)
def registrar_intento_fallido(data: IntentoLoginFallido, db: Session = Depends(get_db)) -> None:
    """Pública a propósito: el login habla directo con Supabase Auth
    (ver frontend/src/pages/Login.tsx), no pasa por este backend — el
    frontend llama acá cuando supabase.auth.signInWithPassword devuelve
    error, para que quede registrado (RNF-26) y SCRUM-17 pueda contarlo.

    Como es pública y recibe un identificador de texto libre, alguien
    podría spamearla con emails ajenos para intentar "gastarle" los
    intentos a otra persona una vez que SCRUM-17 use este conteo para
    bloquear — SCRUM-17 debería sumarle algún límite por IP u otra
    mitigación antes de confiar en este número a ciegas."""
    AuditoriaService.registrar_login_fallido(db, data.identificador)


@router.get("/", response_model=list[AuditoriaResponse])
def listar_auditoria(
    entidad: str | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return AuditoriaService.obtener_todos(db, entidad)
