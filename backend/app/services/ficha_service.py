from app.models.ficha import Ficha
from app.repositories.ficha_repository import FichaRepository


class FichaService:
    @staticmethod
    def obtener_todos(db):
        return FichaRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db, id_ficha):
        return FichaRepository.obtener_por_id(db, id_ficha)

    @staticmethod
    def crear(db, data):
        nueva_ficha = Ficha(
            codigoFicha=data.codigoFicha,
            idPrograma=data.idPrograma,
            idTrimestre=data.idTrimestre,
            idSede=data.idSede,
            fechaInicioLectiva=data.fechaInicioLectiva,
            fechaFinLectiva=data.fechaFinLectiva,
            fechaInicioProductiva=data.fechaInicioProductiva,
            fechaFinProductiva=data.fechaFinProductiva,
        )
        return FichaRepository.crear(db, nueva_ficha)

    @staticmethod
    def actualizar(db, id_ficha, data):
        ficha = FichaRepository.obtener_por_id(db, id_ficha)

        if not ficha:
            return None

        ficha.codigoFicha = data.codigoFicha
        ficha.idPrograma = data.idPrograma
        ficha.idTrimestre = data.idTrimestre
        ficha.idSede = data.idSede
        ficha.fechaInicioLectiva = data.fechaInicioLectiva
        ficha.fechaFinLectiva = data.fechaFinLectiva
        ficha.fechaInicioProductiva = data.fechaInicioProductiva
        ficha.fechaFinProductiva = data.fechaFinProductiva

        return FichaRepository.actualizar(db, ficha)

    @staticmethod
    def eliminar(db, id_ficha):
        ficha = FichaRepository.obtener_por_id(db, id_ficha)

        if not ficha:
            return False

        FichaRepository.eliminar(db, ficha)
        return True
