from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin
from app.schemas.auditoria import AuditoriaResponse, EstadoLoginResponse, IntentoLoginFallido
from app.services.auditoria_service import AuditoriaService

router = APIRouter(prefix="/auditoria", tags=["auditoria"])


@router.post("/intento-fallido-login", status_code=status.HTTP_204_NO_CONTENT)
def registrar_intento_fallido(data: IntentoLoginFallido, db: Session = Depends(get_db)) -> None:
    """Pública a propósito: el login habla directo con Supabase Auth
    (ver frontend/src/pages/Login.tsx), no pasa por este backend — el
    frontend llama acá cuando supabase.auth.signInWithPassword devuelve
    error, para que quede registrado (RNF-26) y alimente el bloqueo de
    GET /auditoria/estado-login (RF-001/RNF-06).

    Como es pública y recibe un identificador de texto libre, alguien
    podría spamearla con el email de otra persona para "gastarle" los 3
    intentos y bloquearla — es una limitación conocida de que el login no
    pasa por este backend (no hay forma de confirmar acá que quien llama
    de verdad intentó loguearse con ese email). Mitigarlo (ej. límite por
    IP) queda pendiente si el equipo lo pide."""
    AuditoriaService.registrar_login_fallido(db, data.identificador)


@router.get("/estado-login", response_model=EstadoLoginResponse)
def verificar_estado_login(identificador: str, db: Session = Depends(get_db)):
    """Pública a propósito, por la misma razón que la de arriba: el
    frontend la consulta ANTES de llamar a
    supabase.auth.signInWithPassword, para no dejar seguir si ya se
    gastaron los 3 intentos permitidos (RF-001/RNF-06)."""
    return AuditoriaService.verificar_bloqueo(db, identificador)


@router.get("/", response_model=list[AuditoriaResponse])
def listar_auditoria(
    entidad: str | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return AuditoriaService.obtener_todos(db, entidad)
