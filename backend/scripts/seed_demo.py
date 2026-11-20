"""Carga el escenario sintético DEMO sin crear, modificar ni borrar Auth.

Las cuatro cuentas se aprovisionan previamente en Supabase Auth. Este script
recibe solo sus UUID por variables de entorno y reconstruye sus perfiles y el
grafo mínimo de aplicación de forma idempotente.
"""
import os
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.demo_seed_service import DemoSeedService


def _ids_auth() -> dict[str, UUID]:
    nombres = {
        "admin": "DEMO_AUTH_ADMIN_ID",
        "coordinador": "DEMO_AUTH_COORDINADOR_ID",
        "instructor": "DEMO_AUTH_INSTRUCTOR_ID",
        "aprendiz": "DEMO_AUTH_APRENDIZ_ID",
    }
    try:
        return {clave: UUID(os.environ[variable]) for clave, variable in nombres.items()}
    except (KeyError, ValueError) as error:
        raise SystemExit("Configura los cuatro DEMO_AUTH_*_ID con UUID de cuentas Auth ya existentes.") from error


def main() -> None:
    if not settings.demo_mode or settings.app_env != "demo":
        raise SystemExit("El seed solo opera con DEMO_MODE=true y APP_ENV=demo.")
    db = SessionLocal()
    try:
        resultado = DemoSeedService.sembrar(db, _ids_auth())
        db.commit()
        print(f"Seed {resultado['version']} aplicado: {resultado['usuarios']} perfiles, {resultado['horarios']} horario publicado.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
