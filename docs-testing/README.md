# Testing SIHS — Documentación

Guías, metodología, reportes y evidencias del bootcamp. [Documentación general SIHS](../docs-sihs/README.md).

- [Matriz oficial de rotación](../docs/matriz-rotacion.md) — la ruta exacta `docs/matriz-rotacion.md` es obligatoria para ADSO.
- [Resumen del bootcamp](./bootcamp/RESUMEN_BOOTCAMP_NOTEBOOKLM.md).
- [Reporte E2E semana 1](./reportes/TESTS_SEMANA_1_E2E.md).
- [Pruebas con PostgreSQL](./reportes/TESTS_SEMANA_2_POSTGRES.md).
- [Informes históricos](./informes-historicos/README.md).

## Organización de tests ejecutables

| Proyecto | Código de aplicación | Pruebas |
|---|---|---|
| Backend Python | `backend/app/` | [`backend/tests/`](../backend/tests/) |
| Frontend React | `frontend/src/` | [`frontend/tests/`](../frontend/tests/) |
| E2E navegador | Frontend + backend | [`e2e/tests/`](../e2e/tests/) |

En frontend, Vitest descubre los tests en `frontend/tests/{unit,integration}/` y utiliza `frontend/tests/setup.ts`. Las pruebas E2E de Playwright viven únicamente en `e2e/tests/`.

### Archivo institucional y Drive

Los PDF, hojas de cálculo, audios y documentos institucionales deberán verificarse en Drive antes de retirarlos de Git. No copiar secretos o datos sensibles a carpetas abiertas.
