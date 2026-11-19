# Semana 5 — E2E con red simulada (Dayana)

## Alcance

Se agregaron tres escenarios en `e2e/tests/s5-red-dayana.spec.ts` sobre la pantalla real `/mi-horario`. Playwright conserva el frontend, el router y sus componentes; `page.route` sustituye las respuestas HTTP de la API. La sesión de instructor usada por la ruta protegida se instala en el navegador para no depender de Supabase ni de credenciales reales.

| Escenario | Doble y motivo | Resultado observable |
|---|---|---|
| API caída | Stub de red con `route.abort('failed')`, para simular una falla de conexión en la frontera HTTP | El aviso de conexión queda visible; se confirma que el frontend consultó los horarios |
| Lista vacía | Stub HTTP `200` con `[]`, para controlar el resultado de la API sin reemplazar la pantalla | Se muestra el estado vacío de horarios publicados |
| Error de validación | Stub HTTP `422` con `detail`, para aislar el contrato de error del backend | El detalle «El período solicitado no es válido.» queda visible |

Los tests también verifican que las rutas utilizadas estén preparadas por el doble. Se comprueba el estado presentado por la interfaz, no únicamente que el handler de ruta haya sido llamado. El doble está en la frontera de red; la lógica de la pantalla permanece real.

## Evidencia roja/verde de mutación

Mutante temporal local en `frontend/src/pages/MiHorario.tsx`: el `catch` de la consulta de horarios dejó de presentar el error (`setError(null)`). Este cambio se restauró y **no forma parte de la rama entregable**.

| Ejecución | Comando / cambio | Resultado |
|---|---|---|
| Verde inicial | `pnpm exec playwright test tests/s5-red-dayana.spec.ts` | Exit code 0; 3 passed |
| Rojo | Mismo comando con el mutante temporal | Exit code 1; 2 failed (caída de API y 422), 1 passed |
| Verde restaurado | Mismo comando después de restaurar `MiHorario.tsx` | Exit code 0; 3 passed |

Los dos fallos rojos ocurrieron porque ya no aparecía el mensaje esperado en la UI. La prueba de lista vacía siguió pasando, como corresponde: su respuesta fue exitosa y no depende del manejo de errores.

## Verificación de la suite

- Baseline `pnpm test` en `e2e/`: 7 passed, 2 skipped y 1 failed (exit code 1). El fallo preexistente es `login.spec.ts`, que exige `E2E_LOGIN_IDENTIFIER`, `E2E_LOGIN_PASSWORD` y `E2E_EXPECTED_ROLE`; esas credenciales de prueba no estaban configuradas.
- Suite sin ese caso dependiente de credenciales: `pnpm exec playwright test --grep-invert 'autentica un usuario institucional'` — exit code 0; 10 passed y 2 skipped.
- Node.js: 26.3.0. Chromium de Playwright disponible; Vite arrancó automáticamente para las ejecuciones.
- Docker: no disponible; `docker info` no pudo conectar con `dockerDesktopLinuxEngine`. No afecta estos E2E: la red de API se simula en el navegador y no se usa infraestructura Docker.
- No se ejecutó contra producción ni se utilizaron credenciales externas.

## Estado de revisión

La revisión de exceso de mocks es favorable: la interfaz y el comportamiento del frontend son reales; el doble solo controla la dependencia HTTP y las aserciones se centran en mensajes y estados visibles. La ejecución local no sustituye la CI del PR. El PR individual debe dirigirse a `semana-5`, solicitar revisión de Edith y permanecer sin merge hasta completar la revisión del equipo.
