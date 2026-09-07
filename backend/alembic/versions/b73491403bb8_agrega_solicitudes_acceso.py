"""agrega tabla solicitudes_acceso

Revision ID: b73491403bb8
Revises: 840e7dff47f0
Create Date: 2026-09-07 00:00:01.000000

SCRUM-103 (backlog asignado a la cuenta de gestión). Mockup
`panel_de_administracion_sihs_sena/code.html`. Distinto de "usuario sin
rol" (SCRUM-10, `AprobarlicitarSolicitudes.tsx`, opera sobre cuentas que
YA se registraron en Supabase Auth) — modela la solicitud PREVIA a que
exista cuenta, con motivo declarado y trazabilidad de quién la resolvió.

Solo la tabla — los endpoints (crear/listar/aprobar/rechazar) son el
ticket SCRUM-109, aparte.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b73491403bb8'
down_revision: Union[str, Sequence[str], None] = '840e7dff47f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'solicitudes_acceso',
        sa.Column('idSolicitud', sa.Integer(), primary_key=True),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('numeroDocumento', sa.String(length=30), nullable=True),
        sa.Column('idRolSolicitado', sa.Integer(), sa.ForeignKey('roles.idRol'), nullable=False),
        sa.Column('motivo', sa.Text(), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False, server_default='pendiente'),
        sa.Column('motivoRechazo', sa.Text(), nullable=True),
        sa.Column('fechaSolicitud', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('fechaResolucion', sa.DateTime(timezone=True), nullable=True),
        sa.Column('idAdminResolvio', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.idUsuario'), nullable=True),
    )
    op.create_index('ix_solicitudes_acceso_idSolicitud', 'solicitudes_acceso', ['idSolicitud'])


def downgrade() -> None:
    op.drop_index('ix_solicitudes_acceso_idSolicitud', table_name='solicitudes_acceso')
    op.drop_table('solicitudes_acceso')
