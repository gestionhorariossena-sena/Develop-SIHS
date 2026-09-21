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


def _opciones_validas(necesidad: NecesidadHorario) -> list[_Opcion]:
    if necesidad.jornada not in FRANJAS_POR_JORNADA:
        raise ValueError(
            f"Jornada '{necesidad.jornada}' no está en el catálogo del generador "
            f"({list(FRANJAS_POR_JORNADA)}) -- ficha {necesidad.id_ficha}."
        )
    franjas = FRANJAS_POR_JORNADA[necesidad.jornada]
    return [
        (franja, patron, instructor, ambiente)
        for franja in franjas
        for patron in PATRONES_DE_DIA
        for instructor in necesidad.instructores_candidatos
        for ambiente in necesidad.ambientes_candidatos
    ]


def generar_horario(
    necesidades: list[NecesidadHorario], tiempo_limite_seg: float = 10.0
) -> list[BloqueAsignado] | None:
    """Devuelve una asignación sin choques de instructor/ficha/ambiente
    para todas las necesidades, o None si el modelo es infactible (ej. no
    hay suficientes instructores o ambientes candidatos para cubrir todo
    sin que se pisen)."""
    if not necesidades:
        return []

    modelo = cp_model.CpModel()
    opciones_por_necesidad = [_opciones_validas(n) for n in necesidades]

    for i, opciones in enumerate(opciones_por_necesidad):
        if not opciones:
            raise ValueError(
                f"La necesidad {i} (ficha {necesidades[i].id_ficha}) no tiene "
                "ninguna combinación válida de instructor/ambiente/franja."
            )

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
