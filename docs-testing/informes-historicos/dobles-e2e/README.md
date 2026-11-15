# Dobles de prueba y flujos E2E de horarios

## Dependencias externas del backend

| Dependencia | Código de producción | Interacción real | Doble en pruebas |
|---|---|---|---|
| Gemini API | `backend/app/ai/client.py`, invocado desde `backend/app/services/asistente_horario_service.py` y tareas `backend/app/ai/tasks/` | `httpx.post` a `generativelanguage.googleapis.com`; usa `GEMINI_API_KEY` | `fake_gemini` en `backend/tests/conftest.py` devuelve la estructura `candidates[].content.parts[].text` que el cliente interpreta como JSON. Las pruebas de `test_ai_*` y `test_asistente_horario_service.py` también sustituyen el POST para casos y errores específicos. |
| Supabase Auth, verificación de sesión | `backend/app/core/supabase_auth.py` | `httpx.get` a `/auth/v1/user` para validar el bearer recibido | `fake_supabase` en `backend/tests/conftest.py` registra tokens conocidos y devuelve 401 para los demás; limpia la caché de tokens antes de cada uso. |
| Supabase Auth, login por documento | `backend/app/api/v1/usuarios.py` | `httpx.post` a `/auth/v1/token?grant_type=password` | `test_external_dependencies_doubles.py` simula tanto el intercambio exitoso como las credenciales rechazadas. El login del frontend con correo institucional llama directamente a `supabase-js`. |

Las pruebas unitarias no necesitan claves de Gemini ni credenciales de Supabase. Gemini y Auth se simulan en la capa que realiza cada llamada; no se incorpora una ruta de autenticación falsa al código de producción.

## E2E de Playwright

`e2e/tests/horarios-flujos.spec.ts` agrega dos flujos reales UI → API:

1. Crea un borrador mediante `POST /horarios/`, lo abre en **Horarios completos**, pulsa **Publicar ahora**, comprueba el `PATCH /horarios/{id}/estado` y consulta el recurso por API para verificar la persistencia.
2. Consulta los catálogos y valida por API una celda libre; luego usa el constructor manual, selecciona el resultado/instructor/ambiente, coloca el bloque en la celda y confirma el alta consultando de nuevo los horarios de la ficha.

Cada horario creado durante el test se elimina por API en `finally`. Los casos se ejecutan en serie para evitar que se disputen el mismo espacio. Estos E2E usan un **proyecto de Supabase y un backend/base de datos exclusivos para pruebas**: no interceptan Auth ni las rutas de la aplicación, porque el backend debe validar el token auténtico para probar persistencia. Gemini no participa en estos dos flujos manuales; se prueba con dobles en backend.

Variables requeridas para habilitar estos dos casos:

```text
E2E_API_URL=http://127.0.0.1:8001/api/v1
E2E_LOGIN_IDENTIFIER=coordinador-de-pruebas
E2E_LOGIN_PASSWORD=...
E2E_TEST_FICHA_ID=...
E2E_TEST_INSTRUCTOR_ID=...
E2E_TEST_AMBIENTE_ID=...
E2E_TEST_RESULTADO_ID=...
```

El usuario configurado debe tener rol Coordinador o Administrador y los IDs deben identificar registros activos relacionados en los catálogos de prueba. La ficha debe tener al menos una jornada que coincida con las franjas del constructor. Si falta cualquiera de estas variables o la fixture de catálogos, los casos quedan omitidos o fallan explícitamente; nunca usan la base productiva como fallback.

Desde la raíz del monorepo, con el backend de pruebas en ejecución y la configuración Vite del frontend apuntando al Supabase de pruebas:

```powershell
pnpm --dir e2e exec playwright test tests/horarios-flujos.spec.ts
```

No configurar contraseñas en este documento ni versionar archivos `.env` con credenciales.
