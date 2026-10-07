from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo_o_instructor
from app.schemas.resultado_aprendizaje import (
    ResultadoAprendizajeCreate,
    ResultadoAprendizajeResponse,
    ResultadoAprendizajeUpdate,
)
from app.services.resultado_aprendizaje_service import ResultadoAprendizajeService
from app.services.tematica_service import ReferenciaInexistenteError, TematicaEnUsoError, TematicaService

router = APIRouter(prefix="/resultados-aprendizaje", tags=["resultados-aprendizaje"])


@router.post("/", response_model=ResultadoAprendizajeResponse)
def crear_resultado(
    data: ResultadoAprendizajeCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    try:
        TematicaService.validar_competencia(db, data.idCompetencia)
    except ReferenciaInexistenteError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    return ResultadoAprendizajeService.crear(db, data)


@router.get("/", response_model=list[ResultadoAprendizajeResponse])
def obtener_resultados(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    return ResultadoAprendizajeService.obtener_todos(db)


@router.get("/{id_resultado}", response_model=ResultadoAprendizajeResponse)
def obtener_resultado(
    id_resultado: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    resultado = ResultadoAprendizajeService.obtener_por_id(db, id_resultado)

    if not resultado:
        raise HTTPException(status_code=404, detail="Resultado de aprendizaje no encontrado")

    return resultado


@router.put("/{id_resultado}", response_model=ResultadoAprendizajeResponse)
def actualizar_resultado(
    id_resultado: int,
    data: ResultadoAprendizajeUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    try:
        TematicaService.validar_competencia(db, data.idCompetencia)
    except ReferenciaInexistenteError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    resultado = ResultadoAprendizajeService.actualizar(db, id_resultado, data)

    if not resultado:
        raise HTTPException(status_code=404, detail="Resultado de aprendizaje no encontrado")

    return resultado


@router.delete("/{id_resultado}")
def eliminar_resultado(
    id_resultado: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    try:
        TematicaService.verificar_resultado_borrable(db, id_resultado)
    except TematicaEnUsoError as error:
        raise HTTPException(status_code=409, detail=str(error)) from None
    eliminado = ResultadoAprendizajeService.eliminar(db, id_resultado)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Resultado de aprendizaje no encontrado")

    return {"mensaje": "Resultado de aprendizaje eliminado"}
