"""agrega tabla notificaciones

Revision ID: e5c53749014d
Revises: f3a1c9d02b7e
Create Date: 2026-09-03 00:00:00.000000

Escrita a mano porque la base compartida todavía no tiene el baseline de
Alembic aplicado; debe ejecutarse con `alembic upgrade head` cuando corresponda.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e5c53749014d'
down_revision: Union[str, Sequence[str], None] = 'f3a1c9d02b7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'notificaciones',
        sa.Column('idNotificacion', sa.Integer(), primary_key=True, index=True),
        sa.Column('idUsuario', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.idUsuario', ondelete='CASCADE'), nullable=False),
        sa.Column('tipo', sa.String(length=30), nullable=False),
        sa.Column('mensaje', sa.String(length=500), nullable=False),
        sa.Column('leida', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('fechaCreacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('entidadRelacionada', sa.String(length=50), nullable=True),
        sa.Column('idEntidadRelacionada', sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('notificaciones')
