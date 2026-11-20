# Puertas de calidad para PR hacia develop

**Issue:** [#219](https://github.com/gestionhorariossena-sena/Develop-SIHS/issues/219)

## Regla mínima

Un PR hacia `develop` debe incluir evidencia verde o una excepción registrada.
No se puede solicitar merge usando solamente una descripción o una promesa de
ejecución posterior. Una excepción debe indicar alcance, comando no ejecutado,
motivo verificable, responsable y fecha de revisión.

## Comandos mínimos por capa

| Capa | Comando mínimo | Evidencia |
|---|---|---|
| Backend | `cd backend && python -m pip install -r requirements.txt && pytest -v --cov=app --cov-report=term --cov-fail-under=84` | Conteo de pruebas, cobertura y run de Actions |
| Frontend | `cd frontend && pnpm install --frozen-lockfile && pnpm lint && pnpm build && pnpm test:coverage` | Resultado de lint, build y Vitest |
| Mobile | `cd mobile && flutter pub get && flutter analyze && flutter test` | Resultado de `analyze` y `flutter test` |
| E2E | Cuando aplique: `cd e2e && pnpm install --frozen-lockfile && pnpm exec playwright install chromium && pnpm exec playwright test` | Reporte Playwright y capturas de fallos |
| Documentación o configuración | Ejecutar los checks automatizados afectados y adjuntar el run de CI; si no afecta una capa, justificar `N/A` | Captura o enlace al run |

El backend y el frontend conservan los umbrales existentes. El móvil debe
pasar `flutter analyze` y `flutter test`; no se aceptan análisis con errores.

## E2E aplicable

E2E es obligatoria para cambios de navegación, autenticación, publicación,
creación o consulta de horarios y recuperación de errores visibles. Puede
omitirse con excepción si la capa no afecta el navegador.

Los flujos con Supabase o backend real requieren cuentas o fixtures aislados.
No deben versionarse credenciales ni ejecutarse contra producción.

CI incluye un smoke E2E sin credenciales:

```powershell
cd e2e
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test tests/login.spec.ts --grep "muestra los campos del formulario"
pnpm exec playwright test tests/login-validacion.spec.ts
```

## Checklist obligatorio del PR

1. Seleccionar la capa real del autor y la capa del revisor.
2. Completar `## Evidencia` con URLs o artefactos.
3. Marcar cada check solo después de ejecutar lo indicado.
4. Registrar `N/A` y el motivo en el campo de excepción si una validación no aplica.
5. Adjuntar un issue o reporte para fallos P0/P1 y bloquear el merge mientras persistan.
6. Confirmar que no haya credenciales, `.env`, datos reales o mutantes activos.

## Evidencia mínima

- Run de GitHub Actions aprobado.
- Conteos exactos de pruebas ejecutadas y omitidas.
- Cobertura cuando la capa la produzca.
- Captura o video para cambios manuales o E2E.
- Incidente ligado para cualquier excepción o fallo conocido.

El trabajo se considera cerrado solo con PR fusionado hacia `develop`,
`Closes #219` en la descripción y todos los checks del Quality Gate aprobados.

## Evidencia de validación local

- Frontend: lint y build aprobados; la suite Vitest quedó con 1 fallo de
  Registro y la cobertura debe verificarse en el run de CI.
- Backend: 467 pruebas aprobadas, 10 omitidas y 1 fallida.
  Cobertura 84,59 %, por encima del mínimo 84 %. El fallo aislado quedó en
  `test_generar_propuesta_lote_grande_se_resuelve_ficha_por_ficha_sin_colgarse`.
- Mobile: `flutter analyze` detectó una implementación ausente en mocks de
  asistencia y un activo `.env`; el bloque debe registrarse como excepción
  hasta que esa tarea sea corregida.
- E2E: 3 pruebas de login/aprobadas localmente: 1 prueba de campos visibles
  y 2 pruebas de validación sin llamadas al backend.
