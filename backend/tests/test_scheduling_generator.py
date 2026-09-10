"""Fase 4 de PLAN_INTEGRACION_IA.md. CP-SAT puro -- sin mockear nada de
IA, esto es lógica determinista, se prueba resolviendo modelos reales
(rápidos: cada caso tiene pocas necesidades)."""

from datetime import time

import pytest

from app.scheduling.generator import NecesidadHorario, generar_horario


def _slots_ocupados(bloque):
    """(franja, día) por cada día del bloque -- para detectar choques."""
    return {(bloque.hora_inicio, bloque.hora_fin, dia) for dia in bloque.dias}


def test_lista_vacia_devuelve_lista_vacia():
    assert generar_horario([]) == []


def test_necesidades_con_mismo_instructor_y_ambiente_no_chocan():
    necesidades = [
        NecesidadHorario(
            id_ficha=i, id_resultado=i, jornada="MAÑANA",
            instructores_candidatos=["instructor-1"], ambientes_candidatos=[100],
        )
        for i in range(1, 4)
    ]

    resultado = generar_horario(necesidades)

    assert resultado is not None
    assert len(resultado) == 3
    slots_vistos: set = set()
    for bloque in resultado:
        for slot in _slots_ocupados(bloque):
            assert slot not in slots_vistos, f"choque de instructor/ambiente en {slot}"
            slots_vistos.add(slot)


def test_misma_ficha_dos_resultados_no_chocan_aunque_no_compartan_recursos():
    # Instructores y ambientes distintos, pero es la MISMA ficha -- no
    # puede tener dos clases al mismo tiempo (cruce_ficha).
    necesidades = [
        NecesidadHorario(
            id_ficha=1, id_resultado=1, jornada="TARDE",
            instructores_candidatos=["instructor-a"], ambientes_candidatos=[1],
        ),
        NecesidadHorario(
            id_ficha=1, id_resultado=2, jornada="TARDE",
            instructores_candidatos=["instructor-b"], ambientes_candidatos=[2],
        ),
    ]

    resultado = generar_horario(necesidades)

    assert resultado is not None
    b1, b2 = resultado
    assert not _slots_ocupados(b1) & _slots_ocupados(b2)


def test_sin_instructores_candidatos_lanza_value_error():
    necesidades = [
        NecesidadHorario(
            id_ficha=1, id_resultado=1, jornada="MAÑANA",
            instructores_candidatos=[], ambientes_candidatos=[1],
        )
    ]

    with pytest.raises(ValueError, match="ninguna combinación válida"):
        generar_horario(necesidades)


def test_jornada_desconocida_lanza_value_error():
    necesidades = [
        NecesidadHorario(
            id_ficha=1, id_resultado=1, jornada="MADRUGADA",
            instructores_candidatos=["a"], ambientes_candidatos=[1],
        )
    ]

    with pytest.raises(ValueError, match="no está en el catálogo"):
        generar_horario(necesidades)


def test_modelo_infactible_devuelve_none(monkeypatch):
    # Una sola franja y un solo patrón de día posibles -> una sola opción
    # por necesidad. Misma ficha fuerza que no puedan coincidir, pero
    # ambas están obligadas a tomar esa única opción: infactible.
    monkeypatch.setattr(
        "app.scheduling.generator.FRANJAS_POR_JORNADA",
        {"MAÑANA": [(time(7, 0), time(9, 0))]},
    )
    monkeypatch.setattr("app.scheduling.generator.PATRONES_DE_DIA", [(1,)])

    necesidades = [
        NecesidadHorario(
            id_ficha=1, id_resultado=1, jornada="MAÑANA",
            instructores_candidatos=["a"], ambientes_candidatos=[1],
        ),
        NecesidadHorario(
            id_ficha=1, id_resultado=2, jornada="MAÑANA",
            instructores_candidatos=["b"], ambientes_candidatos=[2],
        ),
    ]

    assert generar_horario(necesidades) is None
