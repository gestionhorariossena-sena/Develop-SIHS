from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_roles
from app.schemas.publicacion_programada import PublicacionProgramadaInput
from app.services.publicacion_programada_service import (
    PublicacionProgramadaError, cancelar, ids_de_horarios, listar, obtener,
    programar, reprogramar,
)
from app.services.worker_publicacion_service import consultar_disponibilidad

router = APIRouter(prefix="/publicaciones-programadas", tags=["publicaciones programadas"])
puede_gestionar = require_roles("Coordinador", "Administrador")


def _response(db, row):
    return {
        "idPublicacion": row.idPublicacion, "idTrimestre": row.idTrimestre,
        "idCoordinador": row.idCoordinador, "fechaEjecucion": row.fechaEjecucion,
        "estado": row.estado, "fechaCreacion": row.fechaCreacion,
        "fechaEjecucionReal": row.fechaEjecucionReal, "resultado": row.resultado,
        "revision": row.revision, "idHorarios": ids_de_horarios(db, row.idPublicacion),
    }


def _get(db, id_publicacion):
    row = obtener(db, id_publicacion)
    if row is None:
        raise HTTPException(status_code=404, detail="Publicación programada no encontrada.")
    return row


def _exigir_worker(db):
    disponibilidad = consultar_disponibilidad(db)
    if not disponibilidad["habilitado"]:
        raise HTTPException(
            status_code=503,
            detail={
                "motivo": "worker_no_disponible",
                "mensaje": disponibilidad["motivo"],
            },
        )


@router.post("/", status_code=201)
def crear(data: PublicacionProgramadaInput, db: Session = Depends(get_db), usuario=Depends(puede_gestionar)):
    _exigir_worker(db)
    try:
        row = programar(db, id_trimestre=data.idTrimestre, ids_horarios=data.idHorarios,
                        fecha_local=data.fechaHoraLocal, responsable=usuario)
    except PublicacionProgramadaError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _response(db, row)


@router.get("/")
def consultar(idTrimestre: int | None = None, estado: str | None = None,
              db: Session = Depends(get_db), usuario=Depends(puede_gestionar)):
    return [_response(db, row) for row in listar(db, idTrimestre, estado)]


@router.get("/disponibilidad")
def consultar_worker(db: Session = Depends(get_db), usuario=Depends(puede_gestionar)):
    return consultar_disponibilidad(db)


@router.get("/{id_publicacion}")
def consultar_una(id_publicacion: int, db: Session = Depends(get_db), usuario=Depends(puede_gestionar)):
    return _response(db, _get(db, id_publicacion))


@router.put("/{id_publicacion}")
def actualizar(id_publicacion: int, data: PublicacionProgramadaInput,
               db: Session = Depends(get_db), usuario=Depends(puede_gestionar)):
    _exigir_worker(db)
    row = _get(db, id_publicacion)
    try:
        row = reprogramar(db, row, id_trimestre=data.idTrimestre, ids_horarios=data.idHorarios,
                          fecha_local=data.fechaHoraLocal, responsable=usuario)
    except PublicacionProgramadaError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _response(db, row)


@router.post("/{id_publicacion}/cancelar")
def cancelar_una(id_publicacion: int, db: Session = Depends(get_db), usuario=Depends(puede_gestionar)):
    try:
        row = cancelar(db, _get(db, id_publicacion), usuario)
    except PublicacionProgramadaError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _response(db, row)
