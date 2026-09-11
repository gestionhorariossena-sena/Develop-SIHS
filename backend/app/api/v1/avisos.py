from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user, require_roles
from app.schemas.aviso import AvisoCreate, AvisoResponse, AvisoUpdate
from app.services.auditoria_service import AuditoriaService
from app.services.aviso_service import AvisoService

router = APIRouter(prefix="/avisos", tags=["avisos"])

# Quien publica avisos oficiales es Coordinación o Administración, no
# cualquier usuario autenticado — la lectura sí es abierta (ver GET abajo).
require_puede_publicar = require_roles("Coordinador", "Administrador")


def _con_publicador(aviso):
    aviso.publicadorNombre = aviso.publicador.nombre if aviso.publicador else None
    return aviso


@router.post("/", response_model=AvisoResponse, status_code=201)
def crear_aviso(
    data: AvisoCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_publicar),
):
    aviso = AvisoService.crear(db, data, usuario.idUsuario)
    AuditoriaService.registrar(db, usuario=usuario, accion="CREAR", entidad="avisos", id_entidad=aviso.idAviso)
    return _con_publicador(aviso)


@router.get("/", response_model=list[AvisoResponse])
def obtener_avisos(
    categoria: str | None = None,
    idFicha: int | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    return [_con_publicador(a) for a in AvisoService.obtener_todos(db, categoria, idFicha)]


@router.put("/{id_aviso}", response_model=AvisoResponse)
def actualizar_aviso(
    id_aviso: int,
    data: AvisoUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_publicar),
):
    aviso = AvisoService.actualizar(db, id_aviso, data)

    if not aviso:
        raise HTTPException(status_code=404, detail="Aviso no encontrado")

    AuditoriaService.registrar(db, usuario=usuario, accion="ACTUALIZAR", entidad="avisos", id_entidad=id_aviso)
    return _con_publicador(aviso)


@router.delete("/{id_aviso}")
def eliminar_aviso(
    id_aviso: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_publicar),
):
    eliminado = AvisoService.eliminar(db, id_aviso)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Aviso no encontrado")

    AuditoriaService.registrar(db, usuario=usuario, accion="ELIMINAR", entidad="avisos", id_entidad=id_aviso)
    return {"mensaje": "Aviso eliminado"}
