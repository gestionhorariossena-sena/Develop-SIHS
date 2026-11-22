"""Altas de instructores por gestión; la cuenta no requiere registro público."""
import io
import csv
import unicodedata
import logging
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
import httpx
from pydantic import BaseModel, EmailStr, Field, ValidationError, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.supabase_auth import require_admin_o_coordinador
from app.models.usuario import Usuario
from app.repositories.usuario_repository import UsuarioRepository
from app.models.rol import Rol
from app.services.auditoria_service import AuditoriaService
from app.services.email_service import EmailService
from app.services.supabase_admin_service import crear_o_recuperar_usuario_supabase, buscar_usuario_supabase_por_email

router = APIRouter(prefix="/instructores/alta", tags=["alta-instructores"])
logger = logging.getLogger("sihs.alta_instructores")
MAX_ARCHIVO_BYTES = 2 * 1024 * 1024
MAX_FILAS = 200
COLUMNAS = ("nombre", "correo", "documento", "contrato", "horas")
ALIAS_COLUMNAS = {
    "tipocontrato": "contrato",
    "horascontratadassemana": "horas",
    "email": "correo",
}



class InstructorAlta(BaseModel):
    nombre: str = Field(min_length=3, max_length=100)
    correo: EmailStr
    documento: str = Field(min_length=4, max_length=30)
    tipoContrato: str | None = Field(default=None, max_length=20)
    horasContratadasSemana: int | None = Field(default=None, ge=1, le=60)
    sigla: str | None = Field(default=None, max_length=10)

    @field_validator("nombre", "documento", "tipoContrato", "sigla", mode="before")
    @classmethod
    def limpiar(cls, value):
        return value.strip() if isinstance(value, str) else value


def _smtp_disponible():
    if not EmailService.smtp_configurado():
        raise HTTPException(
            503, {"motivo": "smtp", "mensaje": "No está configurado el correo para enviar invitaciones. Si estás en Docker demo, reinicia la configuración SMTP local."},
        )


@router.get("/diagnostico")
def diagnosticar_alta(actor: Usuario = Depends(require_admin_o_coordinador)):
    """Solo configuración, sin exponer credenciales ni consultar cuentas de terceros."""
    return {
        "smtpConfigurado": EmailService.smtp_configurado(),
        "modoDemo": settings.app_env == "demo",
        "supabaseConfigurado": bool(settings.supabase_url and settings.supabase_service_role_key),
    }

def _alta(db: Session, datos: InstructorAlta, actor: Usuario) -> dict:
    correo = str(datos.correo).strip().lower()
    # Nunca cambiar contraseñas ni asignar permisos a cuentas ya existentes.
    if UsuarioRepository.obtener_por_email(db, correo) or UsuarioRepository.obtener_por_numero_documento(db, datos.documento):
        return {"correo": correo, "estado": "omitido", "detalle": "Ya existe un usuario con ese correo o documento."}
    if buscar_usuario_supabase_por_email(correo):
        return {"correo": correo, "estado": "omitido", "detalle": "El correo ya tiene una cuenta de acceso."}

    clave = secrets.token_urlsafe(18)
    auth, creado = crear_o_recuperar_usuario_supabase(correo, clave)
    if not creado:
        return {"correo": correo, "estado": "omitido", "detalle": "El correo ya tiene una cuenta de acceso."}

    try:
        rol = db.query(Rol).filter(Rol.nombre == "Instructor").first()
        if rol is None:
            raise RuntimeError("No existe el rol Instructor.")
        usuario = Usuario(
            idUsuario=UUID(auth["id"]), nombre=datos.nombre, email=correo,
            numeroDocumento=datos.documento, tipoContrato=datos.tipoContrato,
            horasContratadasSemana=datos.horasContratadasSemana, sigla=datos.sigla,
            debeCambiarClave=True,
        )
        usuario.roles.append(rol)
        db.add(usuario)
        db.flush()
        AuditoriaService.registrar_transaccional(
            db, usuario=actor, accion="CREAR_INSTRUCTOR", entidad="usuarios",
            id_entidad=usuario.idUsuario, detalle="Alta administrativa de instructor",
        )
        db.commit()
    except Exception:
        db.rollback()
        # No borrar automáticamente identidades de Supabase: la recuperación
        # administrativa evita destruir una cuenta que pueda haberse usado.
        logger.exception("Cuenta de Supabase creada pero perfil SIHS no pudo guardarse")
        return {"correo": correo, "estado": "requiere_revision", "detalle": "La cuenta de acceso se creó, pero el perfil no pudo completarse. Contacta soporte."}

    try:
        EmailService.enviar_alta_instructor(
            destinatario_email=correo, destinatario_nombre=datos.nombre,
            password_temporal=clave,
        )
    except Exception:
        logger.exception("No se pudo enviar invitación al instructor %s", correo)
        return {"correo": correo, "estado": "correo_pendiente", "detalle": "La cuenta existe, pero falló el correo. Indica al instructor que use Recuperar contraseña o solicita asistencia."}
    return {"correo": correo, "estado": "creado", "detalle": "Invitación enviada al correo institucional."}


@router.post("/")
def alta_individual(datos: InstructorAlta, db: Session = Depends(get_db), actor: Usuario = Depends(require_admin_o_coordinador)):
    _smtp_disponible()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(503, {"motivo": "supabase", "mensaje": "Faltan las variables de Supabase Auth del backend. Comprueba la configuración de Docker demo."})
    try:
        return _alta(db, datos, actor)
    except httpx.HTTPStatusError as exc:
        logger.exception("Supabase Admin rechazó el alta de instructor")
        estado = exc.response.status_code
        detalle = (
            "Supabase Auth rechazó las credenciales administrativas. Comprueba SUPABASE_SERVICE_ROLE_KEY y SUPABASE_URL."
            if estado in (401, 403) else
            "Supabase Auth devolvió un error. Comprueba que el servicio local esté iniciado y las variables de Docker correspondan al mismo proyecto."
        )
        raise HTTPException(503, {"motivo": "supabase", "mensaje": detalle}) from exc
    except (httpx.RequestError, ValueError, KeyError) as exc:
        logger.exception("Falló la conexión o respuesta de Supabase Admin")
        raise HTTPException(503, {"motivo": "supabase", "mensaje": "No se pudo conectar con Supabase Auth. Revisa DEMO_SUPABASE_INTERNAL_URL, la clave de servicio y que Supabase local esté iniciado."}) from exc
    except Exception as exc:
        logger.exception("Falló el alta de instructor")
        raise HTTPException(500, "El alta falló por un error interno. Consulta el log de Docker para identificar la causa.") from exc


def _normalizar_encabezado(valor: str) -> str:
    """Acepta espacios, guiones bajos, acentos y variaciones de mayúsculas."""
    descompuesto = unicodedata.normalize("NFKD", valor.strip().casefold())
    sin_acentos = "".join(c for c in descompuesto if not unicodedata.combining(c))
    compacto = "".join(c for c in sin_acentos if c.isalnum())
    return ALIAS_COLUMNAS.get(compacto, compacto)


def _texto_csv(contenido: bytes) -> str:
    try:
        return contenido.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            return contenido.decode("cp1252")
        except UnicodeDecodeError:
            return contenido.decode("latin-1")


def _leer_csv(contenido: bytes) -> list[dict]:
    texto = _texto_csv(contenido)
    if not texto.strip():
        raise HTTPException(422, "El CSV está vacío.")

    # Probar ambos separadores con un lector CSV real; gana el encabezado
    # con más columnas reconocibles. Esto respeta comillas y saltos de línea.
    opciones = []
    for separador in (",", ";"):
        try:
            encabezado = next(csv.reader(io.StringIO(texto, newline=""), delimiter=separador, strict=True), [])
        except csv.Error as exc:
            raise HTTPException(422, "El encabezado CSV tiene comillas mal formadas.") from exc
        columnas = [_normalizar_encabezado(x) for x in encabezado]
        conocidas = sum(col in (*COLUMNAS, "sigla") for col in columnas)
        opciones.append((conocidas, len(columnas), separador, columnas))
    _, _, separador, columnas = max(opciones, key=lambda opcion: (opcion[0], opcion[1]))
    faltantes = [col for col in COLUMNAS if col not in columnas]
    if faltantes:
        raise HTTPException(
            422, "Faltan columnas requeridas: " + ", ".join(faltantes)
            + ". Usa nombre,correo,documento,contrato,horas,sigla.",
        )
    if len(columnas) != len(set(columnas)):
        raise HTTPException(422, "El CSV contiene encabezados duplicados o equivalentes.")

    filas: list[dict] = []
    correos_vistos: set[str] = set()
    documentos_vistos: set[str] = set()
    try:
        lector = csv.reader(io.StringIO(texto, newline=""), delimiter=separador, strict=True)
        next(lector, None)
        for valores in lector:
            numero = lector.line_num
            if all(not valor.strip() for valor in valores):
                continue
            if len(filas) >= MAX_FILAS:
                raise HTTPException(422, f"El máximo por archivo es {MAX_FILAS} instructores.")
            if len(valores) != len(columnas):
                filas.append({
                    "fila": numero, "valido": False, "datos": {},
                    "error": f"Se esperaban {len(columnas)} columnas y llegaron {len(valores)}.",
                })
                continue
            fila = dict(zip(columnas, (valor.strip() for valor in valores)))
            registro = {
                "nombre": fila.get("nombre", ""),
                "correo": fila.get("correo", ""),
                "documento": fila.get("documento", ""),
                "tipoContrato": fila.get("contrato", ""),
                "horasContratadasSemana": fila.get("horas", ""),
                "sigla": fila.get("sigla") or None,
            }
            errores = [
                f"{col}: campo obligatorio"
                for col in COLUMNAS if not fila.get(col)
            ]
            try:
                datos = InstructorAlta.model_validate(registro)
                registro = datos.model_dump(mode="json")
            except ValidationError as exc:
                errores.extend(
                    f"{item['loc'][-1]}: {item['msg']}" for item in exc.errors()
                )
            correo = str(registro.get("correo") or "").casefold().strip()
            documento = str(registro.get("documento") or "").strip()
            if correo and correo in correos_vistos:
                errores.append("Correo duplicado dentro del CSV.")
            if documento and documento in documentos_vistos:
                errores.append("Documento duplicado dentro del CSV.")
            if correo:
                correos_vistos.add(correo)
            if documento:
                documentos_vistos.add(documento)
            filas.append({
                "fila": numero, "valido": not errores,
                "datos": registro, "error": "; ".join(errores) if errores else None,
            })
    except csv.Error as exc:
        raise HTTPException(422, "El CSV contiene campos o comillas mal formados.") from exc
    return filas


@router.post("/importar")
async def importar(
    archivo: UploadFile = File(...),
    confirmar: bool = Form(False),
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin_o_coordinador),
):
    if not (archivo.filename or "").lower().endswith(".csv"):
        raise HTTPException(422, "Selecciona un archivo .csv.")
    contenido = await archivo.read(MAX_ARCHIVO_BYTES + 1)
    if len(contenido) > MAX_ARCHIVO_BYTES:
        raise HTTPException(413, "El archivo supera el límite de 2 MB.")
    filas = _leer_csv(contenido)
    if not confirmar:
        return {"confirmado": False, "filas": filas, "total": len(filas), "validas": sum(f["valido"] for f in filas)}
    if not filas or any(not f["valido"] for f in filas):
        raise HTTPException(422, "Corrige las filas inválidas antes de confirmar la importación.")
    _smtp_disponible()
    resultados = []
    for fila in filas:
        try:
            resultado = _alta(db, InstructorAlta.model_validate(fila["datos"]), actor)
        except Exception:
            logger.exception("Error procesando fila %s", fila["fila"])
            resultado = {"correo": fila["datos"]["correo"], "estado": "error", "detalle": "No se pudo completar esta fila."}
        resultados.append({"fila": fila["fila"], **resultado})
    return {"confirmado": True, "resultados": resultados, "total": len(resultados)}
