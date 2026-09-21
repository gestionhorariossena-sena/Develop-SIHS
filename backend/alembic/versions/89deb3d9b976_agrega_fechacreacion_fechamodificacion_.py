"""agrega fechaCreacion fechaModificacion y activo a horarios

Revision ID: 89deb3d9b976
Revises: 1024014f62a0
Create Date: 2026-09-03 04:50:08.941946

Habilita el rediseño de "Historial de horarios" como backlog real (pedido
2026-09-03): sin fechas no hay forma de ordenar "más reciente primero" ni
de que un horario "suba arriba" al modificarse, y sin un estado no hay
forma de desactivar una clase sin borrarla. `fechaModificacion` se
actualiza sola en cada UPDATE vía `onupdate` (ver app/models/horario.py) —
no hace falta tocarla a mano en HorarioService.

Escrita a mano, mismo caso que las migraciones anteriores: la BD
compartida sigue sin `alembic stamp head` para el baseline.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '89deb3d9b976'
down_revision: Union[str, Sequence[str], None] = '1024014f62a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('horarios', sa.Column('fechaCreacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('horarios', sa.Column('fechaModificacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('horarios', sa.Column('activo', sa.Boolean(), server_default=sa.text('true'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('horarios', 'activo')
    op.drop_column('horarios', 'fechaModificacion')
    op.drop_column('horarios', 'fechaCreacion')
