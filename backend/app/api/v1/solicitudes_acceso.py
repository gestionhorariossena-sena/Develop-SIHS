from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin
from app.schemas.solicitud_acceso import EstadoSolicitudAcceso
from app.services.solicitud_acceso_service import SolicitudAccesoService

router = APIRouter(prefix="/solicitudes-acceso", tags=["solicitudes-acceso"])


@router.get("/exportar")
def exportar_solicitudes_acceso(
    estado: EstadoSolicitudAcceso | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    """Botón "Exportar Registro (CSV)" del Panel de Administración
    (panel_de_administracion_sihs_sena/code.html). Solo Administrador --
    mismo criterio que el resto del panel. `estado` filtra igual que
    haría GET /solicitudes-acceso/ (ticket "[Backend] Endpoints
    /solicitudes-acceso", aparte); sin filtro, exporta todas."""
    contenido = SolicitudAccesoService.exportar_csv(db, estado.value if estado else None)

    return Response(
        content=contenido,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="solicitudes-acceso.csv"'},
    )
