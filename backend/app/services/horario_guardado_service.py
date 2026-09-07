from app.models.horario_guardado import HorarioGuardado
from app.repositories.ficha_repository import FichaRepository
from app.repositories.horario_guardado_repository import HorarioGuardadoRepository
from app.repositories.horario_repository import HorarioRepository


class HorarioGuardadoService:
    @staticmethod
    def obtener_todos(db):
        horarios = HorarioGuardadoRepository.obtener_todos(db)
        return [HorarioGuardadoService._enriquecer_programa_con_db(db, horario) for horario in horarios]

    @staticmethod
    def obtener_por_id(db, id_horario_guardado):
        horario = HorarioGuardadoRepository.obtener_por_id(db, id_horario_guardado)
        return HorarioGuardadoService._enriquecer_programa_con_db(db, horario) if horario else None

    @staticmethod
    def _enriquecer_programa_con_db(db, horario_guardado):
        ficha = FichaRepository.obtener_por_codigo(db, horario_guardado.ficha)
        horario_guardado.programaNombre = ficha.programa.nombrePrograma if ficha else None
        return horario_guardado

    @staticmethod
    def crear(db, data, usuario):
        nuevo = HorarioGuardado(
            idUsuario=usuario.idUsuario,
            ficha=data.ficha,
            aprendices=data.aprendices,
            horasTrimestre=data.horasTrimestre,
            fechaInicio=data.fechaInicio,
            fechaFin=data.fechaFin,
            bloques=[bloque.model_dump() for bloque in data.bloques],
            grid=data.grid,
            idsHorarios=data.idsHorarios,
        )
        creado = HorarioGuardadoRepository.crear(db, nuevo)
        creado.usuario = usuario
        return HorarioGuardadoService._enriquecer_programa_con_db(db, creado)

    @staticmethod
    def eliminar(db, id_horario_guardado):
        horario_guardado = HorarioGuardadoRepository.obtener_por_id(db, id_horario_guardado)

        if not horario_guardado:
            return False

        # Borra también las clases reales de `horarios` que este snapshot
        # representa — sin esto quedaban huérfanas (bug reportado
        # 2026-09-02): el instructor seguía "ocupado" para cruces aunque
        # su "horario completo" ya no apareciera en el historial. Ignora
        # silenciosamente las que ya no existan (borradas a mano aparte).
        for id_horario in horario_guardado.idsHorarios or []:
            horario = HorarioRepository.obtener_por_id(db, id_horario)
            if horario:
                HorarioRepository.eliminar(db, horario)

        HorarioGuardadoRepository.eliminar(db, horario_guardado)
        return True
