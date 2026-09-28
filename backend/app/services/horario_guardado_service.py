from app.models.anotacion_horario import AnotacionHorario
from app.models.asistencia import Asistencia
from app.models.horario import Horario
from app.models.horario_guardado import HorarioGuardado
from app.models.solicitud_cambio_horario import SolicitudCambioHorario
from app.repositories.ficha_repository import FichaRepository
from app.repositories.horario_guardado_repository import HorarioGuardadoRepository
from app.repositories.horario_repository import HorarioRepository
from app.services.horario_service import (
    CruceHorarioError,
    FichaTrimestreInconsistenteError,
    HorarioService,
)


class HorarioGuardadoNoReemplazableError(Exception):
    """El snapshot no tiene un vínculo relacional seguro para reemplazar."""


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
    def obtener_con_asignaciones(db, id_horario_guardado):
        guardado = HorarioGuardadoRepository.obtener_por_id(db, id_horario_guardado)
        if not guardado:
            return None
        asignaciones = HorarioRepository.obtener_por_ids(db, guardado.idsHorarios or [])
        guardado.asignaciones = [HorarioService.a_response(db, h) for h in asignaciones]
        return HorarioGuardadoService._enriquecer_programa_con_db(db, guardado)

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
    def reemplazar(db, id_horario_guardado, data):
        """Reemplaza asignaciones y snapshot sin confirmar la sesión.

        Las clases existentes se actualizan en el mismo ID cuando es seguro.
        Las clases retiradas se inactivan y despublican en vez de borrarse,
        conservando asistencias, solicitudes, anotaciones y referencias de
        auditoría. El endpoint es responsable del commit/rollback conjunto.
        """
        guardado = HorarioGuardadoRepository.obtener_para_reemplazo(db, id_horario_guardado)
        if guardado is None:
            return None

        ids_originales = list(guardado.idsHorarios or [])
        if not ids_originales:
            raise HorarioGuardadoNoReemplazableError(
                "Este horario no tiene asignaciones vinculadas y no se puede reemplazar de forma segura."
            )
        if len(set(ids_originales)) != len(ids_originales):
            raise HorarioGuardadoNoReemplazableError(
                "El snapshot contiene vínculos de clases duplicados y requiere revisión."
            )
        originales = HorarioRepository.obtener_por_ids(db, ids_originales, bloquear=True)
        if len(originales) != len(ids_originales):
            raise HorarioGuardadoNoReemplazableError(
                "Faltan clases vinculadas al snapshot; no se modificó ningún registro."
            )
        if not data.horarios:
            raise HorarioGuardadoNoReemplazableError(
                "El horario debe conservar al menos una asignación."
            )

        grupos_grid = {
            (indice_fila, bloque_id)
            for indice_fila, fila in enumerate(data.grid)
            for bloque_id in fila
            if bloque_id
        }
        grupos_propuestos = [(asignacion.bloqueIdx, asignacion.bloqueId) for asignacion in data.horarios]
        if len(grupos_grid) != len(data.horarios) or set(grupos_propuestos) != grupos_grid:
            raise HorarioGuardadoNoReemplazableError(
                "La cantidad de asignaciones no coincide con las clases del horario visual."
            )
        if len(set(grupos_propuestos)) != len(grupos_propuestos):
            raise HorarioGuardadoNoReemplazableError(
                "Una clase visual tiene más de una asignación relacional."
            )

        estados_originales = {
            h.idHorario: (h.activo, h.publicado) for h in originales
        }
        publicado_global = all(publicado for _, publicado in estados_originales.values())
        activo_global = all(activo for activo, _ in estados_originales.values())
        dias_originales = {
            h.idHorario: HorarioRepository.obtener_dias(db, h.idHorario) for h in originales
        }
        dependencias = {
            h.idHorario: HorarioGuardadoService._tiene_dependencias_operativas(db, h.idHorario)
            for h in originales
        }
        originales_por_id = {horario.idHorario: horario for horario in originales}
        ids_usados: set[int] = set()
        for asignacion in data.horarios:
            id_original = asignacion.idHorarioOriginal
            if id_original is None:
                continue
            if id_original not in originales_por_id:
                raise HorarioGuardadoNoReemplazableError(
                    "Una asignación intenta reemplazar una clase que no pertenece a este snapshot."
                )
            if id_original in ids_usados:
                raise HorarioGuardadoNoReemplazableError(
                    "Una clase original fue asignada más de una vez en la propuesta."
                )
            ids_usados.add(id_original)
            if (
                asignacion.fechaModificacionOriginal is None
                or asignacion.fechaModificacionOriginal != originales_por_id[id_original].fechaModificacion
            ):
                raise HorarioGuardadoNoReemplazableError(
                    f"La clase {id_original} cambió desde que se abrió el editor. "
                    "Recarga el horario antes de guardar otra vez."
                )

        # Se excluyen temporalmente las clases originales de las consultas de
        # cruces. Cada propuesta se inserta/actualiza sin commit y queda visible
        # para validar las siguientes propuestas dentro de esta transacción.
        for h in originales:
            h.activo = False
        db.flush()

        nuevas: list[Horario] = []
        cambios_publicados: list[Horario] = []
        nuevos_ids: list[int] = []
        activos_finales: dict[int, bool] = {}

        for asignacion in data.horarios:
            id_original = asignacion.idHorarioOriginal
            existente = originales_por_id.get(id_original) if id_original is not None else None
            if existente is None:
                publicado = publicado_global
                activo = activo_global
            else:
                activo, publicado = estados_originales[existente.idHorario]

            HorarioService._validar_ficha_del_periodo(db, asignacion)
            errores = HorarioService._detectar_cruces(db, asignacion)
            if errores:
                raise CruceHorarioError(errores)

            if existente is None:
                horario = Horario(
                    horaInicio=asignacion.horaInicio,
                    horaFin=asignacion.horaFin,
                    idJornada=asignacion.idJornada,
                    idTrimestre=asignacion.idTrimestre,
                    idAmbiente=asignacion.idAmbiente,
                    idInstructor=asignacion.idInstructor,
                    idFicha=asignacion.idFicha,
                    idResultado=asignacion.idResultado,
                    activo=True,
                    publicado=publicado,
                )
                HorarioRepository.crear_sin_commit(db, horario, asignacion.dias)
                cambio = True
            else:
                cambio = not HorarioGuardadoService._misma_asignacion(
                    existente, asignacion, dias_originales[existente.idHorario]
                )
                if cambio and dependencias[existente.idHorario]:
                    raise HorarioGuardadoNoReemplazableError(
                        f"La clase {existente.idHorario} tiene asistencia, solicitud o anotación "
                        "asociada y no puede cambiarse sin afectar esos registros."
                    )
                existente.horaInicio = asignacion.horaInicio
                existente.horaFin = asignacion.horaFin
                existente.idJornada = asignacion.idJornada
                existente.idTrimestre = asignacion.idTrimestre
                existente.idAmbiente = asignacion.idAmbiente
                existente.idInstructor = asignacion.idInstructor
                existente.idFicha = asignacion.idFicha
                existente.idResultado = asignacion.idResultado
                existente.activo = True  # se incluye al validar los siguientes bloques
                existente.publicado = publicado
                horario = HorarioRepository.actualizar_sin_commit(db, existente, asignacion.dias)

            nuevas.append(horario)
            nuevos_ids.append(horario.idHorario)
            activos_finales[horario.idHorario] = activo
            if cambio and publicado:
                cambios_publicados.append(horario)

        # Las clases quitadas se conservan como registros inactivos; así no se
        # pierden asistencias, solicitudes, anotaciones ni sus IDs históricos.
        for horario in originales:
            if horario.idHorario in ids_usados:
                continue
            horario.activo = False
            horario.publicado = False

        guardado.ficha = data.ficha
        guardado.aprendices = data.aprendices
        guardado.horasTrimestre = data.horasTrimestre
        guardado.fechaInicio = data.fechaInicio
        guardado.fechaFin = data.fechaFin
        guardado.bloques = [bloque.model_dump() for bloque in data.bloques]
        guardado.grid = data.grid
        guardado.idsHorarios = nuevos_ids

        for horario in nuevas:
            horario.activo = activos_finales[horario.idHorario]
        db.flush()

        if cambios_publicados:
            HorarioService.notificar_reemplazo_publicado_transaccional(db, cambios_publicados)

        return HorarioGuardadoService._enriquecer_programa_con_db(db, guardado)

    @staticmethod
    def _misma_asignacion(horario, data, dias_actuales):
        return (
            horario.horaInicio == data.horaInicio
            and horario.horaFin == data.horaFin
            and horario.idJornada == data.idJornada
            and horario.idTrimestre == data.idTrimestre
            and horario.idAmbiente == data.idAmbiente
            and horario.idInstructor == data.idInstructor
            and horario.idFicha == data.idFicha
            and horario.idResultado == data.idResultado
            and set(dias_actuales) == set(data.dias)
        )

    @staticmethod
    def _tiene_dependencias_operativas(db, id_horario):
        return any((
            db.query(Asistencia).filter(Asistencia.idHorario == id_horario).first(),
            db.query(SolicitudCambioHorario)
            .filter(SolicitudCambioHorario.idHorarioOrigen == id_horario)
            .first(),
            db.query(AnotacionHorario).filter(AnotacionHorario.idHorario == id_horario).first(),
        ))

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
