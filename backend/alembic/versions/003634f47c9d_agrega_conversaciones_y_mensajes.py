"""agrega tablas conversaciones y mensajes

Revision ID: 003634f47c9d
Revises: d5fb5bdff6fd
Create Date: 2026-09-07 00:00:08.000000

SCRUM-119 (backlog asignado a la cuenta de gestión). Módulo de
Mensajería Instructor ↔ Aprendiz. Mockup
`mensajer_a_de_instructores_rol_aprendiz_sihs_sena/code.html`. 100%
nuevo, sin nada que reusar.

v1: sin websockets/tiempo real (recarga/polling alcanza), sin presencia
en línea real, adjuntos solo como URL de texto, sin canal grupal de
ficha (1 a 1 únicamente).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '003634f47c9d'
down_revision: Union[str, Sequence[str], None] = 'd5fb5bdff6fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'conversaciones',
        sa.Column('idConversacion', sa.Integer(), primary_key=True),
        sa.Column('idAprendiz', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.idUsuario'), nullable=False),
        sa.Column('idInstructor', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.idUsuario'), nullable=False),
        sa.Column('fechaCreacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('idAprendiz', 'idInstructor', name='uqConversacionAprendizInstructor'),
    )
    op.create_index('ix_conversaciones_idConversacion', 'conversaciones', ['idConversacion'])

    op.create_table(
        'mensajes',
        sa.Column('idMensaje', sa.Integer(), primary_key=True),
        sa.Column(
            'idConversacion', sa.Integer(),
            sa.ForeignKey('conversaciones.idConversacion', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('idRemitente', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.idUsuario'), nullable=False),
        sa.Column('contenido', sa.Text(), nullable=False),
        sa.Column('adjuntoUrl', sa.String(length=500), nullable=True),
        sa.Column('leido', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('fechaEnvio', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_mensajes_idMensaje', 'mensajes', ['idMensaje'])


def downgrade() -> None:
    op.drop_index('ix_mensajes_idMensaje', table_name='mensajes')
    op.drop_table('mensajes')
    op.drop_index('ix_conversaciones_idConversacion', table_name='conversaciones')
    op.drop_table('conversaciones')
