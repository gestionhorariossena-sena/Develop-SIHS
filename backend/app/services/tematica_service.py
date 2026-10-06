from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.models.actividades_aprendizaje import ActividadAprendizaje
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.horario import Horario
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje


class TematicaEnUsoError(Exception):
    """Borrar la temática dejaría colgando filas que la referencian (FK sin
    cascada). Antes eso llegaba a la base y volvía como un 500 opaco."""


class ReferenciaInexistenteError(Exception):
    """El programa o la competencia indicados no existen."""


def _coincide(termino: str, *textos: str | None) -> bool:
    return any(termino in (texto or "").lower() for texto in textos)


class TematicaService:
    """Vista de administración de "Temáticas": competencias de formación
    con sus resultados de aprendizaje, que son lo que el creador de
    horarios muestra como temática de cada bloque. No es una tabla nueva:
    agrupa en una sola respuesta lo que antes había que cruzar a mano con
    /competencias-formacion, /resultados-aprendizaje y /horarios."""

    @staticmethod
    def listar(db, *, id_programa: int | None = None, busqueda: str | None = None) -> list[dict]:
        consulta = db.query(CompetenciaFormacion).options(selectinload(CompetenciaFormacion.especialidades))
        if id_programa is not None:
            consulta = consulta.filter(CompetenciaFormacion.idPrograma == id_programa)
        competencias = consulta.order_by(CompetenciaFormacion.codigo, CompetenciaFormacion.idCompetencia).all()
        if not competencias:
            return []

        resultados = (
            db.query(ResultadoAprendizaje)
            .filter(ResultadoAprendizaje.idCompetencia.in_([c.idCompetencia for c in competencias]))
            .order_by(ResultadoAprendizaje.numeroFase, ResultadoAprendizaje.codigo, ResultadoAprendizaje.idResultado)
            .all()
        )
        usos = (
            dict(
                db.query(Horario.idResultado, func.count(Horario.idHorario))
                .filter(Horario.idResultado.in_([r.idResultado for r in resultados]))
                .group_by(Horario.idResultado)
                .all()
            )
            if resultados
            else {}
        )
        nombres_programa = dict(
            db.query(Programa.idPrograma, Programa.nombrePrograma)
            .filter(Programa.idPrograma.in_({c.idPrograma for c in competencias}))
            .all()
        )

        resultados_por_competencia: dict[int, list[dict]] = {}
        for resultado in resultados:
            resultados_por_competencia.setdefault(resultado.idCompetencia, []).append({
                "idResultado": resultado.idResultado,
                "codigo": resultado.codigo,
                "descripcion": resultado.descripcion,
                "horasAsignadas": resultado.horasAsignadas,
                "numeroFase": resultado.numeroFase,
                "idGuia": resultado.idGuia,
                "horariosAsignados": usos.get(resultado.idResultado, 0),
            })

        termino = (busqueda or "").strip().lower()
        respuesta = []
        for competencia in competencias:
            propios = resultados_por_competencia.get(competencia.idCompetencia, [])
            # Si la búsqueda coincide con la competencia se muestra entera;
            # si solo coincide con algunos resultados, solo esos.
            if termino and not _coincide(termino, competencia.descripcion, competencia.codigo):
                propios = [r for r in propios if _coincide(termino, r["descripcion"], r["codigo"])]
                if not propios:
                    continue
            respuesta.append({
                "idCompetencia": competencia.idCompetencia,
                "codigo": competencia.codigo,
                "descripcion": competencia.descripcion,
                "idPrograma": competencia.idPrograma,
                "nombrePrograma": nombres_programa.get(competencia.idPrograma),
                "especialidades": competencia.especialidades,
                "resultados": propios,
                "totalHoras": sum(r["horasAsignadas"] or 0 for r in propios),
            })
        return respuesta

    @staticmethod
    def validar_programa(db, id_programa: int) -> None:
        if not db.query(Programa.idPrograma).filter(Programa.idPrograma == id_programa).first():
            raise ReferenciaInexistenteError("El programa indicado no existe.")

    @staticmethod
    def validar_competencia(db, id_competencia: int) -> None:
        existe = (
            db.query(CompetenciaFormacion.idCompetencia)
            .filter(CompetenciaFormacion.idCompetencia == id_competencia)
            .first()
        )
        if not existe:
            raise ReferenciaInexistenteError("La competencia indicada no existe.")

    @staticmethod
    def verificar_competencia_borrable(db, id_competencia: int) -> None:
        cantidad = (
            db.query(func.count(ResultadoAprendizaje.idResultado))
            .filter(ResultadoAprendizaje.idCompetencia == id_competencia)
            .scalar()
        )
        if cantidad:
            raise TematicaEnUsoError(
                f"La competencia tiene {cantidad} resultado(s) de aprendizaje. Elimínalos primero."
            )

    @staticmethod
    def verificar_resultado_borrable(db, id_resultado: int) -> None:
        horarios = db.query(func.count(Horario.idHorario)).filter(Horario.idResultado == id_resultado).scalar()
        if horarios:
            raise TematicaEnUsoError(
                f"El resultado está asignado a {horarios} bloque(s) de horario. Reasígnalos antes de eliminarlo."
            )
        actividades = (
            db.query(func.count(ActividadAprendizaje.idActividad))
            .filter(ActividadAprendizaje.idResultado == id_resultado)
            .scalar()
        )
        if actividades:
            raise TematicaEnUsoError(f"El resultado tiene {actividades} actividad(es) de aprendizaje asociadas.")
