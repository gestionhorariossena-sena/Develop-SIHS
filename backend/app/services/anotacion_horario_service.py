from sqlalchemy.orm import Session

from app.models.anotacion_horario import AnotacionHorario
from app.repositories.anotacion_horario_repository import AnotacionHorarioRepository


class AnotacionHorarioService:
    @staticmethod
    def crear(db: Session, id_usuario, data) -> AnotacionHorario:
        anotacion = AnotacionHorario(
            idUsuario=id_usuario,
            idHorario=data.idHorario,
            nota=data.nota,
            etiqueta=data.etiqueta,
            recordatorioActivo=data.recordatorioActivo,
        )
        return AnotacionHorarioRepository.crear(db, anotacion)

    @staticmethod
    def obtener_mias(db: Session, id_usuario) -> list[AnotacionHorario]:
        return AnotacionHorarioRepository.obtener_por_usuario(db, id_usuario)

    @staticmethod
    def actualizar(db: Session, id_anotacion: int, id_usuario, data) -> AnotacionHorario | None:
        """None tanto si no existe como si no es del usuario — el router
        responde 404 en ambos casos, sin revelar si la anotación de otro
        usuario existe."""
        anotacion = AnotacionHorarioRepository.obtener_por_id(db, id_anotacion)

        if anotacion is None or anotacion.idUsuario != id_usuario:
            return None

        return AnotacionHorarioRepository.actualizar(
            db,
            anotacion,
            nota=data.nota,
            etiqueta=data.etiqueta,
            recordatorio_activo=data.recordatorioActivo,
        )

    @staticmethod
    def eliminar(db: Session, id_anotacion: int, id_usuario) -> bool:
        anotacion = AnotacionHorarioRepository.obtener_por_id(db, id_anotacion)

        if anotacion is None or anotacion.idUsuario != id_usuario:
            return False

        AnotacionHorarioRepository.eliminar(db, anotacion)
        return True
