from pydantic_settings import BaseSettings, SettingsConfigDict


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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
