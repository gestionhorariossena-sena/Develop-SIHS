"""Registro de asistencia por sesión.

Quién puede qué, y por qué:

- **Escribe solo el instructor de ESE bloque.** No "un instructor": el que
  dicta esa clase. La asistencia la certifica quien estuvo en el aula, y un
  instructor no tiene nada que decir sobre la clase de otro.
- **El aprendiz solo lee lo suyo.** Ni el grupo, ni el de un compañero.
- **Cada cambio queda auditado.** Un registro de asistencia que se puede
  cambiar sin traza no sirve como evidencia de nada; quien lo consulte
  después tiene que poder ver que se corrigió y cuándo.

La nómina sale de `ficha_usuario` (los aprendices vinculados a la ficha del
horario), que es la única lista de estudiantes que este sistema tiene. El
centro los gestiona en Sofía Plus, así que mientras no se importen, la
lista será parcial — la pantalla lo dice en vez de aparentar un curso
completo.
"""

from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models.asistencia import Asistencia
from app.models.usuario import Usuario
from app.repositories.asistencia_repository import AsistenciaRepository
from app.repositories.ficha_usuario_repository import FichaUsuarioRepository
from app.repositories.horario_repository import HorarioRepository

# Un horario vale para un día de la semana concreto (`dias`), así que no
# tiene sentido pasar lista de un martes en un bloque que solo existe los
# lunes. idDia: 1=Lunes .. 7=Domingo, igual que dias_semana.
_LUNES = 1


class AsistenciaError(Exception):
    def __init__(self, mensaje: str, estado_http: int = 422):
        super().__init__(mensaje)
        self.estado_http = estado_http


class AsistenciaService:
    @staticmethod
    def _horario_del_instructor(db: Session, id_horario: int, id_instructor):
        horario = HorarioRepository.obtener_por_id(db, id_horario)

        if not horario:
            raise AsistenciaError("Esa clase no existe", 404)

        if horario.idInstructor != id_instructor:
            # 404 y no 403 a propósito: que exista el bloque de otro
            # instructor no es información que este necesite.
            raise AsistenciaError("Esa clase no existe o no es tuya", 404)

        return horario

    @staticmethod
    def _validar_fecha(db: Session, horario, fecha_sesion: date) -> None:
        dias = HorarioRepository.obtener_dias(db, horario.idHorario)
        if not dias:
            return

        # isoweekday(): 1=lunes .. 7=domingo, misma convención que dias_semana.
        if fecha_sesion.isoweekday() not in dias:
            raise AsistenciaError(
                "Esa clase no se dicta ese día de la semana. Revisa la fecha.", 422
            )

        if fecha_sesion > date.today():
            raise AsistenciaError("No se puede pasar lista de una clase que todavía no ocurrió", 422)

    @staticmethod
    def obtener_sesion(db: Session, id_horario: int, fecha_sesion: date, id_instructor) -> dict:
        horario = AsistenciaService._horario_del_instructor(db, id_horario, id_instructor)

        ya_registradas = {
            a.idUsuarioAprendiz: a
            for a in AsistenciaRepository.obtener_de_sesion(db, id_horario, fecha_sesion)
        }

        aprendices = []
        for vinculo in FichaUsuarioRepository.obtener_aprendices_por_ficha(db, horario.idFicha):
            usuario = db.get(Usuario, vinculo.idUsuario)
            if not usuario:
                continue

            registro = ya_registradas.get(vinculo.idUsuario)
            aprendices.append(
                {
                    "idUsuario": usuario.idUsuario,
                    "nombre": usuario.nombre,
                    "numeroDocumento": usuario.numeroDocumento,
                    "rolEnFicha": vinculo.rolEnFicha,
                    "estado": registro.estado if registro else None,
                    "horaMarcacion": registro.horaMarcacion if registro else None,
                    "referenciaExcusa": registro.referenciaExcusa if registro else None,
                }
            )

        aprendices.sort(key=lambda a: a["nombre"])

        ultima = max(ya_registradas.values(), key=lambda a: a.fechaCreacion, default=None)

        return {
            "idHorario": horario.idHorario,
            "fechaSesion": fecha_sesion,
            "fichaCodigo": horario.ficha.codigoFicha if horario.ficha else None,
            "resultadoDescripcion": horario.resultado.descripcion if horario.resultado else None,
            "ambienteNombre": horario.ambiente.nombre if horario.ambiente else None,
            "horaInicio": horario.horaInicio,
            "horaFin": horario.horaFin,
            "aprendices": aprendices,
            "registradaEn": ultima.fechaCreacion if ultima else None,
            "registradaPor": horario.instructor.nombre if ultima and horario.instructor else None,
        }

    @staticmethod
    def registrar(db: Session, data, id_instructor) -> dict:
        """Guarda la lista COMPLETA de una sesión. Reemplaza lo que hubiera:
        pasar lista de nuevo es corregir, no acumular."""
        horario = AsistenciaService._horario_del_instructor(db, data.idHorario, id_instructor)
        AsistenciaService._validar_fecha(db, horario, data.fechaSesion)

        matriculados = {
            v.idUsuario
            for v in FichaUsuarioRepository.obtener_aprendices_por_ficha(db, horario.idFicha)
        }

        ajenos = [m.idUsuarioAprendiz for m in data.marcas if m.idUsuarioAprendiz not in matriculados]
        if ajenos:
            raise AsistenciaError(
                "Hay marcas de personas que no están matriculadas en esta ficha", 422
            )

        previas = {
            a.idUsuarioAprendiz: a
            for a in AsistenciaRepository.obtener_de_sesion(db, data.idHorario, data.fechaSesion)
        }
        ahora = datetime.now(timezone.utc)
        correcciones = 0

        for marca in data.marcas:
            existente = previas.get(marca.idUsuarioAprendiz)

            if existente:
                if existente.estado != marca.estado:
                    correcciones += 1
                existente.estado = marca.estado
                existente.referenciaExcusa = marca.referenciaExcusa
                # `horaMarcacion` es cuándo se le marcó presencia, no cuándo
                # se editó la fila: solo se toca si pasa a presente/tardanza.
                if marca.estado in ("presente", "tardanza") and not existente.horaMarcacion:
                    existente.horaMarcacion = ahora
                continue

            db.add(
                Asistencia(
                    idHorario=data.idHorario,
                    idUsuarioAprendiz=marca.idUsuarioAprendiz,
                    fechaSesion=data.fechaSesion,
                    estado=marca.estado,
                    referenciaExcusa=marca.referenciaExcusa,
                    horaMarcacion=ahora if marca.estado in ("presente", "tardanza") else None,
                )
            )

        db.commit()

        return {
            "guardadas": len(data.marcas),
            "corregidas": correcciones,
            "eraPrimeraVez": not previas,
        }

    @staticmethod
    def obtener_de_aprendiz(db: Session, id_aprendiz, *, desde=None, hasta=None) -> dict:
        registros = AsistenciaRepository.obtener_de_aprendiz(db, id_aprendiz, desde=desde, hasta=hasta)

        conteo = {"presente": 0, "tardanza": 0, "excusa": 0, "ausente": 0}
        sesiones = []

        for registro in registros:
            conteo[registro.estado] = conteo.get(registro.estado, 0) + 1
            horario = registro.horario

            sesiones.append(
                {
                    "idAsistencia": registro.idAsistencia,
                    "idHorario": registro.idHorario,
                    "fechaSesion": registro.fechaSesion,
                    "estado": registro.estado,
                    "referenciaExcusa": registro.referenciaExcusa,
                    "resultadoDescripcion": horario.resultado.descripcion if horario and horario.resultado else None,
                    "instructorNombre": horario.instructor.nombre if horario and horario.instructor else None,
                    "ambienteNombre": horario.ambiente.nombre if horario and horario.ambiente else None,
                    "horaInicio": horario.horaInicio if horario else None,
                    "horaFin": horario.horaFin if horario else None,
                }
            )

        registradas = len(registros)
        # Tardanza cuenta como asistencia: llegó. La excusa no suma ni
        # resta -- se descuenta del total, que es como se calcula en el
        # reglamento del aprendiz.
        computables = registradas - conteo["excusa"]
        asistio = conteo["presente"] + conteo["tardanza"]
        porcentaje = round(asistio / computables * 100, 1) if computables else 100.0

        return {
            "resumen": {
                "registradas": registradas,
                "presente": conteo["presente"],
                "tardanza": conteo["tardanza"],
                "excusa": conteo["excusa"],
                "ausente": conteo["ausente"],
                "porcentaje": porcentaje,
            },
            "sesiones": sesiones,
        }
