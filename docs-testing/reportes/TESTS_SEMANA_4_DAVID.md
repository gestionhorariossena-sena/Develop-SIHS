# Evidencia de pruebas S4 — David

## Alcance

Suite: `backend/tests/test_s4_seguridad_errores_david.py`.

Incluye respuestas `401` y `403`, lectura autorizada del contrato JSON de
fichas y rechazo seguro de JSON mal formado (`422`). Las solicitudes se
ejecutan con FastAPI `TestClient`, SQLite en memoria y Supabase simulado; no
requieren iniciar el backend ni el frontend.

## Mutación de autorización

Se cambió temporalmente la dependencia del `POST /api/v1/fichas/` de
`require_admin` a `get_current_user`, permitiendo que un usuario autenticado
sin rol administrador llegara al endpoint.

Comando:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend\tests\test_s4_seguridad_errores_david.py::test_crear_ficha_con_rol_sin_permiso_devuelve_403
```

Resultado rojo esperado: **1 failed**. La aserción esperaba `403` y recibió
`500` al continuar la solicitud sin el control de rol. La mutación fue
restaurada; no forma parte del código final.

## Ejecución verde después de restaurar

Comando:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend\tests\test_s4_seguridad_errores_david.py .\backend\tests\test_roles.py .\backend\tests\test_fichas_faseactual.py .\backend\tests\test_errores_no_manejados.py
```

Resultado: **31 passed**, 1 advertencia deprecada de Starlette relacionada
con `httpx` en `TestClient`.
