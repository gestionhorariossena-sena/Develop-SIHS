from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.models.asistencia import Asistencia
from app.models.horario import Horario


class AsistenciaRepository:
    @staticmethod
    def obtener_de_sesion(db: Session, id_horario: int, fecha_sesion: date) -> list[Asistencia]:
        return (
            db.query(Asistencia)
            .filter(Asistencia.idHorario == id_horario, Asistencia.fechaSesion == fecha_sesion)
            .all()
        )

    @staticmethod
    def obtener_de_aprendiz(
        db: Session, id_aprendiz, *, desde: date | None = None, hasta: date | None = None
    ) -> list[Asistencia]:
        """El historial trae el horario cargado: la pantalla muestra el tema,
        el instructor y el ambiente de cada sesión, no solo el estado."""
        consulta = db.query(Asistencia).options(
            joinedload(Asistencia.horario).joinedload(Horario.instructor),
            joinedload(Asistencia.horario).joinedload(Horario.ambiente),
            joinedload(Asistencia.horario).joinedload(Horario.resultado),
        ).filter(Asistencia.idUsuarioAprendiz == id_aprendiz)

        if desde:
            consulta = consulta.filter(Asistencia.fechaSesion >= desde)
        if hasta:
            consulta = consulta.filter(Asistencia.fechaSesion <= hasta)

        return consulta.order_by(Asistencia.fechaSesion.desc(), Asistencia.idAsistencia.desc()).all()

    @staticmethod
    def guardar(db: Session, asistencias: list[Asistencia]) -> None:
        for asistencia in asistencias:
            db.add(asistencia)
        db.commit()
