"""agrega numero de documento a usuarios

Revision ID: 7c5e9a1b2d44
Revises: 68224e41fcbe
Create Date: 2026-09-03 00:00:00.000000

SCRUM: permite iniciar sesión usando el número de documento. Se deja
nullable para no bloquear a los usuarios existentes, que continuarán
iniciando sesión mediante su email hasta completar ese dato.

Escrita a mano porque la base compartida todavía no tiene el baseline de
Alembic aplicado; debe ejecutarse con `alembic upgrade head` cuando corresponda.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c5e9a1b2d44'
down_revision: Union[str, Sequence[str], None] = '68224e41fcbe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('usuarios', sa.Column('numeroDocumento', sa.String(length=30), nullable=True))
    op.create_unique_constraint('uq_usuarios_numeroDocumento', 'usuarios', ['numeroDocumento'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_usuarios_numeroDocumento', 'usuarios', type_='unique')
    op.drop_column('usuarios', 'numeroDocumento')
