from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Ambiente(Base):
    __tablename__ = "ambientes"
    __table_args__ = (
        UniqueConstraint("numeroAmbiente", "idSede", name="uqAmbienteNumeroSede"),
        CheckConstraint('"tipoAmbiente" IN (\'regular\', \'especial\')', name="ckTipoAmbiente"),
        CheckConstraint('"estadoAmbiente" IN (\'disponible\', \'mantenimiento\', \'inactivo\')', name="ckEstadoAmbiente"),
        CheckConstraint('"tipoAmbiente" = \'especial\' OR "nombreAmbiente" = \'Ambiente\'', name="nombreAmbienteRegular"),
    )

    id: Mapped[int] = mapped_column("idAmbiente", Integer, primary_key=True)
    numero_ambiente: Mapped[int] = mapped_column("numeroAmbiente", Integer, nullable=False)
    nombre: Mapped[str] = mapped_column("nombreAmbiente", String(100), nullable=False)
    tipo_ambiente: Mapped[str] = mapped_column("tipoAmbiente", String(20), nullable=False)
    estado_ambiente: Mapped[str] = mapped_column("estadoAmbiente", String(30), nullable=False, default="disponible")
    sede_id: Mapped[int] = mapped_column("idSede", ForeignKey("sedes.idSede"), nullable=False)

    # Ficha técnica del ambiente — mockup
    # detalle_de_franja_y_ambiente_sihs_sena/code.html. Todas nullable a
    # propósito, se completan a mano con el import real; el inventario
    # técnico detallado (marca de equipos, conectividad) queda fuera de
    # alcance -- el propio mockup lo marca "Dato Conceptual / En Evaluación".
    piso: Mapped[str | None] = mapped_column("piso", String(30), nullable=True)
    capacidad: Mapped[int | None] = mapped_column("capacidad", Integer, nullable=True)
    especialidad_sala: Mapped[str | None] = mapped_column("especialidadSala", String(100), nullable=True)
    responsable_llaves: Mapped[str | None] = mapped_column("responsableLlaves", String(100), nullable=True)

    sede: Mapped["Sede"] = relationship(back_populates="ambientes")


from app.models.sede import Sede
