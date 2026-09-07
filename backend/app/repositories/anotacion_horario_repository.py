from sqlalchemy.orm import Session

from app.models.anotacion_horario import AnotacionHorario


class AnotacionHorarioRepository:
    @staticmethod
    def crear(db: Session, anotacion: AnotacionHorario) -> AnotacionHorario:
        db.add(anotacion)
        db.commit()
        db.refresh(anotacion)
        return anotacion

    @staticmethod
    def obtener_por_usuario(db: Session, id_usuario) -> list[AnotacionHorario]:
        return (
            db.query(AnotacionHorario)
            .filter(AnotacionHorario.idUsuario == id_usuario)
            .order_by(AnotacionHorario.fechaCreacion.desc())
            .all()
        )

    @staticmethod
    def obtener_por_id(db: Session, id_anotacion: int) -> AnotacionHorario | None:
        return (
            db.query(AnotacionHorario)
            .filter(AnotacionHorario.idAnotacion == id_anotacion)
            .first()
        )

    @staticmethod
    def actualizar(
        db: Session,
        anotacion: AnotacionHorario,
        *,
        nota: str,
        etiqueta: str,
        recordatorio_activo: bool,
    ) -> AnotacionHorario:
        anotacion.nota = nota
        anotacion.etiqueta = etiqueta
        anotacion.recordatorioActivo = recordatorio_activo
        db.commit()
        db.refresh(anotacion)
        return anotacion

    @staticmethod
    def eliminar(db: Session, anotacion: AnotacionHorario) -> None:
        db.delete(anotacion)
        db.commit()
