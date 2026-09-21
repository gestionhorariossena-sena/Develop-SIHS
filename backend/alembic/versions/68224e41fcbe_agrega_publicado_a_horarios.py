"""agrega publicado a horarios

Revision ID: 68224e41fcbe
Revises: 89deb3d9b976
Create Date: 2026-09-03 06:03:12.599786

Habilita las vistas de instructor (pedido 2026-09-03): un instructor solo
debe ver en "Mi horario" las clases que el coordinador ya dio por buenas,
no un borrador a medio armar. `activo` (migración anterior) NO sirve para
esto — significa otra cosa (si cuenta para cruces/RF-011). `publicado` es
un concepto aparte: visibilidad para el instructor, no validación.

Default `true` a propósito, distinto del "borrador por defecto" que se
había planteado en el chat: la BD compartida ya tiene meses de horarios
reales creados antes de que este campo existiera — si el default fuera
`false`, todos esos desaparecerían de golpe de las vistas de instructor el
día que esto se despliegue. Con `true`, no cambia nada para lo que ya
existe, y el coordinador puede despublicar puntualmente lo que no quiera
mostrar todavía (ver PATCH /horarios/{id}/estado).

Escrita a mano, mismo caso que las migraciones anteriores: la BD
compartida sigue sin `alembic stamp head` para el baseline.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68224e41fcbe'
down_revision: Union[str, Sequence[str], None] = '89deb3d9b976'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('horarios', sa.Column('publicado', sa.Boolean(), server_default=sa.text('true'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('horarios', 'publicado')
