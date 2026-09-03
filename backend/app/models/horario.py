from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, Table, Time, func, true
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base

# Tabla puente horario_dia: igual que usuario_especialidad, sin columnas
# propias más allá de las dos FK — no necesita su propio
# model/repository/service.
horario_dia = Table(
    "horario_dia",
    Base.metadata,
    Column("idHorario", Integer, ForeignKey("horarios.idHorario", ondelete="CASCADE"), primary_key=True),
    Column("idDia", Integer, ForeignKey("diasDeLaSemana.idDia"), primary_key=True),
)


class Horario(Base):
    """El módulo objetivo del proyecto: crear esto detectando cruces de
    ficha/instructor/ambiente solapados, más las reglas de RF-011 (tope de
    horas/semana por tipo de contrato, jornada Noche vedada para planta,
    y centro de formación en jornadas continuas). Ver
    _Docs/Documentación general/REGLAS_DE_NEGOCIO_CONOCIDAS.md y
    _Docs/Informes de requisitos/Requisitos Funcionales V4.pdf (RF-011) —
    las validaciones viven en HorarioService, no acá."""

    __tablename__ = "horarios"
    __table_args__ = (
        CheckConstraint('"horaFin" > "horaInicio"', name="horaFinDespuesDeInicio"),
    )

    idHorario = Column(Integer, primary_key=True, index=True)
    horaInicio = Column(Time, nullable=False)
    horaFin = Column(Time, nullable=False)

    idJornada = Column(Integer, ForeignKey("jornadas.idJornada"), nullable=False)
    idTrimestre = Column(Integer, ForeignKey("trimestres.idTrimestre"), nullable=False)
    idAmbiente = Column(Integer, ForeignKey("ambientes.idAmbiente"), nullable=False)
    idInstructor = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)
    idFicha = Column(Integer, ForeignKey("fichas.idFicha"), nullable=False)
    idResultado = Column(Integer, ForeignKey("resultados_aprendizaje.idResultado"), nullable=False)

    # Habilitan el backlog de Historial de horarios (pedido 2026-09-03):
    # ordenar por más reciente y desactivar sin borrar. fechaModificacion
    # se actualiza sola en cada UPDATE — no hace falta tocarla a mano en
    # HorarioService.actualizar().
    fechaCreacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fechaModificacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    activo = Column(Boolean, server_default=true(), nullable=False)

    instructor = relationship("Usuario")
    ficha = relationship("Ficha")
    ambiente = relationship("Ambiente")
    resultado = relationship("ResultadoAprendizaje")
