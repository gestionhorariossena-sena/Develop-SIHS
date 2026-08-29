from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as health_router
from app.api.v1.roles import router as roles_router
from app.api.v1.usuario_rol import router as usuario_rol_router
from app.api.v1.usuarios import router as usuarios_router
from app.core.config import settings
from app.api.v1.dias_semana import router as dias_semana_router
from app.api.v1.especialidades import router as especialidades_router
from app.api.v1.jornadas import router as jornadas_router
from app.api.v1.sedes import router as sedes_router
from app.api.v1.ambientes import router as ambientes_router
from app.api.v1.horarios_guardados import router as horarios_guardados_router
from app.api.v1.coordinaciones import router as coordinaciones_router
from app.api.v1.programas import router as programas_router
from app.api.v1.trimestres import router as trimestres_router
from app.api.v1.fichas import router as fichas_router
from app.api.v1.guias import router as guias_router
from app.api.v1.competencias_formacion import router as competencias_formacion_router
from app.api.v1.resultados_aprendizaje import router as resultados_aprendizaje_router
from app.api.v1.horarios import router as horarios_router
from app.api.v1.actividades_aprendizaje import router as actividades_aprendizaje_router


app = FastAPI(title=settings.app_name)

# Desarrollo: acepta cualquier puerto de localhost (Vite salta al siguiente
# puerto libre — 5174, 5175... — si 5173 ya está ocupado por otro proyecto,
# así que fijar un solo puerto rompe el CORS en silencio). En producción se
# suma la URL real del frontend desplegado vía la variable FRONTEND_URL.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_origins=[settings.frontend_url] if settings.frontend_url else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")
app.include_router(roles_router, prefix="/api/v1")
app.include_router(usuario_rol_router, prefix="/api/v1")
app.include_router(dias_semana_router, prefix="/api/v1")
app.include_router(especialidades_router, prefix="/api/v1")
app.include_router(jornadas_router, prefix="/api/v1")
app.include_router(sedes_router, prefix="/api/v1")
app.include_router(ambientes_router, prefix="/api/v1")
app.include_router(horarios_guardados_router, prefix="/api/v1")
app.include_router(coordinaciones_router, prefix="/api/v1")
app.include_router(programas_router, prefix="/api/v1")
app.include_router(trimestres_router, prefix="/api/v1")
app.include_router(fichas_router, prefix="/api/v1")
app.include_router(guias_router, prefix="/api/v1")
app.include_router(competencias_formacion_router, prefix="/api/v1")
app.include_router(resultados_aprendizaje_router, prefix="/api/v1")
app.include_router(horarios_router, prefix="/api/v1")
app.include_router(actividades_aprendizaje_router, prefix="/api/v1")
