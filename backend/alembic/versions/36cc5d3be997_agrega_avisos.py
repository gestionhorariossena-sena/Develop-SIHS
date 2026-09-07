"""agrega tabla avisos

Revision ID: 36cc5d3be997
Revises: 49fb9918b2ea
Create Date: 2026-09-07 00:00:06.000000

SCRUM-111 (backlog asignado a la cuenta de gestión). Módulo de Avisos y
Comunicados de Coordinación. Mockup
`avisos_oficiales_y_eventos_rol_aprendiz_sihs_sena/code.html`. 100%
nuevo, sin nada que reusar.

Fuera de alcance de este ticket (vitrina en el frontend, no bloqueante):
vincular un aviso a un bloque específico de horario, "estado de
sede"/aforo, "calendario de hitos" del trimestre.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '36cc5d3be997'
down_revision: Union[str, Sequence[str], None] = '49fb9918b2ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'avisos',
        sa.Column('idAviso', sa.Integer(), primary_key=True),
        sa.Column(
            'idUsuarioPublicador', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('usuarios.idUsuario'), nullable=False,
        ),
        sa.Column('titulo', sa.String(length=200), nullable=False),
        sa.Column('cuerpo', sa.Text(), nullable=False),
        sa.Column('categoria', sa.String(length=20), nullable=False),
        sa.Column('idFicha', sa.Integer(), sa.ForeignKey('fichas.idFicha'), nullable=True),
        sa.Column('idSede', sa.Integer(), sa.ForeignKey('sedes.idSede'), nullable=True),
        sa.Column('adjuntoUrl', sa.String(length=500), nullable=True),
        sa.Column('fechaPublicacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('vigenteHasta', sa.Date(), nullable=True),
    )
    op.create_index('ix_avisos_idAviso', 'avisos', ['idAviso'])


def downgrade() -> None:
    op.drop_index('ix_avisos_idAviso', table_name='avisos')
    op.drop_table('avisos')
