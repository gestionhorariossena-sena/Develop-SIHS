"""agrega tabla notificaciones

Revision ID: 54318b7dadd5
Revises: bb5880a6e6f0
Create Date: 2026-09-12 00:00:00.000000

SCRUM-93. Prerequisito real (no vitrina) del ticket "[Frontend] Pantalla
'Centro de Notificaciones' del Aprendiz": la página consume GET
/notificaciones/ y PATCH /notificaciones/{id}/leida +
/notificaciones/marcar-todas-leidas.

Escrita a mano (no `--autogenerate`) por la misma razón que las
migraciones anteriores de este backlog: la BD compartida no tiene el
`stamp head` del baseline todavía.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '54318b7dadd5'
down_revision: Union[str, Sequence[str], None] = 'bb5880a6e6f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'notificaciones',
        sa.Column('idNotificacion', sa.Integer(), primary_key=True),
        sa.Column('idUsuario', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tipo', sa.String(length=30), nullable=False),
        sa.Column('mensaje', sa.String(length=500), nullable=False),
        sa.Column('leida', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('fechaCreacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('entidadRelacionada', sa.String(length=50), nullable=True),
        sa.Column('idEntidadRelacionada', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(
            ['idUsuario'], ['usuarios.idUsuario'], name='notificaciones_idUsuario_fkey', ondelete='CASCADE'
        ),
    )
    op.create_index('idxNotificacionesIdUsuario', 'notificaciones', ['idUsuario'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idxNotificacionesIdUsuario', table_name='notificaciones')
    op.drop_table('notificaciones')
