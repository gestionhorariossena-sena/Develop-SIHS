"""anotaciones_horario

Revision ID: 2f1b7da88537
Revises: c51931d849f6
Create Date: 2026-09-11 00:00:00.000000

Notas personales del Aprendiz sobre su horario — sección "Herramientas de
Organización Personal" / drawer "Organizador Personal" de
mi_horario_rol_aprendiz_sihs_sena/code.html. 100% nuevo, no había ninguna
tabla que reusar.

"idHorario" (no "idHorarioDia") es la FK al bloque real: horario_dia es una
tabla puente sin PK propia (idHorario, idDia), así que no hay una fila
individual a la que apuntar ahí — el bloque horario ya identifica de sobra
la clase sobre la que se anota. Nullable porque el mockup también admite
notas generales no atadas a un bloque puntual.

"etiqueta" sigue el mismo criterio que notificaciones.tipo (ver
aa0f293/0b9d912): string corto (VARCHAR) en vez de tabla catálogo aparte —
el valor se acota en el schema de FastAPI (Pydantic Literal), no con un
Enum de Postgres, para no necesitar otra migración cada vez que se agregue
una etiqueta nueva.

"recordatorioActivo" en v1 solo guarda la preferencia del Aprendiz y se
pinta en la UI — el envío real del recordatorio (push/correo) queda como
mejora aparte, no bloqueante (mismo criterio usado en SCRUM-93 para
notificaciones).

Escrita a mano (no `--autogenerate`), mismo motivo que 2e82e82e30d0 y
c51931d849f6: la BD compartida no tiene el `stamp head` del baseline
todavía, así que Alembic rechaza el diff con "Target database is not up to
date". Correr `alembic stamp head` una vez contra la BD antes de aplicar
esta (o cualquier futura) migración.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2f1b7da88537'
down_revision: Union[str, Sequence[str], None] = 'c51931d849f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'anotaciones_horario',
        sa.Column('idAnotacion', sa.Integer(), primary_key=True),
        sa.Column('idUsuario', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('idHorario', sa.Integer(), nullable=True),
        sa.Column('nota', sa.Text(), nullable=False),
        sa.Column('etiqueta', sa.String(length=20), nullable=False, server_default='Normal'),
        sa.Column('recordatorioActivo', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('fechaCreacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ['idUsuario'], ['usuarios.idUsuario'], name='anotaciones_horario_idUsuario_fkey',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['idHorario'], ['horarios.idHorario'], name='anotaciones_horario_idHorario_fkey',
            ondelete='CASCADE',
        ),
    )
    op.create_index(
        'idxAnotacionesHorarioIdUsuario', 'anotaciones_horario', ['idUsuario'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idxAnotacionesHorarioIdUsuario', table_name='anotaciones_horario')
    op.drop_table('anotaciones_horario')
