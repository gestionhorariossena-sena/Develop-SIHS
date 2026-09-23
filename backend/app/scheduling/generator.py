"""Fase 4 de _Docs/Documentación general/PLAN_INTEGRACION_IA.md: el hueco
más grande de SIHS hoy no es la IA, es que `HorarioService` **valida**
horarios armados a mano pero nadie los **genera**. Esto es CP-SAT puro
(OR-Tools), sin ningún LLM de por medio -- requisito 7 de la
arquitectura: las restricciones duras nunca se delegan a un LLM.

Simplificación deliberada del MVP: cada `NecesidadHorario` se resuelve en
UN solo bloque semanal (una franja horaria + un patrón de días fijo del
catálogo), no en varios bloques repartidos arbitrariamente en la semana.
Cubre el caso real más común -- ver LIDERES DE FICHA 2026_pruebas.xlsx,
donde cada ficha tiene un instructor y una jornada, no un desglose por
horas sueltas. Generalizar a que el solver también decida cuántos
bloques por semana es la siguiente iteración natural del generador, no
un cambio de arquitectura: el modelo ya soportaría una necesidad con
`horas_por_semana > 2` repartida en N necesidades vinculadas, solo falta
esa capa arriba de esto.
"""

from dataclasses import dataclass
from datetime import time

from ortools.sat.python import cp_model

# Franjas horarias fijas por jornada -- catálogo simplificado del MVP,
# no viene de la tabla `jornadas` (que en SIHS solo tiene id + nombre,
# sin horario asociado).
#
# Intencionalmente NO calcan la plantilla institucional real de 2
# franjas/jornada (`frontend/src/pages/horario/tipos.ts` BLOQUES: 6:15-9,
# 9-12, etc.) aunque eso sería lo ideal para que el grid semanal manual
# (GridHorario/HorarioEditor) pudiera dibujar los bloques que este
# generador propone sin descartarlos. Se probó en vivo el 2026-09-14 y
# se revirtió: con solo 2 franjas × 5 días = 10 slots/semana POR FICHA,
# y el modelo actual asignando un bloque semanal propio a CADA resultado
# de aprendizaje pendiente (ver docstring del módulo), cualquier fase del
# currículo con más de 10 resultados pendientes (la mayoría -- ej.
# programa 1 real tiene fases de 13, 14 y 16) se vuelve matemáticamente
# infactible para esa ficha SIN IMPORTAR cuántos instructores/ambientes
# haya disponibles -- el cuello de botella pasa a ser la propia ficha,
# no el catálogo. Con 3 franjas (15 slots/semana) alcanza para currículos
# reales de hasta 15 resultados/fase. Antes de intentar de nuevo alinear
# esto con la plantilla institucional, hay que resolver primero que el
# generador pueda repartir varios resultados en un mismo bloque de clase
# (la "siguiente iteración natural" que ya menciona el docstring del
# módulo) -- no basta con cambiar las franjas.
FRANJAS_POR_JORNADA: dict[str, list[tuple[time, time]]] = {
    "MAÑANA": [(time(7, 0), time(9, 0)), (time(9, 0), time(11, 0)), (time(11, 0), time(13, 0))],
    "TARDE": [(time(13, 0), time(15, 0)), (time(15, 0), time(17, 0)), (time(17, 0), time(19, 0))],
    "NOCHE": [(time(18, 0), time(20, 0)), (time(20, 0), time(22, 0))],
}

# Patrones de día del catálogo -- idDia 1=Lunes .. 5=Viernes (ver
# diasDeLaSemana). Incluye días sueltos y los pares no consecutivos
# típicos de SENA (Lunes-Miércoles, Martes-Jueves).
PATRONES_DE_DIA: list[tuple[int, ...]] = [
    (1,), (2,), (3,), (4,), (5,),
    (1, 3), (2, 4), (1, 4), (2, 5),
]


@dataclass
class NecesidadHorario:
    """Una ficha necesita que se programe un resultado de aprendizaje.
    `instructores_candidatos` y `ambientes_candidatos` ya vienen
    filtrados por quien arma la lista (especialidad, sede...) -- el
    generador no sabe nada de esas reglas, solo elige entre lo que le
    dan."""

    id_ficha: int
    id_resultado: int
    jornada: str  # debe existir en FRANJAS_POR_JORNADA
    instructores_candidatos: list[str]  # UUID de instructor, como str
    ambientes_candidatos: list[int]


@dataclass
class BloqueAsignado:
    id_ficha: int
    id_resultado: int
    id_instructor: str
    id_ambiente: int
    dias: tuple[int, ...]
    hora_inicio: time
    hora_fin: time


# (franja, patrón_de_día, id_instructor, id_ambiente)
_Opcion = tuple[tuple[time, time], tuple[int, ...], str, int]


# Slot de recurso ocupado: (id_del_recurso, franja, día). Se usa para
# acarrear lo ya asignado en lotes anteriores (ver generar_propuesta, que
# resuelve ficha por ficha para que el modelo de cada lote sea chico) sin
# tener que volver a meter esas necesidades en el mismo CpModel.
_SlotOcupado = tuple[str | int, tuple[time, time], int]


def _opciones_validas(
    necesidad: NecesidadHorario,
    ocupados_instructor: set[_SlotOcupado] | None = None,
    ocupados_ambiente: set[_SlotOcupado] | None = None,
    ocupados_ficha: set[_SlotOcupado] | None = None,
) -> list[_Opcion]:
    if necesidad.jornada not in FRANJAS_POR_JORNADA:
        raise ValueError(
            f"Jornada '{necesidad.jornada}' no está en el catálogo del generador "
            f"({list(FRANJAS_POR_JORNADA)}) -- ficha {necesidad.id_ficha}."
        )
    franjas = FRANJAS_POR_JORNADA[necesidad.jornada]
    ocupados_instructor = ocupados_instructor or set()
    ocupados_ambiente = ocupados_ambiente or set()
    ocupados_ficha = ocupados_ficha or set()
    return [
        (franja, patron, instructor, ambiente)
        for franja in franjas
        for patron in PATRONES_DE_DIA
        for instructor in necesidad.instructores_candidatos
        for ambiente in necesidad.ambientes_candidatos
        if not any((instructor, franja, dia) in ocupados_instructor for dia in patron)
        and not any((ambiente, franja, dia) in ocupados_ambiente for dia in patron)
        and not any((necesidad.id_ficha, franja, dia) in ocupados_ficha for dia in patron)
    ]


def generar_horario(
    necesidades: list[NecesidadHorario],
    tiempo_limite_seg: float = 10.0,
    ocupados_instructor: set[_SlotOcupado] | None = None,
    ocupados_ambiente: set[_SlotOcupado] | None = None,
    ocupados_ficha: set[_SlotOcupado] | None = None,
) -> list[BloqueAsignado] | None:
    """Devuelve una asignación sin choques de instructor/ficha/ambiente
    para todas las necesidades, o None si el modelo es infactible (ej. no
    hay suficientes instructores o ambientes candidatos para cubrir todo
    sin que se pisen).

    `ocupados_instructor`/`ocupados_ambiente`/`ocupados_ficha` son slots
    ya comprometidos por FUERA de este `necesidades` -- de un lote
    anterior (ver _generar_bloques_por_ficha) o de horarios YA GUARDADOS
    en la BD para este trimestre (ver generar_propuesta) -- se excluyen
    de las opciones en vez de modelarse como necesidades propias, porque
    ya fueron decididos y no deben volver a competir en este solve. Sin
    esto el solver podía proponer un bloque que choca con un horario real
    ya guardado (encontrado en vivo el 2026-09-13: 3 de 5 bloques
    propuestos fallaban la revalidación final con "cruce_ficha" porque la
    ficha ya tenía otra clase justo en ese horario)."""
    if not necesidades:
        return []

    modelo = cp_model.CpModel()
    opciones_por_necesidad = [
        _opciones_validas(n, ocupados_instructor, ocupados_ambiente, ocupados_ficha) for n in necesidades
    ]

    for i, opciones in enumerate(opciones_por_necesidad):
        if opciones:
            continue
        if not necesidades[i].instructores_candidatos or not necesidades[i].ambientes_candidatos:
            raise ValueError(
                f"La necesidad {i} (ficha {necesidades[i].id_ficha}) no tiene "
                "ninguna combinación válida de instructor/ambiente/franja."
            )
        # Candidatos válidos hay, pero un lote anterior ya ocupó todos los
        # slots posibles para ellos -- infactible para ESTE lote, no un
        # error de datos.
        return None

    x = [
        [modelo.NewBoolVar(f"n{i}_o{o}") for o in range(len(opciones))]
        for i, opciones in enumerate(opciones_por_necesidad)
    ]

    # Cada necesidad se resuelve con exactamente una opción.
    for variables in x:
        modelo.AddExactlyOne(variables)

    # Ninguna pareja de necesidades puede chocar: mismo instructor, mismo
    # ambiente, o misma ficha, coincidiendo en franja y en al menos un día.
    #
    # Comparar cada opción de cada necesidad contra cada opción de cada
    # otra necesidad (como se hacía antes) es O(necesidades² × opciones²):
    # con datos reales (una ficha compitiendo por varias decenas de
    # resultados, cientos de opciones por necesidad) eso son miles de
    # millones de comparaciones en Python puro antes de llamar al solver,
    # y el asistente se queda colgado hasta hacer timeout. La restricción
    # es la misma pero se indexa por el recurso que cada opción ocupa en
    # cada (franja, día): como mucho una variable activa por slot. Eso
    # hace que construir el modelo sea lineal en necesidades × opciones.
    ocupacion_instructor: dict[tuple[str, tuple[time, time], int], list] = {}
    ocupacion_ambiente: dict[tuple[int, tuple[time, time], int], list] = {}
    ocupacion_ficha: dict[tuple[int, tuple[time, time], int], list] = {}

    for i, opciones in enumerate(opciones_por_necesidad):
        id_ficha = necesidades[i].id_ficha
        for o, (franja, patron, instructor, ambiente) in enumerate(opciones):
            variable = x[i][o]
            for dia in patron:
                ocupacion_instructor.setdefault((instructor, franja, dia), []).append(variable)
                ocupacion_ambiente.setdefault((ambiente, franja, dia), []).append(variable)
                ocupacion_ficha.setdefault((id_ficha, franja, dia), []).append(variable)

    for ocupacion in (ocupacion_instructor, ocupacion_ambiente, ocupacion_ficha):
        for variables in ocupacion.values():
            if len(variables) > 1:
                modelo.AddAtMostOne(variables)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = tiempo_limite_seg
    # Determinista a propósito: con búsqueda en paralelo (el default),
    # qué opción exacta gana entre varias igual de válidas puede variar
    # de una corrida a otra -- en _generar_bloques_por_ficha eso se
    # encadena entre fichas (la asignación de la ficha 10 cambia qué
    # queda libre para la 48), así que la misma propuesta podía salir
    # factible una vez y no la siguiente sin que cambiara ni un dato.
    # Encontrado en vivo el 2026-09-13 con el test de 50 fichas: pasaba
    # aislado y fallaba corrido junto a la suite completa.
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    estado = solver.Solve(modelo)

    if estado not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    resultado: list[BloqueAsignado] = []
    for i, necesidad in enumerate(necesidades):
        for o, opcion in enumerate(opciones_por_necesidad[i]):
            if solver.Value(x[i][o]) == 1:
                franja, dias, instructor, ambiente = opcion
                resultado.append(
                    BloqueAsignado(
                        id_ficha=necesidad.id_ficha,
                        id_resultado=necesidad.id_resultado,
                        id_instructor=instructor,
                        id_ambiente=ambiente,
                        dias=dias,
                        hora_inicio=franja[0],
                        hora_fin=franja[1],
                    )
                )
                break
    return resultado
