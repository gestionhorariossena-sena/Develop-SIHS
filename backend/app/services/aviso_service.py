from sqlalchemy.orm import Session

from app.models.aviso import Aviso
from app.repositories.aviso_repository import AvisoRepository
from app.schemas.aviso import AvisoCreate, AvisoUpdate


class AvisoService:
    @staticmethod
    def crear(db: Session, data: AvisoCreate, id_usuario_publicador) -> Aviso:
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
        return AvisoRepository.crear(db, aviso)

    @staticmethod
    def obtener_todos(db: Session, *, categoria: str | None = None, id_ficha: int | None = None) -> list[Aviso]:
        return AvisoRepository.obtener_todos(db, categoria=categoria, id_ficha=id_ficha)

    @staticmethod
    def obtener_por_id(db: Session, id_aviso: int) -> Aviso | None:
        return AvisoRepository.obtener_por_id(db, id_aviso)

    @staticmethod
    def actualizar(db: Session, id_aviso: int, data: AvisoUpdate) -> Aviso | None:
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

        return AvisoRepository.actualizar(db, aviso)

    @staticmethod
    def eliminar(db: Session, id_aviso: int) -> bool:
        aviso = AvisoRepository.obtener_por_id(db, id_aviso)

        if not aviso:
            return False

        AvisoRepository.eliminar(db, aviso)
        return True
