# Evidencia de pruebas S4 — David

## Alcance

Suite: `backend/tests/test_s4_seguridad_errores_david.py`.

Incluye respuestas `401` y `403`, lectura autorizada del contrato JSON de
fichas y rechazo seguro de JSON mal formado (`422`). Las solicitudes se
ejecutan con FastAPI `TestClient`, SQLite en memoria y Supabase simulado; no
requieren iniciar el backend ni el frontend.

## Mutaciones individuales

Cada test se ejecutó por separado contra una mutación temporal de la conducta
de producción. Los cuatro comandos terminaron con **1 failed**, por la
aserción que protege el comportamiento correspondiente. Todos los cambios
temporales se restauraron y no forman parte del código final.

### 1. Autenticación ausente

Se configuró temporalmente `HTTPBearer(auto_error=False)`, evitando que el
esquema rechazara la petición sin token con `401`. La prueba esperaba `401`
y recibió `500`.

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend\tests\test_s4_seguridad_errores_david.py::test_crear_ficha_sin_autenticacion_devuelve_401
```

### 2. Rol sin permiso

Se reemplazó temporalmente `require_admin` por `get_current_user` en la
creación de fichas. Para que el caso ejercitara solo autorización, se usaron
IDs existentes de programa y trimestre. La mutación permitió crear la ficha
(`200`); la prueba esperaba `403`.

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend\tests\test_s4_seguridad_errores_david.py::test_crear_ficha_con_rol_sin_permiso_devuelve_403
```

### 3. Contrato del listado

Se hizo que el endpoint devolviera temporalmente una lista vacía. La prueba
esperaba la ficha preparada y recibió cero elementos.

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend\tests\test_s4_seguridad_errores_david.py::test_listar_fichas_como_instructor_devuelve_contrato_json
```

### 4. JSON mal formado

Se cambió temporalmente el manejo de errores de validación de FastAPI de
`422` a `400`. La prueba esperaba `422` y recibió `400`.

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend\tests\test_s4_seguridad_errores_david.py::test_crear_ficha_con_json_malformado_devuelve_422_seguro
```

## Restauración y ejecución verde

Tras cada caso se restauró la implementación antes de pasar al siguiente.
Después de las cuatro mutaciones, se ejecutó la suite S4 y sus regresiones con:

Comando:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend\tests\test_s4_seguridad_errores_david.py .\backend\tests\test_roles.py .\backend\tests\test_fichas_faseactual.py .\backend\tests\test_errores_no_manejados.py
```

Resultado después de las mutaciones y restauraciones: **31 passed**, con una
advertencia deprecada de Starlette relacionada con `httpx` en `TestClient`.
