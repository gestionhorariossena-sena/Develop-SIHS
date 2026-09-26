"""Arma UN Excel con todo lo necesario para programar 200 fichas.

Por qué existe
--------------
Los Excel del centro tienen los datos repartidos y con huecos: las fichas
están en uno, las jornadas y los aprendices en otro, las horas de los
instructores en dos columnas sin encabezado, y la capacidad de los
ambientes no está en ninguno. Así no se puede sembrar una base ni probar
el generador con volumen real.

Este script junta lo que sí existe, completa lo que falta y escribe un
solo archivo con una hoja por tabla, listo para revisar a mano y para
importar.

Qué es real y qué no
--------------------
Cada hoja lleva una columna `origen`:

  excel      — salió tal cual de los archivos del centro.
  derivado   — se calculó a partir de ellos (ej. las horas de RF-011, que
               son la suma de dos columnas sin nombre del Excel).
  inventado  — no existe en ningún archivo y se generó para poder probar.

Eso es lo que permite lo que pidió David: cuando lleguen los datos reales,
se borra por `origen` y no a ojo. La hoja LÉEME del archivo lo explica
para quien lo abra sin leer este script.

Uso:
    cd backend
    .venv/bin/python scripts/armar_excel_maestro.py
"""

import random
import re
import sys
import unicodedata
import warnings
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

warnings.filterwarnings("ignore")

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

RAIZ = Path(__file__).resolve().parent.parent.parent
MUESTRA = RAIZ / "_Docs" / "datos-muestra"
SALIDA = MUESTRA / "MAESTRO_PROGRAMACION_200_FICHAS.xlsx"

# Semilla fija: dos corridas dan el mismo archivo, así que revisar el
# Excel y volver a generarlo no produce un diff falso.
random.seed(20260925)

FICHAS_OBJETIVO = 200

# Del generador (app/scheduling/generator.py): 3 franjas en mañana y
# tarde, 2 en noche, sobre 5 días. Una ficha no puede tener dos clases a
# la vez, así que ese es su techo semanal.
SLOTS_POR_JORNADA = {"MAÑANA": 15, "TARDE": 15, "NOCHE": 10}

# Cuántos resultados se le programan a una ficha en el trimestre. Se
# queda por debajo del techo a propósito: llenar la jornada al 100% deja
# al generador sin margen para reacomodar y lo vuelve infactible ante
# cualquier choque.
RESULTADOS_POR_FICHA = {"MAÑANA": 10, "TARDE": 10, "NOCHE": 7}


def sin_tildes(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def limpiar(valor) -> str:
    if valor is None:
        return ""
    return re.sub(r"\s+", " ", str(valor).replace("\xa0", " ")).strip()


# ---------------------------------------------------------------- lectura


def leer_fichas_reales() -> list[dict]:
    wb = load_workbook(MUESTRA / "PROGRAMACIÓN CGMLTI I TRM 2026 (4).xlsx", read_only=True, data_only=True)
    ws = wb["FICHAS"]
    fichas = []
    for f in ws.iter_rows(min_row=2, values_only=True):
        codigo = limpiar(f[2])
        if not codigo or not codigo.isdigit():
            continue
        fichas.append(
            {
                "codigo": codigo,
                "nombre": limpiar(f[3]),
                "nivel": limpiar(f[4]) or "TECNÓLOGO",
                "coordinacion": limpiar(f[5]) or "TELEINFORMÁTICA",
                "trimestre": limpiar(f[6]) or "1",
                "inicio": f[7].date() if hasattr(f[7], "date") else None,
                "fin_lectiva": f[8].date() if hasattr(f[8], "date") else None,
                "sede": limpiar(f[11]),
            }
        )
    wb.close()
    return fichas


def leer_instructores_y_ambientes() -> tuple[list[dict], list[dict], list[tuple[str, str]]]:
    """Del mismo archivo salen tres cosas mezcladas en una hoja: los
    instructores con su contrato, los ambientes, y qué actividad de
    formación dicta cada quien (que es la base de las especialidades)."""
    wb = load_workbook(MUESTRA / "PROGRAMACIÓN CGMLTI I TRM 2026 (4).xlsx", read_only=True, data_only=True)
    ws = wb["LISTA_INSTRUCTORES_AMBIENTES"]

    instructores: dict[str, dict] = {}
    ambientes: dict[str, dict] = {}
    dicta: list[tuple[str, str]] = []

    for f in ws.iter_rows(min_row=2, values_only=True):
        nombre = limpiar(f[2])
        contrato = limpiar(f[3]).upper()
        if nombre and contrato in ("PLANTA", "CONTRATO") and nombre not in instructores:
            # col4 + col5 dan exactamente 32 en PLANTA y 40 en CONTRATO,
            # sin una sola excepción en las 216 filas: son las horas de
            # RF-011 repartidas entre asignadas y disponibles.
            horas = None
            if isinstance(f[4], (int, float)) and isinstance(f[5], (int, float)):
                horas = int(f[4]) + int(f[5])
            instructores[nombre] = {
                "nombre": nombre,
                "iniciales": limpiar(f[1]),
                "contrato": "planta" if contrato == "PLANTA" else "contrato",
                "horas": horas or (32 if contrato == "PLANTA" else 40),
                "horas_origen": "derivado" if horas else "inventado",
            }

        nombre_amb = limpiar(f[10])
        numero = limpiar(f[9])
        if nombre_amb and numero and nombre_amb not in ambientes:
            ambientes[nombre_amb] = {"numero": numero, "nombre": nombre_amb}

        actividad = limpiar(f[17])
        if nombre and actividad:
            dicta.append((nombre, actividad))

    wb.close()
    return list(instructores.values()), list(ambientes.values()), dicta


def leer_jornadas_y_aprendices() -> dict[str, dict]:
    """El Excel de líderes es el único que dice en qué jornada va cada
    ficha y cuántos aprendices tiene."""
    wb = load_workbook(MUESTRA / "LIDERES DE FICHA 2026_pruebas.xlsx", read_only=True, data_only=True)
    ws = wb["2026_TRIM 03"]
    datos = {}
    for f in ws.iter_rows(min_row=4, values_only=True):
        codigo = limpiar(f[3])
        if not codigo.isdigit():
            continue
        jornada_cruda = sin_tildes(limpiar(f[1])).upper()
        if "NOCHE" in jornada_cruda or "NOCTURNA" in jornada_cruda:
            jornada = "NOCHE"
        elif "TARDE" in jornada_cruda:
            jornada = "TARDE"
        elif "MANANA" in jornada_cruda or "DIURNA" in jornada_cruda:
            jornada = "MAÑANA"
        else:
            jornada = ""  # "MIXTA" y vacíos se resuelven después
        aprendices = int(f[8]) if isinstance(f[8], (int, float)) else None
        datos[codigo] = {"jornada": jornada, "aprendices": aprendices, "lider": limpiar(f[7])}
    wb.close()
    return datos


# ------------------------------------------------------- catálogos base

SEDES = [
    {"nombre": "CALLE 52", "direccion": "Calle 52 # 13-65", "tipo": "principal"},
    {"nombre": "FONTIBÓN", "direccion": "Carrera 97 # 17C-10", "tipo": "secundaria"},
    {"nombre": "UNIGERMANA", "direccion": "Calle 13 # 68-40", "tipo": "alterna"},
]

# Las tres coordinaciones que aparecen en el Excel de fichas, con las
# especialidades que se les inventan para poder validar fortalezas.
ESPECIALIDADES_POR_COORDINACION = {
    "TELEINFORMÁTICA": ["Desarrollo de software", "Redes y telecomunicaciones", "Infraestructura TI"],
    "MERCADEO": ["Mercadeo digital", "Producción audiovisual", "Gestión comercial"],
    "LOGÍSTICA": ["Logística y cadena de suministro", "Gestión de inventarios", "Comercio exterior"],
}


def armar_programas(fichas: list[dict]) -> list[dict]:
    """El nombre de la ficha trae el programa embebido
    ("7_TRM_2996161_(DM)_DESARROLLO DE PROCESOS DE MERCADEO")."""
    vistos: dict[tuple[str, str], dict] = {}
    for ficha in fichas:
        partes = ficha["nombre"].split("_")
        nombre_programa = limpiar(partes[-1]) if len(partes) > 1 else ""
        if not nombre_programa or len(nombre_programa) < 5:
            nombre_programa = f"PROGRAMA {ficha['coordinacion']}"
        clave = (nombre_programa.upper(), ficha["coordinacion"])
        if clave not in vistos:
            vistos[clave] = {
                "nombre": nombre_programa.upper(),
                "coordinacion": ficha["coordinacion"],
                "nivel": ficha["nivel"],
                "codigo": f"PRG-{len(vistos) + 1:03d}",
            }
        ficha["programa"] = vistos[clave]["nombre"]
    return list(vistos.values())


def armar_curriculo(programas: list[dict], actividades_reales: list[str]) -> tuple[list[dict], list[dict]]:
    """Competencias y resultados por programa.

    Los enunciados salen de las 741 actividades de formación reales del
    Excel — repartirlas por programa es lo inventado, porque el archivo no
    dice a qué programa pertenece cada una.
    """
    competencias, resultados = [], []
    pool = [a for a in dict.fromkeys(actividades_reales) if len(a) > 25]
    random.shuffle(pool)
    cursor = 0

    for prog in programas:
        # 3 competencias por programa, 5 resultados cada una: 15 por
        # programa, suficiente para los 10 que se le piden a una ficha.
        for c in range(1, 4):
            codigo_comp = f"{prog['codigo']}-C{c}"
            competencias.append(
                {
                    "codigo": codigo_comp,
                    "programa": prog["nombre"],
                    "descripcion": f"Competencia {c} de {prog['nombre'].title()}",
                }
            )
            for r in range(1, 6):
                if cursor < len(pool):
                    texto = pool[cursor]
                    cursor += 1
                    origen = "excel"
                    # Las actividades vienen como "584305 - ELABORAR EL..."
                    descripcion = texto.split(" - ", 1)[-1] if " - " in texto else texto
                else:
                    descripcion = f"Resultado {r} de la competencia {c} de {prog['nombre'].title()}"
                    origen = "inventado"
                resultados.append(
                    {
                        "codigo": f"{codigo_comp}-R{r}",
                        "competencia": codigo_comp,
                        "programa": prog["nombre"],
                        "descripcion": descripcion[:300],
                        "horas": random.choice([40, 60, 80, 90, 120]),
                        "origen": origen,
                    }
                )
    return competencias, resultados


def armar_ambientes(ambientes_reales: list[dict]) -> list[dict]:
    """Los ambientes del Excel no traen capacidad ni sede: ese dato no
    está en ningún archivo del centro, así que se inventa — es el único
    campo de toda la programación que hay que salir a buscar afuera."""
    ambientes = []
    for i, amb in enumerate(ambientes_reales):
        nombre = amb["nombre"]
        texto = sin_tildes(nombre).upper()
        if "FONTIBON" in texto:
            sede = "FONTIBÓN"
        elif "UNIGERMANA" in texto or "GERMANA" in texto:
            sede = "UNIGERMANA"
        else:
            sede = "CALLE 52"

        especial = any(p in texto for p in ("LAB", "ESTUDIO", "TALLER", "SALA"))
        ambientes.append(
            {
                "numero": amb["numero"],
                "nombre": nombre if especial else "Ambiente",
                "tipo": "especial" if especial else "regular",
                "estado": "disponible",
                "sede": sede,
                "capacidad": random.choice([20, 25, 30, 30, 35, 40]),
                "origen_capacidad": "inventado",
                "origen_sede": "derivado",
            }
        )

    # Con 200 fichas hacen falta ~50 ambientes a tope; el Excel solo trae
    # 95 nombres distintos y varios repiten sede, así que se completan
    # hasta 120 para dejarle margen al generador.
    faltan = max(0, 120 - len(ambientes))
    for i in range(faltan):
        sede = SEDES[i % len(SEDES)]["nombre"]
        ambientes.append(
            {
                "numero": f"9{i + 1:02d}",
                "nombre": "Ambiente",
                "tipo": "regular",
                "estado": "disponible",
                "sede": sede,
                "capacidad": random.choice([25, 30, 35]),
                "origen_capacidad": "inventado",
                "origen_sede": "inventado",
            }
        )
    return ambientes


def armar_instructores(reales: list[dict], programas: list[dict], objetivo: int = 260) -> list[dict]:
    """Los 216 instructores con contrato del Excel no alcanzan para 200
    fichas con holgura, así que se completan con inventados."""
    instructores = []
    for i, ins in enumerate(reales):
        instructores.append(
            {
                "documento": f"10{i + 1:08d}",
                "nombre": ins["nombre"].title(),
                "correo": f"{sin_tildes(ins['nombre'].lower()).replace(' ', '.')}@sena.edu.co",
                "contrato": ins["contrato"],
                "horas": ins["horas"],
                "origen": "excel",
                "origen_horas": ins["horas_origen"],
            }
        )

    nombres = ["Ana", "Carlos", "Diana", "Édgar", "Fabián", "Gloria", "Héctor", "Irene", "Javier", "Karen",
               "Luis", "Marta", "Néstor", "Olga", "Pablo", "Quenia", "Rocío", "Sergio", "Tatiana", "Uriel"]
    apellidos = ["Ramírez", "Gómez", "Torres", "Cárdenas", "Beltrán", "Quintero", "Mendoza", "Rojas",
                 "Salazar", "Vargas", "Moreno", "Pineda", "Castro", "Herrera", "Jiménez"]

    i = len(instructores)
    while len(instructores) < objetivo:
        nombre = f"{random.choice(nombres)} {random.choice(apellidos)} {random.choice(apellidos)}"
        contrato = "contrato" if len(instructores) % 3 else "planta"
        instructores.append(
            {
                "documento": f"10{i + 1:08d}",
                "nombre": nombre,
                "correo": f"inst{i + 1}@sena.edu.co",
                "contrato": contrato,
                "horas": 40 if contrato == "contrato" else 32,
                "origen": "inventado",
                "origen_horas": "inventado",
            }
        )
        i += 1
    return instructores


def asignar_especialidades(instructores: list[dict], programas: list[dict]) -> list[dict]:
    """Cada instructor recibe 1-2 especialidades. Sin esto la validación
    de fortalezas del generador no filtra nada: hoy la tabla está en cero."""
    todas = [e for lista in ESPECIALIDADES_POR_COORDINACION.values() for e in lista]
    filas = []
    for ins in instructores:
        elegidas = random.sample(todas, k=random.choice([1, 1, 2]))
        for esp in elegidas:
            filas.append({"documento": ins["documento"], "instructor": ins["nombre"], "especialidad": esp})
    return filas


def armar_fichas(reales: list[dict], extra: dict, programas: list[dict]) -> list[dict]:
    fichas = []
    jornadas_ciclo = ["MAÑANA", "MAÑANA", "TARDE", "TARDE", "NOCHE"]

    for i, ficha in enumerate(reales[:FICHAS_OBJETIVO]):
        datos = extra.get(ficha["codigo"], {})
        jornada = datos.get("jornada") or jornadas_ciclo[i % len(jornadas_ciclo)]
        origen_jornada = "excel" if datos.get("jornada") else "inventado"

        aprendices = datos.get("aprendices")
        origen_aprendices = "excel" if aprendices else "inventado"
        if not aprendices:
            aprendices = random.randint(18, 34)

        inicio = ficha["inicio"] or date(2026, 1, 20)
        fin = ficha["fin_lectiva"] or (inicio + timedelta(days=540))
        sede = ficha["sede"] or SEDES[i % len(SEDES)]["nombre"]

        fichas.append(
            {
                "codigo": ficha["codigo"],
                "programa": ficha["programa"],
                "nivel": ficha["nivel"],
                "coordinacion": ficha["coordinacion"],
                "trimestre": f"Trimestre {ficha['trimestre']}",
                "jornada": jornada,
                "sede": sede,
                "aprendices": aprendices,
                "inicio_lectiva": inicio,
                "fin_lectiva": fin,
                "origen": "excel",
                "origen_jornada": origen_jornada,
                "origen_aprendices": origen_aprendices,
                "origen_sede": "excel" if ficha["sede"] else "inventado",
            }
        )
    return fichas


def armar_necesidades(fichas: list[dict], resultados: list[dict]) -> list[dict]:
    """Lo que el generador consume: qué resultado hay que programarle a
    qué ficha. La cantidad por ficha se queda bajo el techo de su jornada
    para que el problema siga siendo resoluble."""
    por_programa = defaultdict(list)
    for r in resultados:
        por_programa[r["programa"]].append(r)

    necesidades = []
    for ficha in fichas:
        disponibles = por_programa.get(ficha["programa"], [])
        if not disponibles:
            continue
        cuantos = min(RESULTADOS_POR_FICHA[ficha["jornada"]], len(disponibles))
        for r in random.sample(disponibles, k=cuantos):
            necesidades.append(
                {
                    "ficha": ficha["codigo"],
                    "programa": ficha["programa"],
                    "jornada": ficha["jornada"],
                    "resultado": r["codigo"],
                    "descripcion": r["descripcion"][:120],
                    "horas": r["horas"],
                }
            )
    return necesidades


# ------------------------------------------------------------- escritura

VERDE = PatternFill("solid", fgColor="16A34A")
GRIS = PatternFill("solid", fgColor="E2E8F0")


def escribir_hoja(wb, titulo: str, filas: list[dict], nota: str = "") -> None:
    ws = wb.create_sheet(titulo)
    if not filas:
        ws["A1"] = "(sin datos)"
        return

    columnas = list(filas[0].keys())
    if nota:
        ws["A1"] = nota
        ws["A1"].font = Font(italic=True, size=9, color="475569")
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=max(len(columnas), 3))
        inicio = 3
    else:
        inicio = 1

    for c, nombre in enumerate(columnas, start=1):
        celda = ws.cell(row=inicio, column=c, value=nombre)
        celda.font = Font(bold=True, color="FFFFFF")
        celda.fill = VERDE
        celda.alignment = Alignment(horizontal="center")

    for f, fila in enumerate(filas, start=inicio + 1):
        for c, nombre in enumerate(columnas, start=1):
            ws.cell(row=f, column=c, value=fila[nombre])

    for c, nombre in enumerate(columnas, start=1):
        ancho = max(len(str(nombre)), *(len(str(fila[nombre])[:60]) for fila in filas[:200]))
        ws.column_dimensions[get_column_letter(c)].width = min(ancho + 3, 60)

    ws.freeze_panes = ws.cell(row=inicio + 1, column=1)


def main() -> None:
    if not MUESTRA.exists():
        sys.exit(f"No encuentro {MUESTRA}")

    print("Leyendo los Excel del centro…")
    fichas_reales = leer_fichas_reales()
    instructores_reales, ambientes_reales, dicta = leer_instructores_y_ambientes()
    extra = leer_jornadas_y_aprendices()
    print(f"  fichas: {len(fichas_reales)} · instructores: {len(instructores_reales)} · "
          f"ambientes: {len(ambientes_reales)} · actividades: {len(dicta)}")

    programas = armar_programas(fichas_reales)
    competencias, resultados = armar_curriculo(programas, [a for _, a in dicta])
    ambientes = armar_ambientes(ambientes_reales)
    instructores = armar_instructores(instructores_reales, programas)
    especialidades_asignadas = asignar_especialidades(instructores, programas)
    fichas = armar_fichas(fichas_reales, extra, programas)
    necesidades = armar_necesidades(fichas, resultados)

    wb = Workbook()
    wb.remove(wb.active)

    # LÉEME primero: quien abra el archivo tiene que entender de dónde
    # salió cada cosa antes de mirar ningún número.
    ws = wb.create_sheet("LÉEME")
    ws.column_dimensions["A"].width = 110
    lineas = [
        ("MAESTRO DE PROGRAMACIÓN · 200 fichas", True),
        ("", False),
        (f"Generado por backend/scripts/armar_excel_maestro.py el {date.today().isoformat()}.", False),
        ("Una hoja por tabla del sistema. Editable a mano: es la fuente para sembrar la base.", False),
        ("", False),
        ("DE DÓNDE SALE CADA DATO — columna `origen` en cada hoja", True),
        ("  excel      · salió tal cual de los archivos del centro.", False),
        ("  derivado   · calculado a partir de ellos. Ejemplo: las horas de cada instructor son la", False),
        ("               suma de dos columnas sin encabezado del Excel, que dan 32 en planta y 40", False),
        ("               en contrato sin una sola excepción en 216 filas — o sea, RF-011.", False),
        ("  inventado  · no existe en ningún archivo. Se generó para poder probar con volumen.", False),
        ("", False),
        ("CÓMO BORRAR LO INVENTADO CUANDO LLEGUEN LOS DATOS REALES", True),
        ("  Al importar, guardar el `origen` de cada fila en la base. Entonces limpiar es una", False),
        ("  consulta (DELETE ... WHERE origen <> 'excel') y no revisar registro por registro.", False),
        ("  Sin esa marca no hay forma de distinguir una ficha sembrada de una real.", False),
        ("", False),
        ("LO ÚNICO QUE NO EXISTE EN NINGÚN ARCHIVO", True),
        ("  La capacidad de los ambientes. Está inventada en la hoja AMBIENTES y hay que salir a", False),
        ("  buscarla: sin ella no se puede validar que una ficha de 30 aprendices quepa en un", False),
        ("  laboratorio de 20.", False),
        ("", False),
        ("POR QUÉ ESTAS CANTIDADES", True),
        ("  El generador da 3 franjas en mañana y tarde y 2 en noche, sobre 5 días: una ficha tiene", False),
        ("  como techo 15 bloques-día por semana (10 si es de noche). Se le programan 10 resultados", False),
        ("  (7 en noche) para dejar margen; llenar la jornada al tope deja al generador sin dónde", False),
        ("  reacomodar ante el primer choque y el problema se vuelve infactible.", False),
    ]
    for i, (texto, negrita) in enumerate(lineas, start=1):
        celda = ws.cell(row=i, column=1, value=texto)
        if negrita:
            celda.font = Font(bold=True, size=11)

    escribir_hoja(wb, "SEDES", SEDES, "Las 3 sedes que aparecen en el Excel de fichas. Direcciones inventadas.")
    escribir_hoja(wb, "COORDINACIONES", [{"nombre": c} for c in ESPECIALIDADES_POR_COORDINACION], "Origen: excel.")
    escribir_hoja(wb, "PROGRAMAS", programas, "Extraídos del nombre de cada ficha. Origen: derivado.")
    escribir_hoja(wb, "AMBIENTES", ambientes, "Nombre y número: excel. Sede: derivada del nombre. CAPACIDAD: inventada — no existe en ningún archivo.")
    escribir_hoja(wb, "INSTRUCTORES", instructores, "Nombre y contrato: excel. Horas: derivadas (suman 32 planta / 40 contrato). Documento y correo: inventados.")
    escribir_hoja(wb, "ESPECIALIDADES", [{"nombre": e, "coordinacion": c} for c, l in ESPECIALIDADES_POR_COORDINACION.items() for e in l], "Inventadas: el Excel no las tiene como catálogo.")
    escribir_hoja(wb, "INSTRUCTOR_ESPECIALIDAD", especialidades_asignadas, "Inventado. Hoy esta tabla está VACÍA en la base, así que la validación de fortalezas no filtra nada.")
    escribir_hoja(wb, "COMPETENCIAS", competencias, "Inventadas: 3 por programa.")
    escribir_hoja(wb, "RESULTADOS", resultados, "Enunciados: excel (741 actividades reales). Su reparto por programa y las horas: inventados.")
    escribir_hoja(wb, "FICHAS", fichas, f"{len(fichas)} fichas reales del centro. Jornada y aprendices: del Excel de líderes donde había; inventados donde no.")
    escribir_hoja(wb, "NECESIDADES", necesidades, "Lo que consume el generador: qué resultado programarle a qué ficha.")

    wb.save(SALIDA)

    print(f"\n✓ {SALIDA.relative_to(RAIZ)}")
    print(f"\n  fichas                 {len(fichas):5d}")
    print(f"  necesidades a programar {len(necesidades):5d}")
    print(f"  instructores           {len(instructores):5d}  ({sum(1 for i in instructores if i['origen']=='excel')} del excel)")
    print(f"  ambientes              {len(ambientes):5d}  ({len(ambientes_reales)} del excel)")
    print(f"  programas              {len(programas):5d}")
    print(f"  resultados             {len(resultados):5d}  ({sum(1 for r in resultados if r['origen']=='excel')} con enunciado real)")

    # Chequeo de factibilidad: que la demanda quepa en los recursos.
    print("\n  ¿cabe? (demanda vs capacidad semanal)")
    demanda = len(necesidades)  # 1 patrón de día por necesidad
    print(f"    slots-día pedidos      {demanda:5d}")
    print(f"    capacidad de ambientes {len(ambientes) * 40:5d}  ({demanda / (len(ambientes) * 40) * 100:.0f}% de ocupación)")
    horas = demanda * 2
    tope = sum(i["horas"] for i in instructores)
    print(f"    horas de clase pedidas {horas:5d}")
    print(f"    horas contratadas      {tope:5d}  ({horas / tope * 100:.0f}% de uso)")


if __name__ == "__main__":
    main()
