from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.ai.client import AIServiceError
from app.ai.schemas import ResumenAuditoriaIA
from app.ai.tasks.explain_conflict import resumir_auditoria
from app.core.database import get_db
from app.core.supabase_auth import require_roles
from app.schemas.horario import (
    AuditoriaCrucesResponse,
    HorarioCreate,
    HorarioDryRunRequest,
    HorarioDryRunResponse,
    HorarioEstadoUpdate,
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
    return HorarioService.a_response(db, horario)


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


@router.get("/auditoria-cruces", response_model=AuditoriaCrucesResponse)
def auditar_cruces(
    idTrimestre: int | None = None,
    idSede: int | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    """Barrido de cruces entre horarios ya guardados (activos) — pantalla
    "Auditoría de Cruces" de Coordinación. Reutiliza la misma lógica de
    validar_dry_run por cada horario existente (ver
    HorarioService.auditar_conflictos), así que los tipos de conflicto son
    exactamente los mismos que ya devuelve /horarios/validar:
    cruce_ficha, cruce_instructor, cruce_ambiente, resultado_repetido,
    regla_instructor."""
    conflictos = HorarioService.auditar_conflictos(db, id_trimestre=idTrimestre, id_sede=idSede)

    return {
        "conflictos": conflictos,
        "resumen": {
            "totalCruces": len(conflictos),
            "tipos": sorted({c["tipo"] for c in conflictos}),
        },
    }


@router.post("/auditoria-cruces/resumen-ia", response_model=ResumenAuditoriaIA)
def resumir_auditoria_con_ia(
    idTrimestre: int | None = None,
    idSede: int | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    """Fase 2 de _Docs/Documentación general/PLAN_INTEGRACION_IA.md.
    POST (no GET) a propósito: dispara una llamada real a un LLM, no es
    gratis ni instantáneo como el resto de /horarios -- el coordinador lo
    pide explícitamente (botón "Resumir con IA"), no se dispara solo al
    cargar la pantalla de auditoría.

    No reemplaza el `mensaje` determinista de cada conflicto individual
    (eso lo sigue calculando Python en HorarioService). Esto agrega una
    lectura de conjunto: con decenas de conflictos, ver el patrón y por
    dónde empezar es algo que el código determinista no hace."""
    conflictos = HorarioService.auditar_conflictos(db, id_trimestre=idTrimestre, id_sede=idSede)

    if not conflictos:
        return ResumenAuditoriaIA(resumen="No se detectaron cruces en esta auditoría.", prioridades=[])

    try:
        return resumir_auditoria(conflictos)
    except AIServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/", response_model=HorarioResponse, status_code=201)
def crear_horario(
    data: HorarioCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    forzar = getattr(data, "forzar", False)
    try:
        horario, conflictos = HorarioService.crear(db, data, forzar=forzar)
    except CruceHorarioError as error:
        raise HTTPException(status_code=409, detail={"mensajes": error.mensajes}) from error

    accion = "FORZAR_CRUCE" if (forzar and conflictos) else "CREAR"
    detalle = "; ".join(conflictos) if conflictos else None
    AuditoriaService.registrar(
        db, usuario=usuario, accion=accion, entidad="horarios", id_entidad=horario.idHorario, detalle=detalle
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
    forzar = getattr(data, "forzar", False)
    try:
        horario, conflictos = HorarioService.actualizar(db, id_horario, data, forzar=forzar)
    except CruceHorarioError as error:
        raise HTTPException(status_code=409, detail={"mensajes": error.mensajes}) from error

    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")

    accion = "FORZAR_CRUCE" if (forzar and conflictos) else "ACTUALIZAR"
    detalle = "; ".join(conflictos) if conflictos else None
    AuditoriaService.registrar(
        db, usuario=usuario, accion=accion, entidad="horarios", id_entidad=id_horario, detalle=detalle
    )

    return _a_response(db, horario)


@router.patch("/{id_horario}/estado", response_model=HorarioResponse)
def cambiar_estado_horario(
    id_horario: int,
    data: HorarioEstadoUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    """Activar/desactivar y/o publicar/despublicar sin borrar — backlog de
    Horarios completos/Historial (pedido 2026-09-03). No pasa por
    HorarioUpdate: no cambia ficha/instructor/ambiente/horario, así que no
    tiene sentido pedir esos campos ni re-correr el dry-run completo."""
    horario = HorarioService.cambiar_estado(db, id_horario, activo=data.activo, publicado=data.publicado)

    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")

    acciones = []
    if data.activo is not None:
        acciones.append("ACTIVAR" if data.activo else "DESACTIVAR")
    if data.publicado is not None:
        acciones.append("PUBLICAR" if data.publicado else "DESPUBLICAR")
    AuditoriaService.registrar(db, usuario=usuario, accion=" y ".join(acciones) or "SIN_CAMBIOS", entidad="horarios", id_entidad=id_horario)

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
