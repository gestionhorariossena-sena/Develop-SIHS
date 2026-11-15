import os
from pathlib import Path
from urllib.parse import urlparse

from pydantic import model_validator
from sqlalchemy.engine import make_url

from pydantic_settings import BaseSettings, SettingsConfigDict

# Ruta absoluta a backend/.env, calculada desde este archivo y NO desde el
# directorio de trabajo. Con `env_file=".env"` a secas, arrancar el servidor
# desde la raíz del monorepo (`uvicorn app.main:app` en vez de hacerlo dentro
# de backend/) levantaba la API igual pero sin leer ninguna variable: como
# todos los campos de abajo tienen un valor por defecto vacío, no fallaba
# nada al arrancar y el problema solo aparecía mucho después, en forma de
# "GEMINI_API_KEY no está configurada" al usar el asistente, o de una
# conexión a una base de datos local inexistente.
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_SELECTED = os.getenv("SIHS_ENV_FILE", "").strip()
if _SELECTED and _SELECTED not in (".env.demo", ".env.institucional"):
    raise RuntimeError("SIHS_ENV_FILE debe ser .env.demo o .env.institucional")
_ARCHIVO_ENV = _BACKEND_DIR / (_SELECTED or ".env")
if _SELECTED and not _ARCHIVO_ENV.is_file():
    raise RuntimeError(f"Falta backend/{_SELECTED}; configura las variables locales")


def _ref_supabase(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host.endswith(".supabase.co"):
        raise ValueError("SUPABASE_URL debe ser HTTPS de un proyecto Supabase")
    ref = host.removesuffix(".supabase.co")
    if not ref or "." in ref:
        raise ValueError("Proyecto Supabase no válido")
    return ref


def _ref_database(url: str) -> str:
    parsed = make_url(url)
    if not (parsed.host or "").endswith(".pooler.supabase.com"):
        raise ValueError("La base local seleccionada debe utilizar un pooler Supabase")
    username = parsed.username or ""
    if not username.startswith("postgres.") or len(username) <= 9:
        raise ValueError("La conexión debe identificar postgres.<project-ref>")
    return username.removeprefix("postgres.")



class Settings(BaseSettings):
    app_name: str = "SIHS API"
    app_env: str = "development"

    # Conexión de runtime (transaction pooler de Supabase, puerto 6543)
    database_url: str = "postgresql+psycopg://usuario:contrasena@localhost:5432/sihs"
    # Conexión para Alembic (session pooler, puerto 5432 — DDL necesita modo sesión)
    alembic_database_url: str = ""

    supabase_url: str = ""
    supabase_anon_key: str = ""
    # Secreta: solo para tareas admin del backend, jamás se expone al frontend
    supabase_service_role_key: str = ""

    # URL del frontend desplegado (ej. https://sihs.vercel.app), para permitirle
    # llamar al backend por CORS además de localhost. Vacía en desarrollo local.
    frontend_url: str = ""

    # Render Free no ofrece background worker gratuito. Cuando está activo,
    # FastAPI inicia el worker de publicaciones en un hilo del mismo proceso.
    # Se mantiene opt-in para poder migrar a un worker dedicado sin duplicarlo.
    embedded_publication_worker: bool = False

    # SMTP de la cuenta de Gmail de gestión — mismas credenciales que el
    # ticket de recuperación de contraseña (Epic SCRUM-96). Vacío hasta que
    # ese ticket configure la cuenta; EmailService falla explícito mientras
    # tanto en vez de fallar en silencio. smtp_password es la "contraseña de
    # aplicación" de Gmail, no la contraseña normal de la cuenta.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_nombre: str = "SIHS SENA — Gestión de Horarios"

    # Gemini API (Google AI Studio) — capa de IA opcional, ver
    # _Docs/Arquitectura/Arquitectura_IA_Motor_Horarios.md. Vacía por
    # defecto: el sistema funciona completo sin esto configurado.
    gemini_api_key: str = ""

    @model_validator(mode="after")
    def validar_entorno(self):
        if not _SELECTED:
            return self  # No alterar despliegues existentes.
        nombre = _SELECTED.removeprefix(".env.")
        if self.app_env != nombre:
            raise ValueError(f"APP_ENV debe ser {nombre}")
        ref = _ref_supabase(self.supabase_url)
        if _ref_database(self.database_url) != ref:
            raise ValueError("DATABASE_URL apunta a otro proyecto Supabase")
        if _ref_database(self.alembic_database_url) != ref:
            raise ValueError("ALEMBIC_DATABASE_URL apunta a otro proyecto Supabase")
        if not self.supabase_anon_key:
            raise ValueError("Falta SUPABASE_ANON_KEY")
        if nombre == "institucional" and os.getenv("SIHS_ALLOW_INSTITUTIONAL") != "1":
            raise ValueError("Inicio institucional bloqueado: usa el selector")
        return self

    model_config = SettingsConfigDict(env_file=_ARCHIVO_ENV, env_file_encoding="utf-8", extra="ignore")


settings = Settings()
