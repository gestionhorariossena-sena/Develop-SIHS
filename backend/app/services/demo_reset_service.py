"""Reset de los datos sintéticos del escenario DEMO; Auth queda fuera."""
from uuid import UUID

from app.core.config import settings
from app.models.ambiente import Ambiente
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.guia import Guia
from app.models.horario import Horario
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario
from app.services.demo_seed_service import CUENTAS_DEMO, DemoSeedService


class DemoResetService:
    @staticmethod
    def ids_auth_desde_configuracion() -> dict[str, UUID]:
        variables = {
            "admin": settings.demo_auth_admin_id,
            "coordinador": settings.demo_auth_coordinador_id,
            "instructor": settings.demo_auth_instructor_id,
            "aprendiz": settings.demo_auth_aprendiz_id,
        }
        try:
            return {rol: UUID(valor) for rol, valor in variables.items()}
        except ValueError as error:
            raise ValueError("Faltan UUID válidos DEMO_AUTH_*_ID de cuentas Auth preaprovisionadas.") from error

    @staticmethod
    def resetear(db) -> dict[str, int | str]:
        """Elimina exclusivamente el grafo identificado como DEMO y lo siembra.

        No hay llamadas HTTP ni SQL sobre ``auth.users``: las cuentas Auth
        sobreviven, mientras sus perfiles de aplicación se recrean con los
        mismos UUID dentro de una única transacción de la sesión.
        """
        ids_auth = DemoResetService.ids_auth_desde_configuracion()
        ficha = db.query(Ficha).filter(Ficha.codigoFicha == "DEMO-ADSO-01").one_or_none()
        eliminados = {"horarios": 0, "fichas": 0, "usuarios": 0}
        if ficha:
            eliminados["horarios"] = db.query(Horario).filter(Horario.idFicha == ficha.idFicha).delete(synchronize_session=False)
            db.query(FichaUsuario).filter(FichaUsuario.idFicha == ficha.idFicha).delete(synchronize_session=False)
            eliminados["fichas"] = db.query(Ficha).filter(Ficha.idFicha == ficha.idFicha).delete(synchronize_session=False)
        db.query(ResultadoAprendizaje).filter(ResultadoAprendizaje.codigo == "RA-DEMO-01").delete(synchronize_session=False)
        db.query(Guia).filter(Guia.codigo == "G-DEMO-01").delete(synchronize_session=False)
        db.query(CompetenciaFormacion).filter(CompetenciaFormacion.codigo == "C-DEMO-01").delete(synchronize_session=False)
        db.query(Programa).filter(Programa.codigoPrograma == "DEMO-ADSO").delete(synchronize_session=False)
        db.query(Ambiente).filter(Ambiente.numero_ambiente == 101).delete(synchronize_session=False)
        db.query(Sede).filter(Sede.nombre == "Sede DEMO").delete(synchronize_session=False)
        db.query(Trimestre).filter(Trimestre.nombre == "DEMO-2026").delete(synchronize_session=False)
        correos = [datos[1] for datos in CUENTAS_DEMO.values()]
        eliminados["usuarios"] = db.query(Usuario).filter(Usuario.email.in_(correos)).delete(synchronize_session=False)
        db.flush()
        sembrado = DemoSeedService.sembrar(db, ids_auth)
        return {**eliminados, **sembrado}
