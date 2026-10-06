from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_lectura_catalogo
from app.schemas.tematica import TematicaCompetenciaResponse
from app.services.tematica_service import TematicaService

router = APIRouter(prefix="/tematicas", tags=["tematicas"])


@router.get("/", response_model=list[TematicaCompetenciaResponse])
def listar_tematicas(
    id_programa: int | None = Query(None, description="Solo las competencias de este programa."),
    busqueda: str | None = Query(None, max_length=100, description="Código o descripción."),
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    """Pestaña "Temáticas" del administrador: competencias con sus
    resultados de aprendizaje y cuántos bloques de horario usa cada uno.
    Crear, editar y borrar sigue pasando por /competencias-formacion y
    /resultados-aprendizaje."""
    return TematicaService.listar(db, id_programa=id_programa, busqueda=busqueda)
