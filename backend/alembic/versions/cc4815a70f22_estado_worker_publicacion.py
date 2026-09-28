"""Añade señal de disponibilidad del worker de publicaciones programadas."""
from alembic import op
import sqlalchemy as sa


revision = "cc4815a70f22"
down_revision = "f7b812a4d091"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "worker_publicacion_estado",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ultimaSenal", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_worker_publicacion_estado_singleton"),
    )


def downgrade() -> None:
    op.drop_table("worker_publicacion_estado")
