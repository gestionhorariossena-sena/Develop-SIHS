"""agrega tabla anotaciones_horario

Revision ID: 49fb9918b2ea
Revises: 8bde7868dac6
Create Date: 2026-09-07 00:00:05.000000

SCRUM-107 (backlog asignado a la cuenta de gestión). Notas personales
del Aprendiz sobre un bloque de horario propio. Mockup
`mi_horario_rol_aprendiz_sihs_sena/code.html`, sección "Herramientas de
Organización Personal". 100% nuevo, sin nada que reusar.

v1: sin motor real de push/email para recordatorios — solo se guarda la
preferencia (`recordatorioActivo`) y se pinta en la UI.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '49fb9918b2ea'
down_revision: Union[str, Sequence[str], None] = '8bde7868dac6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'anotaciones_horario',
        sa.Column('idAnotacion', sa.Integer(), primary_key=True),
        sa.Column(
            'idUsuario', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('usuarios.idUsuario', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column(
            'idHorario', sa.Integer(),
            sa.ForeignKey('horarios.idHorario', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('nota', sa.String(length=500), nullable=False),
        sa.Column('etiqueta', sa.String(length=20), nullable=False),
        sa.Column('recordatorioActivo', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('fechaCreacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_anotaciones_horario_idAnotacion', 'anotaciones_horario', ['idAnotacion'])


def downgrade() -> None:
    op.drop_index('ix_anotaciones_horario_idAnotacion', table_name='anotaciones_horario')
    op.drop_table('anotaciones_horario')
