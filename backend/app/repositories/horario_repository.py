from sqlalchemy.orm import Session

from app.models.horario import Horario, horario_dia


class HorarioRepository:
    @staticmethod
    def obtener_todos(db: Session):
        return db.query(Horario).all()

    @staticmethod
    def obtener_por_id(db: Session, id_horario: int):
        return db.query(Horario).filter(Horario.idHorario == id_horario).first()

    @staticmethod
    def obtener_dias(db: Session, id_horario: int) -> list[int]:
        filas = db.execute(horario_dia.select().where(horario_dia.c.idHorario == id_horario)).all()
        return [fila.idDia for fila in filas]

    @staticmethod
    def crear(db: Session, horario: Horario, dias: list[int]):
        db.add(horario)
        db.flush()  # asigna idHorario sin cerrar la transacción todavía

        for id_dia in dias:
            db.execute(horario_dia.insert().values(idHorario=horario.idHorario, idDia=id_dia))

        db.commit()
        db.refresh(horario)
        return horario

    @staticmethod
    def actualizar(db: Session, horario: Horario, dias: list[int]):
        db.execute(horario_dia.delete().where(horario_dia.c.idHorario == horario.idHorario))
        for id_dia in dias:
            db.execute(horario_dia.insert().values(idHorario=horario.idHorario, idDia=id_dia))

        db.commit()
        db.refresh(horario)
        return horario

    @staticmethod
    def eliminar(db: Session, horario: Horario):
        db.delete(horario)
        db.commit()

    @staticmethod
    def buscar_solape(
        db: Session,
        campo: str,
        valor,
        dias: list[int],
        hora_inicio,
        hora_fin,
        excluir_id: int | None = None,
    ) -> Horario | None:
        """Mismo `campo` (idFicha/idInstructor/idAmbiente), rango de horas
        que se solapa, y al menos un día en común — ver la consulta de
        ejemplo en database/02_datos_prueba.sql. Devuelve el horario
        existente con el que choca (o None) para poder explicar el cruce
        con detalle, no solo confirmar que existe."""
        query = (
            db.query(Horario)
            .join(horario_dia, horario_dia.c.idHorario == Horario.idHorario)
            .filter(
                getattr(Horario, campo) == valor,
                horario_dia.c.idDia.in_(dias),
                Horario.horaInicio < hora_fin,
                Horario.horaFin > hora_inicio,
            )
        )
        if excluir_id is not None:
            query = query.filter(Horario.idHorario != excluir_id)
        return query.first()

    @staticmethod
    def obtener_por_instructor(
        db: Session, id_instructor, excluir_id: int | None = None
    ) -> list[Horario]:
        """Todos los horarios ya asignados a un instructor, sin filtrar por
        día/hora — HorarioService los usa para sumar horas semanales y
        detectar centro/jornada (RF-011), esa decisión no es de acá."""
        query = db.query(Horario).filter(Horario.idInstructor == id_instructor)
        if excluir_id is not None:
            query = query.filter(Horario.idHorario != excluir_id)
        return query.all()

    @staticmethod
    def buscar_resultado_en_ficha(
        db: Session,
        id_ficha: int,
        id_resultado: int,
        excluir_id: int | None = None,
    ) -> Horario | None:
        """Cruce de contenido, no de horas — ver REGLAS_DE_NEGOCIO_CONOCIDAS.md.
        Devuelve el horario existente que ya cubre ese resultado, o None."""
        query = db.query(Horario).filter(Horario.idFicha == id_ficha, Horario.idResultado == id_resultado)
        if excluir_id is not None:
            query = query.filter(Horario.idHorario != excluir_id)
        return query.first()
