from datetime import datetime

from sqlalchemy.orm import Session

from app.models.auditoria import Auditoria


class AuditoriaRepository:
    @staticmethod
    def crear(db: Session, registro: Auditoria) -> Auditoria:
        db.add(registro)
        db.commit()
        db.refresh(registro)
        return registro

    @staticmethod
    def obtener_todos(db: Session, entidad: str | None = None) -> list[Auditoria]:
        query = db.query(Auditoria).order_by(Auditoria.fecha.desc())
        if entidad:
            query = query.filter(Auditoria.entidad == entidad)
        return query.all()

    @staticmethod
    def contar_login_fallido_desde(db: Session, identificador: str, desde: datetime) -> int:
        """Para SCRUM-17: cuántos intentos fallidos de login tiene ese
        identificador desde `desde` en adelante — la decisión de qué hacer
        con ese número (bloquear, avisar) no es de acá."""
        return (
            db.query(Auditoria)
            .filter(
                Auditoria.accion == "LOGIN_FALLIDO",
                Auditoria.identificador == identificador,
                Auditoria.fecha >= desde,
            )
            .count()
        )

    @staticmethod
    def obtener_ultimo_login_fallido_desde(
        db: Session, identificador: str, desde: datetime
    ) -> Auditoria | None:
        """El intento fallido más reciente de ese identificador dentro de
        la ventana — para calcular desde cuándo contar el tiempo de
        bloqueo (RF-001/RNF-06)."""
        return (
            db.query(Auditoria)
            .filter(
                Auditoria.accion == "LOGIN_FALLIDO",
                Auditoria.identificador == identificador,
                Auditoria.fecha >= desde,
            )
            .order_by(Auditoria.fecha.desc())
            .first()
        )
