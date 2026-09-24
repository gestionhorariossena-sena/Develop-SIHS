from app.models.dia_semana import DiaSemana
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.especialidad import Especialidad, especialidad_competencia
from app.models.ficha import Ficha
from app.models.horario import Horario
from app.models.jornada import Jornada
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario
from app.repositories.ficha_usuario_repository import FichaUsuarioRepository
from app.repositories.horario_repository import HorarioRepository
from app.services.notificacion_service import NotificacionService, TIPO_AMBIENTE, TIPO_HORARIO

# RF-011 (Requisitos Funcionales V4.pdf, pág. 15-16): "Los instructores de
# planta podrán estar asignados máximo 32 horas a la semana, mientras que
# para los de contrato serán un máximo de 40."
HORAS_MAX_PLANTA = 32
HORAS_MAX_CONTRATO = 40


class CruceHorarioError(Exception):
    """Se lanza cuando crear/actualizar un horario produciría un cruce.
    La capa de API (`api/v1/horarios.py`) la traduce a un 409 con la lista
    de mensajes — ver
    _Docs/Documentación general/PLAN_INTEGRACION_LOGICA_Y_BD.md §3."""

    def __init__(self, mensajes: list[str]):
        self.mensajes = mensajes
        super().__init__("; ".join(mensajes))


class HorarioService:
    @staticmethod
    def obtener_todos(db):
        return HorarioRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db, id_horario):
        return HorarioRepository.obtener_por_id(db, id_horario)

    @staticmethod
    def a_response(db, horario, dias: list[int] | None = None) -> dict:
        """Serializa un Horario a la forma de HorarioResponse, enriquecido
        con los nombres/códigos de instructor/ficha/ambiente/resultado —
        movido acá desde api/v1/horarios.py (`_a_response`) para
        reutilizarlo también en los GET por instructor/ficha/ambiente que
        alimentan el drawer de relacionados (SCRUM-46/47/48).

        `dias`: si el llamador ya los trajo en bloque para MUCHOS horarios
        a la vez (ver HorarioRepository.obtener_dias_por_horarios), se
        pasan acá para no repetir un query por horario. Si se omite (el
        caso normal de crear/actualizar/obtener UN horario suelto), cae al
        query individual de siempre -- un query extra no importa cuando
        es uno solo, sí importa multiplicado por cientos en un listado."""
        return {
            "idHorario": horario.idHorario,
            "horaInicio": horario.horaInicio,
            "horaFin": horario.horaFin,
            "idJornada": horario.idJornada,
            "idTrimestre": horario.idTrimestre,
            "idAmbiente": horario.idAmbiente,
            "idInstructor": horario.idInstructor,
            "idFicha": horario.idFicha,
            "idResultado": horario.idResultado,
            "fechaCreacion": horario.fechaCreacion,
            "fechaModificacion": horario.fechaModificacion,
            "activo": horario.activo,
            "publicado": horario.publicado,
            "dias": dias if dias is not None else HorarioRepository.obtener_dias(db, horario.idHorario),
            "instructorNombre": horario.instructor.nombre if horario.instructor else None,
            "fichaCodigo": horario.ficha.codigoFicha if horario.ficha else None,
            "ambienteNombre": horario.ambiente.nombre if horario.ambiente else None,
            "resultadoCodigo": horario.resultado.codigo if horario.resultado else None,
            "resultadoDescripcion": horario.resultado.descripcion if horario.resultado else None,
        }

    @staticmethod
    def obtener_todos_con_respuesta(db) -> list[dict]:
        """Versión bulk de `obtener_todos` + `a_response` -- ver
        HorarioRepository._RELACIONES_PARA_RESPUESTA y
        obtener_dias_por_horarios. Antes, GET /horarios/ hacía
        obtener_todos() (1 query) y luego a_response(db, h) POR CADA
        horario (5 queries más: días + 4 relaciones lazy-load), sin
        límite de cuántos horarios hay -- con el catálogo real (130+
        horarios) eso tardaba 47s medido en vivo el 2026-09-14, muy por
        encima del timeout del frontend. Con eager loading + bulk-days el
        costo pasa a ser ~3 queries totales sin importar cuántos horarios
        haya."""
        horarios = HorarioRepository.obtener_todos(db)
        dias_por_horario = HorarioRepository.obtener_dias_por_horarios(db, [h.idHorario for h in horarios])
        return [HorarioService.a_response(db, h, dias=dias_por_horario.get(h.idHorario, [])) for h in horarios]

    @staticmethod
    def obtener_por_instructor(db, id_instructor) -> list[dict]:
        """GET /usuarios/{id}/horarios (SCRUM-46) — horarios asignados a un
        instructor, para la mini-grid/grid del drawer de relacionados."""
        return [
            HorarioService.a_response(db, h)
            for h in HorarioRepository.obtener_por_instructor(db, id_instructor)
        ]

    @staticmethod
    def obtener_por_ficha(db, id_ficha) -> list[dict]:
        """GET /fichas/{id}/horarios (SCRUM-47) y /ficha-usuario/mi-horario
        del Aprendiz — horarios de una ficha. Bulk-days igual que
        obtener_todos_con_respuesta, ver su docstring."""
        horarios = HorarioRepository.obtener_por_ficha(db, id_ficha)
        dias_por_horario = HorarioRepository.obtener_dias_por_horarios(db, [h.idHorario for h in horarios])
        return [HorarioService.a_response(db, h, dias=dias_por_horario.get(h.idHorario, [])) for h in horarios]

    @staticmethod
    def obtener_por_ambiente(db, id_ambiente) -> list[dict]:
        """GET /ambientes/{id}/horarios (SCRUM-48) — horarios de un ambiente."""
        return [
            HorarioService.a_response(db, h)
            for h in HorarioRepository.obtener_por_ambiente(db, id_ambiente)
        ]

    @staticmethod
    def crear(db, data, forzar: bool = False) -> tuple:
        """Crea horario. Si forzar=False, lanza excepción si hay cruces.
        Si forzar=True, ignora cruces pero devuelve (horario, conflictos) para auditar."""
        errores = HorarioService._detectar_cruces(db, data)
        if errores and not forzar:
            raise CruceHorarioError(errores)

        nuevo_horario = Horario(
            horaInicio=data.horaInicio,
            horaFin=data.horaFin,
            idJornada=data.idJornada,
            idTrimestre=data.idTrimestre,
            idAmbiente=data.idAmbiente,
            idInstructor=data.idInstructor,
            idFicha=data.idFicha,
            idResultado=data.idResultado,
        )
        horario = HorarioRepository.crear(db, nuevo_horario, data.dias)

        # Un horario nace publicado (`publicado` tiene server_default true),
        # así que el momento en que la gente puede verlo es este, no un
        # PATCH posterior: si el aviso solo colgara de "despublicado ->
        # publicado", el camino normal —crear y listo— no avisaría nunca.
        if horario.publicado:
            HorarioService._notificar_publicacion(db, horario)

        return horario, errores if forzar else []

    @staticmethod
    def actualizar(db, id_horario, data, forzar: bool = False) -> tuple:
        """Actualiza horario. Si forzar=False, lanza excepción si hay cruces.
        Si forzar=True, ignora cruces pero devuelve (horario, conflictos) para auditar."""
        horario = HorarioRepository.obtener_por_id(db, id_horario)

        if not horario:
            return None, []

        cambio_ambiente = horario.idAmbiente != data.idAmbiente
        cambio_instructor = horario.idInstructor != data.idInstructor
        # Se guarda ANTES de sobrescribirlo: a quien le quitan un bloque le
        # interesa tanto como a quien se lo dan.
        instructor_anterior = horario.idInstructor

        errores = HorarioService._detectar_cruces(db, data, excluir_id=id_horario)
        if errores and not forzar:
            raise CruceHorarioError(errores)

        horario.horaInicio = data.horaInicio
        horario.horaFin = data.horaFin
        horario.idJornada = data.idJornada
        horario.idTrimestre = data.idTrimestre
        horario.idAmbiente = data.idAmbiente
        horario.idInstructor = data.idInstructor
        horario.idFicha = data.idFicha
        horario.idResultado = data.idResultado

        actualizado = HorarioRepository.actualizar(db, horario, data.dias)
        HorarioService._notificar_cambio_asignacion(
            db, actualizado, cambio_ambiente, cambio_instructor, instructor_anterior
        )
        return actualizado, errores if forzar else []

    @staticmethod
    def _datos_para_mensaje(horario) -> tuple[str, str, str]:
        """(código de ficha, nombre del ambiente, franja) para armar
        mensajes — los tres salen de relaciones que pueden venir vacías."""
        ficha_codigo = horario.ficha.codigoFicha if horario.ficha else horario.idFicha
        ambiente_nombre = horario.ambiente.nombre if horario.ambiente else "sin ambiente"
        franja = f"{horario.horaInicio:%H:%M} a {horario.horaFin:%H:%M}"
        return str(ficha_codigo), ambiente_nombre, franja

    @staticmethod
    def _notificar_cambio_asignacion(
        db, horario, cambio_ambiente: bool, cambio_instructor: bool, instructor_anterior=None
    ) -> None:
        """H-8: antes esto solo avisaba a los aprendices de la ficha, así
        que a un instructor le podían mover el ambiente de una clase y se
        enteraba al llegar al salón equivocado. Ahora el aviso alcanza a
        los tres lados del cambio: la ficha, quien la dicta y —si el bloque
        cambió de manos— quien la dictaba antes."""
        if not (cambio_ambiente or cambio_instructor):
            return

        ficha_codigo, ambiente_nombre, franja = HorarioService._datos_para_mensaje(horario)
        instructor_nombre = horario.instructor.nombre if horario.instructor else "sin instructor"
        tipo = TIPO_AMBIENTE if cambio_ambiente else TIPO_HORARIO

        def avisar(id_usuario, mensaje: str) -> None:
            if not id_usuario:
                return
            NotificacionService.crear(
                db,
                id_usuario=id_usuario,
                tipo=tipo,
                mensaje=mensaje,
                entidad_relacionada="horarios",
                id_entidad_relacionada=horario.idHorario,
            )

        for vinculo in FichaUsuarioRepository.obtener_aprendices_por_ficha(db, horario.idFicha):
            avisar(
                vinculo.idUsuario,
                f"Cambió tu clase de {franja} en la ficha {ficha_codigo}: "
                f"ahora es en {ambiente_nombre} con {instructor_nombre}.",
            )

        avisar(
            horario.idInstructor,
            f"Cambió tu bloque de {franja} con la ficha {ficha_codigo}: "
            f"ahora es en {ambiente_nombre}.",
        )

        if cambio_instructor and instructor_anterior and instructor_anterior != horario.idInstructor:
            avisar(
                instructor_anterior,
                f"Ya no tienes el bloque de {franja} con la ficha {ficha_codigo}: "
                f"pasó a {instructor_nombre}.",
            )

    @staticmethod
    def _notificar_publicacion(db, horario) -> None:
        """H-9: publicar era un cambio invisible — el horario quedaba ahí
        esperando a que alguien entrara a mirarlo. Se avisa al instructor y
        a los aprendices de la ficha, que son quienes recién en ese momento
        pueden verlo ("Mi horario" solo muestra lo publicado).

        El aviso es por FICHA y no por bloque, y se agrupa: publicar el
        horario de una ficha son decenas de llamadas sueltas (el asistente
        guarda bloque por bloque), y a nadie le sirve recibir treinta
        campanazos diciendo lo mismo. El mensaje no nombra una franja
        concreta justamente para que valga igual si fue uno o treinta.
        """
        ficha_codigo, _, _ = HorarioService._datos_para_mensaje(horario)

        for vinculo in FichaUsuarioRepository.obtener_aprendices_por_ficha(db, horario.idFicha):
            NotificacionService.crear_agrupada(
                db,
                id_usuario=vinculo.idUsuario,
                tipo=TIPO_HORARIO,
                mensaje=f"Ya está publicado el horario de tu ficha {ficha_codigo}. Míralo en «Mi horario».",
                entidad_relacionada="fichas",
                id_entidad_relacionada=horario.idFicha,
            )

        NotificacionService.crear_agrupada(
            db,
            id_usuario=horario.idInstructor,
            tipo=TIPO_HORARIO,
            mensaje=f"Se publicó tu horario con la ficha {ficha_codigo}. Ya aparece en «Mi horario».",
            entidad_relacionada="fichas",
            id_entidad_relacionada=horario.idFicha,
        )

    @staticmethod
    def eliminar(db, id_horario):
        horario = HorarioRepository.obtener_por_id(db, id_horario)

        if not horario:
            return False

        HorarioRepository.eliminar(db, horario)
        return True

    @staticmethod
    def cambiar_estado(db, id_horario, activo: bool | None = None, publicado: bool | None = None):
        """Activar/desactivar y/o publicar/despublicar sin borrar (backlog
        de Historial, pedido 2026-09-03). Un horario desactivado deja de
        contar para cruces y para las horas semanales de RF-011 — ver los
        filtros `activo` en HorarioRepository — así que reactivarlo puede
        volver a chocar con algo que se creó mientras tanto; por ahora no
        se re-valida al reactivar (igual que un ambiente puede pasar a
        "mantenimiento" y volver a "disponible" sin revisar cruces), queda
        para cuando se arme el backlog completo si hace falta más rigor
        acá. `publicado` es independiente de `activo`: controla si el
        instructor lo ve en "Mi horario", no si cuenta para cruces."""
        horario = HorarioRepository.obtener_por_id(db, id_horario)

        if not horario:
            return None

        # Solo el paso de borrador a publicado avisa: despublicar y volver
        # a publicar el mismo bloque no debe repetir el aviso, y
        # activar/desactivar no cambia lo que la gente ve en "Mi horario".
        recien_publicado = publicado is True and not horario.publicado

        if activo is not None:
            horario.activo = activo
        if publicado is not None:
            horario.publicado = publicado

        guardado = HorarioRepository.guardar(db, horario)

        if recien_publicado:
            HorarioService._notificar_publicacion(db, guardado)

        return guardado

    @staticmethod
    def obtener_publicados_por_instructor(db, id_instructor) -> list[dict]:
        """GET /usuarios/me/horarios — autoservicio del instructor ("Mi
        horario"): solo lo activo y publicado, nunca un borrador que el
        coordinador todavía está armando."""
        return [
            HorarioService.a_response(db, h)
            for h in HorarioRepository.obtener_por_instructor(db, id_instructor)
            if h.publicado
        ]

    @staticmethod
    def _detectar_cruces(db, data, excluir_id: int | None = None) -> list[str]:
        """Cruces por solape de horario: misma ficha, mismo instructor o
        mismo ambiente ya ocupados en ese día/hora — ver
        REGLAS_DE_NEGOCIO_CONOCIDAS.md. También valida que el MISMO
        instructor no repita un resultado de aprendizaje para la misma
        ficha en un día no relacionado (dos instructores distintos sí
        pueden repartirse el mismo resultado en días distintos -- eso es
        reparto válido, no duplicado; corrección 2026-09-12). Cada
        mensaje describe CONTRA QUÉ horario existente choca (día, hora, y
        quién/qué ya lo tiene) — no solo la regla que se violó, para que
        se entienda de un vistazo sin tener que ir a buscarlo a mano."""
        errores: list[str] = []

        ficha_existente = HorarioRepository.buscar_solape(
            db, "idFicha", data.idFicha, data.dias, data.horaInicio, data.horaFin, excluir_id
        )
        if ficha_existente:
            errores.append(
                "La ficha ya tiene otra clase programada en ese horario: "
                f"{HorarioService._describir(db, ficha_existente)}."
            )

        instructor_existente = HorarioRepository.buscar_solape(
            db, "idInstructor", data.idInstructor, data.dias, data.horaInicio, data.horaFin, excluir_id
        )
        if instructor_existente:
            errores.append(
                "El instructor ya tiene otra clase programada en ese horario: "
                f"{HorarioService._describir(db, instructor_existente)}."
            )

        ambiente_existente = HorarioRepository.buscar_solape(
            db, "idAmbiente", data.idAmbiente, data.dias, data.horaInicio, data.horaFin, excluir_id
        )
        if ambiente_existente:
            errores.append(
                "El ambiente ya está ocupado en ese horario: "
                f"{HorarioService._describir(db, ambiente_existente)}."
            )

        resultado_existente = HorarioRepository.buscar_resultado_en_ficha(
            db, data.idFicha, data.idResultado, data.idInstructor, data.dias, excluir_id
        )
        if resultado_existente:
            errores.append(
                "La ficha ya tiene este resultado de aprendizaje programado: "
                f"{HorarioService._describir(db, resultado_existente)}."
            )

        errores.extend(HorarioService._validar_reglas_instructor(db, data, excluir_id))
        errores.extend(HorarioService._validar_fortaleza_instructor(db, data))
        return errores

    @staticmethod
    def validar_dry_run(db, data, excluir_id: int | None = None) -> list[dict]:
        conflictos: list[dict] = []

        ficha_existente = HorarioRepository.buscar_solape(
            db, "idFicha", data.idFicha, data.dias, data.horaInicio, data.horaFin, excluir_id
        )
        if ficha_existente:
            conflictos.append(
                {
                    "tipo": "cruce_ficha",
                    "mensaje": "La ficha ya tiene otra clase programada en ese horario: "
                    f"{HorarioService._describir(db, ficha_existente)}.",
                    "idHorarioExistente": ficha_existente.idHorario,
                    "idFicha": ficha_existente.idFicha,
                }
            )

        instructor_existente = HorarioRepository.buscar_solape(
            db, "idInstructor", data.idInstructor, data.dias, data.horaInicio, data.horaFin, excluir_id
        )
        if instructor_existente:
            conflictos.append(
                {
                    "tipo": "cruce_instructor",
                    "mensaje": "El instructor ya tiene otra clase programada en ese horario: "
                    f"{HorarioService._describir(db, instructor_existente)}.",
                    "idHorarioExistente": instructor_existente.idHorario,
                    "idInstructor": instructor_existente.idInstructor,
                }
            )

        ambiente_existente = HorarioRepository.buscar_solape(
            db, "idAmbiente", data.idAmbiente, data.dias, data.horaInicio, data.horaFin, excluir_id
        )
        if ambiente_existente:
            conflictos.append(
                {
                    "tipo": "cruce_ambiente",
                    "mensaje": "El ambiente ya está ocupado en ese horario: "
                    f"{HorarioService._describir(db, ambiente_existente)}.",
                    "idHorarioExistente": ambiente_existente.idHorario,
                    "idAmbiente": ambiente_existente.idAmbiente,
                }
            )

        resultado_existente = HorarioRepository.buscar_resultado_en_ficha(
            db, data.idFicha, data.idResultado, data.idInstructor, data.dias, excluir_id
        )
        if resultado_existente:
            conflictos.append(
                {
                    "tipo": "resultado_repetido",
                    "mensaje": "La ficha ya tiene este resultado de aprendizaje programado: "
                    f"{HorarioService._describir(db, resultado_existente)}.",
                    "idHorarioExistente": resultado_existente.idHorario,
                    "idFicha": resultado_existente.idFicha,
                    "idResultado": resultado_existente.idResultado,
                }
            )

        for error in HorarioService._validar_reglas_instructor(db, data, excluir_id):
            conflictos.append({
                "tipo": "regla_instructor",
                "mensaje": error,
            })

        for error in HorarioService._validar_fortaleza_instructor(db, data):
            conflictos.append({
                "tipo": "fortaleza_instructor",
                "mensaje": error,
                "idInstructor": data.idInstructor,
                "idResultado": data.idResultado,
            })

        return conflictos

    @staticmethod
    def auditar_conflictos(db, id_trimestre: int | None = None, id_sede: int | None = None) -> list[dict]:
        """Barrido de cruces entre horarios YA guardados (activos) — para
        la pantalla "Auditoría de Cruces". A diferencia de validar_dry_run
        (que valida UN candidato nuevo contra lo existente), acá se
        re-valida cada horario ya guardado contra todos los demás,
        reutilizando validar_dry_run tal cual para no duplicar ni desviarse
        de las reglas de negocio (RF-011, solapes, resultado repetido).

        Deduplicación: un cruce por solape (ficha/instructor/ambiente/
        resultado repetido) es simétrico — h1 choca con h2 y viceversa —
        así que se reporta una sola vez por par (idHorario menor primero).
        `regla_instructor` (tope de horas semanales) no es un cruce entre
        dos horarios sino un estado del instructor, así que se reporta una
        sola vez por instructor aunque tenga varios horarios que la violen.
        """
        from app.schemas.horario import HorarioDryRunRequest  # evita import circular a nivel de módulo

        horarios = HorarioRepository.obtener_activos(db, id_trimestre=id_trimestre, id_sede=id_sede)
        # Bulk en vez de un `obtener_dias` por horario -- ver
        # HorarioService.obtener_todos_con_respuesta, mismo problema N+1.
        # No elimina el costo dominante de este barrido (validar_dry_run
        # se sigue llamando una vez POR horario, con sus propias queries
        # de buscar_solape), pero saca del camino el N+1 más barato de
        # arreglar sin tocar la lógica de detección de cruces.
        dias_por_horario = HorarioRepository.obtener_dias_por_horarios(db, [h.idHorario for h in horarios])

        pares_vistos: set[tuple[int, int, str]] = set()
        instructores_vistos: set = set()
        resultado: list[dict] = []

        for horario in horarios:
            candidato = HorarioDryRunRequest(
                horaInicio=horario.horaInicio,
                horaFin=horario.horaFin,
                idJornada=horario.idJornada,
                idTrimestre=horario.idTrimestre,
                idAmbiente=horario.idAmbiente,
                idInstructor=horario.idInstructor,
                idFicha=horario.idFicha,
                idResultado=horario.idResultado,
                dias=dias_por_horario.get(horario.idHorario, []),
            )

            for conflicto in HorarioService.validar_dry_run(db, candidato, excluir_id=horario.idHorario):
                if conflicto["tipo"] == "regla_instructor":
                    if horario.idInstructor in instructores_vistos:
                        continue
                    instructores_vistos.add(horario.idInstructor)
                    resultado.append({**conflicto, "idHorario": horario.idHorario})
                    continue

                existente = conflicto.get("idHorarioExistente")
                if existente is None:
                    resultado.append({**conflicto, "idHorario": horario.idHorario})
                    continue

                par = (min(horario.idHorario, existente), max(horario.idHorario, existente), conflicto["tipo"])
                if par in pares_vistos:
                    continue
                pares_vistos.add(par)
                resultado.append({**conflicto, "idHorario": horario.idHorario})

        return resultado

    @staticmethod
    def _duracion_horas(hora_inicio, hora_fin) -> float:
        inicio = hora_inicio.hour + hora_inicio.minute / 60
        fin = hora_fin.hour + hora_fin.minute / 60
        return fin - inicio

    @staticmethod
    def calcular_carga_semanal(db, id_instructor) -> dict | None:
        """Horas ya asignadas por semana vs. el máximo de RF-011 (32
        planta / 40 contrato) — mismo cálculo que usa
        _validar_reglas_instructor para el tope, expuesto acá para el
        GET /usuarios/{id}/carga-semanal que alimenta la sección "Carga
        semanal" del drawer de instructor (backlog "Nuevo alcance",
        épica B tarea 14). None si el usuario no existe."""
        instructor = db.get(Usuario, id_instructor)
        if not instructor:
            return None

        horarios_instructor = HorarioRepository.obtener_por_instructor(db, id_instructor)
        horas_asignadas = sum(
            HorarioService._duracion_horas(h.horaInicio, h.horaFin)
            * len(HorarioRepository.obtener_dias(db, h.idHorario))
            for h in horarios_instructor
        )

        horas_maximas = None
        if instructor.tipoContrato:
            horas_maximas = (
                HORAS_MAX_PLANTA if instructor.tipoContrato == "planta" else HORAS_MAX_CONTRATO
            )

        return {
            "idUsuario": instructor.idUsuario,
            "tipoContrato": instructor.tipoContrato,
            "horasAsignadas": horas_asignadas,
            "horasMaximas": horas_maximas,
        }

    @staticmethod
    def _semanas_de_trimestre(db, id_trimestre) -> int | None:
        """Cuántas semanas dura el trimestre. Hace falta porque las dos
        magnitudes que hay que comparar están en unidades distintas: un
        horario es SEMANAL (se repite cada semana del trimestre) y la
        intensidad de la planeación (`resultados_aprendizaje.horasAsignadas`)
        es del TRIMESTRE COMPLETO. None si el trimestre no existe o no
        tiene fechas — sin eso no se puede convertir y no se valida nada."""
        trimestre = db.get(Trimestre, id_trimestre)
        if not trimestre or not trimestre.fechaInicio or not trimestre.fechaFin:
            return None

        dias = (trimestre.fechaFin - trimestre.fechaInicio).days
        if dias <= 0:
            return None

        return max(1, round(dias / 7))

    @staticmethod
    def horas_semanales_de(db, horario) -> float:
        """Horas de clase que ese bloque ocupa por semana: su duración por
        la cantidad de días en que se repite."""
        return HorarioService._duracion_horas(horario.horaInicio, horario.horaFin) * len(
            HorarioRepository.obtener_dias(db, horario.idHorario)
        )

    @staticmethod
    def resumen_intensidad_ficha(db, id_ficha: int) -> dict | None:
        """Cuadre de horas de UNA ficha, resultado por resultado — para el
        panel de seguimiento de Fichas.tsx y para responder "¿esta ficha ya
        tiene programado todo lo que debe?".

        Compara, para cada resultado de aprendizaje del programa de la
        ficha que corresponde a su fase actual, las horas que la planeación
        le asigna contra las que están efectivamente programadas.
        `estado` por resultado: 'ok' | 'faltan' | 'exceso' | 'sin-planeacion'
        (este último cuando el RA no trae `horasAsignadas` y no hay contra
        qué comparar).

        None si la ficha no existe."""
        ficha = db.get(Ficha, id_ficha)
        if not ficha:
            return None

        semanas = HorarioService._semanas_de_trimestre(db, ficha.idTrimestre)
        horarios = [h for h in HorarioRepository.obtener_por_ficha(db, id_ficha) if h.activo]

        programadas_por_resultado: dict[int, float] = {}
        for horario in horarios:
            if horario.idResultado is None:
                continue
            programadas_por_resultado[horario.idResultado] = programadas_por_resultado.get(
                horario.idResultado, 0.0
            ) + HorarioService.horas_semanales_de(db, horario)

        # Los resultados del pénsum de ESTA ficha: los de su programa y, si
        # la ficha tiene fase declarada, los de esa fase. Sin fase declarada
        # se toman todos los del programa (igual criterio que usa
        # generar_propuesta, ver models/ficha.py faseActual).
        query = (
            db.query(ResultadoAprendizaje)
            .join(
                CompetenciaFormacion,
                CompetenciaFormacion.idCompetencia == ResultadoAprendizaje.idCompetencia,
            )
            .filter(CompetenciaFormacion.idPrograma == ficha.idPrograma)
        )
        if ficha.faseActual:
            query = query.filter(ResultadoAprendizaje.numeroFase == ficha.faseActual)
        resultados = query.all()

        detalle = []
        total_planeadas = 0
        total_programadas = 0.0
        for resultado in resultados:
            semanales = programadas_por_resultado.pop(resultado.idResultado, 0.0)
            programadas = semanales * semanas if semanas else None
            planeadas = resultado.horasAsignadas

            if not planeadas:
                estado = "sin-planeacion"
            elif programadas is None:
                estado = "sin-planeacion"
            elif programadas > planeadas:
                estado = "exceso"
            elif programadas < planeadas:
                estado = "faltan"
            else:
                estado = "ok"

            if planeadas:
                total_planeadas += planeadas
            if programadas:
                total_programadas += programadas

            detalle.append({
                "idResultado": resultado.idResultado,
                "codigo": resultado.codigo,
                "descripcion": resultado.descripcion,
                "horasPlaneadas": planeadas,
                "horasSemanales": semanales,
                "horasProgramadas": programadas,
                "estado": estado,
            })

        # Lo que quedó en programadas_por_resultado son bloques de
        # resultados que NO pertenecen a la fase/programa esperado: se
        # reportan igual, si no el total programado mentiría.
        for id_resultado, semanales in programadas_por_resultado.items():
            resultado = db.get(ResultadoAprendizaje, id_resultado)
            programadas = semanales * semanas if semanas else None
            if programadas:
                total_programadas += programadas
            detalle.append({
                "idResultado": id_resultado,
                "codigo": resultado.codigo if resultado else None,
                "descripcion": resultado.descripcion if resultado else None,
                "horasPlaneadas": None,
                "horasSemanales": semanales,
                "horasProgramadas": programadas,
                "estado": "fuera-de-fase",
            })

        return {
            "idFicha": ficha.idFicha,
            "codigoFicha": ficha.codigoFicha,
            "faseActual": ficha.faseActual,
            "semanasTrimestre": semanas,
            "horasPlaneadas": total_planeadas,
            "horasProgramadas": total_programadas,
            "resultados": detalle,
        }

    @staticmethod
    def _validar_fortaleza_instructor(db, data) -> list[str]:
        """¿El instructor tiene alguna de las fortalezas que pide el
        resultado de aprendizaje que va a dictar?

        Corrección pedida en la evaluación del V Trimestre (hoja GRUPO 1,
        2026-09-04): "el instructor no se puede asignar a cualquier RA, se
        deben revisar sus fortalezas para dicha asignación". La fortaleza
        se modela a nivel de COMPETENCIA, no de resultado suelto: un
        instructor que domina una competencia puede dictar cualquiera de
        sus resultados, y clasificar competencia por competencia es
        trabajo que coordinación puede sostener (clasificar los cientos de
        RA uno por uno, no).

        Silencio cuando no hay dato, a propósito y por partida doble:

        - la competencia no tiene NINGUNA especialidad asociada -> no se
          ha clasificado, no hay nada contra qué comparar;
        - el resultado no existe o no tiene competencia -> igual.

        Con la tabla recién creada eso significa que todo sigue exactamente
        como antes hasta que alguien empiece a mapear especialidades; y lo
        que sale de acá es un conflicto FORZABLE (mismo trato que RF-011),
        no un bloqueo: el coordinador que sabe por qué lo está haciendo
        programa igual y queda auditado."""
        resultado = db.get(ResultadoAprendizaje, data.idResultado)
        if not resultado or not resultado.idCompetencia:
            return []

        habilitantes = (
            db.query(Especialidad)
            .join(
                especialidad_competencia,
                especialidad_competencia.c.idEspecialidad == Especialidad.idEspecialidad,
            )
            .filter(especialidad_competencia.c.idCompetencia == resultado.idCompetencia)
            .all()
        )
        if not habilitantes:
            return []

        instructor = db.get(Usuario, data.idInstructor)
        if not instructor:
            return []

        ids_instructor = {e.idEspecialidad for e in instructor.especialidades}
        if ids_instructor & {e.idEspecialidad for e in habilitantes}:
            return []

        nombres = ", ".join(sorted(e.nombre for e in habilitantes))
        tiene = (
            ", ".join(sorted(e.nombre for e in instructor.especialidades))
            if instructor.especialidades
            else "ninguna fortaleza registrada"
        )
        codigo = resultado.codigo or f"resultado {resultado.idResultado}"
        return [
            f"El instructor {instructor.nombre} no tiene la fortaleza que pide {codigo}: "
            f"se requiere {nombres} y tiene {tiene}."
        ]

    @staticmethod
    def _validar_reglas_instructor(db, data, excluir_id: int | None) -> list[str]:
        """RF-011: tope de horas/semana según tipo de contrato, y jornada
        Noche vedada para instructores de planta.

        Corrección 2026-09-12: se quitó la regla que bloqueaba al mismo
        instructor en jornadas continuas de sedes distintas el mismo día
        (RF-011 la exigía, pero un hallazgo real de entrevista en
        REGLAS_DE_NEGOCIO_CONOCIDAS.md la contradice directamente: un
        instructor real programado mañana en una sede y tarde en otra).
        El margen de traslado entre sedes ya está documentado como
        coordinación humana, no una restricción dura del sistema -- no
        había ningún caso real donde la regla evitara un error genuino,
        solo bloqueaba reasignaciones válidas."""
        errores: list[str] = []

        instructor = db.get(Usuario, data.idInstructor)
        if not instructor:
            return errores

        jornada_nueva = db.get(Jornada, data.idJornada)
        horarios_instructor = HorarioRepository.obtener_por_instructor(
            db, data.idInstructor, excluir_id
        )
        duracion_nueva = HorarioService._duracion_horas(data.horaInicio, data.horaFin)

        if instructor.tipoContrato:
            limite = (
                HORAS_MAX_PLANTA if instructor.tipoContrato == "planta" else HORAS_MAX_CONTRATO
            )
            horas_existentes = sum(
                HorarioService._duracion_horas(h.horaInicio, h.horaFin)
                * len(HorarioRepository.obtener_dias(db, h.idHorario))
                for h in horarios_instructor
            )
            horas_totales = horas_existentes + duracion_nueva * len(data.dias)
            if horas_totales > limite:
                errores.append(
                    f"El instructor {instructor.nombre} ({instructor.tipoContrato}) superaría "
                    f"el máximo de {limite}h/semana: quedaría en {horas_totales:.1f}h."
                )

        if instructor.tipoContrato == "planta" and jornada_nueva and jornada_nueva.nombreJornada == "Noche":
            errores.append(
                f"El instructor {instructor.nombre} es de planta y no puede programarse en jornada Noche."
            )

        return errores

    @staticmethod
    def _describir(db, horario: Horario) -> str:
        """'Lunes y Miércoles 07:00-09:00 · Carlos Lopez · ficha 2874521 ·
        Ambiente 1' — arma la descripción legible de un horario existente,
        para explicar un cruce con detalle en vez de solo nombrar la regla."""
        ids_dias = HorarioRepository.obtener_dias(db, horario.idHorario)
        dias = db.query(DiaSemana).filter(DiaSemana.idDia.in_(ids_dias)).order_by(DiaSemana.idDia).all()
        nombres_dias = " y ".join(d.nombreDia for d in dias) if dias else "días sin especificar"

        instructor = horario.instructor.nombre if horario.instructor else "instructor desconocido"
        ficha = horario.ficha.codigoFicha if horario.ficha else "ficha desconocida"
        ambiente = horario.ambiente.nombre if horario.ambiente else "ambiente desconocido"

        return (
            f"{nombres_dias} {horario.horaInicio.strftime('%H:%M')}-{horario.horaFin.strftime('%H:%M')}, "
            f"instructor {instructor}, ficha {ficha}, {ambiente}"
        )
