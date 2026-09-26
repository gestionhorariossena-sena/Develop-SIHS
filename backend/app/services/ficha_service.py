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
            faseActual=data.faseActual,
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
        ficha.faseActual = data.faseActual

        return FichaRepository.actualizar(db, ficha)

    @staticmethod
    def actualizar_fase_actual(db, id_ficha, fase_actual):
        """Update mínimo para el botón "Actualizar fase" del asistente de
        programación -- a propósito no pasa por `actualizar()` (que exige
        codigoFicha/idPrograma/etc. completos): el wizard solo tiene la
        fase que leyó del Excel para una ficha que YA EXISTE, no el resto
        de sus datos, y no hay por qué pedírselos solo para corregir un
        campo."""
        ficha = FichaRepository.obtener_por_id(db, id_ficha)

        if not ficha:
            return None

        ficha.faseActual = fase_actual
        return FichaRepository.actualizar(db, ficha)

    @staticmethod
    def eliminar(db, id_ficha):
        ficha = FichaRepository.obtener_por_id(db, id_ficha)

        if not ficha:
            return False

        FichaRepository.eliminar(db, ficha)
        return True
