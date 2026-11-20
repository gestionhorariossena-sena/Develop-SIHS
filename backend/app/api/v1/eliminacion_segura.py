from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin
from app.services.auditoria_service import AuditoriaService
from app.services.eliminacion_segura_service import EliminacionSeguraService

router = APIRouter(prefix="/eliminacion-segura", tags=["eliminación segura"])


@router.get("/{tipo}/{identificador}")
def previsualizar(tipo: str, identificador: str, db: Session = Depends(get_db), usuario=Depends(require_admin)):
    return EliminacionSeguraService.analizar(db, tipo, identificador)


@router.delete("/{tipo}/{identificador}")
def eliminar(tipo: str, identificador: str, db: Session = Depends(get_db), usuario=Depends(require_admin)):
    resultado = EliminacionSeguraService.eliminar(db, tipo, identificador)
    AuditoriaService.registrar(db, usuario=usuario, accion="ELIMINAR_SEGURO", entidad=tipo, id_entidad=identificador, detalle=str(resultado["dependencias"]))
    return resultado
