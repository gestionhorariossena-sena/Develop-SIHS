from app.models.actividades_aprendizaje import ActividadAprendizaje
from app.repositories.actividades_aprendizaje_repository import ActividadAprendizajeRepository


class ActividadAprendizajeService:
    @staticmethod
    def obtener_todos(db):
        return ActividadAprendizajeRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db, id_actividad):
        return ActividadAprendizajeRepository.obtener_por_id(db, id_actividad)

    @staticmethod
    def obtener_por_resultado(db, id_resultado):
        return ActividadAprendizajeRepository.obtener_por_resultado(db, id_resultado)

    @staticmethod
    def crear(db, data):
        nueva_actividad = ActividadAprendizaje(
            codigo=data.codigo,
            descripcion=data.descripcion,
            tipoActividad=data.tipoActividad,
            duracionMinutos=data.duracionMinutos,
            idResultado=data.idResultado,
        )
        return ActividadAprendizajeRepository.crear(db, nueva_actividad)

    @staticmethod
    def actualizar(db, id_actividad, data):
        actividad = ActividadAprendizajeRepository.obtener_por_id(db, id_actividad)

        if not actividad:
            return None

        actividad.codigo = data.codigo
        actividad.descripcion = data.descripcion
        actividad.tipoActividad = data.tipoActividad
        actividad.duracionMinutos = data.duracionMinutos
        actividad.idResultado = data.idResultado

        return ActividadAprendizajeRepository.actualizar(db, actividad)

    @staticmethod
    def eliminar(db, id_actividad):
        actividad = ActividadAprendizajeRepository.obtener_por_id(db, id_actividad)

        if not actividad:
            return False

        ActividadAprendizajeRepository.eliminar(db, actividad)
        return True
