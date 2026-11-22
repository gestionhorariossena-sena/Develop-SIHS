"""Altas de instructores por gestión; la cuenta no requiere registro público."""
import io
import logging
import secrets
from zipfile import BadZipFile, ZipFile
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr, Field, ValidationError, field_validator
from sqlalchemy.orm import Session
from openpyxl import load_workbook

from app.core.database import get_db
from app.core.supabase_auth import require_admin_o_coordinador
from app.core.config import settings
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
COLUMNAS = ("nombre", "correo", "documento")


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
    if not settings.smtp_user or not settings.smtp_password:
        raise HTTPException(503, "El correo de invitaciones no está configurado. Avisa a administración antes de crear cuentas.")


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
    try:
        return _alta(db, datos, actor)
    except Exception as exc:
        logger.exception("Falló el alta de instructor")
        raise HTTPException(503, "No se pudo completar el alta. Comprueba la configuración del servidor.") from exc


def _normalizar(valor: object) -> str:
    return str(valor).strip() if valor is not None else ""


def _leer_excel(contenido: bytes) -> list[dict]:
    try:
        # Un .xlsx es un ZIP: limitar también el tamaño descomprimido evita
        # procesar archivos que parecen pequeños pero se expanden demasiado.
        with ZipFile(io.BytesIO(contenido)) as paquete:
            if sum(entrada.file_size for entrada in paquete.infolist()) > 20 * 1024 * 1024:
                raise HTTPException(413, "El Excel excede el tamaño máximo de contenido permitido.")
        libro = load_workbook(io.BytesIO(contenido), read_only=True, data_only=True, keep_links=False)
    except HTTPException:
        raise
    except (BadZipFile, ValueError, OSError) as exc:
        raise HTTPException(422, "El archivo no es un Excel .xlsx válido.") from exc
    try:
        hoja = libro.active
        filas = hoja.iter_rows(values_only=True)
        encabezado = next(filas, None)
        if not encabezado:
            raise HTTPException(422, "El Excel está vacío.")
        columnas = [_normalizar(col).lower() for col in encabezado]
        faltantes = [col for col in COLUMNAS if col not in columnas]
        if faltantes:
            raise HTTPException(422, "Faltan columnas: " + ", ".join(faltantes) + ". Descarga la plantilla para ver los encabezados esperados.")
        resultado = []
        for numero, valores in enumerate(filas, start=2):
            if all(_normalizar(v) == "" for v in valores):
                continue
            if len(resultado) >= MAX_FILAS:
                raise HTTPException(422, f"El máximo por archivo es {MAX_FILAS} instructores.")
            fila = {col: _normalizar(valores[idx]) if idx < len(valores) else "" for idx, col in enumerate(columnas)}
            registro = {
                "nombre": fila.get("nombre"), "correo": fila.get("correo"),
                "documento": fila.get("documento"),
                "tipoContrato": fila.get("tipocontrato") or None,
                "horasContratadasSemana": fila.get("horascontratadassemana") or None,
                "sigla": fila.get("sigla") or None,
            }
            try:
                datos = InstructorAlta.model_validate(registro)
                resultado.append({"fila": numero, "valido": True, "datos": datos.model_dump(mode="json"), "error": None})
            except ValidationError as exc:
                resultado.append({"fila": numero, "valido": False, "datos": registro, "error": "; ".join(str(e["loc"][-1]) + ": " + e["msg"] for e in exc.errors())})
        correos_vistos = set()
        documentos_vistos = set()
        for fila in resultado:
            correo = str(fila["datos"].get("correo") or "").lower().strip()
            documento = str(fila["datos"].get("documento") or "").strip()
            if correo and correo in correos_vistos:
                fila["valido"] = False
                fila["error"] = "Correo duplicado dentro del Excel."
            elif documento and documento in documentos_vistos:
                fila["valido"] = False
                fila["error"] = "Documento duplicado dentro del Excel."
            if correo:
                correos_vistos.add(correo)
            if documento:
                documentos_vistos.add(documento)
        return resultado
    finally:
        libro.close()


@router.post("/importar")
async def importar(
    archivo: UploadFile = File(...),
    confirmar: bool = Form(False),
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin_o_coordinador),
):
    if not (archivo.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(422, "Selecciona un archivo .xlsx.")
    contenido = await archivo.read(MAX_ARCHIVO_BYTES + 1)
    if len(contenido) > MAX_ARCHIVO_BYTES:
        raise HTTPException(413, "El archivo supera el límite de 2 MB.")
    filas = _leer_excel(contenido)
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
