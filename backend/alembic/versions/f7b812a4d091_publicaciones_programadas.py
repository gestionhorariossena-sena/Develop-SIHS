"""Agrega programación persistente de publicaciones de horarios.

Revision ID: f7b812a4d091
Revises: c9d4e1f70a33

Esta migración se prepara para revisión; no debe ejecutarse contra la base
compartida hasta tener autorización de despliegue.
"""
from alembic import op
import sqlalchemy as sa

revision = "f7b812a4d091"
down_revision = "c9d4e1f70a33"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "publicaciones_programadas",
        sa.Column("idPublicacion", sa.Integer(), primary_key=True),
        sa.Column("idTrimestre", sa.Integer(), nullable=False),
        sa.Column("idCoordinador", sa.Uuid(), nullable=False),
        sa.Column("fechaEjecucion", sa.DateTime(timezone=True), nullable=False),
        sa.Column("estado", sa.String(length=30), server_default="pendiente", nullable=False),
        sa.Column("fechaCreacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("fechaEjecucionReal", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resultado", sa.Text(), nullable=True),
        sa.Column("revision", sa.Integer(), server_default="1", nullable=False),
        sa.CheckConstraint(
            "estado IN ('pendiente', 'ejecutando', 'publicada', 'fallida', 'cancelada', 'revision_requerida')",
            name="ck_publicaciones_programadas_estado",
        ),
        sa.ForeignKeyConstraint(["idTrimestre"], ["trimestres.idTrimestre"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["idCoordinador"], ["usuarios.idUsuario"], ondelete="RESTRICT"),
    )
    op.create_index(
        "ix_publicaciones_programadas_estado_fecha",
        "publicaciones_programadas", ["estado", "fechaEjecucion"],
    )
    op.create_table(
        "publicacion_programada_horarios",
        sa.Column("idPublicacion", sa.Integer(), nullable=False),
        sa.Column("idHorario", sa.Integer(), nullable=False),
        sa.Column("huellaRevision", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("idPublicacion", "idHorario"),
        sa.ForeignKeyConstraint(
            ["idPublicacion"], ["publicaciones_programadas.idPublicacion"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["idHorario"], ["horarios.idHorario"], ondelete="RESTRICT"),
    )
    op.create_index(
        "ix_publicacion_programada_horarios_horario",
        "publicacion_programada_horarios", ["idHorario"],
    )


def downgrade() -> None:
    op.drop_index("ix_publicacion_programada_horarios_horario", table_name="publicacion_programada_horarios")
    op.drop_table("publicacion_programada_horarios")
    op.drop_index("ix_publicaciones_programadas_estado_fecha", table_name="publicaciones_programadas")
    op.drop_table("publicaciones_programadas")
