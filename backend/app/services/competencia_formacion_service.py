from app.models.competencia_formacion import CompetenciaFormacion
from app.models.especialidad import Especialidad
from app.repositories.competencia_formacion_repository import CompetenciaFormacionRepository


class CompetenciaFormacionService:
    @staticmethod
    def obtener_todos(db):
        return CompetenciaFormacionRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db, id_competencia):
        return CompetenciaFormacionRepository.obtener_por_id(db, id_competencia)

    @staticmethod
    def crear(db, data):
        nueva_competencia = CompetenciaFormacion(
            codigo=data.codigo,
            descripcion=data.descripcion,
            idPrograma=data.idPrograma,
        )
        return CompetenciaFormacionRepository.crear(db, nueva_competencia)

    @staticmethod
    def actualizar(db, id_competencia, data):
        competencia = CompetenciaFormacionRepository.obtener_por_id(db, id_competencia)

        if not competencia:
            return None

        competencia.codigo = data.codigo
        competencia.descripcion = data.descripcion
        competencia.idPrograma = data.idPrograma

        return CompetenciaFormacionRepository.actualizar(db, competencia)

    @staticmethod
    def eliminar(db, id_competencia):
        competencia = CompetenciaFormacionRepository.obtener_por_id(db, id_competencia)

        if not competencia:
            return False

        CompetenciaFormacionRepository.eliminar(db, competencia)
        return True

    @staticmethod
    def reemplazar_especialidades(db, id_competencia: int, ids_especialidades: list[int]):
        """Deja la competencia con exactamente esas fortalezas (las que
        no vengan en la lista se quitan). Ids inexistentes se ignoran en
        silencio en vez de reventar la operación entera: la UI manda lo
        que tiene en pantalla y una especialidad borrada por otro usuario
        mientras tanto no debería impedir guardar el resto.

        Devuelve la competencia, o None si no existe."""
        competencia = CompetenciaFormacionRepository.obtener_por_id(db, id_competencia)

        if not competencia:
            return None

        competencia.especialidades = (
            db.query(Especialidad).filter(Especialidad.idEspecialidad.in_(ids_especialidades)).all()
            if ids_especialidades
            else []
        )
        return CompetenciaFormacionRepository.actualizar(db, competencia)
