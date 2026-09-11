"""avisos

Revision ID: 7bea46b16a3c
Revises: 2f1b7da88537
Create Date: 2026-09-11 00:00:00.000000

Módulo de Avisos y Comunicados de Coordinación —
avisos_oficiales_y_eventos_rol_aprendiz_sihs_sena/code.html. 100% nuevo,
confirmado que no existía ninguna tabla/endpoint de avisos/comunicados en
el backend.

"categoria" es string corto (VARCHAR), no Enum de Postgres, mismo criterio
usado en anotaciones_horario/notificaciones — el mockup usa reprog |
eventos | sede, más "extraordinario" para el destacado tipo "COMUNICADO
EXTRAORDINARIO"; el valor se acota en el schema de FastAPI (Pydantic
Literal) para no necesitar otra migración si se agrega una categoría.

"idFicha"/"idSede" nullable con ON DELETE SET NULL: null en ambos es un
estado válido ("aviso general"), así que si la ficha/sede referenciada se
borra, el aviso cae ahí en vez de desaparecer con ella.
"idUsuarioPublicador" también SET NULL: un aviso oficial es un registro
histórico que debe sobrevivir aunque se borre la cuenta de quien lo
publicó.

Fuera de alcance (ver ticket): relacionar un aviso a un bloque puntual de
horarios ("Ver cómo afecta mi horario") y cualquier tabla de aforo/hitos
institucionales — ninguna de las dos existe hoy, quedan para tickets
aparte.

Escrita a mano (no `--autogenerate`), mismo motivo que las migraciones
anteriores: la BD compartida no tiene el `stamp head` del baseline
todavía.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '7bea46b16a3c'
down_revision: Union[str, Sequence[str], None] = '2f1b7da88537'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'avisos',
        sa.Column('idAviso', sa.Integer(), primary_key=True),
        sa.Column('idUsuarioPublicador', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('titulo', sa.String(length=200), nullable=False),
        sa.Column('cuerpo', sa.Text(), nullable=False),
        sa.Column('categoria', sa.String(length=20), nullable=False),
        sa.Column('idFicha', sa.Integer(), nullable=True),
        sa.Column('idSede', sa.Integer(), nullable=True),
        sa.Column('adjuntoUrl', sa.String(length=500), nullable=True),
        sa.Column('fechaPublicacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('vigenteHasta', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ['idUsuarioPublicador'], ['usuarios.idUsuario'], name='avisos_idUsuarioPublicador_fkey',
            ondelete='SET NULL',
        ),
        sa.ForeignKeyConstraint(
            ['idFicha'], ['fichas.idFicha'], name='avisos_idFicha_fkey',
            ondelete='SET NULL',
        ),
        sa.ForeignKeyConstraint(
            ['idSede'], ['sedes.idSede'], name='avisos_idSede_fkey',
            ondelete='SET NULL',
        ),
    )
    op.create_index('idxAvisosCategoria', 'avisos', ['categoria'], unique=False)
    op.create_index('idxAvisosIdFicha', 'avisos', ['idFicha'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idxAvisosIdFicha', table_name='avisos')
    op.drop_index('idxAvisosCategoria', table_name='avisos')
    op.drop_table('avisos')
