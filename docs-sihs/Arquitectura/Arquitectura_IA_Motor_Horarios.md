# Sugerencias de arquitectura del motor de creación de horarios (preparado para IA)

Resumen de una revisión hecha con IA sobre cómo preparar SIHS para incorporar
inteligencia artificial más adelante, sin que el sistema dependa de ella para
funcionar. Fecha de la revisión: 2026-09-09.

## Idea central

Dejar SIHS **preparado para IA, pero no dependiente de IA**. El motor de
horarios sigue siendo determinista (reglas + optimizador); la IA es una capa
adicional y opcional que interpreta, clasifica y sugiere, pero nunca decide
por sí sola sobre restricciones duras ni sobre datos en conflicto.

## A. Los Excel son fuentes, no el sistema

Archivos como Líderes de Ficha, Planeación Cadena de Formación y futuros
formatos son **fuentes de información**, no el modelo de datos del sistema.

Flujo:

```
Excel / PDF / CSV / API / carga manual
                 ↓
             IMPORTADOR
                 ↓
       extracción + normalización
                 ↓
              VALIDACIÓN
                 ↓
              BD SIHS
                 ↓
          MOTOR DE HORARIOS
```

La BD debe tener un modelo propio de SIHS, independiente de cómo venga
organizado el Excel de turno.

## B. El importador debe tolerar cambios

No hacer lectura por celda fija:

```python
ficha = hoja["D5"]
programa = hoja["F5"]
```

Sino identificar campos por nombres de columna, sinónimos, patrones,
códigos, contenido, posiciones relativas, celdas combinadas y estructuras
repetitivas. Por ejemplo, "FICHA", "NÚMERO DE FICHA" y "GRUPO" pueden
representar el mismo concepto, y si las columnas cambian de orden
(`FICHA | PROGRAMA | TRIMESTRE` vs. `PROGRAMA | JORNADA | FICHA |
TRIMESTRE`) el extractor debe seguir funcionando.

## C. Comparar contra la BD

Cuando llega un dato nuevo desde un Excel, se compara contra lo que ya
existe en la BD:

- Si coincide (ficha, programa y jornada iguales) → alta confianza, se
  acepta.
- Si hay diferencia (p. ej. BD dice jornada Mixta, el Excel dice Diurna) →
  conflicto → **revisión humana**, nunca "adivinar" y sobrescribir.

## D. Confianza por campo

Cada dato extraído se guarda con un valor y un nivel de confianza:

```json
{
  "ficha": { "valor": "3171599", "confianza": 0.99 },
  "programa": { "valor": "ADSO", "confianza": 0.97 },
  "instructor": { "valor": "Carlos...", "confianza": 0.61 }
}
```

Y una pantalla de revisión antes de importar en definitiva, tipo:
"✓ 42 fichas reconocidas · ✓ 7 programas · ✓ 31 instructores ·
⚠ 3 registros requieren revisión".

## El corazón sigue siendo el motor de horarios

Un LLM **no** genera el horario. El motor debe conocer:

**Restricciones duras**
- Instructor no puede estar en dos clases a la vez.
- Ficha no puede estar en dos clases a la vez.
- Ambiente no puede duplicarse.
- Jornada debe respetarse.
- Disponibilidad debe respetarse.

**Preferencias** (pesos, no reglas duras)
- Reducir huecos.
- Agrupar clases.
- Preferir ciertos ambientes, días o evitar franjas determinadas.

Para esto, un optimizador tipo OR-Tools/Python tiene mucho más sentido que
un LLM.

## La IA como capa adicional

```
                 SIHS
                   │
       ┌───────────┴───────────┐
       ↓                       ↓
 Motor determinista        Módulo IA
 Python/OR-Tools          modelo pequeño
       │                       │
       └───────────┬───────────┘
                   ↓
                 BD
```

La IA interpreta y recomienda. Python valida y ejecuta.

## Para qué se usaría la IA (llamadas pequeñas)

1. **Interpretar instrucciones en lenguaje natural** — p. ej. "La ficha
   3171599 no puede tener clases el viernes" → JSON estructurado
   (`{"tipo": "bloqueo", "entidad": "ficha", "id": "3171599", "dia":
   "viernes"}`).
2. **Clasificar columnas desconocidas** de un Excel nuevo (GRUPO →
   ficha, DENOMINACIÓN → programa, TRM → trimestre, TIPO JORNADA →
   jornada).
3. **Explicar conflictos** en lenguaje amigable a partir de lo que Python
   ya detectó (p. ej. "instructor ocupado").
4. **Clasificar inconsistencias** entre Excel y BD, marcando
   `requiere_revision: true` — sin decidir cuál valor es el correcto.
5. **Sugerir preferencias** a partir de patrones observados (p. ej. un
   coordinador que mueve repetidamente cierta actividad de la tarde a la
   mañana) y proponerlas como preferencia configurable.

## Aprendizaje sin gastar IA

No todo el "aprendizaje" necesita un LLM. Si SIHS registra el ciclo
`dato detectado → usuario corrigió → dato correcto`, puede ir guardando
alias aprendidos sin ninguna llamada a IA:

```
"TIPO JORNADA"     → jornada
"JORNADA FORMATIVA" → jornada
"TRM" / "TRIM"      → trimestre
"GRUPO"             → ficha
```

Después de ~100 importaciones el sistema ya reconoce la mayoría de
formatos por su cuenta, y la IA solo entra cuando aparece algo
desconocido — lo que reduce aún más el costo (ver cotización aparte).

## Estructura de carpetas propuesta en el backend

```
backend/
│
├── importers/
│   ├── excel/
│   ├── pdf/
│   ├── csv/
│   └── normalizer/
│
├── scheduling/
│   ├── constraints/
│   ├── generator/
│   └── optimizer/
│
├── ai/
│   ├── client.py
│   ├── prompts.py
│   ├── schemas.py
│   └── tasks/
│       ├── classify_document.py
│       ├── parse_instruction.py
│       ├── explain_conflict.py
│       └── detect_inconsistency.py
│
└── models/
```

El resto del backend solo llama a la interfaz (`ai.parse_instruction(...)`,
`ai.classify_document(...)`, `ai.explain_conflict(...)`), de forma que
cambiar de proveedor (Gemini → Kimi → Groq → modelo local) no implica
reescribir SIHS.

## Requisitos de arquitectura (para dárselos a Claude Code como base)

1. Los documentos externos (Excel, PDF, CSV, etc.) son fuentes de
   información, no dependencias directas del motor de horarios.
2. Debe existir una capa de importación: detectar estructura → extraer →
   normalizar → validar.
3. El extractor no depende de posiciones fijas de celdas; identifica
   campos por nombres, alias, patrones, contenido, estructura y contexto.
4. Los datos extraídos se comparan contra la BD existente. Las
   coincidencias aumentan la confianza; las inconsistencias se marcan
   para revisión.
5. Existe un modelo de datos interno de SIHS independiente del formato
   de origen.
6. El motor de horarios funciona independientemente de la IA, con reglas
   deterministas y, más adelante, un optimizador tipo OR-Tools.
7. Las restricciones duras nunca se delegan a un LLM.
8. Las preferencias se manejan como pesos dentro del optimizador.
9. El sistema registra historial: horarios generados, modificaciones,
   rechazos, aprobaciones, conflictos y correcciones de importación.
10. Existe desde el inicio una interfaz `AIService` desacoplada del
    proveedor.
11. A futuro la IA se usa mediante llamadas pequeñas, específicas y
    estructuradas: clasificación de campos, interpretación de
    instrucciones, normalización semántica, detección/clasificación de
    inconsistencias, explicación de conflictos, sugerencia de
    preferencias.
12. Las respuestas del LLM son JSON estructurado y siempre se validan
    con Python/Pydantic antes de modificar datos o reglas.
13. La IA es asistente del sistema, no fuente absoluta de verdad.
14. El proveedor de IA se puede cambiar sin modificar el resto del
    backend.
15. Debe poder usarse modelo local, API económica o API más potente
    como fallback.
16. Existe un sistema de confianza para los datos importados.
17. El sistema registra correcciones humanas para que a futuro se
    conviertan en reglas, alias, patrones o preferencias aprendidas.
18. No se implementa IA todavía si no es necesaria para el MVP, pero la
    arquitectura queda preparada para incorporarla después sin rehacer
    el sistema.

## Ruta concreta recomendada

1. **MVP**: Python + OpenPyXL/Pandas + Pydantic + BD + motor de
   restricciones. Sin IA.
2. **Primera IA experimental**: modelo local (Qwen3 4B vía Ollama) —
   costo $0.
3. **Fallback económico**: Gemini 2.5 Flash-Lite — centavos de peso por
   llamada pequeña.
4. **Fallback más potente**: Kimi / Gemini Flash.

Ver [Cotización de integración de IA](../Documentación%20general/COTIZACION_INTEGRACION_IA.md)
para el detalle de costos por modelo.
