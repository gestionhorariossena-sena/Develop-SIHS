from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.aviso import Aviso
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario

# El tablón muestra el código de ficha, el nombre de sede y quién publicó,
# no los ids: sin eager loading eso serían 3 queries por aviso.
_RELACIONES = (
    joinedload(Aviso.ficha),
    joinedload(Aviso.sede),
    joinedload(Aviso.publicador),
)


class AvisoRepository:
    @staticmethod
    def crear(db: Session, aviso: Aviso) -> Aviso:
        db.add(aviso)
        db.commit()
        db.refresh(aviso)
        return aviso

    @staticmethod
    def obtener_todos(
        db: Session,
        *,
        categoria: str | None = None,
        id_ficha: int | None = None,
        id_usuario=None,
        ver_todos: bool = False,
    ) -> list[Aviso]:
        query = db.query(Aviso).options(*_RELACIONES)

        if categoria is not None:
            query = query.filter(Aviso.categoria == categoria)

        if id_ficha is not None:
            query = query.filter(Aviso.idFicha == id_ficha)

        if not ver_todos:
            fichas_del_usuario = select(FichaUsuario.idFicha).where(FichaUsuario.idUsuario == id_usuario).union(
                select(Horario.idFicha).where(
                    Horario.idInstructor == id_usuario,
                    Horario.activo.is_(True),
                    Horario.publicado.is_(True),
                )
            )
            sedes_del_usuario = select(Ficha.idSede).where(
                Ficha.idFicha.in_(fichas_del_usuario),
                Ficha.idSede.is_not(None),
            )
            query = query.filter(
                or_(
                    and_(Aviso.idFicha.is_(None), Aviso.idSede.is_(None)),
                    Aviso.idFicha.in_(fichas_del_usuario),
                    Aviso.idSede.in_(sedes_del_usuario),
                )
            )

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
