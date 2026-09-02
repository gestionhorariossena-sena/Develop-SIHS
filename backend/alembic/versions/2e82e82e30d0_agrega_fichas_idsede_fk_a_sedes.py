"""agrega fichas idSede FK a sedes

Revision ID: 2e82e82e30d0
Revises: d109a7762c30
Create Date: 2026-09-02 00:00:00.000000

SCRUM-77 (Épica F, gap del Excel real §7.1): `fichas` no tenía sede
asociada, pero la coordinación sí la maneja. Nullable a propósito — las
fichas existentes no traen sede todavía, se completa con el import real
(SCRUM-76, que depende de este grupo F).

No se pudo generar con `--autogenerate`: la BD compartida nunca recibió un
`alembic stamp head` para el baseline (`alembic current` no devuelve nada),
así que Alembic rechaza el diff con "Target database is not up to date".
Escrita a mano seguir el mismo cambio; correr `alembic stamp head` una vez
contra la BD antes de aplicar esta (o cualquier futura) migración.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e82e82e30d0'
down_revision: Union[str, Sequence[str], None] = 'd109a7762c30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('fichas', sa.Column('idSede', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fichas_idSede_fkey', 'fichas', 'sedes', ['idSede'], ['idSede']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fichas_idSede_fkey', 'fichas', type_='foreignkey')
    op.drop_column('fichas', 'idSede')
