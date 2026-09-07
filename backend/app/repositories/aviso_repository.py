from sqlalchemy.orm import Session

from app.models.aviso import Aviso


class AvisoRepository:
    @staticmethod
    def crear(db: Session, aviso: Aviso) -> Aviso:
        db.add(aviso)
        db.commit()
        db.refresh(aviso)
        return aviso

    @staticmethod
    def obtener_todos(db: Session, *, categoria: str | None = None, id_ficha: int | None = None) -> list[Aviso]:
        query = db.query(Aviso)

        if categoria is not None:
            query = query.filter(Aviso.categoria == categoria)

        if id_ficha is not None:
            query = query.filter(Aviso.idFicha == id_ficha)

        return query.order_by(Aviso.fechaPublicacion.desc()).all()

    @staticmethod
    def obtener_por_id(db: Session, id_aviso: int) -> Aviso | None:
        return db.query(Aviso).filter(Aviso.idAviso == id_aviso).first()

    @staticmethod
    def actualizar(db: Session, aviso: Aviso) -> Aviso:
        db.commit()
        db.refresh(aviso)
        return aviso

    @staticmethod
    def eliminar(db: Session, aviso: Aviso) -> None:
        db.delete(aviso)
        db.commit()
