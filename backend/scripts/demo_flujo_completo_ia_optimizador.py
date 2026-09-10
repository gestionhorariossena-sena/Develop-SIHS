"""Demo manual de punta a punta de las Fases 1 y 4 de
_Docs/Documentación general/PLAN_INTEGRACION_IA.md:

Excel real -> IA clasifica sus columnas (Fase 1) -> se arman necesidades
de horario reales -> OR-Tools genera una asignación sin choques (Fase 4)
-> se persiste con HorarioService (el mismo código de negocio que usa la
API real) -> se audita con HorarioService.auditar_conflictos para
confirmar 0 conflictos.

Corre sobre SQLite en memoria -- NUNCA toca Supabase, no escribe ningún
dato real ni de prueba en la base compartida del equipo. No es parte de
la suite de pytest: hace una llamada real a Gemini (gasta un puñado de
tokens) y no tiene sentido correrlo en CI en cada push.

Uso:
    cd backend
    GEMINI_API_KEY=... .venv/bin/python scripts/demo_flujo_completo_ia_optimizador.py
"""

import sys
import uuid
from datetime import date
from pathlib import Path

import openpyxl
from sqlalchemy import create_engine, types
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.dialects.sqlite import dialect as SQLiteDialect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ai.tasks.classify_document import clasificar_columnas  # noqa: E402
from app.core.database import Base  # noqa: E402
from app.models.ambiente import Ambiente  # noqa: E402
from app.models.competencia_formacion import CompetenciaFormacion  # noqa: E402
from app.models.coordinacion import Coordinacion  # noqa: E402
from app.models.dia_semana import DiaSemana  # noqa: E402
from app.models.ficha import Ficha  # noqa: E402
from app.models.guia import Guia  # noqa: E402
from app.models.horario import Horario, horario_dia  # noqa: E402
from app.models.jornada import Jornada  # noqa: E402
from app.models.programa import Programa  # noqa: E402
from app.models.resultado_aprendizaje import ResultadoAprendizaje  # noqa: E402
from app.models.sede import Sede  # noqa: E402
from app.models.trimestre import Trimestre  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402
from app.schemas.horario import HorarioCreate  # noqa: E402
from app.scheduling.generator import NecesidadHorario, generar_horario  # noqa: E402
from app.services.horario_service import HorarioService  # noqa: E402


class _UUIDComoTextoParaSQLite(types.TypeDecorator):
    """Mismo shim que backend/tests/conftest.py -- SQLite no acepta str
    donde Postgres real sí. Solo aplica a este script, nunca a producción."""

    impl = types.CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return uuid.UUID(value) if value is not None else None


SQLiteDialect.colspecs = {**SQLiteDialect.colspecs, PostgresUUID: _UUIDComoTextoParaSQLite}

RAIZ_REPO = Path(__file__).resolve().parent.parent.parent
EXCEL_PATH = RAIZ_REPO / "LIDERES DE FICHA 2026_pruebas.xlsx"
HOJA = "2026_TRIM 03"
FILA_ENCABEZADO = 3
MAX_FICHAS_DEMO = 8

# Simplificación del MVP (igual que app/scheduling/generator.py): el
# Excel real trae jornadas más finas ("DIURNA - MAÑANA", "MIXTA"...) que
# el catálogo de 3 franjas del generador.
MAPA_JORNADA = {
    "MIXTA": "MAÑANA",
    "DIURNA": "MAÑANA",
    "DIURNA - MAÑANA": "MAÑANA",
    "DIURNA - TARDE": "TARDE",
    "NOCTURNA": "NOCHE",
}


def leer_fichas_reales() -> list[dict]:
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb[HOJA]
    encabezados = [c.value for c in ws[FILA_ENCABEZADO]]
    idx = {nombre: i for i, nombre in enumerate(encabezados) if nombre}

    filas = []
    for fila in ws.iter_rows(min_row=FILA_ENCABEZADO + 1, values_only=True):
        ficha, instructor = fila[idx["FICHA"]], fila[idx["NUEVOS LIDERES"]]
        jornada_raw, programa = fila[idx["JORNADA"]], fila[idx["PROGRAMA"]]
        if not (ficha and instructor and jornada_raw and programa):
            continue
        try:
            id_ficha = int(ficha)
        except (TypeError, ValueError):
            # Dato real sucio (ej. "3171645-65-668", varias fichas en una
            # celda combinada) -- exactamente el caso que
            # _Docs/Arquitectura/Arquitectura_IA_Motor_Horarios.md describe
            # como "requiere revisión humana". Este demo lo salta, un
            # importador real lo marcaría con confianza baja.
            print(f"   (fila con ficha no parseable, se salta: {ficha!r})")
            continue
        filas.append(
            {
                "ficha": id_ficha,
                "instructor": str(instructor).strip(),
                "jornada_raw": str(jornada_raw).strip().upper(),
                "programa": str(programa).strip(),
            }
        )
        if len(filas) >= MAX_FICHAS_DEMO:
            break
    return filas, encabezados


def main():
    print(f"1) Leyendo Excel real: {EXCEL_PATH.name}")
    filas, encabezados = leer_fichas_reales()
    print(f"   {len(filas)} fichas reales extraídas (de la hoja '{HOJA}').")

    print("\n2) Clasificando encabezados con IA (Gemini -- Fase 1)...")
    encabezados_no_vacios = [e for e in encabezados if e]
    clasificacion = clasificar_columnas(encabezados_no_vacios)
    for columna, c in clasificacion.root.items():
        print(f"   {columna!r:22s} -> {c.campo} (confianza {c.confianza})")

    print("\n3) Armando catálogo real en SQLite aislado (nunca toca Supabase)...")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Coordinacion.__table__, Programa.__table__, Trimestre.__table__, Sede.__table__,
            Ambiente.__table__, Jornada.__table__, DiaSemana.__table__, Ficha.__table__, Guia.__table__,
            CompetenciaFormacion.__table__, ResultadoAprendizaje.__table__, Usuario.__table__,
            Horario.__table__, horario_dia,
        ],
    )
    db = sessionmaker(bind=engine)()

    db.add(Coordinacion(idCoordinacion=1, nombreCoordinacion="Demo"))
    db.add(Trimestre(idTrimestre=1, nombre="2026-3", fechaInicio=date(2026, 7, 1), fechaFin=date(2026, 9, 30), estado="activo"))
    db.add(Sede(id=1, nombre="Sede Demo", direccion="Calle Demo", tipo="principal"))
    id_jornada_por_clave = {"MAÑANA": 1, "TARDE": 2, "NOCHE": 3}
    for clave, id_jornada in id_jornada_por_clave.items():
        db.add(Jornada(idJornada=id_jornada, nombreJornada=clave.capitalize()))
    for id_dia, nombre_dia in enumerate(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"], start=1):
        db.add(DiaSemana(idDia=id_dia, nombreDia=nombre_dia))
    for id_ambiente in (1, 2, 3):
        db.add(Ambiente(id=id_ambiente, numero_ambiente=100 + id_ambiente, nombre="Ambiente",
                         tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1))
    db.commit()

    programas: dict[str, int] = {}
    competencias: dict[int, int] = {}
    instructores: dict[str, uuid.UUID] = {}
    necesidades: list[NecesidadHorario] = []
    jornada_por_necesidad: dict[tuple[int, int], str] = {}

    for i, fila in enumerate(filas, start=1):
        id_programa = programas.setdefault(fila["programa"], len(programas) + 1)
        if id_programa not in competencias:
            db.add(Programa(idPrograma=id_programa, codigoPrograma=f"P{id_programa}",
                             nombrePrograma=fila["programa"], nivelFormacion="Tecnólogo",
                             activo=True, idCoordinacion=1))
            id_competencia = len(competencias) + 1
            db.add(CompetenciaFormacion(idCompetencia=id_competencia, codigo=f"C{id_competencia}",
                                         descripcion="Competencia demo", idPrograma=id_programa))
            competencias[id_programa] = id_competencia
        id_competencia = competencias[id_programa]

        db.add(Ficha(idFicha=fila["ficha"], codigoFicha=str(fila["ficha"]), idPrograma=id_programa, idTrimestre=1))
        db.add(ResultadoAprendizaje(idResultado=i, codigo=f"RA-{i}", descripcion="Resultado demo",
                                     idCompetencia=id_competencia, horasAsignadas=20))

        nombre_instructor = fila["instructor"]
        if nombre_instructor not in instructores:
            id_instructor = uuid.uuid4()
            # "contrato" (no "planta") a propósito: RF-011 veta jornada
            # Noche para planta y este demo no está probando esa regla,
            # solo el pipeline Excel -> IA -> optimizador -> persistencia.
            db.add(Usuario(idUsuario=id_instructor, nombre=nombre_instructor,
                            email=f"{id_instructor}@demo.sihs", tipoContrato="contrato"))
            instructores[nombre_instructor] = id_instructor
        id_instructor = instructores[nombre_instructor]

        jornada_clave = MAPA_JORNADA.get(fila["jornada_raw"], "MAÑANA")
        necesidades.append(
            NecesidadHorario(
                id_ficha=fila["ficha"], id_resultado=i, jornada=jornada_clave,
                instructores_candidatos=[str(id_instructor)], ambientes_candidatos=[1, 2, 3],
            )
        )
        jornada_por_necesidad[(fila["ficha"], i)] = jornada_clave
    db.commit()

    print(f"   {len(programas)} programas, {len(instructores)} instructores, {len(filas)} fichas -- todo real, del Excel.")

    print("\n4) Generando horario con OR-Tools (CP-SAT, cero IA -- Fase 4)...")
    asignacion = generar_horario(necesidades)
    if asignacion is None:
        print("   INFACTIBLE -- no se pudo generar sin choques con estos datos.")
        return
    print(f"   {len(asignacion)} bloques generados.")

    print("\n5) Persistiendo cada bloque con HorarioService.crear (mismo código que usa la API real)...")
    for bloque in asignacion:
        data = HorarioCreate(
            horaInicio=bloque.hora_inicio, horaFin=bloque.hora_fin,
            idJornada=id_jornada_por_clave[jornada_por_necesidad[(bloque.id_ficha, bloque.id_resultado)]],
            idTrimestre=1, idAmbiente=bloque.id_ambiente,
            idInstructor=bloque.id_instructor, idFicha=bloque.id_ficha, idResultado=bloque.id_resultado,
            dias=list(bloque.dias),
        )
        horario, _ = HorarioService.crear(db, data, forzar=False)
        nombre_instructor = next(n for n, v in instructores.items() if str(v) == bloque.id_instructor)
        print(f"   Ficha {bloque.id_ficha}: días {bloque.dias} {bloque.hora_inicio}-{bloque.hora_fin}, "
              f"instructor {nombre_instructor}, ambiente {bloque.id_ambiente} "
              f"-> Horario #{horario.idHorario} creado, 0 conflictos.")

    print("\n6) Auditando TODOS los horarios guardados (HorarioService.auditar_conflictos)...")
    conflictos = HorarioService.auditar_conflictos(db, id_trimestre=1)
    print(f"   Conflictos encontrados: {len(conflictos)}")
    assert len(conflictos) == 0, "El optimizador debería generar horarios sin conflictos"

    print(
        "\n✅ Flujo completo validado: Excel real -> IA clasifica columnas -> "
        "OR-Tools genera horario -> HorarioService persiste -> auditoría en 0 conflictos."
    )


if __name__ == "__main__":
    main()
