from app.models.horario_guardado import HorarioGuardado
from app.repositories.horario_guardado_repository import HorarioGuardadoRepository
from app.repositories.horario_repository import HorarioRepository


class HorarioGuardadoService:
    @staticmethod
    def obtener_todos(db):
        return HorarioGuardadoRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db, id_horario_guardado):
        return HorarioGuardadoRepository.obtener_por_id(db, id_horario_guardado)

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
        return creado

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
