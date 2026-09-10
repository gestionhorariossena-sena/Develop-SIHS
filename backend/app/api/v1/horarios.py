from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.ai.client import AIServiceError
from app.ai.schemas import ResumenAuditoriaIA, RespuestaPreguntaHorario
from app.ai.tasks.explain_conflict import resumir_auditoria
from app.ai.tasks.responder_pregunta import responder_pregunta
from app.core.database import get_db
from app.core.supabase_auth import require_roles
from app.schemas.asistente_horario import (
    GenerarPropuestaRequest,
    GenerarPropuestaResponse,
    ImportarExcelPreviewResponse,
    PreguntaHorarioRequest,
)
from app.schemas.horario import (
    AuditoriaCrucesResponse,
    HorarioCreate,
    HorarioDryRunRequest,
    HorarioDryRunResponse,
    HorarioEstadoUpdate,
    HorarioResponse,
    HorarioUpdate,
)
from app.services.asistente_horario_service import generar_propuesta as generar_propuesta_service
from app.services.asistente_horario_service import previsualizar_excel
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


@router.post("/asistente/importar", response_model=ImportarExcelPreviewResponse)
async def importar_excel_vista_previa(
    archivo: UploadFile,
    archivo_complementario: UploadFile | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    """Paso 1-2 del asistente de programación: sube un Excel real, la IA
    clasifica sus columnas (Fase 1) y se arma una vista previa -- nada se
    escribe en la base de datos acá. Las fichas que el Excel trae pero
    que no existen todavía en el catálogo de SIHS se marcan como
    pendientes, no se crean automáticamente.

    `archivo_complementario` opcional: un segundo archivo con datos que
    el principal no trae (ej. nivel de formación, coordinación, fechas),
    cruzado por número de ficha -- ver PLAN_INTEGRACION_IA.md, Fase 3.
    """
    contenido = await archivo.read()
    contenido_complementario = await archivo_complementario.read() if archivo_complementario else None
    try:
        return previsualizar_excel(
            db,
            contenido,
            archivo.filename or "archivo.xlsx",
            contenido_complementario,
            archivo_complementario.filename if archivo_complementario else None,
        )
    except AIServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 -- archivo corrupto, hoja vacía, etc.
        raise HTTPException(status_code=422, detail=f"No se pudo leer el archivo: {exc}") from exc


@router.post("/asistente/generar-propuesta", response_model=GenerarPropuestaResponse)
def generar_propuesta_horario(
    data: GenerarPropuestaRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    """Paso 3: genera una propuesta de horario con OR-Tools (Fase 4) para
    fichas que YA existen en el catálogo. No persiste nada -- el
    coordinador confirma en el paso 4, bloque por bloque, contra
    POST /horarios/ (que sí valida cruces antes de guardar)."""
    try:
        return generar_propuesta_service(db, data.idTrimestre, data.idsFicha, data.jornada)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/asistente/preguntar", response_model=RespuestaPreguntaHorario)
def preguntar_sobre_horario(
    data: PreguntaHorarioRequest,
    usuario=Depends(require_puede_programar),
):
    """La barra "¿En qué te ayudo?" del asistente -- una pregunta puntual
    sobre un bloque/conflicto que el coordinador está viendo. No toca la
    base de datos, no genera ni guarda nada."""
    try:
        return responder_pregunta(data.pregunta, data.contexto)
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
