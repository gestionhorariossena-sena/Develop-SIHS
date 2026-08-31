from sqlalchemy.orm import Session

from app.models.actividades_aprendizaje import ActividadAprendizaje


class ActividadAprendizajeRepository:
    @staticmethod
    def obtener_todos(db: Session):
        return db.query(ActividadAprendizaje).all()

    @staticmethod
    def obtener_por_id(db: Session, id_actividad: int):
        return db.query(ActividadAprendizaje).filter(ActividadAprendizaje.idActividad == id_actividad).first()

    @staticmethod
    def obtener_por_resultado(db: Session, id_resultado: int):
        return db.query(ActividadAprendizaje).filter(ActividadAprendizaje.idResultado == id_resultado).all()

    @staticmethod
    def crear(db: Session, actividad: ActividadAprendizaje):
        db.add(actividad)
        db.commit()
        db.refresh(actividad)
        return actividad

    @staticmethod
    def actualizar(db: Session, actividad: ActividadAprendizaje):
        db.commit()
        db.refresh(actividad)
        return actividad

    @staticmethod
    def eliminar(db: Session, actividad: ActividadAprendizaje):
        db.delete(actividad)
        db.commit()
