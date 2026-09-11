from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_aprendiz
from app.models.usuario import Usuario
from app.schemas.anotacion_horario import (
    AnotacionHorarioCreate,
    AnotacionHorarioResponse,
    AnotacionHorarioUpdate,
)
from app.services.anotacion_horario_service import AnotacionHorarioService

router = APIRouter(prefix="/anotaciones-horario", tags=["anotaciones-horario"])


@router.post("/", response_model=AnotacionHorarioResponse)
def crear_anotacion(
    data: AnotacionHorarioCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_aprendiz),
):
    return AnotacionHorarioService.crear(db, data, usuario.idUsuario)


@router.get("/mias", response_model=list[AnotacionHorarioResponse])
def obtener_mis_anotaciones(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_aprendiz),
):
    return AnotacionHorarioService.obtener_mias(db, usuario.idUsuario)


@router.put("/{id_anotacion}", response_model=AnotacionHorarioResponse)
def actualizar_anotacion(
    id_anotacion: int,
    data: AnotacionHorarioUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_aprendiz),
):
    anotacion = AnotacionHorarioService.actualizar(db, id_anotacion, data, usuario.idUsuario)

    if not anotacion:
        raise HTTPException(status_code=404, detail="Anotación no encontrada")

    return anotacion


@router.delete("/{id_anotacion}")
def eliminar_anotacion(
    id_anotacion: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_aprendiz),
):
    eliminado = AnotacionHorarioService.eliminar(db, id_anotacion, usuario.idUsuario)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Anotación no encontrada")

    return {"mensaje": "Anotación eliminada"}
