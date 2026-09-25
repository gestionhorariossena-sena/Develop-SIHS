from sqlalchemy.orm import Session, selectinload

from app.models.competencia_formacion import CompetenciaFormacion


class CompetenciaFormacionRepository:
    @staticmethod
    def obtener_todos(db: Session):
        # selectinload porque la respuesta incluye las especialidades de
        # cada competencia: sin esto son N queries extra en un listado.
        return (
            db.query(CompetenciaFormacion)
            .options(selectinload(CompetenciaFormacion.especialidades))
            .all()
        )

    @staticmethod
    def obtener_por_id(db: Session, id_competencia: int):
        return db.query(CompetenciaFormacion).filter(CompetenciaFormacion.idCompetencia == id_competencia).first()

    @staticmethod
    def crear(db: Session, competencia: CompetenciaFormacion):
        db.add(competencia)
        db.commit()
        db.refresh(competencia)
        return competencia

    @staticmethod
    def actualizar(db: Session, competencia: CompetenciaFormacion):
        db.commit()
        db.refresh(competencia)
        return competencia

    @staticmethod
    def eliminar(db: Session, competencia: CompetenciaFormacion):
        db.delete(competencia)
        db.commit()
