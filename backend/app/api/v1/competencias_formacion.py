from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo_o_instructor
from app.schemas.competencia_formacion import (
    CompetenciaFormacionCreate,
    CompetenciaFormacionResponse,
    CompetenciaFormacionUpdate,
)
from app.schemas.curriculo import PreviewCurriculoResponse
from app.services.competencia_formacion_service import CompetenciaFormacionService
from app.services.curriculo_service import previsualizar_curriculo

router = APIRouter(prefix="/competencias-formacion", tags=["competencias-formacion"])


@router.post("/importar-vista-previa", response_model=PreviewCurriculoResponse)
async def importar_curriculo_vista_previa(
    archivo: UploadFile,
    usuario=Depends(require_admin),
):
    """Lee un Excel real con el Formato de Planeación Pedagógica de SENA
    (columnas "COMPETENCIA" / "RESULTADOS DE APRENDIZAJE") y arma una
    vista previa -- nada se escribe en la base de datos acá. Confirmar
    crea cada fila llamando a POST /competencias-formacion/ y
    POST /resultados-aprendizaje/ (ya existentes), el mismo patrón que
    el resto de importadores de catálogo."""
    contenido = await archivo.read()
    try:
        return previsualizar_curriculo(contenido, archivo.filename or "archivo.xlsx")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 -- archivo corrupto, hoja vacía, etc.
        raise HTTPException(status_code=422, detail=f"No se pudo leer el archivo: {exc}") from exc


@router.post("/", response_model=CompetenciaFormacionResponse)
def crear_competencia(
    data: CompetenciaFormacionCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return CompetenciaFormacionService.crear(db, data)


@router.get("/", response_model=list[CompetenciaFormacionResponse])
def obtener_competencias(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    return CompetenciaFormacionService.obtener_todos(db)


@router.get("/{id_competencia}", response_model=CompetenciaFormacionResponse)
def obtener_competencia(
    id_competencia: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    competencia = CompetenciaFormacionService.obtener_por_id(db, id_competencia)

    if not competencia:
        raise HTTPException(status_code=404, detail="Competencia no encontrada")

    return competencia


@router.put("/{id_competencia}", response_model=CompetenciaFormacionResponse)
def actualizar_competencia(
    id_competencia: int,
    data: CompetenciaFormacionUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    competencia = CompetenciaFormacionService.actualizar(db, id_competencia, data)

    if not competencia:
        raise HTTPException(status_code=404, detail="Competencia no encontrada")

    return competencia


@router.delete("/{id_competencia}")
def eliminar_competencia(
    id_competencia: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = CompetenciaFormacionService.eliminar(db, id_competencia)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Competencia no encontrada")

    return {"mensaje": "Competencia eliminada"}
