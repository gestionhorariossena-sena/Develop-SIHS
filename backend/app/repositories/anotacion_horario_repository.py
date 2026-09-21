from sqlalchemy.orm import Session

from app.models.anotacion_horario import AnotacionHorario


class AnotacionHorarioRepository:
    @staticmethod
    def obtener_mias(db: Session, id_usuario):
        return (
            db.query(AnotacionHorario)
            .filter(AnotacionHorario.idUsuario == id_usuario)
            .order_by(AnotacionHorario.fechaCreacion.desc())
            .all()
        )

    @staticmethod
    def obtener_por_id_y_usuario(db: Session, id_anotacion: int, id_usuario):
        return (
            db.query(AnotacionHorario)
            .filter(
                AnotacionHorario.idAnotacion == id_anotacion,
                AnotacionHorario.idUsuario == id_usuario,
            )
            .first()
        )

    @staticmethod
    def crear(db: Session, anotacion: AnotacionHorario):
        db.add(anotacion)
        db.commit()
        db.refresh(anotacion)
        return anotacion

    @staticmethod
    def actualizar(db: Session, anotacion: AnotacionHorario):
        db.commit()
        db.refresh(anotacion)
        return anotacion

    @staticmethod
    def eliminar(db: Session, anotacion: AnotacionHorario):
        db.delete(anotacion)
        db.commit()
