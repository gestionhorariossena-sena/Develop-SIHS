# Evidencia de pruebas S5 — Edith

## Alcance

Suite: `frontend/tests/unit/services/api.msw.test.ts`.

Ángulo asignado: **Front — cliente HTTP/MSW**. Dependencia fuera del control
del proyecto: la red/el backend FastAPI, consumida por
`frontend/src/services/api.ts` (`apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete`).

Se agregó `msw@^2.15.0` como devDependency del frontend. No había exclusión
de cobertura configurada para `src/services/api.ts` en `vite.config.ts`
(no existe bloque `coverage.exclude`), así que no aplicaba retirar nada.

## Tipo de doble usado

MSW actúa como un **fake** en la frontera externa: un servidor HTTP de
mentira que intercepta `fetch` real (vía `setupServer`/`msw/node`) y
responde como si fuera el backend, sin levantar FastAPI ni tocar la red
real. En dos de los cinco tests también se usa como **spy** -- se captura
qué encabezados mandó de verdad el cliente -- para comprobar
comportamiento, no solo estado.

No se duplicó nada de `tests/unit/services/api.test.ts` (ese archivo ya
existente cubre `getUserFriendlyApiMessage` en aislado y un solo caso de
`apiGet` con `fetch` mockeado a mano para el cuelgue de
`supabase.auth.getSession()`). Los 5 tests nuevos prueban el contrato HTTP
de punta a punta.

## Cinco escenarios nuevos (≥3 pedidos, se hicieron 5)

1. **200 feliz** — el cliente devuelve el JSON tal cual (estado/resultado)
   y manda el token real como `Authorization: Bearer <token>`
   (comportamiento).
2. **Sin sesión activa** — el cliente NO manda el encabezado
   `Authorization` (comportamiento: ausencia verificada, no solo presencia).
3. **500 con `detail`** — lanza `ApiError` con el mensaje genérico de
   servidor (no el `detail` crudo del backend) — estado/resultado.
4. **422 con `detail` de negocio** — el mensaje mostrado es el `detail`
   real del backend (a diferencia del 500/401/403, el 422 sí se respeta
   tal cual lo manda el backend) — estado/resultado.
5. **Respuesta no-JSON** (ej. página de error HTML de un proxy) — el
   cliente no revienta con un `SyntaxError` sin capturar; cae a un
   `ApiError` con el estado real y el mensaje genérico de 502 — este es el
   escenario que explícitamente pedía el reto.

## Mutación

Se cambió temporalmente, en `frontend/src/services/api.ts`
(función `request`, manejo de respuestas no-2xx):

```diff
- const body = await response.json().catch(() => null)
+ const body = await response.json()
```

Esto quita la protección contra una respuesta no-JSON -- exactamente la
dependencia externa que el test 5 aísla con el doble.

Comando:

```bash
cd frontend
pnpm exec vitest run tests/unit/services/api.msw.test.ts
```

**Resultado rojo:** 1 failed, 4 passed. Falló
`respuesta no-JSON (ej. página de error de un proxy): no revienta, cae a
un ApiError con el estado real` con
`AssertionError: expected SyntaxError: Unexpected token '<', "<html…` —
el `SyntaxError` de `response.json()` salió sin capturar en vez de
convertirse en un `ApiError` limpio.

Se restauró la línea original (`git diff` confirmado limpio).

**Resultado verde:** mismo comando → **5 passed**.

## Verificación adicional

- Suite completa del frontend: 383 passed (55 archivos).
- `npx tsc -b`: sin errores.
- `pnpm lint`: sin errores.
- Cobertura (`pnpm test:coverage`), umbrales heredados (76,73 % / 64,85 % /
  73,89 % / 79,59 %) y `pnpm build`: ver resultado adjunto en el PR.

## Revisión de exceso de simulacros (autoevaluación de mis propios tests)

Antes de la revisión grupal obligatoria (sección 5 del reto), reviso mis
propios 5 tests con las mismas preguntas:

- **¿Se prueba un resultado observable o solo la llamada al simulacro?**
  Los 5 tests verifican el resultado real del cliente (`resultado`
  devuelto o `error` lanzado con su `.status`/`.message`), no solo que
  `fetch` se haya llamado. Los dos tests de encabezados (`Authorization`)
  sí comprueban comportamiento puro -- deliberado, porque ese
  comportamiento (mandar o no el token) no tiene ningún "resultado" visible
  distinto del lado del cliente.
- **¿El doble está en la frontera externa?** Sí -- MSW intercepta a nivel
  de red (`fetch`), no sustituye ninguna función propia de `api.ts`. Lo
  único mockeado con `vi.fn()` es `supabase.auth.getSession()`, que
  también es una dependencia externa (Supabase), no código propio.
- **¿Un fake sustituye comportamiento que debería ser real?** No -- el
  cliente real (`request()`, `apiGet`, `apiPost`, `ApiError`,
  `getUserFriendlyApiMessage`) corre sin modificar; solo la respuesta de
  "internet" es falsa.
