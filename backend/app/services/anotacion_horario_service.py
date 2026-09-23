from app.models.anotacion_horario import AnotacionHorario
from app.repositories.anotacion_horario_repository import AnotacionHorarioRepository


class AnotacionHorarioService:
    @staticmethod
    def obtener_mias(db, id_usuario):
        return AnotacionHorarioRepository.obtener_mias(db, id_usuario)

    @staticmethod
    def crear(db, data, id_usuario):
        nueva_anotacion = AnotacionHorario(
            idUsuario=id_usuario,
            idHorario=data.idHorario,
            nota=data.nota,
            etiqueta=data.etiqueta,
            recordatorioActivo=data.recordatorioActivo,
        )
        return AnotacionHorarioRepository.crear(db, nueva_anotacion)

    @staticmethod
    def actualizar(db, id_anotacion, data, id_usuario):
        anotacion = AnotacionHorarioRepository.obtener_por_id_y_usuario(db, id_anotacion, id_usuario)

        if not anotacion:
            return None

        anotacion.idHorario = data.idHorario
        anotacion.nota = data.nota
        anotacion.etiqueta = data.etiqueta
        anotacion.recordatorioActivo = data.recordatorioActivo

        return AnotacionHorarioRepository.actualizar(db, anotacion)

    @staticmethod
    def eliminar(db, id_anotacion, id_usuario):
        anotacion = AnotacionHorarioRepository.obtener_por_id_y_usuario(db, id_anotacion, id_usuario)

        if not anotacion:
            return False

        AnotacionHorarioRepository.eliminar(db, anotacion)
        return True
