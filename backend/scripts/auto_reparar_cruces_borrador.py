"""BORRADOR — NO PROBADO, NO CONECTADO A NINGUNA RUTA.

Esqueleto preliminar de auto-reparación de conflictos de horario, para que
quien continúe este trabajo no arranque de cero. Ver
`_Docs/Documentación general/PLAN_AUTO_REPARACION_CRUCES.md` para el
análisis completo de qué tipos de conflicto son seguros de auto-reparar y
por qué.

Alcance de este borrador: solo `cruce_ambiente` con `tipoAmbiente='regular'`
(el único caso que el plan considera razonablemente seguro). Los demás
tipos de conflicto quedan fuera a propósito.

No importar esto desde ningún módulo de la app todavía — no tiene tests,
no se validó contra la base de datos real, y `aplicar_reparacion` escribe
en `horarios` sin las salvaguardas que tendría una implementación final
(ej. no maneja concurrencia entre "sugerir" y "aplicar" más allá de
re-validar una vez).
"""

from app.models.ambiente import Ambiente
from app.models.horario import Horario
from app.repositories.horario_repository import HorarioRepository
from app.services.auditoria_service import AuditoriaService
from app.services.horario_service import HorarioService
from app.schemas.horario import HorarioDryRunRequest


def sugerir_reparaciones(db, id_trimestre: int | None = None, id_sede: int | None = None) -> list[dict]:
    """Corre el barrido real (`auditar_conflictos`) y, para cada conflicto
    `cruce_ambiente` cuyo ambiente sea `tipo_ambiente == 'regular'`, intenta
    encontrar un ambiente candidato libre del mismo tipo. Todo lo demás se
    devuelve tal cual, marcado como no auto-reparable."""
    conflictos = HorarioService.auditar_conflictos(db, id_trimestre=id_trimestre, id_sede=id_sede)
    resultado = []

    for conflicto in conflictos:
        if conflicto["tipo"] != "cruce_ambiente":
            resultado.append({**conflicto, "sugerenciaAmbiente": None, "autoReparable": False})
            continue

        horario = HorarioRepository.obtener_por_id(db, conflicto["idHorario"])
        ambiente_actual = db.get(Ambiente, horario.idAmbiente) if horario else None

        if not horario or not ambiente_actual or ambiente_actual.tipo_ambiente != "regular":
            resultado.append({**conflicto, "sugerenciaAmbiente": None, "autoReparable": False})
            continue

        dias = HorarioRepository.obtener_dias(db, horario.idHorario)
        candidato = _buscar_ambiente_libre(
            db,
            tipo_ambiente=ambiente_actual.tipo_ambiente,
            sede_id_preferida=ambiente_actual.sede_id,
            dias=dias,
            hora_inicio=horario.horaInicio,
            hora_fin=horario.horaFin,
            excluir_ambiente_id=ambiente_actual.id,
        )

        resultado.append({
            **conflicto,
            "sugerenciaAmbiente": candidato.id if candidato else None,
            "autoReparable": candidato is not None,
        })

    return resultado


def _buscar_ambiente_libre(db, *, tipo_ambiente, sede_id_preferida, dias, hora_inicio, hora_fin, excluir_ambiente_id):
    """TODO: esto es O(n) sobre todos los ambientes del tipo — bien para un
    borrador, pero para producción conviene una consulta que ya excluya los
    ocupados en un solo query (similar a `buscar_solape` pero invertida:
    "ambientes SIN fila en horario_dia/horarios que choque"), en vez de
    iterar y probar uno por uno."""
    candidatos = (
        db.query(Ambiente)
        .filter(
            Ambiente.tipo_ambiente == tipo_ambiente,
            Ambiente.estado_ambiente == "disponible",
            Ambiente.id != excluir_ambiente_id,
        )
        .order_by(Ambiente.sede_id != sede_id_preferida)  # preferidos de la misma sede primero
        .all()
    )

    for ambiente in candidatos:
        choque = HorarioRepository.buscar_solape(
            db, "idAmbiente", ambiente.id, dias, hora_inicio, hora_fin
        )
        if choque is None:
            return ambiente

    return None


def aplicar_reparacion(db, id_horario: int, id_ambiente_nuevo: int, usuario) -> Horario:
    """SIEMPRE requiere que un humano haya confirmado `id_ambiente_nuevo`
    (típicamente el que devolvió `sugerir_reparaciones`, pero re-validado
    acá por si algo cambió entre la sugerencia y la confirmación). No usar
    en un cron/background sin una UI de por medio."""
    horario = HorarioRepository.obtener_por_id(db, id_horario)
    if not horario:
        raise ValueError(f"Horario {id_horario} no existe.")

    dias = HorarioRepository.obtener_dias(db, id_horario)
    candidato = HorarioDryRunRequest(
        horaInicio=horario.horaInicio,
        horaFin=horario.horaFin,
        idJornada=horario.idJornada,
        idTrimestre=horario.idTrimestre,
        idAmbiente=id_ambiente_nuevo,
        idInstructor=horario.idInstructor,
        idFicha=horario.idFicha,
        idResultado=horario.idResultado,
        dias=dias,
    )

    # Re-valida TODO (no solo ambiente) por si algo más cambió mientras
    # tanto — si sigue limpio, aplica; si no, falla con el conflicto real
    # en vez de aplicar la sugerencia vieja a ciegas.
    conflictos = HorarioService.validar_dry_run(db, candidato, excluir_id=id_horario)
    if conflictos:
        raise ValueError(f"El ambiente sugerido ya no está libre: {conflictos}")

    ambiente_anterior = horario.idAmbiente
    horario.idAmbiente = id_ambiente_nuevo
    HorarioRepository.guardar(db, horario)

    AuditoriaService.registrar(
        db,
        usuario=usuario,
        accion="AUTO_REPARAR_CRUCE_AMBIENTE",
        entidad="horarios",
        id_entidad=horario.idHorario,
        detalle=f"Ambiente reasignado de {ambiente_anterior} a {id_ambiente_nuevo} (auto-reparación confirmada)",
    )

    return horario
