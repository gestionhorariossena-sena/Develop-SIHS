"""agrega numeroFase a competencias_formacion y faseActual a fichas

Revision ID: 2fcba25519cd
Revises: 003634f47c9d
Create Date: 2026-09-10 00:00:00.000000

Ver PLAN_INTEGRACION_IA.md, sección "Fases del pénsum". El generador de
horarios trataba TODOS los resultados de aprendizaje pendientes de una
ficha como si tocaran programar esta misma semana, sin importar a qué
fase (TRIM I..IV) del pénsum de 2 años pertenece cada uno -- con
programas reales eso vuelve el modelo infactible (ver commit del fix de
`generar_horario`, ese era otro bug distinto: éste es de datos, no de
rendimiento).

`numeroFase` en resultados_aprendizaje: la fase del pénsum en la que se
dicta (1=TRIM I .. 4=TRIM IV), tomada del nombre de la hoja del Excel
real de planeación pedagógica cuando trae hojas separadas por
trimestre. Va en el resultado, no en la competencia, porque el Excel
real muestra el mismo resultado repetido en dos fases consecutivas
(se dicta progresivamente). Nullable porque no todos los currículos
importados hasta ahora la traen (import previo desde la hoja plana
"Planeacion Cadena").

`faseActual` en fichas: en qué fase de SU PROPIO pénsum va la ficha
ahora mismo. v1 deliberadamente manual (lo llena el coordinador, igual
que Sede/fechas hoy) -- no hay ningún archivo real que traiga este dato
por ficha todavía. Nullable: si queda vacío, `generar_propuesta` no
filtra por fase (mismo comportamiento que antes de este cambio).

Igual que las migraciones anteriores: escrita a mano porque la BD
compartida sigue sin `alembic stamp head` para el baseline.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2fcba25519cd'
down_revision: Union[str, Sequence[str], None] = '003634f47c9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('resultados_aprendizaje', sa.Column('numeroFase', sa.Integer(), nullable=True))
    op.add_column('fichas', sa.Column('faseActual', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('fichas', 'faseActual')
    op.drop_column('resultados_aprendizaje', 'numeroFase')
