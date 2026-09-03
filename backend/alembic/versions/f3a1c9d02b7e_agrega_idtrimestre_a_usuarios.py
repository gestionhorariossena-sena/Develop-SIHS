"""agrega idTrimestre a usuarios (código de instructor por trimestre)

Revision ID: f3a1c9d02b7e
Revises: 89deb3d9b976
Create Date: 2026-09-03 00:00:00.000000

Historia "Código de instructor: completar el flujo frontend y vincularlo a
un trimestre". codigoInstructor queda fijo una vez creado (no se regenera,
ver UsuarioService.generar_codigo_instructor, que ya es idempotente), así
que esto NO es una tabla de historial de códigos por trimestre —
codigos_instructor con idUsuario+idTrimestre+codigo hubiera implicado poder
tener varios códigos por instructor a lo largo del tiempo, justo lo
contrario de "el código debe quedar fijo". Un idTrimestre suelto en
usuarios (un código = el trimestre en que se emitió) encaja con esa regla
sin abrir la puerta a un historial que el negocio no pidió.

Nullable a propósito: los instructores que ya tienen codigoInstructor de
antes de este cambio no tienen trimestre asociado.

Igual que las migraciones anteriores: escrita a mano porque la BD
compartida sigue sin `alembic stamp head` para el baseline.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a1c9d02b7e'
down_revision: Union[str, Sequence[str], None] = '7c5e9a1b2d44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('usuarios', sa.Column('idTrimestre', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'usuarios_idTrimestre_fkey', 'usuarios', 'trimestres', ['idTrimestre'], ['idTrimestre']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('usuarios_idTrimestre_fkey', 'usuarios', type_='foreignkey')
    op.drop_column('usuarios', 'idTrimestre')
