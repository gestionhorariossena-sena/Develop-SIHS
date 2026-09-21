from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin
from app.schemas.solicitud_acceso import (
    EstadoSolicitudAcceso,
    SolicitudAccesoAprobar,
    SolicitudAccesoCreate,
    SolicitudAccesoRechazar,
    SolicitudAccesoResponse,
)
from app.services.auditoria_service import AuditoriaService
from app.services.solicitud_acceso_service import SolicitudAccesoService

router = APIRouter(prefix="/solicitudes-acceso", tags=["solicitudes-acceso"])


@router.post("/", response_model=SolicitudAccesoResponse, status_code=status.HTTP_201_CREATED)
def crear_solicitud_acceso(
    data: SolicitudAccesoCreate,
    db: Session = Depends(get_db),
):
    """Público, sin auth -- lo llama Registro.tsx ("¿Eres coordinador?
    Solicita acceso"): la persona todavía no tiene cuenta en Supabase
    Auth en este punto."""
    resultado = SolicitudAccesoService.crear(db, data)

    if resultado == "ROL_NO_EXISTE":
        raise HTTPException(status_code=404, detail="El rol solicitado no existe")

    if resultado == "YA_PENDIENTE":
        raise HTTPException(status_code=400, detail="Ya existe una solicitud pendiente con ese correo")

    return resultado


@router.get("/", response_model=list[SolicitudAccesoResponse])
def listar_solicitudes_acceso(
    estado: EstadoSolicitudAcceso | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    """Solo Administrador -- regla de negocio explícita: ni Coordinador
    puede ver/aprobar/rechazar solicitudes de acceso. `estado` corresponde
    a los tabs del mockup (pendiente/aprobada/rechazada); sin filtro,
    trae todas (tab "Historial Completo")."""
    return SolicitudAccesoService.listar(db, estado.value if estado else None)


@router.get("/exportar")
def exportar_solicitudes_acceso(
    estado: EstadoSolicitudAcceso | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    """Botón "Exportar Registro (CSV)" del Panel de Administración
    (panel_de_administracion_sihs_sena/code.html). Solo Administrador --
    mismo criterio que el resto del panel. `estado` filtra igual que GET
    /solicitudes-acceso/; sin filtro, exporta todas."""
    contenido = SolicitudAccesoService.exportar_csv(db, estado.value if estado else None)

    return Response(
        content=contenido,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="solicitudes-acceso.csv"'},
    )


@router.post("/{id_solicitud}/aprobar", response_model=SolicitudAccesoResponse)
def aprobar_solicitud_acceso(
    id_solicitud: int,
    data: SolicitudAccesoAprobar,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    """Solo Administrador. Crea/reutiliza la cuenta de Supabase Auth,
    asigna el rol (posiblemente distinto al solicitado, ver
    SolicitudAccesoAprobar), fuerza debeCambiarClave y despacha la
    credencial temporal -- ver SolicitudAccesoService.aprobar para el
    detalle de cada paso."""
    resultado = SolicitudAccesoService.aprobar(db, id_solicitud, data.idRol, usuario)

    if resultado == "SOLICITUD_NO_EXISTE":
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if resultado == "NO_PENDIENTE":
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta")

    if resultado == "ROL_NO_EXISTE":
        raise HTTPException(status_code=404, detail="El rol a otorgar no existe")

    AuditoriaService.registrar(
        db,
        usuario=usuario,
        accion="APROBAR_SOLICITUD_ACCESO",
        entidad="solicitudes_acceso",
        id_entidad=id_solicitud,
        detalle=f"idRolOtorgado={data.idRol}",
    )

    return resultado


@router.post("/{id_solicitud}/rechazar", response_model=SolicitudAccesoResponse)
def rechazar_solicitud_acceso(
    id_solicitud: int,
    data: SolicitudAccesoRechazar,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    """Solo Administrador. motivoRechazo es obligatorio -- el mockup lo
    exige con validación (select de motivos predefinidos + observación
    libre en el frontend; acá solo se guarda el texto final)."""
    resultado = SolicitudAccesoService.rechazar(db, id_solicitud, data.motivoRechazo, usuario)

    if resultado == "SOLICITUD_NO_EXISTE":
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if resultado == "NO_PENDIENTE":
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta")

    AuditoriaService.registrar(
        db,
        usuario=usuario,
        accion="RECHAZAR_SOLICITUD_ACCESO",
        entidad="solicitudes_acceso",
        id_entidad=id_solicitud,
        detalle=data.motivoRechazo,
    )

    return resultado
