from app.models.ambiente import Ambiente
from app.models.dia_semana import DiaSemana
from app.models.horario import Horario
from app.models.jornada import Jornada
from app.models.usuario import Usuario
from app.repositories.horario_repository import HorarioRepository

# RF-011 (Requisitos Funcionales V4.pdf, pág. 15-16): "Los instructores de
# planta podrán estar asignados máximo 32 horas a la semana, mientras que
# para los de contrato serán un máximo de 40."
HORAS_MAX_PLANTA = 32
HORAS_MAX_CONTRATO = 40

# Orden de las jornadas en un mismo día, para decidir si dos son
# "continuas" (adyacentes) — ver _validar_reglas_instructor.
ORDEN_JORNADA = {"Mañana": 1, "Tarde": 2, "Noche": 3}


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
    def a_response(db, horario) -> dict:
        """Serializa un Horario a la forma de HorarioResponse, enriquecido
        con los nombres/códigos de instructor/ficha/ambiente/resultado —
        movido acá desde api/v1/horarios.py (`_a_response`) para
        reutilizarlo también en los GET por instructor/ficha/ambiente que
        alimentan el drawer de relacionados (SCRUM-46/47/48)."""
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
            "dias": HorarioRepository.obtener_dias(db, horario.idHorario),
            "instructorNombre": horario.instructor.nombre if horario.instructor else None,
            "fichaCodigo": horario.ficha.codigoFicha if horario.ficha else None,
            "ambienteNombre": horario.ambiente.nombre if horario.ambiente else None,
            "resultadoCodigo": horario.resultado.codigo if horario.resultado else None,
            "resultadoDescripcion": horario.resultado.descripcion if horario.resultado else None,
        }

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
        """GET /fichas/{id}/horarios (SCRUM-47) — horarios de una ficha."""
        return [HorarioService.a_response(db, h) for h in HorarioRepository.obtener_por_ficha(db, id_ficha)]

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
        return horario, errores if forzar else []

    @staticmethod
    def actualizar(db, id_horario, data, forzar: bool = False) -> tuple:
        """Actualiza horario. Si forzar=False, lanza excepción si hay cruces.
        Si forzar=True, ignora cruces pero devuelve (horario, conflictos) para auditar."""
        horario = HorarioRepository.obtener_por_id(db, id_horario)

        if not horario:
            return None, []

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
        return actualizado, errores if forzar else []

    @staticmethod
    def eliminar(db, id_horario):
        horario = HorarioRepository.obtener_por_id(db, id_horario)

        if not horario:
            return False

        HorarioRepository.eliminar(db, horario)
        return True

    @staticmethod
    def _detectar_cruces(db, data, excluir_id: int | None = None) -> list[str]:
        """Cruces por solape de horario: misma ficha, mismo instructor o
        mismo ambiente ya ocupados en ese día/hora — ver
        REGLAS_DE_NEGOCIO_CONOCIDAS.md. También valida que una misma ficha
        no repita un resultado de aprendizaje. Cada mensaje describe CONTRA
        QUÉ horario existente choca (día, hora, y quién/qué ya lo tiene) —
        no solo la regla que se violó, para que se entienda de un vistazo
        sin tener que ir a buscarlo a mano."""
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
            db, data.idFicha, data.idResultado, excluir_id
        )
        if resultado_existente:
            errores.append(
                "La ficha ya tiene este resultado de aprendizaje programado: "
                f"{HorarioService._describir(db, resultado_existente)}."
            )

        errores.extend(HorarioService._validar_reglas_instructor(db, data, excluir_id))
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
            db, data.idFicha, data.idResultado, excluir_id
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

        return conflictos

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
    def _validar_reglas_instructor(db, data, excluir_id: int | None) -> list[str]:
        """RF-011: tope de horas/semana según tipo de contrato, jornada
        Noche vedada para instructores de planta, y no repetir centro de
        formación (acá, `Sede`, que es lo único que el esquema tiene para
        eso) en jornadas continuas del mismo día. La tercera regla choca
        con un hallazgo de entrevista en REGLAS_DE_NEGOCIO_CONOCIDAS.md
        (un instructor real programado mañana en una sede y tarde en
        otra) — se implementa igual porque así quedó escrito en el
        requisito formal (RF-011), no en la entrevista; si el equipo
        confirma que la entrevista manda, hay que revisar/quitar esto."""
        errores: list[str] = []

        instructor = db.get(Usuario, data.idInstructor)
        if not instructor:
            return errores

        jornada_nueva = db.get(Jornada, data.idJornada)
        ambiente_nuevo = db.get(Ambiente, data.idAmbiente)
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

        if ambiente_nuevo and jornada_nueva:
            orden_nueva = ORDEN_JORNADA.get(jornada_nueva.nombreJornada)
            dias_nuevos = set(data.dias)

            for h in horarios_instructor:
                if h.idAmbiente == data.idAmbiente:
                    continue

                if not (set(HorarioRepository.obtener_dias(db, h.idHorario)) & dias_nuevos):
                    continue

                jornada_h = db.get(Jornada, h.idJornada)
                orden_h = ORDEN_JORNADA.get(jornada_h.nombreJornada) if jornada_h else None
                # <= 1 (no == 1): dos bloques de la MISMA jornada (ej. dos
                # sub-bloques de "Tarde") en sedes distintas el mismo día
                # también son físicamente imposibles, no solo jornadas
                # adyacentes — == 1 dejaba pasar ese caso sin detectarlo.
                if orden_nueva is None or orden_h is None or abs(orden_nueva - orden_h) > 1:
                    continue

                if not h.ambiente or h.ambiente.sede_id == ambiente_nuevo.sede_id:
                    continue

                errores.append(
                    f"El instructor {instructor.nombre} ya está asignado a otro centro de "
                    f"formación en una jornada continua ese día: {HorarioService._describir(db, h)}."
                )
                break

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
