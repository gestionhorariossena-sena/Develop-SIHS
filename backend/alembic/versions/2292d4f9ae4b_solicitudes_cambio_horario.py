"""solicitudes_cambio_horario

Revision ID: 2292d4f9ae4b
Revises: cdb8e9609835
Create Date: 2026-09-11 00:00:00.000000

Gap documentado en backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md (fila
Instructores.tsx: "no existe tabla de solicitudes de cambio de horario")
y confirmado por los mockups nuevos: botones "Reportar Novedad"/"Radicar
Solicitud de Cambio o Novedad" (detalle_de_franja_y_ambiente_sihs_sena),
"Solicitar Novedad o Permuta" y badge "Mis Solicitudes"
(mi_horario_semanal_vista_principal_sihs_sena). 100% nuevo.

"idHorarioOrigen" nullable con ON DELETE SET NULL: mismo criterio que
avisos — una solicitud ya resuelta es un registro histórico que no
debería desaparecer si el horario de origen se borra o reprograma
después.

"tipo" es string corto (novedad | permuta | cambio-ambiente), mismo
criterio que avisos.categoria/anotaciones_horario.etiqueta, acotado en el
schema de FastAPI (Pydantic Literal) para no necesitar otra migración si
se agrega un tipo nuevo.

"estado" sí es un Enum nativo de Postgres: flujo cerrado de 3 estados
(pendiente/aprobada/rechazada) con transición controlada por los
endpoints aprobar/rechazar — mismo criterio que ya se usó para
`solicitudes_acceso.estado` (ver c51931d849f6).

Escrita a mano (no `--autogenerate`), mismo motivo que las migraciones
anteriores: la BD compartida no tiene el `stamp head` del baseline
todavía.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2292d4f9ae4b'
down_revision: Union[str, Sequence[str], None] = 'cdb8e9609835'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    estado_solicitud_cambio_horario = sa.Enum(
        'pendiente', 'aprobada', 'rechazada', name='estado_solicitud_cambio_horario'
    )
    estado_solicitud_cambio_horario.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'solicitudes_cambio_horario',
        sa.Column('idSolicitud', sa.Integer(), primary_key=True),
        sa.Column('idInstructor', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('idHorarioOrigen', sa.Integer(), nullable=True),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('motivo', sa.Text(), nullable=False),
        sa.Column('estado', estado_solicitud_cambio_horario, nullable=False, server_default='pendiente'),
        sa.Column('fechaSolicitud', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('fechaResolucion', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ['idInstructor'], ['usuarios.idUsuario'], name='solicitudesCambioHorario_idInstructor_fkey',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['idHorarioOrigen'], ['horarios.idHorario'], name='solicitudesCambioHorario_idHorarioOrigen_fkey',
            ondelete='SET NULL',
        ),
    )
    op.create_index(
        'idxSolicitudesCambioHorarioInstructor', 'solicitudes_cambio_horario', ['idInstructor'], unique=False
    )
    op.create_index(
        'idxSolicitudesCambioHorarioEstado', 'solicitudes_cambio_horario', ['estado'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idxSolicitudesCambioHorarioEstado', table_name='solicitudes_cambio_horario')
    op.drop_index('idxSolicitudesCambioHorarioInstructor', table_name='solicitudes_cambio_horario')
    op.drop_table('solicitudes_cambio_horario')

    estado_solicitud_cambio_horario = sa.Enum(
        'pendiente', 'aprobada', 'rechazada', name='estado_solicitud_cambio_horario'
    )
    estado_solicitud_cambio_horario.drop(op.get_bind(), checkfirst=True)
