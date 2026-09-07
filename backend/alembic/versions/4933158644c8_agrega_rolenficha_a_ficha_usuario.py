"""agrega rolEnFicha a ficha_usuario

Revision ID: 4933158644c8
Revises: b73491403bb8
Create Date: 2026-09-07 00:00:02.000000

SCRUM-108 (backlog asignado a la cuenta de gestión). Concepto de
"Vocero"/"Subvocero" de ficha — confirmado por los mockups de Instructor
(`detalle_de_franja_y_ambiente_sihs_sena`, `mi_horario_semanal_vista_principal_sihs_sena`).

Columna suelta en `ficha_usuario` en vez de tabla aparte: es un atributo
del VÍNCULO aprendiz-ficha (un vocero lo es de ESA ficha puntual), y
ficha_usuario ya es esa tabla de vínculo — una tabla nueva solo para esto
duplicaría la misma PK compuesta sin ganar nada. Valores esperados:
'vocero' | 'subvocero' | NULL (aprendiz normal).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4933158644c8'
down_revision: Union[str, Sequence[str], None] = 'b73491403bb8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ficha_usuario', sa.Column('rolEnFicha', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('ficha_usuario', 'rolEnFicha')
