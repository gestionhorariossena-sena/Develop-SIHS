"""Semilla sintética, repetible y limitada a datos de aplicación DEMO."""
from datetime import date, time
from uuid import UUID

from app.models.ambiente import Ambiente
from app.models.coordinacion import Coordinacion
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.dia_semana import DiaSemana
from app.models.especialidad import Especialidad
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.guia import Guia
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


CUENTAS_DEMO = {
    "admin": ("Administrador DEMO", "admin.demo@sihs.local", "Administrador"),
    "coordinador": ("Coordinador DEMO", "coordinador.demo@sihs.local", "Coordinador"),
    "instructor": ("Instructor DEMO", "instructor.demo@sihs.local", "Instructor"),
    "aprendiz": ("Aprendiz DEMO", "aprendiz.demo@sihs.local", "Aprendiz"),
}


class DemoSeedService:
    VERSION = "demo-v1"

    @staticmethod
    def sembrar(db, ids_auth: dict[str, UUID]) -> dict[str, int]:
        """Reconstruye el grafo mínimo sin llamar ni mutar ``auth.users``.

        Los UUID provienen de cuatro cuentas Auth creadas previamente por
        operaciones del entorno, nunca por este servicio.
        """
        if set(ids_auth) != set(CUENTAS_DEMO):
            raise ValueError("Se requieren exactamente los UUID Auth de admin, coordinador, instructor y aprendiz.")
        if len(set(ids_auth.values())) != len(ids_auth):
            raise ValueError("Cada rol DEMO debe apuntar a una cuenta Auth distinta.")
        roles = {nombre: DemoSeedService._uno(db, Rol, Rol.nombre == nombre, nombre=nombre)
                 for nombre in ("Administrador", "Coordinador", "Instructor", "Aprendiz")}
        usuarios = {}
        for clave, (nombre, correo, rol) in CUENTAS_DEMO.items():
            usuario = db.get(Usuario, ids_auth[clave])
            if usuario is None:
                usuario = Usuario(idUsuario=ids_auth[clave], nombre=nombre, email=correo, estado="activo")
                db.add(usuario)
            else:
                usuario.nombre, usuario.email, usuario.estado = nombre, correo, "activo"
            if roles[rol] not in usuario.roles:
                usuario.roles.append(roles[rol])
            usuarios[clave] = usuario
        instructor = usuarios["instructor"]
        instructor.tipoContrato, instructor.horasContratadasSemana = "contrato", 40

        coordinacion = DemoSeedService._uno(db, Coordinacion, Coordinacion.nombreCoordinacion == "Coordinación DEMO", nombreCoordinacion="Coordinación DEMO")
        sede = DemoSeedService._uno(db, Sede, Sede.nombre == "Sede DEMO", nombre="Sede DEMO", direccion="Datos sintéticos", tipo="principal")
        jornada = DemoSeedService._uno(db, Jornada, Jornada.nombreJornada == "Mañana", nombreJornada="Mañana")
        lunes = DemoSeedService._uno(db, DiaSemana, DiaSemana.nombreDia == "Lunes", nombreDia="Lunes")
        trimestre = DemoSeedService._uno(db, Trimestre, Trimestre.nombre == "DEMO-2026", nombre="DEMO-2026", fechaInicio=date(2026, 1, 1), fechaFin=date(2026, 12, 31), estado="activo")
        programa = DemoSeedService._uno(db, Programa, Programa.codigoPrograma == "DEMO-ADSO", codigoPrograma="DEMO-ADSO", nombrePrograma="Análisis y Desarrollo de Software DEMO", nivelFormacion="Tecnólogo", activo=True, idCoordinacion=coordinacion.idCoordinacion)
        ambiente = DemoSeedService._uno(db, Ambiente, (Ambiente.numero_ambiente == 101) & (Ambiente.sede_id == sede.id), numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=sede.id)
        ficha = DemoSeedService._uno(db, Ficha, Ficha.codigoFicha == "DEMO-ADSO-01", codigoFicha="DEMO-ADSO-01", idPrograma=programa.idPrograma, idTrimestre=trimestre.idTrimestre, idSede=sede.id, faseActual=1)
        guia = DemoSeedService._uno(db, Guia, (Guia.codigo == "G-DEMO-01") & (Guia.idPrograma == programa.idPrograma), codigo="G-DEMO-01", idPrograma=programa.idPrograma, idTrimestre=trimestre.idTrimestre)
        especialidad = DemoSeedService._uno(db, Especialidad, Especialidad.nombre == "Desarrollo de software", nombre="Desarrollo de software", descripcion="Dato DEMO", activo=True)
        if especialidad not in instructor.especialidades:
            instructor.especialidades.append(especialidad)
        competencia = DemoSeedService._uno(db, CompetenciaFormacion, CompetenciaFormacion.codigo == "C-DEMO-01", codigo="C-DEMO-01", descripcion="Competencia sintética DEMO", idPrograma=programa.idPrograma)
        if especialidad not in competencia.especialidades:
            competencia.especialidades.append(especialidad)
        resultado = DemoSeedService._uno(db, ResultadoAprendizaje, ResultadoAprendizaje.codigo == "RA-DEMO-01", codigo="RA-DEMO-01", descripcion="Resultado sintético DEMO", idCompetencia=competencia.idCompetencia, idGuia=guia.idGuia, horasAsignadas=8, numeroFase=1)
        if not db.get(FichaUsuario, {"idFicha": ficha.idFicha, "idUsuario": usuarios["aprendiz"].idUsuario}):
            db.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=usuarios["aprendiz"].idUsuario))
        horario = db.query(Horario).filter(Horario.idFicha == ficha.idFicha, Horario.idResultado == resultado.idResultado).one_or_none()
        if horario is None:
            horario = Horario(horaInicio=time(8), horaFin=time(10), idJornada=jornada.idJornada, idTrimestre=trimestre.idTrimestre, idAmbiente=ambiente.id, idInstructor=instructor.idUsuario, idFicha=ficha.idFicha, idResultado=resultado.idResultado, publicado=True, activo=True)
            db.add(horario)
            db.flush()
            db.execute(horario_dia.insert().values(idHorario=horario.idHorario, idDia=lunes.idDia))
        db.flush()
        return {"usuarios": len(usuarios), "horarios": 1, "version": DemoSeedService.VERSION}

    @staticmethod
    def _uno(db, modelo, filtro, **valores):
        objeto = db.query(modelo).filter(filtro).one_or_none()
        if objeto is None:
            objeto = modelo(**valores)
            db.add(objeto)
            db.flush()
        return objeto
