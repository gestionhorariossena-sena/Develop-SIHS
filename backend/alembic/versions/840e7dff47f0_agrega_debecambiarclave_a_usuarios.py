"""agrega debeCambiarClave a usuarios

Revision ID: 840e7dff47f0
Revises: e5c53749014d
Create Date: 2026-09-07 00:00:00.000000

SCRUM-103/112 (backlog asignado a la cuenta de gestión). Cuando el panel
de aprobación de solicitudes cree una cuenta con contraseña temporal
autogenerada (en vez de la que elige la propia persona), esta columna
queda en True y el frontend debe bloquear la navegación hasta que
establezca su propia contraseña.

Default False para todas las cuentas existentes (se registraron con su
propia contraseña desde el principio, no aplica).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '840e7dff47f0'
down_revision: Union[str, Sequence[str], None] = 'e5c53749014d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'usuarios',
        sa.Column('debeCambiarClave', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('usuarios', 'debeCambiarClave')
