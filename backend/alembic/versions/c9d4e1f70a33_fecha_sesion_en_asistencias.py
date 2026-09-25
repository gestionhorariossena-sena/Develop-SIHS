"""Agrega fechaSesion a asistencias

Un horario se repite todas las semanas (`dias: [1, 3]` = todos los lunes y
miércoles), así que `idHorario + idUsuarioAprendiz` no alcanza para decir
de QUÉ clase se está hablando: la asistencia del lunes 22 y la del lunes 29
serían indistinguibles. `fechaCreacion` tampoco sirve como sustituto — es
cuándo se guardó la fila, así que pasar lista al día siguiente dejaría la
falta con fecha equivocada.

Con el único compuesto, además, pasar lista dos veces de la misma sesión
corrige en vez de duplicar.

Revision ID: c9d4e1f70a33
Revises: a7c31f5b9e02
"""

from alembic import op
import sqlalchemy as sa

revision = "c9d4e1f70a33"
down_revision = "a7c31f5b9e02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # nullable primero: si ya hubiera filas (la tabla se creó en
    # 8bde7868dac6 y nunca tuvo endpoints, así que debería estar vacía),
    # se les pone la fecha de creación antes de exigir el valor.
    op.add_column("asistencias", sa.Column("fechaSesion", sa.Date(), nullable=True))
    op.execute('UPDATE asistencias SET "fechaSesion" = DATE("fechaCreacion") WHERE "fechaSesion" IS NULL')
    op.alter_column("asistencias", "fechaSesion", nullable=False)

    op.create_unique_constraint(
        "uqAsistenciaHorarioAprendizFecha",
        "asistencias",
        ["idHorario", "idUsuarioAprendiz", "fechaSesion"],
    )
    # El listado del aprendiz filtra por persona y ordena por fecha.
    op.create_index("ixAsistenciaAprendizFecha", "asistencias", ["idUsuarioAprendiz", "fechaSesion"])


def downgrade() -> None:
    op.drop_index("ixAsistenciaAprendizFecha", table_name="asistencias")
    op.drop_constraint("uqAsistenciaHorarioAprendizFecha", "asistencias", type_="unique")
    op.drop_column("asistencias", "fechaSesion")
