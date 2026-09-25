from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_aprendiz, require_instructor
from app.schemas.asistencia import MiAsistencia, RegistroAsistencia, SesionAsistencia
from app.services.asistencia_service import AsistenciaError, AsistenciaService
from app.services.auditoria_service import AuditoriaService

router = APIRouter(prefix="/asistencias", tags=["asistencias"])


@router.get("/sesion", response_model=SesionAsistencia)
def obtener_sesion(
    idHorario: int = Query(...),
    fecha: date = Query(...),
    db: Session = Depends(get_db),
    usuario=Depends(require_instructor),
):
    """La nómina de esa clase con lo que ya esté marcado. Solo el instructor
    que dicta ese bloque: la asistencia la certifica quien estuvo en el aula."""
    try:
        return AsistenciaService.obtener_sesion(db, idHorario, fecha, usuario.idUsuario)
    except AsistenciaError as exc:
        raise HTTPException(status_code=exc.estado_http, detail=str(exc)) from exc


@router.post("/sesion")
def registrar_sesion(
    data: RegistroAsistencia,
    db: Session = Depends(get_db),
    usuario=Depends(require_instructor),
):
    """Guarda la lista completa de una sesión. Volver a llamarlo corrige lo
    que hubiera, y la corrección queda auditada."""
    try:
        resultado = AsistenciaService.registrar(db, data, usuario.idUsuario)
    except AsistenciaError as exc:
        raise HTTPException(status_code=exc.estado_http, detail=str(exc)) from exc

    # Un registro de asistencia que se puede cambiar sin traza no sirve como
    # evidencia: se audita tanto el alta como cada corrección posterior.
    AuditoriaService.registrar(
        db,
        usuario=usuario,
        accion="REGISTRAR_ASISTENCIA" if resultado["eraPrimeraVez"] else "CORREGIR_ASISTENCIA",
        entidad="asistencias",
        id_entidad=data.idHorario,
        detalle=(
            f"sesión {data.fechaSesion} · {resultado['guardadas']} marcas"
            + (f" · {resultado['corregidas']} corregidas" if resultado["corregidas"] else "")
        ),
    )

    return resultado


@router.get("/mias", response_model=MiAsistencia)
def obtener_mi_asistencia(
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario=Depends(require_aprendiz),
):
    """Lo propio y nada más: la asistencia de un compañero es dato de un
    tercero. Solo lectura — el aprendiz no puede cambiar su asistencia."""
    return AsistenciaService.obtener_de_aprendiz(db, usuario.idUsuario, desde=desde, hasta=hasta)
