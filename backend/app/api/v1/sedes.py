from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo
from app.schemas.sede import SedeCreate, SedeResponse, SedeUpdate
from app.services.sede_service import SedeService

router = APIRouter(prefix="/sedes", tags=["sedes"])
service = SedeService()


@router.get("", response_model=list[SedeResponse])
def list_sedes(db: Session = Depends(get_db), usuario=Depends(require_lectura_catalogo)):
    return service.list(db)


@router.get("/{sede_id}", response_model=SedeResponse)
def get_sede(sede_id: int, db: Session = Depends(get_db), usuario=Depends(require_lectura_catalogo)):
    return service.get(db, sede_id)


@router.post("", response_model=SedeResponse, status_code=status.HTTP_201_CREATED)
def create_sede(data: SedeCreate, db: Session = Depends(get_db), usuario=Depends(require_admin)):
    return service.create(db, data)


@router.put("/{sede_id}", response_model=SedeResponse)
def update_sede(sede_id: int, data: SedeUpdate, db: Session = Depends(get_db), usuario=Depends(require_admin)):
    return service.update(db, sede_id, data)


@router.delete("/{sede_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sede(sede_id: int, db: Session = Depends(get_db), usuario=Depends(require_admin)) -> Response:
    service.delete(db, sede_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
