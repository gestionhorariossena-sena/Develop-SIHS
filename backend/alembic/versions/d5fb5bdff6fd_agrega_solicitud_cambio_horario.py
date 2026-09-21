"""agrega tabla solicitud_cambio_horario

Revision ID: d5fb5bdff6fd
Revises: 36cc5d3be997
Create Date: 2026-09-07 00:00:07.000000

SCRUM-116 (backlog asignado a la cuenta de gestión). Solicitudes de
cambio/permuta de horario para instructores — gap ya documentado en
backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md, confirmado por los mockups
nuevos de instructor (botones "Reportar Novedad", "Radicar Solicitud de
Cambio o Novedad", "Solicitar Novedad o Permuta").

v1: solo backend de la solicitud y su resolución (aprobar/rechazar) — no
mueve datos reales de `horarios` al aprobar, porque el ticket no define
un campo estructurado de "destino" (solo `motivo` en texto libre). El
frontend (formulario, badge de contador) es otro ticket aparte.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd5fb5bdff6fd'
down_revision: Union[str, Sequence[str], None] = '36cc5d3be997'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'solicitud_cambio_horario',
        sa.Column('idSolicitud', sa.Integer(), primary_key=True),
        sa.Column('idInstructor', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.idUsuario'), nullable=False),
        sa.Column('idHorarioOrigen', sa.Integer(), sa.ForeignKey('horarios.idHorario'), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('motivo', sa.String(length=1000), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False, server_default='pendiente'),
        sa.Column('fechaSolicitud', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('fechaResolucion', sa.DateTime(timezone=True), nullable=True),
        sa.Column('idAdminResolvio', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.idUsuario'), nullable=True),
    )
    op.create_index('ix_solicitud_cambio_horario_idSolicitud', 'solicitud_cambio_horario', ['idSolicitud'])


def downgrade() -> None:
    op.drop_index('ix_solicitud_cambio_horario_idSolicitud', table_name='solicitud_cambio_horario')
    op.drop_table('solicitud_cambio_horario')
