"""agrega rolEnFicha a ficha_usuario (vocero/subvocero)

Revision ID: bb5880a6e6f0
Revises: 9a11ed549634
Create Date: 2026-09-12 00:00:00.000000

Gap ya documentado en backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md (fila
Fichas.tsx: "ficha_usuario no tiene campo de vocero"). Confirmado por los
mockups de Instructor (`detalle_de_franja_y_ambiente_sihs_sena`,
`mi_horario_semanal_vista_principal_sihs_sena`).

Columna suelta en `ficha_usuario` en vez de tabla aparte: es un atributo
del VÍNCULO aprendiz-ficha (un vocero lo es de ESA ficha puntual), y
ficha_usuario ya es esa tabla de vínculo — una tabla nueva solo para esto
duplicaría la misma PK compuesta sin ganar nada. Valores esperados:
'vocero' | 'subvocero' | NULL (aprendiz normal).

Escrita a mano (no `--autogenerate`) por la misma razón que las
migraciones anteriores de este backlog: la BD compartida no tiene el
`stamp head` del baseline todavía.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb5880a6e6f0'
down_revision: Union[str, Sequence[str], None] = '9a11ed549634'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('ficha_usuario', sa.Column('rolEnFicha', sa.String(length=20), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('ficha_usuario', 'rolEnFicha')
