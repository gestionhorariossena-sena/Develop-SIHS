import logging
from contextlib import asynccontextmanager
from threading import Event, Thread

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.health import router as health_router
from app.api.v1.roles import router as roles_router
from app.api.v1.usuario_rol import router as usuario_rol_router
from app.api.v1.usuarios import router as usuarios_router
from app.core.config import settings
from app.workers.publicacion_programada_worker import run_worker
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
from app.api.v1.ficha_usuario import router as ficha_usuario_router
from app.api.v1.guias import router as guias_router
from app.api.v1.competencias_formacion import router as competencias_formacion_router
from app.api.v1.resultados_aprendizaje import router as resultados_aprendizaje_router
from app.api.v1.tematicas import router as tematicas_router
from app.api.v1.horarios import router as horarios_router
from app.api.v1.actividades_aprendizaje import router as actividades_aprendizaje_router
from app.api.v1.asistencias import router as asistencias_router
from app.api.v1.auditoria import router as auditoria_router
from app.api.v1.notificaciones import router as notificaciones_router
from app.api.v1.mensajeria import router as mensajeria_router
from app.api.v1.anotaciones_horario import router as anotaciones_horario_router
from app.api.v1.avisos import router as avisos_router
from app.api.v1.solicitudes_acceso import router as solicitudes_acceso_router
from app.api.v1.publicaciones_programadas import router as publicaciones_programadas_router
from app.api.v1.solicitudes_cambio_horario import router as solicitudes_cambio_horario_router
from app.api.v1.solicitudes_acceso import router as solicitudes_acceso_router


_worker_stop_event = Event()


def _run_embedded_publication_worker() -> None:
    logger = logging.getLogger("sihs.publicacion_worker")
    while not _worker_stop_event.is_set():
        try:
            run_worker(stop_event=_worker_stop_event)
        except Exception:
            logger.exception("El worker embebido se detuvo inesperadamente; reintentando en 5 s")
            if _worker_stop_event.wait(5):
                return


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker_thread = None
    if settings.embedded_publication_worker:
        _worker_stop_event.clear()
        worker_thread = Thread(
            target=_run_embedded_publication_worker,
            name="sihs-publicacion-worker",
            daemon=True,
        )
        worker_thread.start()
        logging.getLogger("uvicorn.error").info(
            "Worker embebido de publicaciones programadas habilitado"
        )

    try:
        yield
    finally:
        if worker_thread is not None:
            _worker_stop_event.set()
            worker_thread.join(timeout=10)


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# La capa de IA es opcional: sin clave el sistema funciona completo, pero el
# asistente de programación no puede importar un Excel. Avisarlo al arrancar
# evita descubrirlo recién al usarlo, con un 503 en mitad del flujo.
if not settings.gemini_api_key:
    logging.getLogger("uvicorn.error").warning(
        "GEMINI_API_KEY no está configurada: el asistente de programación "
        "responderá 503 al importar un Excel. Revisa backend/.env"
    )

@app.middleware("http")
async def convertir_errores_no_manejados(request: Request, call_next):
    """Convierte cualquier excepción no manejada en un 500 con cuerpo JSON.

    Sin esto, la excepción sube hasta el ServerErrorMiddleware de
    Starlette y la respuesta sale SIN pasar por CORSMiddleware: el
    navegador ve un cuerpo sin Access-Control-Allow-Origin, `fetch` lanza
    un TypeError, y la pantalla muestra "No se pudo conectar con el
    servidor. Revisa tu conexión" -- culpando a la red de un error del
    servidor que sí ocurrió y sí quedó en el log. Encontrado en vivo el
    2026-09-24: el paso 4 del asistente fallaba así en TODOS sus bloques
    porque `especialidad_competencia` no existía en la base (migración
    a7c31f5b9e02 sin aplicar), y el mensaje mandaba al coordinador a
    revisar su wifi.

    Va como middleware y NO como `@app.exception_handler(Exception)`
    justo por eso: los exception handlers corren en el
    ServerErrorMiddleware, que envuelve a CORSMiddleware desde afuera, y
    su respuesta tampoco recibiría los headers. Se registra ANTES que
    CORS a propósito -- `add_middleware` inserta al principio, así que lo
    último registrado queda por fuera, y este tiene que quedar por
    dentro para que CORS alcance a decorar su respuesta.

    El detalle real va al log del servidor, no a la respuesta: quien usa
    la app no puede hacer nada con un traceback, y exponerlo filtra la
    estructura interna."""
    try:
        return await call_next(request)
    except Exception:
        logging.getLogger("uvicorn.error").exception(
            "Error no manejado en %s %s", request.method, request.url.path
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "El servidor tuvo un problema procesando esta solicitud."},
        )


# Desarrollo: acepta cualquier puerto de localhost (Vite salta al siguiente
# puerto libre — 5174, 5175... — si 5173 ya está ocupado por otro proyecto).
# Producción: además de FRONTEND_URL, se aceptan SOLO los dominios Vercel del
# proyecto SIHS. Vercel usa un dominio estable para producción y dominios
# derivados del nombre de rama para previews; exigir una única URL exacta
# hacía que un redeploy/preview válido fallara como TypeError de red.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"http://(localhost|127\.0\.0\.1):\d+"
        r"|https://(?:proyectosihs|proyecto-sihs)(?:-[a-z0-9-]+)?\.vercel\.app"
    ),
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
app.include_router(ficha_usuario_router, prefix="/api/v1")
app.include_router(guias_router, prefix="/api/v1")
app.include_router(competencias_formacion_router, prefix="/api/v1")
app.include_router(resultados_aprendizaje_router, prefix="/api/v1")
app.include_router(tematicas_router, prefix="/api/v1")
app.include_router(horarios_router, prefix="/api/v1")
app.include_router(actividades_aprendizaje_router, prefix="/api/v1")
app.include_router(asistencias_router, prefix="/api/v1")
app.include_router(auditoria_router, prefix="/api/v1")
app.include_router(notificaciones_router, prefix="/api/v1")
app.include_router(mensajeria_router, prefix="/api/v1")
app.include_router(anotaciones_horario_router, prefix="/api/v1")
app.include_router(avisos_router, prefix="/api/v1")
app.include_router(solicitudes_cambio_horario_router, prefix="/api/v1")
app.include_router(solicitudes_acceso_router, prefix="/api/v1")
app.include_router(publicaciones_programadas_router, prefix="/api/v1")
