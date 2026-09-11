"""solicitudes_acceso y debe_cambiar_clave

Revision ID: c51931d849f6
Revises: 2e82e82e30d0
Create Date: 2026-09-11 00:00:00.000000

SCRUM-96 (Épica): hoy no existe ningún concepto de "solicitud de acceso" en
el backend — AprobarlicitarSolicitudes.tsx (SCRUM-10) trabaja sobre usuarios
que YA se registraron vía Supabase Auth y están sin rol, no sobre una
solicitud previa con motivo/justificación. El mockup nuevo
(panel_de_administracion_sihs_sena/code.html) sí exige eso: motivo
declarado, rol solicitado, estado pendiente/aprobada/rechazada, motivo de
rechazo, fecha de radicado.

Desbloquea [Backend] Endpoints solicitudes-acceso y [Backend] Forzar cambio
de contraseña en primer login, del mismo Epic.

Escrita a mano (no `--autogenerate`) por la misma razón que
2e82e82e30d0: la BD compartida no tiene el `stamp head` del baseline
todavía, así que Alembic rechaza el diff con "Target database is not up to
date". Correr `alembic stamp head` una vez contra la BD antes de aplicar
esta (o cualquier futura) migración.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c51931d849f6'
down_revision: Union[str, Sequence[str], None] = '2e82e82e30d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'usuarios',
        sa.Column('debe_cambiar_clave', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    estado_solicitud_acceso = sa.Enum(
        'pendiente', 'aprobada', 'rechazada', name='estado_solicitud_acceso'
    )
    estado_solicitud_acceso.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'solicitudes_acceso',
        sa.Column('idSolicitud', sa.Integer(), primary_key=True),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('numeroDocumento', sa.String(length=30), nullable=False),
        sa.Column('idRolSolicitado', sa.Integer(), nullable=False),
        sa.Column('motivo', sa.Text(), nullable=False),
        sa.Column(
            'estado',
            estado_solicitud_acceso,
            nullable=False,
            server_default='pendiente',
        ),
        sa.Column('motivoRechazo', sa.Text(), nullable=True),
        sa.Column('fechaSolicitud', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('fechaResolucion', sa.DateTime(timezone=True), nullable=True),
        sa.Column('idAdminResolvio', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ['idRolSolicitado'], ['roles.idRol'], name='solicitudes_acceso_idRolSolicitado_fkey'
        ),
        sa.ForeignKeyConstraint(
            ['idAdminResolvio'], ['usuarios.idUsuario'], name='solicitudes_acceso_idAdminResolvio_fkey',
            ondelete='SET NULL',
        ),
        sa.CheckConstraint(
            "estado != 'rechazada' OR \"motivoRechazo\" IS NOT NULL",
            name='ckMotivoRechazoObligatorio',
        ),
    )
    op.create_index(
        'idxSolicitudesAccesoEstado', 'solicitudes_acceso', ['estado'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idxSolicitudesAccesoEstado', table_name='solicitudes_acceso')
    op.drop_table('solicitudes_acceso')

    estado_solicitud_acceso = sa.Enum(
        'pendiente', 'aprobada', 'rechazada', name='estado_solicitud_acceso'
    )
    estado_solicitud_acceso.drop(op.get_bind(), checkfirst=True)

    op.drop_column('usuarios', 'debe_cambiar_clave')
