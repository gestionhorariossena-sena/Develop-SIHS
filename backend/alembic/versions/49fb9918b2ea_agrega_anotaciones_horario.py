"""agrega tabla anotaciones_horario

Revision ID: 49fb9918b2ea
Revises: 8bde7868dac6
Create Date: 2026-09-07 00:00:05.000000

SCRUM-107 (backlog asignado a la cuenta de gestión). Notas personales
del Aprendiz sobre su horario — sección "Herramientas de Organización
Personal" / drawer "Organizador Personal" de
mi_horario_rol_aprendiz_sihs_sena/code.html. 100% nuevo, sin nada que
reusar.

"idHorario" (no "idHorarioDia") es la FK al bloque real: horario_dia es
una tabla puente sin PK propia, así que no hay una fila individual a la
que apuntar ahí — el bloque horario ya identifica de sobra la clase
sobre la que se anota. Nullable porque el mockup también admite notas
generales no atadas a un bloque puntual.

"etiqueta" sigue el mismo criterio que notificaciones.tipo: string corto
(VARCHAR) en vez de tabla catálogo aparte — el valor se acota en el
schema de FastAPI (Pydantic Literal), no con un Enum de Postgres.

v1: sin motor real de push/email para recordatorios — solo se guarda la
preferencia (`recordatorioActivo`) y se pinta en la UI.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '49fb9918b2ea'
down_revision: Union[str, Sequence[str], None] = '8bde7868dac6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
    op.drop_index('idxAnotacionesHorarioIdUsuario', table_name='anotaciones_horario')
    op.drop_table('anotaciones_horario')
