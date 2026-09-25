"""agrega tabla puente especialidad_competencia

Revision ID: a7c31f5b9e02
Revises: 2fcba25519cd
Create Date: 2026-09-24 13:10:00.000000

Corrección de la lista de chequeo del V Trimestre (hoja GRUPO 1,
2026-09-04): "Se debe considerar de acuerdo a sus requisitos que el
instructor no se puede asignar a cualquier RA, se deben revisar sus
fortalezas para dicha asignación".

Ya existían las dos mitades del dato — `especialidades` con su puente
`usuario_especialidad` (qué sabe hacer cada instructor) y
`competencias_formacion` → `resultados_aprendizaje` (qué hay que dictar)
— pero nada las unía, así que no había forma de saber si un instructor
tiene la fortaleza que pide un resultado de aprendizaje. Esta tabla es
ese puente: qué especialidades habilitan qué competencia.

Muchos-a-muchos a propósito: una competencia la puede cubrir más de una
especialidad ("Bases de datos" y "Desarrollo backend" habilitan la misma
competencia de persistencia), y una especialidad cubre varias
competencias.

**No rompe la programación existente**: la tabla nace vacía y la
validación que la usa (`HorarioService._validar_fortaleza_instructor`)
solo dice algo cuando la competencia del resultado TIENE al menos una
especialidad asociada acá. Mientras coordinación no mapee nada, crear
horarios se comporta exactamente igual que antes; y cuando mapee, el
resultado es un conflicto forzable más (como RF-011), no un bloqueo.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c31f5b9e02'
down_revision: Union[str, Sequence[str], None] = '2fcba25519cd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'especialidad_competencia',
        sa.Column(
            'idEspecialidad',
            sa.Integer(),
            sa.ForeignKey('especialidades.idEspecialidad', ondelete='CASCADE'),
            primary_key=True,
        ),
        sa.Column(
            'idCompetencia',
            sa.Integer(),
            sa.ForeignKey('competencias_formacion.idCompetencia', ondelete='CASCADE'),
            primary_key=True,
        ),
    )
    # La consulta caliente es "¿qué especialidades habilitan esta
    # competencia?" (una vez por validación de horario), no la inversa:
    # la PK compuesta ya indexa por idEspecialidad primero, así que el
    # índice que falta es el del otro lado.
    op.create_index(
        'ix_especialidad_competencia_idCompetencia',
        'especialidad_competencia',
        ['idCompetencia'],
    )


def downgrade() -> None:
    op.drop_index(
        'ix_especialidad_competencia_idCompetencia',
        table_name='especialidad_competencia',
    )
    op.drop_table('especialidad_competencia')
