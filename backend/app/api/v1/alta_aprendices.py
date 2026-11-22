"""Altas masivas de aprendices desde Excel por Administrador o Coordinador.

Solo se crean cuentas al confirmar. Se usa el código de ficha, no un ID
interno que cambie entre bases reiniciables.
"""
import io
import logging
import secrets
from uuid import UUID
from zipfile import ZipFile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from openpyxl import load_workbook
from pydantic import BaseModel, EmailStr, Field, ValidationError, field_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin_o_coordinador
from app.models.ficha_usuario import FichaUsuario
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.repositories.ficha_repository import FichaRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.services.auditoria_service import AuditoriaService
from app.services.email_service import EmailService
from app.services.supabase_admin_service import (
    buscar_usuario_supabase_por_email,
    crear_o_recuperar_usuario_supabase,
)

router = APIRouter(prefix="/aprendices/alta", tags=["alta-aprendices"])
logger = logging.getLogger("sihs.alta_aprendices")

MAX_ARCHIVO_BYTES = 2 * 1024 * 1024
MAX_FILAS = 200
COLUMNAS_REQUERIDAS = ("nombre", "correo", "documento", "codigoficha")


class AprendizAlta(BaseModel):
    nombre: str = Field(min_length=3, max_length=100)
    correo: EmailStr
    documento: str = Field(min_length=4, max_length=30)
    codigoFicha: str = Field(min_length=3, max_length=50)
    programaFormacion: str | None = Field(default=None, max_length=200)

    @field_validator("nombre", "documento", "codigoFicha", "programaFormacion", mode="before")
    @classmethod
    def limpiar(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor


def _leer_excel(contenido: bytes) -> list[dict]:
    try:
        with ZipFile(io.BytesIO(contenido)) as zipfile:
            if sum(item.file_size for item in zipfile.infolist()) > 20 * 1024 * 1024:
                raise HTTPException(413, "El Excel contiene demasiados datos.")
        libro = load_workbook(io.BytesIO(contenido), read_only=True, data_only=True, keep_links=False)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, "El archivo .xlsx no es válido.") from exc

    try:
        hoja = libro.active
        iterador = hoja.iter_rows(values_only=True)
        encabezados = next(iterador, None)
        if not encabezados:
            raise HTTPException(422, "El Excel está vacío.")
        nombres = [str(x).strip().casefold() if x is not None else "" for x in encabezados]
        faltantes = [col for col in COLUMNAS_REQUERIDAS if col not in nombres]
        if faltantes:
            raise HTTPException(422, "Faltan columnas: " + ", ".join(faltantes))

        resultado: list[dict] = []
        emails: set[str] = set()
        documentos: set[str] = set()
        for numero, valores in enumerate(iterador, start=2):
            if all(x is None or str(x).strip() == "" for x in valores):
                continue
            if len(resultado) >= MAX_FILAS:
                raise HTTPException(422, f"Máximo {MAX_FILAS} aprendices por Excel.")
            fila = {col: str(valores[i]).strip() if i < len(valores) and valores[i] is not None else "" for i, col in enumerate(nombres) if col}
            # "claveDemoLocal" del archivo piloto no se usa: las claves
            # temporales se generan en el servidor y nunca se importan.
            raw = {
                "nombre": fila.get("nombre", ""),
                "correo": fila.get("correo", ""),
                "documento": fila.get("documento", ""),
                "codigoFicha": fila.get("codigoficha", ""),
                "programaFormacion": fila.get("programaformacion") or None,
            }
            try:
                datos = AprendizAlta.model_validate(raw)
                validado = datos.model_dump(mode="json")
                email = str(datos.correo).casefold()
                documento = datos.documento
                error = None
                if email in emails:
                    error = "Correo duplicado dentro del Excel."
                elif documento in documentos:
                    error = "Documento duplicado dentro del Excel."
                emails.add(email)
                documentos.add(documento)
                resultado.append({"fila": numero, "valido": error is None, "datos": validado, "error": error})
            except ValidationError as exc:
                error = "; ".join(f"{item['loc'][-1]}: {item['msg']}" for item in exc.errors())
                resultado.append({"fila": numero, "valido": False, "datos": raw, "error": error})
        return resultado
    finally:
        libro.close()


def _revisar_fila(db: Session, datos: AprendizAlta) -> str | None:
    ficha = FichaRepository.obtener_por_codigo(db, datos.codigoFicha)
    if not ficha:
        return f"La ficha {datos.codigoFicha} no existe. Impórtala primero."
    if datos.programaFormacion and datos.programaFormacion.casefold() != ficha.programa.nombrePrograma.casefold():
        return f"El programa no coincide con el de la ficha {datos.codigoFicha}."
    if UsuarioRepository.obtener_por_email(db, str(datos.correo).lower()):
        return "Ya existe una cuenta con ese correo."
    if UsuarioRepository.obtener_por_numero_documento(db, datos.documento):
        return "El documento ya está registrado."
    return None


@router.post("/importar")
async def vista_previa(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin_o_coordinador),
):
    if not (archivo.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(422, "Selecciona un archivo .xlsx.")
    contenido = await archivo.read(MAX_ARCHIVO_BYTES + 1)
    if len(contenido) > MAX_ARCHIVO_BYTES:
        raise HTTPException(413, "El archivo supera 2 MB.")
    filas = _leer_excel(contenido)
    for fila in filas:
        if not fila["valido"]:
            continue
        error = _revisar_fila(db, AprendizAlta.model_validate(fila["datos"]))
        if error:
            fila["valido"] = False
            fila["error"] = error
    return {"filas": filas, "total": len(filas), "validas": sum(f["valido"] for f in filas)}


@router.post("/")
def crear_aprendiz(
    datos: AprendizAlta,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_admin_o_coordinador),
):
    correo = str(datos.correo).strip().lower()
    error = _revisar_fila(db, datos)
    if error:
        return {"correo": correo, "estado": "omitido", "detalle": error}
    if not EmailService.smtp_configurado():
        raise HTTPException(503, "Configura SMTP para enviar las credenciales temporales.")
    try:
        if buscar_usuario_supabase_por_email(correo):
            return {"correo": correo, "estado": "omitido", "detalle": "Ya existe una identidad en Supabase Auth."}
        clave = secrets.token_urlsafe(18)
        auth, creado = crear_o_recuperar_usuario_supabase(correo, clave)
        if not creado:
            return {"correo": correo, "estado": "omitido", "detalle": "La identidad ya existe."}
    except Exception as exc:
        logger.exception("No fue posible crear identidad de aprendiz")
        raise HTTPException(503, "No se pudo crear el acceso en Supabase.") from exc

    try:
        ficha = FichaRepository.obtener_por_codigo(db, datos.codigoFicha)
        rol = db.query(Rol).filter(Rol.nombre == "Aprendiz").first()
        if not ficha or not rol:
            raise RuntimeError("Falta la ficha o el rol Aprendiz.")
        usuario = Usuario(
            idUsuario=UUID(auth["id"]), nombre=datos.nombre, email=correo,
            numeroDocumento=datos.documento, debeCambiarClave=True,
        )
        usuario.roles.append(rol)
        db.add(usuario)
        db.flush()
        db.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=usuario.idUsuario))
        AuditoriaService.registrar_transaccional(
            db, usuario=actor, accion="CREAR_APRENDIZ",
            entidad="usuarios", id_entidad=usuario.idUsuario,
            detalle=f"Alta administrativa; ficha {datos.codigoFicha}",
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Identidad creada; perfil o vínculo aprendiz-ficha pendientes")
        return {
            "correo": correo, "estado": "requiere_revision",
            "detalle": "Se creó el acceso, pero no se completó el perfil o vínculo de ficha. Contacta soporte.",
        }

    try:
        EmailService.enviar_alta_aprendiz(
            destinatario_email=correo, destinatario_nombre=datos.nombre,
            password_temporal=clave, codigo_ficha=datos.codigoFicha,
        )
    except Exception:
        logger.exception("No se pudo enviar correo de alta de aprendiz")
        return {
            "correo": correo, "estado": "correo_pendiente",
            "detalle": "Cuenta y ficha creadas, pero falló el correo. Usa recuperación de contraseña.",
        }
    return {"correo": correo, "estado": "creado", "detalle": "Aprendiz vinculado a su ficha; invitación enviada."}
