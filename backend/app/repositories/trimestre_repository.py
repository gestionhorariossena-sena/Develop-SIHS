from sqlalchemy.orm import Session

from app.models.trimestre import Trimestre


class TrimestreRepository:
    @staticmethod
    def obtener_todos(db: Session):
        return db.query(Trimestre).all()

    @staticmethod
    def obtener_por_id(db: Session, id_trimestre: int):
        return db.query(Trimestre).filter(Trimestre.idTrimestre == id_trimestre).first()

    @staticmethod
    def obtener_activo(db: Session):
        return db.query(Trimestre).filter(Trimestre.estado == "activo").first()

    @staticmethod
    def crear(db: Session, trimestre: Trimestre):
        db.add(trimestre)
        db.commit()
        db.refresh(trimestre)
        return trimestre

    @staticmethod
    def actualizar(db: Session, trimestre: Trimestre):
        db.commit()
        db.refresh(trimestre)
        return trimestre

    @staticmethod
    def eliminar(db: Session, trimestre: Trimestre):
        db.delete(trimestre)
        db.commit()
