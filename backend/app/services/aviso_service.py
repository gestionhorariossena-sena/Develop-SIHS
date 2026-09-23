from sqlalchemy.orm import Session

from app.models.aviso import Aviso
from app.repositories.aviso_repository import AvisoRepository
from app.schemas.aviso import AvisoCreate, AvisoUpdate


class AvisoService:
    @staticmethod
    def _a_response(aviso: Aviso) -> dict:
        """Serializa un Aviso a la forma de AvisoResponse, enriquecido con
        el nombre del publicador — mismo criterio que
        HorarioService.a_response (backend/app/services/horario_service.py)."""
        return {
            "idAviso": aviso.idAviso,
            "idUsuarioPublicador": aviso.idUsuarioPublicador,
            "publicadorNombre": aviso.publicador.nombre if aviso.publicador else None,
            "titulo": aviso.titulo,
            "cuerpo": aviso.cuerpo,
            "categoria": aviso.categoria,
            "idFicha": aviso.idFicha,
            "idSede": aviso.idSede,
            "adjuntoUrl": aviso.adjuntoUrl,
            "fechaPublicacion": aviso.fechaPublicacion,
            "vigenteHasta": aviso.vigenteHasta,
        }

    @staticmethod
    def crear(db: Session, data: AvisoCreate, id_usuario_publicador) -> dict:
        aviso = Aviso(
            idUsuarioPublicador=id_usuario_publicador,
            titulo=data.titulo,
            cuerpo=data.cuerpo,
            categoria=data.categoria,
            idFicha=data.idFicha,
            idSede=data.idSede,
            adjuntoUrl=data.adjuntoUrl,
            vigenteHasta=data.vigenteHasta,
        )
        aviso = AvisoRepository.crear(db, aviso)
        return AvisoService._a_response(aviso)

    @staticmethod
    def obtener_todos(db: Session, *, categoria: str | None = None, id_ficha: int | None = None) -> list[dict]:
        avisos = AvisoRepository.obtener_todos(db, categoria=categoria, id_ficha=id_ficha)
        return [AvisoService._a_response(aviso) for aviso in avisos]

    @staticmethod
    def obtener_por_id(db: Session, id_aviso: int) -> Aviso | None:
        return AvisoRepository.obtener_por_id(db, id_aviso)

    @staticmethod
    def actualizar(db: Session, id_aviso: int, data: AvisoUpdate) -> dict | None:
        aviso = AvisoRepository.obtener_por_id(db, id_aviso)

        if not aviso:
            return None

        aviso.titulo = data.titulo
        aviso.cuerpo = data.cuerpo
        aviso.categoria = data.categoria
        aviso.idFicha = data.idFicha
        aviso.idSede = data.idSede
        aviso.adjuntoUrl = data.adjuntoUrl
        aviso.vigenteHasta = data.vigenteHasta

        aviso = AvisoRepository.actualizar(db, aviso)
        return AvisoService._a_response(aviso)

    @staticmethod
    def eliminar(db: Session, id_aviso: int) -> bool:
        aviso = AvisoRepository.obtener_por_id(db, id_aviso)

        if not aviso:
            return False

        AvisoRepository.eliminar(db, aviso)
        return True
