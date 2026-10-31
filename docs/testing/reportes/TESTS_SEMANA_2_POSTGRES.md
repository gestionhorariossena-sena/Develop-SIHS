# Reporte de pruebas — Semana 2: PostgreSQL real

**Fecha:** 2026-10-13
**Resultado:** PASS — 2 pruebas aprobadas, 0 fallidas, código de salida 0.

| Prueba | Qué valida | Por qué y para qué sirve |
|---|---|---|
| `test_repositorio_horario_guardado_persiste_jsonb_y_relacion_usuario` | Persiste y recupera el horario y su contenido JSONB desde una nueva sesión de PostgreSQL, junto con su relación al usuario. | Detecta incompatibilidades con PostgreSQL que SQLite en memoria puede ocultar. |
| `test_endpoint_publica_horario_y_solo_el_instructor_destino_lo_ve` | Verifica el flujo HTTP: el borrador no es visible, el instructor no puede publicar, coordinación publica y el instructor asignado recibe el horario. | Comprueba permisos por rol y persistencia/lectura sobre el motor real. |

**Base aislada:** PostgreSQL 16 desechable de `backend/tests/docker-compose.postgres.yml`, base `sihs_test`, puerto local `55440`. No usa Supabase ni producción.

**Ejecución:** desde la raíz:

```powershell
$env:SIHS_TEST_DATABASE_URL='postgresql+psycopg://sihs_test:sihs_test_only@127.0.0.1:55440/sihs_test'
& 'backend\.venv\Scripts\python.exe' -m pytest 'backend\tests\test_real_postgres.py' -v
```

Resultado de pytest: 2 passed en 8.59 s. Se informó una advertencia de deprecación de Starlette/httpx, sin fallos.
