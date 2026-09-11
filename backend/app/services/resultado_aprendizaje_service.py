from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.repositories.resultado_aprendizaje_repository import ResultadoAprendizajeRepository


class ResultadoAprendizajeService:
    @staticmethod
    def obtener_todos(db):
        return ResultadoAprendizajeRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db, id_resultado):
        return ResultadoAprendizajeRepository.obtener_por_id(db, id_resultado)

    @staticmethod
    def crear(db, data):
        nuevo_resultado = ResultadoAprendizaje(
            codigo=data.codigo,
            descripcion=data.descripcion,
            idCompetencia=data.idCompetencia,
            idGuia=data.idGuia,
            horasAsignadas=data.horasAsignadas,
            numeroFase=data.numeroFase,
        )
        return ResultadoAprendizajeRepository.crear(db, nuevo_resultado)

    @staticmethod
    def actualizar(db, id_resultado, data):
        resultado = ResultadoAprendizajeRepository.obtener_por_id(db, id_resultado)

        if not resultado:
            return None

        resultado.codigo = data.codigo
        resultado.descripcion = data.descripcion
        resultado.idCompetencia = data.idCompetencia
        resultado.idGuia = data.idGuia
        resultado.horasAsignadas = data.horasAsignadas
        resultado.numeroFase = data.numeroFase

        return ResultadoAprendizajeRepository.actualizar(db, resultado)

    @staticmethod
    def eliminar(db, id_resultado):
        resultado = ResultadoAprendizajeRepository.obtener_por_id(db, id_resultado)

        if not resultado:
            return False

        ResultadoAprendizajeRepository.eliminar(db, resultado)
        return True
