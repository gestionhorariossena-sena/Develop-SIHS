"""agrega ficha técnica (piso/capacidad/especialidadSala/responsableLlaves) a ambientes

Revision ID: e4d98e84c4cd
Revises: 4933158644c8
Create Date: 2026-09-07 00:00:03.000000

SCRUM-117 (backlog asignado a la cuenta de gestión). Mockup
`detalle_de_franja_y_ambiente_sihs_sena/code.html`, sección "Ficha
Técnica del Ambiente". Todas nullable a propósito, se completan a mano
con el import real.

Fuera de alcance (el propio mockup lo marca "Dato Conceptual / En
Evaluación"): inventario técnico detallado (marca de equipos,
conectividad, audiovisual) — no se crean columnas para eso todavía.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e4d98e84c4cd'
down_revision: Union[str, Sequence[str], None] = '4933158644c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ambientes', sa.Column('piso', sa.String(length=30), nullable=True))
    op.add_column('ambientes', sa.Column('capacidad', sa.Integer(), nullable=True))
    op.add_column('ambientes', sa.Column('especialidadSala', sa.String(length=100), nullable=True))
    op.add_column('ambientes', sa.Column('responsableLlaves', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('ambientes', 'responsableLlaves')
    op.drop_column('ambientes', 'especialidadSala')
    op.drop_column('ambientes', 'capacidad')
    op.drop_column('ambientes', 'piso')
