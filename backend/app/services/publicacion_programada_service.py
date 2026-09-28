import hashlib
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.models.horario import Horario
from app.models.publicacion_programada import PublicacionProgramada, PublicacionProgramadaHorario
from app.repositories.ficha_usuario_repository import FichaUsuarioRepository
from app.services.auditoria_service import AuditoriaService
from app.services.horario_service import HorarioService
from app.services.notificacion_service import NotificacionService, TIPO_HORARIO, TIPO_SISTEMA

BOGOTA = ZoneInfo("America/Bogota")
ESTADOS_ACTIVOS = ("pendiente", "revision_requerida")


class PublicacionProgramadaError(ValueError):
    pass


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _huella(db, horario: Horario) -> str:
    from app.repositories.horario_repository import HorarioRepository
    payload = {
        "horaInicio": horario.horaInicio.isoformat(), "horaFin": horario.horaFin.isoformat(),
        "idJornada": horario.idJornada, "idTrimestre": horario.idTrimestre,
        "idAmbiente": horario.idAmbiente, "idInstructor": str(horario.idInstructor),
        "idFicha": horario.idFicha, "idResultado": horario.idResultado,
        "activo": bool(horario.activo), "publicado": bool(horario.publicado),
        "dias": sorted(HorarioRepository.obtener_dias(db, horario.idHorario)),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _candidatos(db, id_trimestre: int, ids: list[int], *, excluir_publicacion=None):
    if not ids or len(ids) != len(set(ids)):
        raise PublicacionProgramadaError("Indica horarios únicos para programar.")
    stmt = select(Horario).where(Horario.idHorario.in_(ids)).order_by(Horario.idHorario).with_for_update()
    horarios = db.execute(stmt).scalars().all()
    if len(horarios) != len(ids):
        raise PublicacionProgramadaError("Uno o más horarios ya no existen.")
    if any(h.idTrimestre != id_trimestre or not h.activo or h.publicado for h in horarios):
        raise PublicacionProgramadaError("Todos los horarios deben ser borradores activos del período seleccionado.")
    stmt = select(PublicacionProgramadaHorario.idHorario).join(PublicacionProgramada).where(
        PublicacionProgramadaHorario.idHorario.in_(ids),
        PublicacionProgramadaHorario.revision == PublicacionProgramada.revision,
        PublicacionProgramada.estado.in_(ESTADOS_ACTIVOS),
    )
    if excluir_publicacion is not None:
        stmt = stmt.where(PublicacionProgramada.idPublicacion != excluir_publicacion)
    if db.execute(stmt).first():
        raise PublicacionProgramadaError("Un horario ya pertenece a otra publicación pendiente de revisión.")
    return horarios


def _validar_conjunto(db, horarios):
    """Valida contra la base y también entre los elementos del conjunto."""
    original = {h.idHorario: h.activo for h in horarios}
    try:
        for h in horarios:
            h.activo = False
        db.flush()
        from types import SimpleNamespace
        from app.repositories.horario_repository import HorarioRepository
        for h in horarios:
            payload = SimpleNamespace(
                horaInicio=h.horaInicio, horaFin=h.horaFin, idJornada=h.idJornada,
                idTrimestre=h.idTrimestre, idAmbiente=h.idAmbiente,
                idInstructor=h.idInstructor, idFicha=h.idFicha, idResultado=h.idResultado,
                dias=HorarioRepository.obtener_dias(db, h.idHorario),
            )
            HorarioService._validar_ficha_del_periodo(db, payload)
            conflictos = HorarioService._detectar_cruces(db, payload, excluir_id=h.idHorario)
            if conflictos:
                raise PublicacionProgramadaError("Conflicto al validar horario " + str(h.idHorario) + ": " + "; ".join(conflictos))
            h.activo = original[h.idHorario]
            db.flush()
    finally:
        for h in horarios:
            h.activo = original[h.idHorario]
        db.flush()


def programar(db, *, id_trimestre, ids_horarios, fecha_local, responsable):
    if fecha_local.tzinfo is not None:
        raise PublicacionProgramadaError("La fecha debe enviarse como hora local sin zona, interpretada en America/Bogota.")
    instante = fecha_local.replace(tzinfo=BOGOTA).astimezone(timezone.utc)
    if instante <= datetime.now(timezone.utc):
        raise PublicacionProgramadaError("La fecha de ejecución debe ser futura.")
    horarios = _candidatos(db, id_trimestre, ids_horarios)
    _validar_conjunto(db, horarios)
    row = PublicacionProgramada(
        idTrimestre=id_trimestre, idCoordinador=responsable.idUsuario,
        fechaEjecucion=instante, estado="pendiente", revision=1,
    )
    db.add(row)
    db.flush()
    for horario in horarios:
        db.add(PublicacionProgramadaHorario(
            idPublicacion=row.idPublicacion, idHorario=horario.idHorario,
            idHorarioReferencia=horario.idHorario, revision=row.revision,
            huellaRevision=_huella(db, horario),
        ))
    AuditoriaService.registrar_transaccional(
        db, accion="PROGRAMAR_PUBLICACION", entidad="publicaciones_programadas",
        usuario=responsable, id_entidad=row.idPublicacion,
        detalle=f"Trimestre {id_trimestre}; horarios {','.join(map(str, ids_horarios))}; revisión 1",
    )
    db.commit()
    db.refresh(row)
    return row


def obtener(db, id_publicacion):
    return db.get(PublicacionProgramada, id_publicacion)


def listar(db, id_trimestre=None, estado=None):
    stmt = select(PublicacionProgramada).order_by(PublicacionProgramada.fechaEjecucion)
    if id_trimestre is not None:
        stmt = stmt.where(PublicacionProgramada.idTrimestre == id_trimestre)
    if estado:
        stmt = stmt.where(PublicacionProgramada.estado == estado)
    return db.execute(stmt).scalars().all()


def ids_de_horarios(db, id_publicacion):
    return list(db.execute(
        select(PublicacionProgramadaHorario.idHorarioReferencia)
        .join(PublicacionProgramada)
        .where(
            PublicacionProgramadaHorario.idPublicacion == id_publicacion,
            PublicacionProgramadaHorario.revision == PublicacionProgramada.revision,
        )
        .order_by(PublicacionProgramadaHorario.idHorarioReferencia)
    ).scalars())


def cancelar(db, row, responsable):
    row = db.execute(select(PublicacionProgramada).where(
        PublicacionProgramada.idPublicacion == row.idPublicacion
    ).with_for_update().execution_options(populate_existing=True)).scalar_one()
    if row.estado not in ESTADOS_ACTIVOS:
        raise PublicacionProgramadaError("Solo se pueden cancelar publicaciones pendientes o que requieren revisión.")
    row.estado = "cancelada"
    row.resultado = "Cancelada por coordinación."
    AuditoriaService.registrar_transaccional(
        db, accion="CANCELAR_PUBLICACION", entidad="publicaciones_programadas",
        usuario=responsable, id_entidad=row.idPublicacion,
    )
    db.commit()
    db.refresh(row)
    return row


def reprogramar(db, row, *, id_trimestre, ids_horarios, fecha_local, responsable):
    row = db.execute(select(PublicacionProgramada).where(
        PublicacionProgramada.idPublicacion == row.idPublicacion
    ).with_for_update().execution_options(populate_existing=True)).scalar_one()
    if row.estado not in ESTADOS_ACTIVOS:
        raise PublicacionProgramadaError("Solo se pueden reprogramar publicaciones pendientes o que requieren revisión.")
    if fecha_local.tzinfo is not None:
        raise PublicacionProgramadaError("La fecha debe ser local sin zona; se interpreta en America/Bogota.")
    instante = fecha_local.replace(tzinfo=BOGOTA).astimezone(timezone.utc)
    if instante <= datetime.now(timezone.utc):
        raise PublicacionProgramadaError("La fecha de ejecución debe ser futura.")
    horarios = _candidatos(db, id_trimestre, ids_horarios, excluir_publicacion=row.idPublicacion)
    _validar_conjunto(db, horarios)
    row.idTrimestre = id_trimestre
    row.fechaEjecucion = instante
    row.estado = "pendiente"
    row.fechaEjecucionReal = None
    row.resultado = None
    row.revision += 1
    db.flush()
    for horario in horarios:
        db.add(PublicacionProgramadaHorario(
            idPublicacion=row.idPublicacion, idHorario=horario.idHorario,
            idHorarioReferencia=horario.idHorario, revision=row.revision,
            huellaRevision=_huella(db, horario),
        ))
    AuditoriaService.registrar_transaccional(
        db, accion="REPROGRAMAR_PUBLICACION", entidad="publicaciones_programadas",
        usuario=responsable, id_entidad=row.idPublicacion,
        detalle=f"Revisión {row.revision}; trimestre {id_trimestre}; horarios {','.join(map(str, ids_horarios))}",
    )
    db.commit()
    db.refresh(row)
    return row


def ejecutar(db, id_publicacion, ahora=None):
    """Atómica e idempotente. La fila de publicación serializa a workers PostgreSQL."""
    ahora = _utc(ahora or datetime.now(timezone.utc))
    row = db.execute(select(PublicacionProgramada).where(
        PublicacionProgramada.idPublicacion == id_publicacion
    ).with_for_update()).scalar_one_or_none()
    if row is None or row.estado != "pendiente" or _utc(row.fechaEjecucion) > ahora:
        db.rollback()
        return False
    try:
        row.estado = "ejecutando"
        relaciones = db.execute(select(PublicacionProgramadaHorario).where(
            PublicacionProgramadaHorario.idPublicacion == row.idPublicacion,
            PublicacionProgramadaHorario.revision == row.revision,
        ).order_by(PublicacionProgramadaHorario.idHorario).with_for_update()).scalars().all()
        if not relaciones or any(
            relation.idHorario is None or relation.idHorario != relation.idHorarioReferencia
            for relation in relaciones
        ):
            row.estado = "revision_requerida"
            row.fechaEjecucionReal = ahora
            row.resultado = "Falta un horario de la revisión aprobada; coordinación debe revisar y programar de nuevo."
            AuditoriaService.registrar_transaccional(
                db, accion="PUBLICACION_PROGRAMADA_REQUIERE_REVISION",
                entidad="publicaciones_programadas", identificador=str(row.idCoordinador),
                id_entidad=row.idPublicacion, detalle=row.resultado,
            )
            NotificacionService.crear_transaccional(
                db, id_usuario=row.idCoordinador, tipo=TIPO_SISTEMA,
                mensaje=f"La publicación {row.idPublicacion} requiere revisión: falta un horario aprobado.",
                entidad_relacionada="publicaciones_programadas", id_entidad_relacionada=row.idPublicacion,
            )
            db.commit()
            return False
        ids = [r.idHorario for r in relaciones]
        horarios = _candidatos(db, row.idTrimestre, ids, excluir_publicacion=row.idPublicacion)
        for rel, horario in zip(relaciones, horarios):
            if _huella(db, horario) != rel.huellaRevision:
                row.estado = "revision_requerida"
                row.resultado = "Un horario cambió desde la revisión; coordinación debe reprogramar para aprobar la nueva versión."
                row.fechaEjecucionReal = ahora
                AuditoriaService.registrar_transaccional(
                    db, accion="PUBLICACION_PROGRAMADA_REQUIERE_REVISION",
                    entidad="publicaciones_programadas", usuario=None,
                    identificador=str(row.idCoordinador), id_entidad=row.idPublicacion,
                    detalle=row.resultado,
                )
                NotificacionService.crear_transaccional(
                    db, id_usuario=row.idCoordinador, tipo=TIPO_SISTEMA,
                    mensaje=f"La publicación {row.idPublicacion} requiere una nueva revisión porque cambió un horario.",
                    entidad_relacionada="publicaciones_programadas", id_entidad_relacionada=row.idPublicacion,
                )
                db.commit()
                return False
        _validar_conjunto(db, horarios)
        for horario in horarios:
            horario.publicado = True
        row.estado = "publicada"
        row.fechaEjecucionReal = ahora
        row.resultado = f"Publicados {len(horarios)} horarios."
        db.flush()
        AuditoriaService.registrar_transaccional(
            db, accion="PUBLICACION_PROGRAMADA_EXITOSA", entidad="publicaciones_programadas",
            usuario=None, identificador=str(row.idCoordinador), id_entidad=row.idPublicacion,
            detalle=row.resultado,
        )
        NotificacionService.crear_transaccional(
            db, id_usuario=row.idCoordinador, tipo=TIPO_SISTEMA,
            mensaje=f"La publicación programada {row.idPublicacion} se completó correctamente.",
            entidad_relacionada="publicaciones_programadas", id_entidad_relacionada=row.idPublicacion,
        )
        por_ficha = {}
        for horario in horarios:
            por_ficha.setdefault(horario.idFicha, horario)
        for ficha_id, horario in por_ficha.items():
            ficha_codigo = str(ficha_id)
            for vinculo in FichaUsuarioRepository.obtener_aprendices_por_ficha(db, ficha_id):
                NotificacionService.crear_agrupada_transaccional(
                    db, id_usuario=vinculo.idUsuario, tipo=TIPO_HORARIO,
                    mensaje=f"Ya está publicado el horario de tu ficha {ficha_codigo}.",
                    entidad_relacionada="fichas", id_entidad_relacionada=ficha_id,
                )
        for instructor_id in {h.idInstructor for h in horarios}:
            NotificacionService.crear_agrupada_transaccional(
                db, id_usuario=instructor_id, tipo=TIPO_HORARIO,
                mensaje="Se publicó tu horario programado. Ya aparece en «Mi horario».",
                entidad_relacionada="publicaciones_programadas", id_entidad_relacionada=row.idPublicacion,
            )
        db.commit()
        return True
    except Exception as exc:
        db.rollback()
        # Fallo persistente: solo este estado y el aviso de coordinación se confirman.
        failed = db.execute(select(PublicacionProgramada).where(
            PublicacionProgramada.idPublicacion == id_publicacion
        ).with_for_update()).scalar_one_or_none()
        if failed is None or failed.estado != "pendiente":
            db.rollback()
            return False
        failed.estado = "fallida"
        failed.fechaEjecucionReal = ahora
        failed.resultado = str(exc)[:4000]
        AuditoriaService.registrar_transaccional(
            db, accion="PUBLICACION_PROGRAMADA_FALLIDA", entidad="publicaciones_programadas",
            usuario=None, identificador=str(failed.idCoordinador), id_entidad=failed.idPublicacion,
            detalle=failed.resultado,
        )
        NotificacionService.crear_transaccional(
            db, id_usuario=failed.idCoordinador, tipo=TIPO_SISTEMA,
            mensaje=f"La publicación programada {failed.idPublicacion} falló; requiere revisión.",
            entidad_relacionada="publicaciones_programadas", id_entidad_relacionada=failed.idPublicacion,
        )
        db.commit()
        return False
