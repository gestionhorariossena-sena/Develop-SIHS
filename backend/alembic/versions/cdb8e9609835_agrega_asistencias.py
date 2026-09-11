"""agrega tabla asistencias

Revision ID: cdb8e9609835
Revises: 7bea46b16a3c
Create Date: 2026-09-11 00:00:00.000000

SCRUM-113 (backlog de arquitectura asignado a la cuenta de gestión) —
módulo exploratorio, marcado por el propio mockup
(`detalle_de_franja_y_ambiente_sihs_sena/code.html`) como "MÓDULO
EXPLORATORIO / EN EVALUACIÓN UX ... PROTOTIPO PRÓXIMO RELEASE": el backend
institucional SIHS actual no provee lista de estudiantes por ficha en
tiempo real (gestión descentralizada en SOFIA Plus). Solo deja la tabla
trazada en el backlog — sin endpoints todavía a propósito, dependen de que
exista una lista real de aprendices por ficha con datos de contacto (ver
ficha_usuario). Se agregan cuando se priorice.

Escrita a mano (no `--autogenerate`) por la misma razón que las
migraciones anteriores de este backlog: la BD compartida no tiene el
`stamp head` del baseline todavía.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'cdb8e9609835'
down_revision: Union[str, Sequence[str], None] = '7bea46b16a3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'asistencias',
        sa.Column('idAsistencia', sa.Integer(), primary_key=True),
        sa.Column('idHorario', sa.Integer(), nullable=False),
        sa.Column('idUsuarioAprendiz', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('horaMarcacion', sa.DateTime(timezone=True), nullable=True),
        sa.Column('referenciaExcusa', sa.String(length=200), nullable=True),
        sa.Column('fechaCreacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['idHorario'], ['horarios.idHorario'], name='asistencias_idHorario_fkey'),
        sa.ForeignKeyConstraint(
            ['idUsuarioAprendiz'], ['usuarios.idUsuario'], name='asistencias_idUsuarioAprendiz_fkey'
        ),
    )
    op.create_index('idxAsistenciasHorario', 'asistencias', ['idHorario'], unique=False)
    op.create_index('idxAsistenciasUsuarioAprendiz', 'asistencias', ['idUsuarioAprendiz'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idxAsistenciasUsuarioAprendiz', table_name='asistencias')
    op.drop_index('idxAsistenciasHorario', table_name='asistencias')
    op.drop_table('asistencias')
