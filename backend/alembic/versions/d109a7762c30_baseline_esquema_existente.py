"""baseline esquema existente

Revision ID: d109a7762c30
Revises:
Create Date: 2026-09-01 00:21:54.410736

Marca el punto de partida de Alembic sobre una base de datos que ya existía
(esquema aplicado a mano vía `database/01_creacion.sql` + las migraciones
sueltas en `database/migrations/`, hasta e incluyendo `04_codigo_instructor_y_auditoria.sql`).

No ejecuta DDL — se aplica con `alembic stamp head`, no con `upgrade`, así
que `upgrade()`/`downgrade()` quedan vacíos a propósito. Un `--autogenerate`
real acá mezclaba renombres de índices cosméticos con un cambio de verdad
riesgoso (quitaba `ON DELETE CASCADE` de varias FKs porque los modelos de
SQLAlchemy no lo declaran explícitamente, aunque el SQL sí) — evaluar esa
brecha modelo-vs-SQL aparte, no colada en el baseline.

De acá en adelante, todo cambio de esquema nuevo sí va con
`alembic revision --autogenerate` + revisión manual del diff antes de
aplicarlo.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd109a7762c30'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
