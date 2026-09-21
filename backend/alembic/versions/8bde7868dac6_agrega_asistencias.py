"""agrega tabla asistencias

Revision ID: 8bde7868dac6
Revises: e4d98e84c4cd
Create Date: 2026-09-07 00:00:04.000000

SCRUM-113 (backlog asignado a la cuenta de gestión) — módulo
exploratorio, marcado en el propio mockup
(`detalle_de_franja_y_ambiente_sihs_sena/code.html`) como "PROTOTIPO
PRÓXIMO RELEASE": el backend institucional no provee lista de
estudiantes por ficha en tiempo real (gestión descentralizada en Sofía
Plus). Solo deja la tabla trazada en el backlog — sin endpoints todavía
a propósito, se agregan cuando se priorice.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '8bde7868dac6'
down_revision: Union[str, Sequence[str], None] = 'e4d98e84c4cd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'asistencias',
        sa.Column('idAsistencia', sa.Integer(), primary_key=True),
        sa.Column('idHorario', sa.Integer(), sa.ForeignKey('horarios.idHorario'), nullable=False),
        sa.Column('idUsuarioAprendiz', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.idUsuario'), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('horaMarcacion', sa.DateTime(timezone=True), nullable=True),
        sa.Column('referenciaExcusa', sa.String(length=200), nullable=True),
        sa.Column('fechaCreacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_asistencias_idAsistencia', 'asistencias', ['idAsistencia'])


def downgrade() -> None:
    op.drop_index('ix_asistencias_idAsistencia', table_name='asistencias')
    op.drop_table('asistencias')
