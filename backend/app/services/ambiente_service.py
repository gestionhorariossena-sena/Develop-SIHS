from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.ambiente_repository import AmbienteRepository
from app.repositories.sede_repository import SedeRepository
from app.schemas.ambiente import AmbienteCreate, AmbienteUpdate


class AmbienteService:
    def __init__(self, repository: AmbienteRepository | None = None, sede_repository: SedeRepository | None = None) -> None:
        self.repository = repository or AmbienteRepository()
        self.sede_repository = sede_repository or SedeRepository()

    def list(self, db: Session, sede_id: int | None = None):
        if sede_id is not None and self.sede_repository.get(db, sede_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La sede no existe.")
        return self.repository.list(db, sede_id)

    def get(self, db: Session, ambiente_id: int):
        ambiente = self.repository.get(db, ambiente_id)
        if ambiente is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El ambiente no existe.")
        return ambiente

    def _validate_sede(self, db: Session, sede_id: int) -> None:
        if self.sede_repository.get(db, sede_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La sede no existe.")

    def create(self, db: Session, data: AmbienteCreate):
        self._validate_sede(db, data.sede_id)
        if data.tipo_ambiente.value == "regular":
            data = data.model_copy(update={"nombre": "Ambiente"})
        try:
            return self.repository.create(db, data)
        except IntegrityError as exc:
            db.rollback()
            if getattr(exc.orig, "diag", None) and exc.orig.diag.constraint_name == "uqAmbienteNumeroSede":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ya existe el ambiente {data.numero_ambiente} en esta sede.",
                ) from None
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se pudo crear el ambiente.") from None

    def update(self, db: Session, ambiente_id: int, data: AmbienteUpdate):
        ambiente = self.get(db, ambiente_id)
        self._validate_sede(db, data.sede_id)
        if data.tipo_ambiente.value == "regular":
            data = data.model_copy(update={"nombre": "Ambiente"})
        try:
            return self.repository.update(db, ambiente, data)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se pudo actualizar el ambiente.") from None

    def delete(self, db: Session, ambiente_id: int):
        ambiente = self.get(db, ambiente_id)
        try:
            self.repository.delete(db, ambiente)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se puede eliminar un ambiente asociado a horarios.") from None
