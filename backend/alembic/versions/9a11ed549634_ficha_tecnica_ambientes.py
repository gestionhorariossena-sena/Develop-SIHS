"""agrega ficha técnica (piso/capacidad/especialidadSala/responsableLlaves) a ambientes

Revision ID: 9a11ed549634
Revises: 2292d4f9ae4b
Create Date: 2026-09-11 00:00:00.000000

Extiende el gap ya documentado en backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md
(fila Ambientes.tsx/VistaAmbientes.tsx). Confirmado por el mockup
`detalle_de_franja_y_ambiente_sihs_sena/code.html`, sección "Ficha Técnica
del Ambiente": Identificador, Piso/Edificio, Especialidad de Sala,
Responsable de Llaves. Todas nullable a propósito, se completan a mano con
el import real.

Fuera de alcance (el propio mockup lo marca "*Dato Conceptual / En
Evaluación"): el inventario técnico detallado (marca de equipos,
especificaciones de estaciones de trabajo, conectividad, audiovisual) — no
se crean columnas/tablas para eso todavía.

Escrita a mano (no `--autogenerate`) por la misma razón que las
migraciones anteriores de este backlog: la BD compartida no tiene el
`stamp head` del baseline todavía.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a11ed549634'
down_revision: Union[str, Sequence[str], None] = '2292d4f9ae4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('ambientes', sa.Column('piso', sa.String(length=30), nullable=True))
    op.add_column('ambientes', sa.Column('capacidad', sa.Integer(), nullable=True))
    op.add_column('ambientes', sa.Column('especialidadSala', sa.String(length=100), nullable=True))
    op.add_column('ambientes', sa.Column('responsableLlaves', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('ambientes', 'responsableLlaves')
    op.drop_column('ambientes', 'especialidadSala')
    op.drop_column('ambientes', 'capacidad')
    op.drop_column('ambientes', 'piso')
