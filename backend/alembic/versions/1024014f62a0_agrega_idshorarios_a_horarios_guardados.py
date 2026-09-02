"""agrega idsHorarios a horarios_guardados

Revision ID: 1024014f62a0
Revises: 4bdb929a803b
Create Date: 2026-09-02 00:00:00.000000

Bug reportado 2026-09-02: borrar un "horario completo" (horarios_guardados)
no borraba las clases reales correspondientes en `horarios` — quedaban
huérfanas, el instructor seguía "ocupado". No había forma de saber cuáles
`horarios` le correspondían a cada snapshot. Esta columna guarda esos ids
al crear el snapshot para poder borrarlos en cascada. Nullable: snapshots
viejos quedan sin el vínculo, no se puede reconstruir con datos que ya
existían.

Escrita a mano, mismo caso que las 2 migraciones anteriores: la BD
compartida sigue sin `alembic stamp head` para el baseline.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '1024014f62a0'
down_revision: Union[str, Sequence[str], None] = '4bdb929a803b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('horarios_guardados', sa.Column('idsHorarios', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('horarios_guardados', 'idsHorarios')
