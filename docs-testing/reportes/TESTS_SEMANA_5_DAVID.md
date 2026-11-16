# Evidencia de pruebas S5 — David

## Alcance

Suite: `backend/tests/test_s5_solicitud_acceso_service_david.py`.

Prueba `SolicitudAccesoService.crear` aislando sus dependencias de
repositorio. Incluye rol inexistente (no consulta ni guarda), correo con
solicitud pendiente (no persiste ni notifica) y solicitud valida (el fake en
memoria conserva el modelo y se verifica la respuesta).

## Dobles y motivo

- `Mock` para el lookup de rol y para notificaciones: son dependencias
  externas al servicio bajo prueba; permiten comprobar llamadas y garantizar
  que no se envian notificaciones en los caminos rechazados.
- Fake de `SolicitudAccesoRepository` en memoria: representa consultas y
  escrituras sin SQLAlchemy; su lista `solicitudes` hace observable el estado
  guardado.
- `Mock` para la sesion en los tests unitarios: permite comprobar que el
  servicio no confirma transacciones al rechazar entradas.

No se llaman Supabase, correo, PostgreSQL ni la red.

## Mutacion roja/verde

Se invirtio temporalmente la condicion de rol inexistente en
`SolicitudAccesoService.crear` (`if not rol` por `if rol`).

Comando rojo, ejecutado desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_s5_solicitud_acceso_service_david.py::test_rol_inexistente_no_consulta_duplicados_ni_persiste
```

Resultado rojo: **1 failed**. `buscar_pendiente.assert_not_called()` detecto
que el lookup de solicitudes fue llamado una vez con `ada@example.com`,
aunque el rol no existia.

Se restauro la condicion original. La mutacion no forma parte del codigo
entregable.

## Ejecucion verde

Comando, desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_s5_solicitud_acceso_service_david.py tests/test_solicitudes_acceso.py
```

Resultado tras restaurar la condicion: **21 passed** (3 tests S5 nuevos y
18 pruebas existentes de solicitudes de acceso). Hubo una advertencia
deprecada de Starlette relacionada con `httpx` en `TestClient`.
