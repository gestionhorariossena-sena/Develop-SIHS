# Datos de muestra

Archivos reales del centro que sirven de referencia para el parser del
asistente de programación: son el formato que `asistente_horario_service.py`
debe saber leer (título en la fila 1, encabezado en la 3, columnas TRM en
número romano, hojas por trimestre, etc.).

**Contienen datos institucionales reales** (nombres de instructores, fichas,
programación vigente), por eso `.gitignore` los excluye con `*.xlsx`: están
acá para trabajar en local, no para subirse al repositorio. Si te faltan,
pídelos al equipo — no los repongas desde una fuente pública.

Los usa:

- `backend/scripts/demo_flujo_completo_ia_optimizador.py` — los abre en
  tiempo de ejecución (`LIDERES DE FICHA 2026_pruebas.xlsx`).
- Docstrings de `backend/app/services/asistente_horario_service.py`,
  `backend/app/scheduling/generator.py` y `backend/tests/test_curriculo_service.py`
  — los citan como referencia del formato; los tests construyen sus propios
  archivos en memoria y no dependen de estos.
