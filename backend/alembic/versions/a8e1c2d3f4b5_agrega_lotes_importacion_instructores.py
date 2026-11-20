"""agrega lotes reversibles para importación masiva de instructores

Revision ID: a8e1c2d3f4b5
Revises: f7b812a4d091
"""
from alembic import op
import sqlalchemy as sa


revision = "a8e1c2d3f4b5"
down_revision = "f7b812a4d091"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lotes_importacion_instructores",
        sa.Column("idLote", sa.Uuid(), primary_key=True),
        sa.Column("idAdministrador", sa.Uuid(), nullable=True),
        sa.Column("fechaCreacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["idAdministrador"], ["usuarios.idUsuario"], ondelete="SET NULL"),
    )
    op.add_column("usuarios", sa.Column("idLoteImportacionInstructor", sa.Uuid(), nullable=True))
    op.add_column("usuarios", sa.Column("creadoAuthPorLote", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_foreign_key(
        "fk_usuarios_lote_importacion_instructor",
        "usuarios", "lotes_importacion_instructores",
        ["idLoteImportacionInstructor"], ["idLote"], ondelete="SET NULL",
    )
    op.create_index("ix_usuarios_lote_importacion_instructor", "usuarios", ["idLoteImportacionInstructor"])


def downgrade() -> None:
    op.drop_index("ix_usuarios_lote_importacion_instructor", table_name="usuarios")
    op.drop_constraint("fk_usuarios_lote_importacion_instructor", "usuarios", type_="foreignkey")
    op.drop_column("usuarios", "creadoAuthPorLote")
    op.drop_column("usuarios", "idLoteImportacionInstructor")
    op.drop_table("lotes_importacion_instructores")
