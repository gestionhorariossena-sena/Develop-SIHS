from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user, require_roles
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
from app.services.pdf_service import PdfService, SeccionTexto

router = APIRouter(prefix="/horarios", tags=["horarios"])

# Igual que la sección de estudiantes documentó: escribir horarios es de
# Coordinador/Administrador, no de Instructor/Aprendiz.
require_puede_programar = require_roles("Coordinador", "Administrador")


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

    return HorarioService.a_response(db, horario)


@router.get("/", response_model=list[HorarioResponse])
def obtener_horarios(
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    return [HorarioService.a_response(db, h) for h in HorarioService.obtener_todos(db)]


@router.get("/{id_horario}", response_model=HorarioResponse)
def obtener_horario(
    id_horario: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    horario = HorarioService.obtener_por_id(db, id_horario)

    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")

    return HorarioService.a_response(db, horario)


@router.get("/{id_horario}/pdf")
def descargar_horario_pdf(
    id_horario: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    """"Ficha de sesión" descargable de un bloque puntual (instructor,
    ficha, ambiente, día/hora, resultado de aprendizaje) — GET
    /horarios/{id}/pdf de la épica transversal de exportación a PDF
    (ver PdfService). Abierto a cualquier usuario autenticado, mismo
    criterio que GET /fichas/{id}/vocero: no es dato sensible, y tanto
    instructor como aprendiz necesitan poder descargar su propia sesión
    sin tener rol de gestión."""
    horario = HorarioService.obtener_por_id(db, id_horario)

    if not horario:
        raise HTTPException(status_code=404, detail="Horario no encontrado")

    nombres_dias = HorarioRepository.obtener_nombres_dias(db, id_horario)
    contenido = PdfService.generar(
        titulo="Ficha de Sesión",
        subtitulo=f"Horario #{horario.idHorario}",
        secciones=[
            SeccionTexto(
                titulo="Datos de la sesión",
                lineas=[
                    f"Ficha: {horario.ficha.codigoFicha if horario.ficha else '—'}",
                    f"Instructor: {horario.instructor.nombre if horario.instructor else '—'}",
                    f"Ambiente: {horario.ambiente.nombre if horario.ambiente else '—'}",
                    f"Resultado de aprendizaje: "
                    f"{(horario.resultado.codigo + ' — ') if horario.resultado and horario.resultado.codigo else ''}"
                    f"{horario.resultado.descripcion if horario.resultado else '—'}",
                    f"Día(s): {nombres_dias}",
                    f"Horario: {horario.horaInicio.strftime('%H:%M')} - {horario.horaFin.strftime('%H:%M')}",
                ],
            ),
        ],
    )

    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ficha-sesion-horario-{id_horario}.pdf"'},
    )


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

    return HorarioService.a_response(db, horario)


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
