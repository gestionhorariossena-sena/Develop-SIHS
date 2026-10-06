"""agrega preferenciaTema a usuarios

Revision ID: a1d4f6c2e8b9
Revises: cc4815a70f22
Create Date: 2026-10-06 00:00:00.000000

T-9 (SCRUM-139). El modo oscuro vivía solo en el localStorage del
navegador: al entrar desde otro equipo o después de borrar datos del
navegador volvía al tema por defecto. Se guarda por usuario para que la
elección lo siga.

Nullable: NULL = nunca eligió, el cliente usa su valor local ("sistema"
por defecto).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1d4f6c2e8b9'
down_revision: Union[str, Sequence[str], None] = 'cc4815a70f22'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('usuarios', sa.Column('preferenciaTema', sa.String(length=10), nullable=True))
    op.create_check_constraint(
        'ck_usuarios_preferencia_tema',
        'usuarios',
        sa.text('"preferenciaTema" IS NULL OR "preferenciaTema" IN (\'claro\', \'oscuro\', \'sistema\')'),
    )


def downgrade() -> None:
    op.drop_constraint('ck_usuarios_preferencia_tema', 'usuarios', type_='check')
    op.drop_column('usuarios', 'preferenciaTema')
