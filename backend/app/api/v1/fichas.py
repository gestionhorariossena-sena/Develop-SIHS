from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user, require_admin, require_lectura_catalogo
from app.repositories.ficha_usuario_repository import FichaUsuarioRepository
from app.repositories.horario_repository import HorarioRepository
from app.schemas.ficha import FichaCreate, FichaResponse, FichaUpdate
from app.schemas.ficha_usuario import VoceroResponse
from app.services.auditoria_service import AuditoriaService
from app.services.ficha_service import FichaService
from app.services.ficha_usuario_service import FichaUsuarioService
from app.services.pdf_service import PdfService, SeccionTabla, SeccionTexto

router = APIRouter(prefix="/fichas", tags=["fichas"])


@router.post("/", response_model=FichaResponse)
def crear_ficha(
    data: FichaCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    ficha = FichaService.crear(db, data)
    AuditoriaService.registrar(db, usuario=usuario, accion="CREAR", entidad="fichas", id_entidad=ficha.idFicha)
    return ficha


@router.get("/", response_model=list[FichaResponse])
def obtener_fichas(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    return FichaService.obtener_todos(db)


@router.get("/{id_ficha}", response_model=FichaResponse)
def obtener_ficha(
    id_ficha: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    ficha = FichaService.obtener_por_id(db, id_ficha)

    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    return ficha


@router.get("/{id_ficha}/vocero", response_model=list[VoceroResponse])
def obtener_vocero_ficha(
    id_ficha: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    """Vocero/subvocero de una ficha (nombre + correo), para el "Vocero de
    Ficha" del drawer de instructor y "Vocera: ..." en Mi Horario del
    aprendiz. Abierto a cualquier usuario autenticado -- no es dato
    sensible, y tanto instructor como aprendiz necesitan verlo sin tener
    rol de gestión (require_lectura_catalogo los excluiría a ambos). No
    cubre el botón "Contactar" (mensajería, otro Epic), solo expone quién
    es."""
    if not FichaService.obtener_por_id(db, id_ficha):
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    return FichaUsuarioService.obtener_voceros(db, id_ficha)


@router.get("/{id_ficha}/pdf")
def descargar_ficha_pdf(
    id_ficha: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    """"Horario Oficial" + "nómina" de una ficha en un solo PDF (épica
    transversal de exportación a PDF, ver PdfService): datos de la ficha,
    la grilla de todos sus horarios asignados y el listado de aprendices
    matriculados. Abierto a cualquier usuario autenticado, mismo criterio
    que GET /{id_ficha}/vocero: ni instructor ni aprendiz tienen rol de
    gestión, y ambos necesitan poder descargar esto."""
    ficha = FichaService.obtener_por_id(db, id_ficha)

    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    horarios = HorarioRepository.obtener_por_ficha(db, id_ficha)
    filas_horario = [
        [
            HorarioRepository.obtener_nombres_dias(db, h.idHorario),
            f"{h.horaInicio.strftime('%H:%M')} - {h.horaFin.strftime('%H:%M')}",
            h.instructor.nombre if h.instructor else "—",
            h.ambiente.nombre if h.ambiente else "—",
            h.resultado.codigo if h.resultado and h.resultado.codigo else "—",
        ]
        for h in horarios
    ]

    aprendices = FichaUsuarioRepository.obtener_por_ficha(db, id_ficha)
    filas_aprendices = [
        [usuario_aprendiz.nombre, usuario_aprendiz.email, vinculo.rolEnFicha or "Aprendiz"]
        for vinculo, usuario_aprendiz in aprendices
    ]

    contenido = PdfService.generar(
        titulo=f"Ficha {ficha.codigoFicha}",
        subtitulo=f"{ficha.programa.nombrePrograma if ficha.programa else '—'} · Trimestre {ficha.trimestre.nombre if ficha.trimestre else '—'}",
        secciones=[
            SeccionTexto(
                titulo="Datos generales",
                lineas=[
                    f"Programa: {ficha.programa.nombrePrograma if ficha.programa else '—'}",
                    f"Trimestre: {ficha.trimestre.nombre if ficha.trimestre else '—'}",
                    f"Sede: {ficha.sede.nombre if ficha.sede else '—'}",
                ],
            ),
            SeccionTabla(
                titulo="Horario oficial",
                encabezados=["Día(s)", "Hora", "Instructor", "Ambiente", "Resultado"],
                filas=filas_horario,
            ),
            SeccionTabla(
                titulo="Nómina de aprendices",
                encabezados=["Nombre", "Correo", "Rol en la ficha"],
                filas=filas_aprendices,
            ),
        ],
    )

    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ficha-{ficha.codigoFicha}.pdf"'},
    )


@router.put("/{id_ficha}", response_model=FichaResponse)
def actualizar_ficha(
    id_ficha: int,
    data: FichaUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    ficha = FichaService.actualizar(db, id_ficha, data)

    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    AuditoriaService.registrar(db, usuario=usuario, accion="ACTUALIZAR", entidad="fichas", id_entidad=id_ficha)

    return ficha


@router.delete("/{id_ficha}")
def eliminar_ficha(
    id_ficha: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = FichaService.eliminar(db, id_ficha)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    AuditoriaService.registrar(db, usuario=usuario, accion="ELIMINAR", entidad="fichas", id_entidad=id_ficha)

    return {"mensaje": "Ficha eliminada"}
