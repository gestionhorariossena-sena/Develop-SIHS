from app.models.ficha_usuario import FichaUsuario
from app.repositories.ficha_repository import FichaRepository
from app.repositories.ficha_usuario_repository import FichaUsuarioRepository


class FichaUsuarioService:
    @staticmethod
    def vincular(db, id_usuario, codigo_ficha):
        ficha = FichaRepository.obtener_por_codigo(db, codigo_ficha)

        if not ficha:
            return "FICHA_NO_EXISTE"

        if FichaUsuarioRepository.obtener_por_usuario(db, id_usuario):
            return "YA_VINCULADO"

        nueva_relacion = FichaUsuario(idFicha=ficha.idFicha, idUsuario=id_usuario)
        FichaUsuarioRepository.crear(db, nueva_relacion)

        return ficha

    @staticmethod
    def obtener_mi_ficha(db, id_usuario):
        relacion = FichaUsuarioRepository.obtener_por_usuario(db, id_usuario)

        if not relacion:
            return None

        return FichaRepository.obtener_por_id(db, relacion.idFicha)
