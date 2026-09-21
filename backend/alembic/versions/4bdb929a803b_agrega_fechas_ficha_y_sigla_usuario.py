"""agrega fechas lectiva/productiva en fichas y sigla en usuarios

Revision ID: 4bdb929a803b
Revises: 2e82e82e30d0
Create Date: 2026-09-02 00:00:00.000000

SCRUM-78/79/80 (Épica F, gaps del Excel real §7.1):
- `fichas.fechaInicioLectiva` / `fechaFinLectiva`
- `fichas.fechaInicioProductiva` / `fechaFinProductiva`
- `usuarios.sigla` (código corto, ej. "DC", "LM" — distinto de
  `codigoInstructor`, que ya existía)

Todas nullable a propósito — se completan con el import real (SCRUM-76).

Igual que 2e82e82e30d0: escrita a mano porque la BD compartida sigue sin
`alembic stamp head` para el baseline, así que --autogenerate rechaza el
diff con "Target database is not up to date".
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4bdb929a803b'
down_revision: Union[str, Sequence[str], None] = '2e82e82e30d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('fichas', sa.Column('fechaInicioLectiva', sa.Date(), nullable=True))
    op.add_column('fichas', sa.Column('fechaFinLectiva', sa.Date(), nullable=True))
    op.add_column('fichas', sa.Column('fechaInicioProductiva', sa.Date(), nullable=True))
    op.add_column('fichas', sa.Column('fechaFinProductiva', sa.Date(), nullable=True))
    op.add_column('usuarios', sa.Column('sigla', sa.String(length=10), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('usuarios', 'sigla')
    op.drop_column('fichas', 'fechaFinProductiva')
    op.drop_column('fichas', 'fechaInicioProductiva')
    op.drop_column('fichas', 'fechaFinLectiva')
    op.drop_column('fichas', 'fechaInicioLectiva')
