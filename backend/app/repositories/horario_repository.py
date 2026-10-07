from sqlalchemy.orm import Session, selectinload

from app.models.ambiente import Ambiente
from app.models.dia_semana import DiaSemana
from app.models.horario import Horario, horario_dia
from app.models.trimestre import Trimestre

def _relaciones_para_respuesta():
    """Relaciones que HorarioService.a_response necesita leer para CADA
    horario (instructor.nombre, ficha.codigoFicha, ambiente.nombre,
    resultado.codigo/descripcion) -- sin selectinload, acceder a cada una
    es una query lazy-load POR HORARIO. Con listados grandes (el centro
    real ya tiene 130+ horarios) eso es cientos de queries secuenciales
    contra Supabase (no localhost: cada una paga la latencia de red
    real), y `obtener_todos`/`obtener_activos` son justo los que
    alimentan listados completos (GET /horarios/, auditoría de cruces)
    -- no un horario suelto. Encontrado en vivo el 2026-09-14: con 131
    horarios, construir las respuestas tardaba 47s (medido) en vez de
    los ~3s que tarda la query base sola, dejando "Horarios completos"
    con timeout permanente en el frontend. `selectinload` trae cada
    relación en un query aparte con un solo `IN (...)`, así que el costo
    total pasa a ser O(1) queries extra (una por relación), no O(n).

    Función (no una constante a nivel de módulo) a propósito: las
    relaciones de `Horario` están declaradas por STRING ("Ficha",
    "Usuario", ...) y SQLAlchemy las resuelve perezosamente contra su
    registro declarativo la primera vez que hacen falta de verdad (en la
    práctica, cuando se ejecuta la primera query real, momento en el que
    ya se importaron todos los modelos). Evaluar `selectinload(...)` en
    tiempo de import de este módulo fuerza esa resolución ANTES de que
    `app.models.ficha` (y los demás) se hayan cargado -- exactamente el
    ImportError que describe el mensaje de SQLAlchemy ("expression
    'Ficha' failed to locate a name"), reproducido en vivo al correr la
    suite de tests."""
    return (
        selectinload(Horario.instructor),
        selectinload(Horario.ficha),
        selectinload(Horario.ambiente),
        selectinload(Horario.resultado),
    )


class HorarioRepository:
    @staticmethod
    def obtener_todos(db: Session):
        return db.query(Horario).options(*_relaciones_para_respuesta()).all()

    @staticmethod
    def obtener_por_id(db: Session, id_horario: int):
        return db.query(Horario).filter(Horario.idHorario == id_horario).first()

    @staticmethod
    def obtener_por_ids(db: Session, ids_horario: list[int], *, bloquear: bool = False) -> list[Horario]:
        if not ids_horario:
            return []
        query = db.query(Horario).filter(Horario.idHorario.in_(ids_horario))
        if bloquear:
            query = query.with_for_update()
        horarios = query.all()
        por_id = {horario.idHorario: horario for horario in horarios}
        return [por_id[id_horario] for id_horario in ids_horario if id_horario in por_id]

    @staticmethod
    def obtener_dias(db: Session, id_horario: int) -> list[int]:
        filas = db.execute(horario_dia.select().where(horario_dia.c.idHorario == id_horario)).all()
        return [fila.idDia for fila in filas]

    @staticmethod
    def obtener_dias_por_horarios(db: Session, ids_horario: list[int]) -> dict[int, list[int]]:
        """Mismo dato que `obtener_dias`, pero para MUCHOS horarios en un
        solo query (`idHorario IN (...)`) -- el bulk-equivalent que
        `obtener_todos`/`obtener_activos` necesitan para no repetir el
        problema N+1 que `_relaciones_para_respuesta` ya resuelve para las
        demás relaciones. Devuelve {} para ids_horario vacío sin tocar la
        BD -- evita un `IN ()` que en algunos dialectos es válido pero
        inútil hacer viajar a la red."""
        if not ids_horario:
            return {}
        filas = db.execute(horario_dia.select().where(horario_dia.c.idHorario.in_(ids_horario))).all()
        dias_por_horario: dict[int, list[int]] = {}
        for fila in filas:
            dias_por_horario.setdefault(fila.idHorario, []).append(fila.idDia)
        return dias_por_horario

    @staticmethod
    def obtener_nombres_dias(db: Session, id_horario: int) -> str:
        """'Lunes y Miércoles' — para el PDF de PdfService, que necesita
        texto legible en vez de ids de "diasDeLaSemana"."""
        ids_dias = HorarioRepository.obtener_dias(db, id_horario)
        dias = db.query(DiaSemana).filter(DiaSemana.idDia.in_(ids_dias)).order_by(DiaSemana.idDia).all()
        return " y ".join(d.nombreDia for d in dias) if dias else "días sin especificar"

    @staticmethod
    def crear(db: Session, horario: Horario, dias: list[int]):
        HorarioRepository.crear_sin_commit(db, horario, dias)
        db.commit()
        db.refresh(horario)
        return horario

    @staticmethod
    def crear_sin_commit(db: Session, horario: Horario, dias: list[int]):
        db.add(horario)
        db.flush()  # asigna idHorario sin cerrar la transacción todavía

        for id_dia in dias:
            db.execute(horario_dia.insert().values(idHorario=horario.idHorario, idDia=id_dia))

        return horario

    @staticmethod
    def actualizar_sin_commit(db: Session, horario: Horario, dias: list[int]):
        db.execute(horario_dia.delete().where(horario_dia.c.idHorario == horario.idHorario))
        for id_dia in dias:
            db.execute(horario_dia.insert().values(idHorario=horario.idHorario, idDia=id_dia))
        db.flush()
        return horario

    @staticmethod
    def eliminar_sin_commit(db: Session, horario: Horario):
        db.execute(horario_dia.delete().where(horario_dia.c.idHorario == horario.idHorario))
        db.delete(horario)
        db.flush()

    @staticmethod
    def actualizar(db: Session, horario: Horario, dias: list[int]):
        HorarioRepository.actualizar_sin_commit(db, horario, dias)
        db.commit()
        db.refresh(horario)
        return horario

    @staticmethod
    def eliminar(db: Session, horario: Horario):
        db.delete(horario)
        db.commit()

    @staticmethod
    def guardar(db: Session, horario: Horario) -> Horario:
        """Commit simple de cambios ya aplicados al objeto — para
        HorarioService.cambiar_estado, que solo toca `activo` y no
        necesita reescribir horario_dia como sí hace `actualizar`."""
        db.commit()
        db.refresh(horario)
        return horario

    @staticmethod
    def buscar_solape(
        db: Session,
        campo: str,
        valor,
        dias: list[int],
        hora_inicio,
        hora_fin,
        id_trimestre: int,
        excluir_id: int | None = None,
    ) -> Horario | None:
        """Busca un solape del mismo recurso dentro de un período.

        Un horario semanal es recurrente durante su trimestre. Por eso un
        instructor, ambiente o ficha puede usar la misma franja en otro
        trimestre sin que sea un cruce: solo compiten los horarios activos
        con el mismo ``idTrimestre``.
        """
        query = (
            db.query(Horario)
            .join(horario_dia, horario_dia.c.idHorario == Horario.idHorario)
            .filter(
                getattr(Horario, campo) == valor,
                horario_dia.c.idDia.in_(dias),
                Horario.horaInicio < hora_fin,
                Horario.horaFin > hora_inicio,
                Horario.activo.is_(True),
                Horario.idTrimestre == id_trimestre,
            )
        )
        if excluir_id is not None:
            query = query.filter(Horario.idHorario != excluir_id)
        return query.first()

    @staticmethod
    def buscar_solapes(
        db: Session,
        campo: str,
        valor,
        dias: list[int],
        hora_inicio,
        hora_fin,
        id_trimestre: int,
        excluir_id: int | None = None,
    ) -> list[Horario]:
        """Como `buscar_solape`, pero devuelve TODOS los horarios que
        chocan, ordenados por id. La auditoría de cruces lo necesita: con
        `.first()` un bloque que pisaba a otros dos solo reportaba uno, y
        en un triple cruce (A, B y C en la misma franja) el par B–C no
        aparecía nunca."""
        query = (
            db.query(Horario)
            .join(horario_dia, horario_dia.c.idHorario == Horario.idHorario)
            .filter(
                getattr(Horario, campo) == valor,
                horario_dia.c.idDia.in_(dias),
                Horario.horaInicio < hora_fin,
                Horario.horaFin > hora_inicio,
                Horario.activo.is_(True),
                Horario.idTrimestre == id_trimestre,
            )
        )
        if excluir_id is not None:
            query = query.filter(Horario.idHorario != excluir_id)
        # Un horario de varios días aparece una vez por día compartido.
        return query.distinct().order_by(Horario.idHorario).all()

    @staticmethod
    def obtener_por_instructor(
        db: Session,
        id_instructor,
        excluir_id: int | None = None,
        fecha_inicio=None,
        fecha_fin=None,
        id_trimestre: int | None = None,
    ) -> list[Horario]:
        """Todos los horarios ya asignados a un instructor, sin filtrar por
        día/hora — HorarioService los usa para sumar horas semanales y
        detectar centro/jornada (RF-011), esa decisión no es de acá. Solo
        los activos: uno desactivado no debería sumar a la carga semanal
        ni aparecer como vigente en el drawer de relacionados."""
        query = db.query(Horario).filter(Horario.idInstructor == id_instructor, Horario.activo.is_(True))
        if id_trimestre is not None:
            query = query.filter(Horario.idTrimestre == id_trimestre)
        if fecha_inicio is not None and fecha_fin is not None:
            query = query.join(Trimestre, Horario.idTrimestre == Trimestre.idTrimestre).filter(
                Trimestre.fechaInicio <= fecha_fin,
                Trimestre.fechaFin >= fecha_inicio,
            )
        if excluir_id is not None:
            query = query.filter(Horario.idHorario != excluir_id)
        return query.all()

    @staticmethod
    def obtener_periodos_publicados_por_instructor(db: Session, id_instructor):
        """Períodos en los que el instructor tiene clases vigentes publicadas.

        Se usa para poblar el filtro de trimestre de "Mi horario" sin exponer
        el catálogo administrativo completo al rol Instructor.
        """
        return (
            db.query(Trimestre)
            .join(Horario, Horario.idTrimestre == Trimestre.idTrimestre)
            .filter(
                Horario.idInstructor == id_instructor,
                Horario.activo.is_(True),
                Horario.publicado.is_(True),
            )
            .distinct()
            .order_by(Trimestre.fechaInicio.desc(), Trimestre.idTrimestre.desc())
            .all()
        )

    @staticmethod
    def obtener_por_ficha(db: Session, id_ficha: int) -> list[Horario]:
        """GET /fichas/{id}/horarios (SCRUM-47), /ficha-usuario/mi-horario
        del Aprendiz y la grilla semanal de GET /fichas/{id}/pdf
        (PdfService) — grid/relacionados de una ficha. Con eager loading
        (ver _relaciones_para_respuesta): sin esto, una ficha con ~15
        horarios tardaba ~10s en /ficha-usuario/mi-horario (medido en vivo
        el 2026-09-14) por el mismo N+1 que ya se resolvió en obtener_todos."""
        return (
            db.query(Horario)
            .options(*_relaciones_para_respuesta())
            .filter(Horario.idFicha == id_ficha)
            .all()
        )

    @staticmethod
    def obtener_publicados_por_ficha(db: Session, id_ficha: int) -> list[Horario]:
        """Consulta personal: solo horarios activos y publicados.

        No sustituye obtener_por_ficha: coordinación sigue necesitando
        consultar los borradores en sus vistas de gestión.
        """
        return (
            db.query(Horario)
            .options(*_relaciones_para_respuesta())
            .filter(
                Horario.idFicha == id_ficha,
                Horario.activo.is_(True),
                Horario.publicado.is_(True),
            )
            .all()
        )

    @staticmethod
    def obtener_por_ambiente(db: Session, id_ambiente: int) -> list[Horario]:
        """GET /ambientes/{id}/horarios (SCRUM-48) — relacionados de un ambiente."""
        return db.query(Horario).filter(Horario.idAmbiente == id_ambiente).all()

    @staticmethod
    def obtener_activos(
        db: Session, id_trimestre: int | None = None, id_sede: int | None = None
    ) -> list[Horario]:
        """Horarios activos vigentes, opcionalmente acotados a un trimestre
        y/o sede — usado por HorarioService.auditar_conflictos para el
        barrido de "Auditoría de Cruces" (a diferencia de buscar_solape,
        que compara UN candidato contra lo existente, acá se listan los
        horarios ya guardados sobre los que después se re-valida cada
        uno)."""
        query = db.query(Horario).options(*_relaciones_para_respuesta()).filter(Horario.activo.is_(True))
        if id_trimestre is not None:
            query = query.filter(Horario.idTrimestre == id_trimestre)
        if id_sede is not None:
            query = query.join(Ambiente, Horario.idAmbiente == Ambiente.id).filter(
                Ambiente.sede_id == id_sede
            )
        return query.all()

    @staticmethod
    def buscar_resultado_en_ficha(
        db: Session,
        id_ficha: int,
        id_resultado: int,
        id_instructor,
        dias: list[int],
        id_trimestre: int,
        excluir_id: int | None = None,
    ) -> Horario | None:
        """Cruce de contenido, no de horas — ver REGLAS_DE_NEGOCIO_CONOCIDAS.md.
        La regla original comparaba solo (idFicha, idResultado) sin mirar el
        día, así que un mismo tema partido en dos bloques el mismo día (antes
        y después del descanso) se rechazaba como si fuera un duplicado real
        en otro día — bug reportado 2026-09-02. Un horario existente que
        comparte al menos un día con el nuevo se trata como continuación de
        la misma clase (no se marca); solo se marca si NO comparte ningún
        día, que es el caso real de "este resultado ya se programó en otro
        momento no relacionado".

        Corrección 2026-09-12: además, solo cuenta como duplicado si es el
        MISMO instructor repitiendo el resultado en un día no relacionado.
        Dos instructores distintos programados para el mismo (ficha,
        resultado) en días distintos es un reparto válido del contenido
        (ej. dos instructores rotando el mismo tema), no un error de
        programación -- la regla original no miraba el instructor y lo
        bloqueaba igual, un falso positivo real reportado por el usuario.
        Devuelve el horario existente que choca, o None."""
        repetidos = HorarioRepository.buscar_resultados_repetidos_en_ficha(
            db, id_ficha, id_resultado, id_instructor, dias, id_trimestre, excluir_id
        )
        return repetidos[0] if repetidos else None

    @staticmethod
    def buscar_resultados_repetidos_en_ficha(
        db: Session,
        id_ficha: int,
        id_resultado: int,
        id_instructor,
        dias: list[int],
        id_trimestre: int,
        excluir_id: int | None = None,
    ) -> list[Horario]:
        """Todos los horarios que cuentan como resultado repetido según la
        regla de `buscar_resultado_en_ficha` (mismo instructor, ningún día
        en común), ordenados por id — para la auditoría de cruces."""
        query = db.query(Horario).filter(
            Horario.idFicha == id_ficha,
            Horario.idResultado == id_resultado,
            Horario.idInstructor == id_instructor,
            Horario.activo.is_(True),
            Horario.idTrimestre == id_trimestre,
        )
        if excluir_id is not None:
            query = query.filter(Horario.idHorario != excluir_id)

        dias_nuevos = set(dias)
        return [
            horario
            for horario in query.order_by(Horario.idHorario).all()
            if not (set(HorarioRepository.obtener_dias(db, horario.idHorario)) & dias_nuevos)
        ]
