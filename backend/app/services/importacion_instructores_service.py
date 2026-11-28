"""Importación explícita de instructores desde el CSV administrativo.

El archivo se valida completo antes de crear cuentas. La creación de Auth se
mantiene exclusivamente en el backend mediante supabase_admin_service.
"""
import csv
import io
import re
import secrets

from app.models.especialidad import Especialidad
from app.models.horario import Horario
from app.models.lote_importacion_instructor import LoteImportacionInstructor
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.services.supabase_admin_service import crear_o_recuperar_usuario_supabase, eliminar_usuario_supabase

REQUERIDAS = {"documento", "nombre", "correo", "contrato", "horas"}
CORREO_VALIDO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ImportacionInstructoresService:
    @staticmethod
    def leer_csv(contenido: bytes) -> tuple[list[dict], list[dict]]:
        try:
            texto = contenido.decode("utf-8-sig")
        except UnicodeDecodeError:
            return [], [{"fila": 0, "mensaje": "El archivo debe estar codificado en UTF-8."}]
        lector = csv.DictReader(io.StringIO(texto, newline=""))
        encabezados = {(encabezado or "").strip() for encabezado in (lector.fieldnames or [])}
        if not lector.fieldnames or not REQUERIDAS.issubset(encabezados):
            faltantes = ", ".join(sorted(REQUERIDAS - encabezados))
            return [], [{"fila": 0, "mensaje": f"Faltan columnas requeridas: {faltantes}."}]

        validos, errores, documentos, correos = [], [], set(), set()
        for fila, cruda in enumerate(lector, start=2):
            # Solo se conservan columnas con encabezado. csv.DictReader usa
            # la clave None si una fila tiene más celdas que el encabezado.
            dato = {(k or "").strip(): (v or "").strip() for k, v in cruda.items() if k}
            try:
                contrato = dato["contrato"].lower()
                horas = int(dato["horas"])
                correo = dato["correo"].lower()
                if not dato["documento"] or not dato["nombre"] or not CORREO_VALIDO.fullmatch(correo):
                    raise ValueError("documento, nombre y correo válido son obligatorios")
                if contrato not in {"planta", "contrato"}:
                    raise ValueError("contrato debe ser planta o contrato")
                if horas != (32 if contrato == "planta" else 40):
                    raise ValueError("horas debe ser 32 para planta o 40 para contrato")
                if dato["documento"] in documentos or correo in correos:
                    raise ValueError("documento o correo duplicado en el archivo")
                documentos.add(dato["documento"]); correos.add(correo)
                dato["correo"] = correo
                dato["contrato"] = contrato; dato["horas"] = horas
                dato["especialidades"] = [x.strip() for x in dato.get("especialidades", "").split(";") if x.strip()]
                dato["fila"] = fila
                validos.append(dato)
            except (ValueError, KeyError) as error:
                errores.append({"fila": fila, "mensaje": str(error)})
        return validos, errores

    @staticmethod
    def excluir_existentes(db, filas: list[dict]) -> tuple[list[dict], list[dict]]:
        """Señala duplicados ya persistidos antes de mostrar la confirmación.

        La comprobación se repite justo antes de crear cada cuenta porque
        otro administrador podría importar el mismo instructor entre la
        previsualización y la confirmación.
        """
        disponibles, errores = [], []
        for dato in filas:
            existe = db.query(Usuario).filter(
                (Usuario.email == dato["correo"]) | (Usuario.numeroDocumento == dato["documento"])
            ).first()
            if existe:
                errores.append({"fila": dato["fila"], "mensaje": "Ya existe una cuenta con ese documento o correo."})
            else:
                disponibles.append(dato)
        return disponibles, errores

    @staticmethod
    def importar(db, contenido: bytes, id_administrador=None) -> dict:
        filas, errores = ImportacionInstructoresService.leer_csv(contenido)
        # Las filas defectuosas no deben impedir crear las que sí pasaron la
        # previsualización. Se devuelve cada causa al final de la operación.
        if not filas:
            return {"creados": 0, "existentes": 0, "errores": errores, "credencialesTemporales": [], "idLote": None}
        rol = db.query(Rol).filter(Rol.nombre == "Instructor").first()
        if not rol:
            return {"creados": 0, "existentes": 0, "errores": [*errores, {"fila": 0, "mensaje": "No existe el rol Instructor."}], "credencialesTemporales": [], "idLote": None}
        creados = existentes = 0
        credenciales = []
        lote = None
        for dato in filas:
            if db.query(Usuario).filter((Usuario.email == dato["correo"]) | (Usuario.numeroDocumento == dato["documento"])).first():
                existentes += 1
                errores.append({"fila": dato["fila"], "mensaje": "Ya existe una cuenta con ese documento o correo."})
                continue
            try:
                clave = secrets.token_urlsafe(9)
                auth, creado_auth = crear_o_recuperar_usuario_supabase(dato["correo"], clave)
                usuario = db.get(Usuario, auth["id"])
                if usuario:
                    existentes += 1
                    continue
                if lote is None:
                    lote = LoteImportacionInstructor(idAdministrador=id_administrador)
                    db.add(lote)
                    db.flush()
                usuario = Usuario(idUsuario=auth["id"], nombre=dato["nombre"], email=dato["correo"], numeroDocumento=dato["documento"], tipoContrato=dato["contrato"], horasContratadasSemana=dato["horas"], debeCambiarClave=True, idLoteImportacionInstructor=lote.idLote, creadoAuthPorLote=creado_auth)
                usuario.roles.append(rol)
                for nombre in dato["especialidades"]:
                    especialidad = db.query(Especialidad).filter(Especialidad.nombre == nombre).first()
                    if especialidad:
                        usuario.especialidades.append(especialidad)
                db.add(usuario); db.commit()
                creados += 1
                if creado_auth:
                    credenciales.append({"correo": dato["correo"], "passwordTemporal": clave})
            except Exception:
                db.rollback()
                if creados == 0:
                    lote = None
                errores.append({"fila": dato["fila"], "mensaje": "No se pudo crear la cuenta en este momento."})
        return {"creados": creados, "existentes": existentes, "errores": errores, "credencialesTemporales": credenciales, "idLote": lote.idLote if lote else None}

    @staticmethod
    def listar_lotes(db) -> list[dict]:
        lotes = db.query(LoteImportacionInstructor).order_by(LoteImportacionInstructor.fechaCreacion.desc()).all()
        resultado = []
        for lote in lotes:
            creados = db.query(Usuario).filter(Usuario.idLoteImportacionInstructor == lote.idLote).count()
            if creados:
                resultado.append({"idLote": lote.idLote, "fechaCreacion": lote.fechaCreacion, "creados": creados})
        return resultado

    @staticmethod
    def eliminar_lote(db, id_lote) -> dict:
        lote = db.get(LoteImportacionInstructor, id_lote)
        if not lote:
            raise ValueError("El lote de importación no existe.")
        usuarios = db.query(Usuario).filter(Usuario.idLoteImportacionInstructor == id_lote).all()
        if not usuarios:
            raise ValueError("Este lote ya fue eliminado o no tiene registros reversibles.")

        ids = [usuario.idUsuario for usuario in usuarios]
        if db.query(Horario).filter(Horario.idInstructor.in_(ids)).first():
            raise ValueError("No se puede eliminar el lote porque uno o más instructores ya tienen horarios asignados.")

        # Las cuentas de Auth que existían antes del lote no pertenecen al
        # lote; solo se eliminan identidades creadas en esta importación.
        try:
            for usuario in usuarios:
                if usuario.creadoAuthPorLote:
                    eliminar_usuario_supabase(str(usuario.idUsuario))
        except Exception as error:
            raise RuntimeError("No se pudo eliminar una cuenta de autenticación; no se eliminó el lote local.") from error

        try:
            for usuario in usuarios:
                db.delete(usuario)
            db.commit()
        except Exception:
            db.rollback()
            raise RuntimeError("No se pudo eliminar el lote local; revisa el estado de las cuentas de autenticación.")
        return {"eliminados": len(usuarios)}
