# Tests de frontend — Vitest

Estructura separada del código de producción `frontend/src/`:

- `unit/` — pruebas de reglas y componentes por módulo, respetando la estructura de `src/`.
- `integration/` — flujos de componentes con servicios simulados, ejecutados con Vitest.
- `helpers/` — utilidades para montar componentes en los tests.
- `setup.ts` — inicialización compartida.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm test
pnpm test:coverage
```

La ejecución E2E con navegador es independiente: `cd e2e && pnpm test`.
