from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo
from app.schemas.ambiente import AmbienteCreate, AmbienteResponse, AmbienteUpdate
from app.schemas.horario import HorarioResponse
from app.services.ambiente_service import AmbienteService
from app.services.auditoria_service import AuditoriaService
from app.services.horario_service import HorarioService

router = APIRouter(prefix="/ambientes", tags=["ambientes"])
service = AmbienteService()


@router.get("", response_model=list[AmbienteResponse])
def list_ambientes(sede_id: int | None = None, db: Session = Depends(get_db), usuario=Depends(require_lectura_catalogo)):
    return service.list(db, sede_id)


@router.get("/{ambiente_id}", response_model=AmbienteResponse)
def get_ambiente(ambiente_id: int, db: Session = Depends(get_db), usuario=Depends(require_lectura_catalogo)):
    return service.get(db, ambiente_id)


@router.get("/{ambiente_id}/horarios", response_model=list[HorarioResponse])
def obtener_horarios_ambiente(ambiente_id: int, db: Session = Depends(get_db), usuario=Depends(require_lectura_catalogo)):
    """Horarios de un ambiente — alimenta la sección "Ambientes asignados"
    del drawer de relacionados en Instructores.tsx (SCRUM-48)."""
    service.get(db, ambiente_id)  # 404 si no existe
    return HorarioService.obtener_por_ambiente(db, ambiente_id)


@router.post("", response_model=AmbienteResponse, status_code=status.HTTP_201_CREATED)
def create_ambiente(data: AmbienteCreate, db: Session = Depends(get_db), usuario=Depends(require_admin)):
    ambiente = service.create(db, data)
    AuditoriaService.registrar(db, usuario=usuario, accion="CREAR", entidad="ambientes", id_entidad=ambiente.id)
    return ambiente


@router.put("/{ambiente_id}", response_model=AmbienteResponse)
def update_ambiente(ambiente_id: int, data: AmbienteUpdate, db: Session = Depends(get_db), usuario=Depends(require_admin)):
    ambiente = service.update(db, ambiente_id, data)
    AuditoriaService.registrar(db, usuario=usuario, accion="ACTUALIZAR", entidad="ambientes", id_entidad=ambiente_id)
    return ambiente


@router.delete("/{ambiente_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ambiente(ambiente_id: int, db: Session = Depends(get_db), usuario=Depends(require_admin)) -> Response:
    service.delete(db, ambiente_id)
    AuditoriaService.registrar(db, usuario=usuario, accion="ELIMINAR", entidad="ambientes", id_entidad=ambiente_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
