from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_roles
from app.repositories.horario_repository import HorarioRepository
from app.schemas.horario import (
    HorarioCreate,
    HorarioDryRunRequest,
    HorarioDryRunResponse,
    HorarioResponse,
    HorarioUpdate,
)
from app.services.auditoria_service import AuditoriaService
from app.services.horario_service import CruceHorarioError, HorarioService

router = APIRouter(prefix="/horarios", tags=["horarios"])

# Igual que la sección de estudiantes documentó: escribir horarios es de
# Coordinador/Administrador, no de Instructor/Aprendiz.
require_puede_programar = require_roles("Coordinador", "Administrador")


def _a_response(db: Session, horario) -> dict:
    return {
        "idHorario": horario.idHorario,
        "horaInicio": horario.horaInicio,
        "horaFin": horario.horaFin,
        "idJornada": horario.idJornada,
        "idTrimestre": horario.idTrimestre,
        "idAmbiente": horario.idAmbiente,
        "idInstructor": horario.idInstructor,
        "idFicha": horario.idFicha,
        "idResultado": horario.idResultado,
        "dias": HorarioRepository.obtener_dias(db, horario.idHorario),
        "instructorNombre": horario.instructor.nombre if horario.instructor else None,
        "fichaCodigo": horario.ficha.codigoFicha if horario.ficha else None,
        "ambienteNombre": horario.ambiente.nombre if horario.ambiente else None,
        "resultadoCodigo": horario.resultado.codigo if horario.resultado else None,
        "resultadoDescripcion": horario.resultado.descripcion if horario.resultado else None,
    }


@router.post("/validar", response_model=HorarioDryRunResponse)
@router.post("/dry-run", response_model=HorarioDryRunResponse, include_in_schema=False)
def validar_dry_run_horario(
    data: HorarioDryRunRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    conflictos = HorarioService.validar_dry_run(db, data, data.excluirIdHorario)

    if conflictos:
        payload = {
            "ok": False,
            "puedeGuardar": False,
            "mensaje": "La programación presenta conflictos.",
            "conflictos": conflictos,
            "resumen": {
                "totalCruces": len(conflictos),
                "tipos": sorted({c["tipo"] for c in conflictos}),
            },
        }
        return JSONResponse(status_code=409, content=jsonable_encoder(payload))

    return {
        "ok": True,
        "puedeGuardar": True,
        "mensaje": "No se detectaron cruces.",
        "conflictos": [],
        "resumen": {
            "totalCruces": 0,
            "tipos": [],
        },
    }


@router.post("/", response_model=HorarioResponse, status_code=201)
def crear_horario(
    data: HorarioCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    try:
        horario = HorarioService.crear(db, data, forzar=getattr(data, "forzar", False))
    except CruceHorarioError as error:
        raise HTTPException(status_code=409, detail={"mensajes": error.mensajes}) from error

    AuditoriaService.registrar(
        db, usuario=usuario, accion="CREAR", entidad="horarios", id_entidad=horario.idHorario
    )

    return _a_response(db, horario)


@router.get("/", response_model=list[HorarioResponse])
def obtener_horarios(
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    return [_a_response(db, h) for h in HorarioService.obtener_todos(db)]


@router.get("/{id_horario}", response_model=HorarioResponse)
def obtener_horario(
    id_horario: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    horario = HorarioService.obtener_por_id(db, id_horario)

    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")

    return _a_response(db, horario)


@router.put("/{id_horario}", response_model=HorarioResponse)
def actualizar_horario(
    id_horario: int,
    data: HorarioUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    try:
        horario = HorarioService.actualizar(db, id_horario, data)
    except CruceHorarioError as error:
        raise HTTPException(status_code=409, detail={"mensajes": error.mensajes}) from error

    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")

    AuditoriaService.registrar(
        db, usuario=usuario, accion="ACTUALIZAR", entidad="horarios", id_entidad=id_horario
    )

    return _a_response(db, horario)


@router.delete("/{id_horario}")
def eliminar_horario(
    id_horario: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    eliminado = HorarioService.eliminar(db, id_horario)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Horario no encontrado")

    AuditoriaService.registrar(
        db, usuario=usuario, accion="ELIMINAR", entidad="horarios", id_entidad=id_horario
    )

    return {"mensaje": "Horario eliminado"}
