from app.models.aviso import Aviso
from app.repositories.aviso_repository import AvisoRepository


class AvisoService:
    @staticmethod
    def obtener_todos(db, categoria=None, id_ficha=None):
        return AvisoRepository.obtener_todos(db, categoria, id_ficha)

    @staticmethod
    def obtener_por_id(db, id_aviso):
        return AvisoRepository.obtener_por_id(db, id_aviso)

    @staticmethod
    def crear(db, data, id_usuario_publicador):
        nuevo_aviso = Aviso(
            idUsuarioPublicador=id_usuario_publicador,
            titulo=data.titulo,
            cuerpo=data.cuerpo,
            categoria=data.categoria,
            idFicha=data.idFicha,
            idSede=data.idSede,
            adjuntoUrl=data.adjuntoUrl,
            vigenteHasta=data.vigenteHasta,
        )
        return AvisoRepository.crear(db, nuevo_aviso)

    @staticmethod
    def actualizar(db, id_aviso, data):
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
    def eliminar(db, id_aviso):
        aviso = AvisoRepository.obtener_por_id(db, id_aviso)

        if not aviso:
            return False

        AvisoRepository.eliminar(db, aviso)
        return True
