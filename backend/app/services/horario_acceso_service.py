"""Permisos de lectura de horarios y exportaciones personales."""
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario


class HorarioAccesoService:
    @staticmethod
    def roles(usuario) -> set[str]:
        return {rol.nombre for rol in usuario.roles}

    @staticmethod
    def es_gestor(usuario) -> bool:
        return bool(HorarioAccesoService.roles(usuario) & {"Administrador", "Coordinador"})

    @staticmethod
    def puede_ver_ficha(db, usuario, id_ficha: int) -> bool:
        if HorarioAccesoService.es_gestor(usuario):
            return True
        roles = HorarioAccesoService.roles(usuario)
        if "Aprendiz" in roles and db.query(FichaUsuario).filter(
            FichaUsuario.idFicha == id_ficha,
            FichaUsuario.idUsuario == usuario.idUsuario,
        ).first() is not None:
            return True
        if "Instructor" in roles and db.query(Horario).filter(
            Horario.idFicha == id_ficha,
            Horario.idInstructor == usuario.idUsuario,
            Horario.activo.is_(True),
            Horario.publicado.is_(True),
        ).first() is not None:
            return True
        return False

    @staticmethod
    def puede_ver_bloque(db, usuario, horario: Horario) -> bool:
        if HorarioAccesoService.es_gestor(usuario):
            return True
        if not horario.activo or not horario.publicado:
            return False
        roles = HorarioAccesoService.roles(usuario)
        if "Instructor" in roles and horario.idInstructor == usuario.idUsuario:
            return True
        if "Aprendiz" in roles:
            return db.query(FichaUsuario).filter(
                FichaUsuario.idFicha == horario.idFicha,
                FichaUsuario.idUsuario == usuario.idUsuario,
            ).first() is not None
        return False
