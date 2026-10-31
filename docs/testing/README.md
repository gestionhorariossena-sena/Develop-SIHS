# Testing SIHS — Índice de documentación

Esta carpeta es la **fuente de documentación de testing del repositorio**. No contiene código de pruebas ejecutables.

## Semana 1 y semana 2

- [Matriz oficial de rotación](../matriz-rotacion.md) — responsables, capa S1/S2, seguimiento y umbrales.
- [Resumen del bootcamp ADSO](./bootcamp/RESUMEN_BOOTCAMP_NOTEBOOKLM.md) — guion histórico; contrastar cualquier dato antiguo con CI actual.
- [Reporte E2E de semana 1](./reportes/TESTS_SEMANA_1_E2E.md).
- [Reporte PostgreSQL de pruebas](./reportes/TESTS_SEMANA_2_POSTGRES.md).
- [Informes técnicos históricos](./informes-historicos/README.md) — evidencias por módulo y fecha (no reemplazan el CI actual).

## Dónde están las pruebas que se ejecutan

| Tipo | Ubicación | Herramienta |
|---|---|---|
| Unitarias frontend | `frontend/src/**/*.test.ts(x)` | Vitest |
| Unitarias/API/backend | `backend/tests/` | pytest |
| E2E navegador | `e2e/tests/` | Playwright |
| Workflows | `.github/workflows/` | GitHub Actions |

**No mover esas carpetas de código** sin actualizar configuraciones y verificar todo el CI.

## Política de almacenamiento

Los documentos operativos versionados en Markdown y los diagramas editables se conservan en Git. Los archivos institucionales (Excel, grabaciones, datos nominales, informes ofimáticos, respaldos) deben **copiarse al Drive compartido y verificarse antes de solicitar su eliminación del repositorio**. No se borrará nada automáticamente ni se publicará información sensible en reportes públicos. Para un reporte de retiro, identificar ruta, tamaño, hash SHA-256, uso en código, copia confirmada y destino Drive.
