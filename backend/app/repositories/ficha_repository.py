from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models.ficha import Ficha
from app.models.horario import Horario
from app.models.jornada import Jornada
from app.models.rol import Rol
from app.models.usuario_rol import UsuarioRol
from app.models.ficha import ficha_usuario


class FichaRepository:
    @staticmethod
    def obtener_todos(db: Session):
        fichas = db.query(Ficha).options(selectinload(Ficha.programa), selectinload(Ficha.trimestre)).all()
        if not fichas:
            return fichas

        aprendices_por_ficha = dict(
            db.query(ficha_usuario.c.idFicha, func.count(ficha_usuario.c.idUsuario))
            .join(UsuarioRol, UsuarioRol.idUsuario == ficha_usuario.c.idUsuario)
            .join(Rol, Rol.idRol == UsuarioRol.idRol)
            .filter(Rol.nombre == "Aprendiz")
            .group_by(ficha_usuario.c.idFicha)
            .all()
        )
        jornadas_por_ficha = {}
        for id_ficha, nombre_jornada in (
            db.query(Horario.idFicha, Jornada.nombreJornada)
            .join(Jornada, Jornada.idJornada == Horario.idJornada)
            .distinct()
            .all()
        ):
            jornadas_por_ficha.setdefault(id_ficha, []).append(nombre_jornada)

        for ficha in fichas:
            ficha.aprendicesTotales = aprendices_por_ficha.get(ficha.idFicha, 0)
            ficha.jornadas = sorted(jornadas_por_ficha.get(ficha.idFicha, []))
        return fichas

    @staticmethod
    def obtener_por_id(db: Session, id_ficha: int):
        return db.query(Ficha).filter(Ficha.idFicha == id_ficha).first()

    @staticmethod
    def crear(db: Session, ficha: Ficha):
        db.add(ficha)
        db.commit()
        db.refresh(ficha)
        return ficha

    @staticmethod
    def actualizar(db: Session, ficha: Ficha):
        db.commit()
        db.refresh(ficha)
        return ficha

    @staticmethod
    def eliminar(db: Session, ficha: Ficha):
        db.delete(ficha)
        db.commit()
