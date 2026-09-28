from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_roles
from app.models.usuario import Usuario
from app.repositories.horario_repository import HorarioRepository
from app.schemas.horario_guardado import (
    HorarioGuardadoCreate,
    HorarioGuardadoReemplazo,
    HorarioGuardadoResponse,
)
from app.services.auditoria_service import AuditoriaService
from app.services.horario_guardado_service import (
    HorarioGuardadoService,
    HorarioGuardadoNoReemplazableError,
)
from app.services.horario_service import CruceHorarioError, FichaTrimestreInconsistenteError, HorarioService

router = APIRouter(prefix="/horarios-guardados", tags=["horarios-guardados"])

# Los horarios guardados son snapshots del historial de programación (quién
# armó qué horario y cuándo) — es una herramienta de coordinación, igual que
# /horarios/. Un Instructor ve su propio horario vigente vía
# /usuarios/me/horarios, no necesita ni debe ver los snapshots ajenos.
require_puede_programar = require_roles("Coordinador", "Administrador")


def _con_creador(horario_guardado):
    horario_guardado.creadorNombre = horario_guardado.usuario.nombre if horario_guardado.usuario else None
    return horario_guardado


@router.post("/", response_model=HorarioGuardadoResponse)
def crear_horario_guardado(
    data: HorarioGuardadoCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    return _con_creador(HorarioGuardadoService.crear(db, data, usuario))


@router.get("/", response_model=list[HorarioGuardadoResponse])
def obtener_horarios_guardados(
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    return [_con_creador(h) for h in HorarioGuardadoService.obtener_todos(db)]


@router.get("/{id_horario_guardado}", response_model=HorarioGuardadoResponse)
def obtener_horario_guardado(
    id_horario_guardado: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    horario_guardado = HorarioGuardadoService.obtener_con_asignaciones(db, id_horario_guardado)

    if not horario_guardado:
        raise HTTPException(status_code=404, detail="Horario guardado no encontrado")

    return _con_creador(horario_guardado)


@router.put("/{id_horario_guardado}/reemplazar", response_model=HorarioGuardadoResponse)
def reemplazar_horario_guardado(
    id_horario_guardado: int,
    data: HorarioGuardadoReemplazo,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    """Reemplaza en una sola transacción el snapshot y sus clases reales."""
    try:
        with db.begin_nested():
            guardado = HorarioGuardadoService.reemplazar(db, id_horario_guardado, data)
            if guardado is None:
                raise HTTPException(status_code=404, detail="Horario guardado no encontrado")

            AuditoriaService.registrar_transaccional(
                db,
                usuario=usuario,
                accion="REEMPLAZAR",
                entidad="horarios_guardados",
                id_entidad=id_horario_guardado,
            )
            guardado.usuario = db.get(Usuario, guardado.idUsuario)
            guardado.asignaciones = [
                HorarioService.a_response(db, horario)
                for horario in HorarioRepository.obtener_por_ids(db, guardado.idsHorarios or [])
            ]
            respuesta = HorarioGuardadoResponse.model_validate(_con_creador(guardado))
        db.commit()
        return respuesta
    except CruceHorarioError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail={"mensajes": error.mensajes}) from error
    except FichaTrimestreInconsistenteError as error:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(error)) from error
    except HorarioGuardadoNoReemplazableError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.delete("/{id_horario_guardado}")
def eliminar_horario_guardado(
    id_horario_guardado: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_programar),
):
    try:
        eliminado = HorarioGuardadoService.eliminar(db, id_horario_guardado)
    except HorarioGuardadoNoReemplazableError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error

    if not eliminado:
        raise HTTPException(status_code=404, detail="Horario guardado no encontrado")

    return {"mensaje": "Horario guardado eliminado"}
