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

## Mutaciones roja/verde por test

Cada prueba se ejecutó por separado contra una mutación temporal. Las tres
mutaciones se restauraron antes de ejecutar la comprobación verde; no quedan
mutantes en el código final.

### 1. Rol inexistente

Se invirtió temporalmente la condición de rol inexistente en
`SolicitudAccesoService.crear` (`if not rol` por `if rol`). La prueba falló en
`buscar_pendiente.assert_not_called()`: el lookup de duplicados se ejecutó
una vez aunque el rol no existía.

Rojo, desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_s5_solicitud_acceso_service_david.py::test_rol_inexistente_no_consulta_duplicados_ni_persiste
```

Resultado: **1 failed**. Se restauró `if not rol`.

### 2. Correo con solicitud pendiente

Se invirtió temporalmente la condición del duplicado (`if pendiente` por
`if not pendiente`). El servicio intentó guardar el duplicado y devolvió una
respuesta de creación en vez de `YA_PENDIENTE`.

Rojo, desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_s5_solicitud_acceso_service_david.py::test_email_pendiente_no_guarda_ni_notifica
```

Resultado: **1 failed** (`respuesta` no fue `YA_PENDIENTE`). Se restauró la
condición original.

Verde, tras restaurar:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_s5_solicitud_acceso_service_david.py::test_email_pendiente_no_guarda_ni_notifica
```

Resultado: **1 passed**.

### 3. Solicitud válida

Se omitió temporalmente la llamada `SolicitudAccesoRepository.crear(db,
solicitud)`. La prueba detectó que el fake no guardó ninguna solicitud.

Rojo, desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_s5_solicitud_acceso_service_david.py::test_solicitud_valida_se_guarda_en_fake_y_devuelve_respuesta
```

Resultado: **1 failed** (`len(fake_repository.solicitudes)` fue `0`, esperado
`1`). Se restauró la llamada al repositorio.

Verde, tras restaurar:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_s5_solicitud_acceso_service_david.py::test_solicitud_valida_se_guarda_en_fake_y_devuelve_respuesta
```

Resultado: **1 passed**.

## Ejecucion verde

Suite nueva y regresiones existentes, desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_s5_solicitud_acceso_service_david.py tests/test_solicitudes_acceso.py
```

Resultado local: **21 passed** (3 tests S5 nuevos y 18 pruebas existentes de
solicitudes de acceso), con una advertencia deprecada de Starlette sobre
`httpx` en `TestClient`.

CI del commit `4d67dca2dba8c54ccef95a0951a0988511d4ff45`: [GitHub Actions
#43815486466](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43815486466).
El job **Backend (pytest)** ejecutó `pytest -v --cov=app --cov-report=term
--cov-fail-under=84` y terminó exitosamente.
