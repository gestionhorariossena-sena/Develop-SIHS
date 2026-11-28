"""Análisis y borrado seguro de entidades vinculadas a horarios."""
from fastapi import HTTPException, status

from app.models.asistencia import Asistencia
from app.models.ambiente import Ambiente
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario
from app.models.usuario import Usuario


class EliminacionSeguraService:
    TIPOS = {"instructor", "aprendiz", "ficha", "ambiente"}

    @classmethod
    def analizar(cls, db, tipo: str, identificador: str) -> dict:
        if tipo not in cls.TIPOS:
            raise HTTPException(status_code=404, detail="Tipo de entidad no soportado.")
        entidad, horarios = cls._resolver(db, tipo, identificador)
        ids_horario = [h.idHorario for h in horarios]
        asistencias = db.query(Asistencia).filter(Asistencia.idHorario.in_(ids_horario)).count() if ids_horario else 0
        publicados = sum(1 for horario in horarios if horario.publicado)
        borradores = len(horarios) - publicados
        vinculos = cls._vinculos(db, tipo, entidad)
        bloqueado = publicados > 0 or asistencias > 0
        return {
            "tipo": tipo,
            "id": str(identificador),
            "dependencias": {
                "horariosPublicados": publicados,
                "horariosBorrador": borradores,
                "asistencias": asistencias,
                "vinculosFicha": vinculos,
            },
            "accion": "bloqueado" if bloqueado else ("eliminar_borradores_y_entidad" if borradores else "eliminar_entidad"),
        }

    @classmethod
    def eliminar(cls, db, tipo: str, identificador: str) -> dict:
        analisis = cls.analizar(db, tipo, identificador)
        if analisis["accion"] == "bloqueado":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={**analisis, "mensaje": "No se elimina historial publicado ni asistencias."},
            )
        entidad, horarios = cls._resolver(db, tipo, identificador)
        for horario in horarios:
            db.delete(horario)
        if tipo == "ficha":
            db.query(FichaUsuario).filter(FichaUsuario.idFicha == entidad.idFicha).delete(synchronize_session=False)
        elif tipo in {"instructor", "aprendiz"}:
            db.query(FichaUsuario).filter(FichaUsuario.idUsuario == entidad.idUsuario).delete(synchronize_session=False)
        db.delete(entidad)
        db.commit()
        return {**analisis, "accion": "eliminado", "horariosEliminados": len(horarios)}

    @staticmethod
    def _vinculos(db, tipo, entidad) -> int:
        if tipo == "ficha":
            return db.query(FichaUsuario).filter(FichaUsuario.idFicha == entidad.idFicha).count()
        if tipo in {"instructor", "aprendiz"}:
            return db.query(FichaUsuario).filter(FichaUsuario.idUsuario == entidad.idUsuario).count()
        return 0

    @staticmethod
    def _resolver(db, tipo, identificador):
        if tipo == "ficha":
            entidad = db.get(Ficha, int(identificador))
            horarios = db.query(Horario).filter(Horario.idFicha == int(identificador)).all()
        elif tipo == "ambiente":
            entidad = db.get(Ambiente, int(identificador))
            horarios = db.query(Horario).filter(Horario.idAmbiente == int(identificador)).all()
        else:
            entidad = db.get(Usuario, identificador)
            horarios = db.query(Horario).filter(Horario.idInstructor == identificador).all() if tipo == "instructor" else []
        if entidad is None:
            raise HTTPException(status_code=404, detail="Entidad no encontrada.")
        if tipo == "instructor" and not any(rol.nombre == "Instructor" for rol in entidad.roles):
            raise HTTPException(status_code=409, detail="El usuario no tiene rol Instructor.")
        if tipo == "aprendiz" and not any(rol.nombre == "Aprendiz" for rol in entidad.roles):
            raise HTTPException(status_code=409, detail="El usuario no tiene rol Aprendiz.")
        return entidad, horarios
