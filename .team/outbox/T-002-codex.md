# T-002 — entregable de `codex`

**Rama:** `codex/t-002-crea-backend-tests-readme-md-explicando-`  
**Cerrado:** 2026-09-30 01:13

## Cambios contra develop

```
 backend/tests/README.md | 35 +++++++++++++++++++++++++++++++++++
 1 file changed, 35 insertions(+)
```

## Lo que reportó el agente

David debe revisar el contenido y, si desea, ejecutar el ejemplo puntual; mi ejecución de ese test no devolvió resultado antes del límite de la herramienta. El chequeo de formato del diff pasó.
diff --git a/backend/tests/README.md b/backend/tests/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..ccf0a601a2defbd8d8d44d9976797ca47422262b
--- /dev/null
+++ b/backend/tests/README.md
@@ -0,0 +1,35 @@
+# Pruebas del backend
+
+El entorno virtual del backend ya está enlazado. Desde la raíz del repositorio,
+ejecuta un archivo de prueba concreto con:
+
+```bash
+cd backend && .venv/bin/python -m pytest -q tests/test_health.py
+```
+
+Reemplaza `tests/test_health.py` por el archivo que estés modificando. No uses
+`pytest` suelto ni ejecutes `pip install`: no están disponibles en el `PATH`
+del entorno de trabajo.
+
+## Supabase compartida
+
+La configuración de `backend/.env` apunta a la instancia de Supabase
+compartida por el equipo. No ejecutes toda la suite sin una necesidad concreta:
+limita cada ejecución al archivo (o prueba) que corresponda a tu cambio para
+evitar tráfico y efectos sobre recursos compartidos.
+
+La mayoría de las pruebas usan las fixtures de `conftest.py`, que crean una
+base SQLite en memoria y simulan la verificación de tokens de Supabase. Aun
+así, la aplicación carga su configuración normal al iniciar; no modifiques
+credenciales ni uses la Supabase compartida para pruebas manuales.
+
+`test_publicacion_programada_postgres.py` es una excepción: solo se habilita
+si se define `SIHS_ISOLATED_PG_URL` y rechaza cualquier base que no sea la
+instancia PostgreSQL temporal aislada que exige el propio archivo. No lo
+ejecutes contra la Supabase compartida.
+
+Para ejecutar una sola prueba dentro de un archivo, añade su selector:
+
+```bash
+cd backend && .venv/bin/python -m pytest -q tests/test_health.py::test_health_check
+```

tokens used
39.222
Creé [backend/tests/README.md](/home/david/dev/wt/codex-sihs/backend/tests/README.md) con:

- El comando obligatorio usando el venv enlazado.
- Ejemplos para un archivo y una prueba puntual.
- La advertencia sobre la Supabase compartida y evitar la suite completa.
- La aclaración de fixtures locales y del test PostgreSQL estrictamente aislado.

Pendiente: ninguno.

David debe revisar el contenido y, si desea, ejecutar el ejemplo puntual; mi ejecución de ese test no devolvió resultado antes del límite de la herramienta. El chequeo de formato del diff pasó.

  ✓ entregable recogido: .team/outbox/T-002-codex.md
  sin cambios de código en la rama

  Revisa y marca:  duo done T-002
