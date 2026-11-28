# Matriz de aceptación de la demo SIHS

**Issue:** [#215](https://github.com/gestionhorariossena-sena/Develop-SIHS/issues/215)
**Rama:** `demo/qa-integracion`
**Responsable:** Dayana / QA e integración
**Estado:** matriz definida; ensayos DEMO pendientes
**Entorno:** desarrollo o DEMO limpio, sin credenciales ni datos reales

## Convenciones

- **Resultado esperado:** comportamiento verificable por una persona observadora.
- **Evidencia:** captura, video, resultado de CI o archivo de prueba ejecutado.
- **OK:** solo se marca después de ejecutar el caso y conservar evidencia.
- **Fallo:** registrar URL del issue creado, prioridad y responsable.

## Matriz trazable

| ID | Área | Precondición | Pasos | Resultado esperado | Evidencia |
|---|---|---|---|---|---|
| DEMO-01 | Login y roles | Cuenta DEMO vigente para cada rol: coordinador, programador, instructor y aprendiz | 1. Abrir SIHS. 2. Iniciar sesión con cada rol. 3. Confirmar la vista inicial. 4. Cerrar sesión. | El acceso es exitoso, el menú corresponde al rol y no aparecen acciones no autorizadas. | Captura por rol y registro de resultados de CI. |
| DEMO-02 | Datos DEMO | Base DEMO reiniciada y catálogo cargado | 1. Revisar fichas, sedes, ambientes, instructores y periodos. 2. Confirmar que no existen datos reales ni datos residuales. | Los datos visibles son deterministas y suficientes para el guion completo. | Captura del directorio DEMO; registrar el resultado al ejecutar el caso. |
| DEMO-03 | Creación de horario | Usuario coordinador o programador autenticado; catálogo cargado | 1. Abrir gestión de horarios. 2. Crear una asignación válida. 3. Guardar. 4. Consultar el horario creado. | El horario se guarda una sola vez y muestra ficha, instructor, ambiente y franja correctos. | Captura antes/después y prueba `test_s4_crud_horarios_dayana.py`. |
| DEMO-04 | Validación de conflictos | Horario válido existente | 1. Intentar crear una segunda asignación que choque con instructor, ficha o ambiente. 2. Guardar. | La aplicación evita el conflicto o muestra un mensaje claro con el recurso afectado; no crea un horario inválido. | Captura del conflicto y prueba `test_horarios_aislamiento_trimestre.py`. |
| DEMO-05 | Publicación | Horario válido y usuario coordinador o programador autenticado | 1. Seleccionar el horario. 2. Ejecutar publicación. 3. Consultar la vista institucional. | El estado cambia correctamente y el horario publicado queda visible para los roles autorizados. | Captura de estado publicado y prueba `test_publicacion_programada_postgres.py`. |
| DEMO-06 | Consulta por rol | Horario publicado | 1. Consultar el horario como instructor. 2. Consultarlo como aprendiz. 3. Consultar el directorio general. | Cada rol recibe el horario correspondiente y no puede editarlo si no tiene permiso. | Capturas por rol y pruebas E2E existentes. |
| DEMO-07 | Móvil MVP | APK instalado en Android físico o emulador; API accesible | 1. Iniciar sesión. 2. Consultar horario. 3. Revisar asistencia y avisos. 4. Probar navegación sin credenciales reales. | El flujo principal responde, conserva sesión y muestra datos DEMO; los errores se presentan sin pantalla rota. | Modelo Android, versión, captura y resultado de prueba manual. |
| DEMO-08 | Offline móvil | Dispositivo con datos ya cargados | 1. Cerrar conexión. 2. Consultar información disponible. 3. Restaurar conexión. | La aplicación informa el estado sin pérdida silenciosa de datos o muestra un mensaje offline apropiado. | Captura offline y captura posterior a reconexión. |
| DEMO-09 | Reset DEMO | Entorno DEMO disponible y respaldo registrado | 1. Ejecutar el procedimiento de reinicio. 2. Confirmar datos iniciales. 3. Repetir la creación básica. | El reinicio deja una base limpia, determinista y lista para repetir la demostración. | Registro del comando, resultado y captura inicial/final. |
| DEMO-10 | Repetición completa | Reset DEMO completado | 1. Repetir DEMO-01 a DEMO-06 en la misma sesión. 2. Registrar tiempos y fallos. | El flujo completo termina sin datos duplicados, conflictos residuales ni errores P0. | Cronometría, video o capturas numeradas y reporte de fallos. |
| DEMO-11 | Seguridad crítica | Usuarios con distintos roles y rutas protegidas | 1. Sin autenticación abrir rutas protegidas. 2. Usar un rol sin permiso. 3. Intentar reiniciar, publicar o borrar como usuario no autorizado. | No autenticado recibe denegación; usuario autenticado sin permiso no escala privilegios ni accede a acciones prohibidas. | Evidencia HTTP `401/403/404` y resultado de pruebas de seguridad. |
| DEMO-12 | Recuperación de errores | Entorno DEMO disponible | 1. Simular API caída o respuesta HTTP inválida. 2. Restaurar la red o la API. | La interfaz muestra un mensaje accionable y no expone stack trace, secretos ni datos reales. | Capturas y pruebas de Playwright/MSW existentes. |

## Evidencia de validación local

Validaciones ejecutadas el 2026-11-19. Son evidencia automatizada relacionada; no sustituyen los ensayos manuales completos de DEMO-01 a DEMO-12.

### Backend con PostgreSQL desechable

```text
PowerShell:
$env:SIHS_TEST_DATABASE_URL = "postgresql+psycopg://sihs_test:sihs_test_only@127.0.0.1:55440/sihs_test"
python -m pytest -q tests/test_real_postgres.py tests/test_s4_crud_horarios_dayana.py tests/test_horarios_aislamiento_trimestre.py

Resultado: 15 passed, 1 warning; exit code 0.
```

La suite usa el PostgreSQL desechable de `backend/tests/docker-compose.postgres.yml`. No utiliza la base compartida ni credenciales reales.

Revalidación completa con PostgreSQL disponible:

```text
Comando: python -m pytest -q --cov=app --cov-report=term --cov-fail-under=84
Resultado: 470 passed, 8 skipped, 1 warning; exit code 0.
Cobertura backend: 84.65 % (umbral 84 %).
```

Los 15 tests de integración focalizados (`test_real_postgres.py`, `test_s4_crud_horarios_dayana.py` y `test_horarios_aislamiento_trimestre.py`) también pasaron contra la base desechable local.

### Publicación programada

```text
Comando: python -m pytest -q tests/test_publicacion_programada_postgres.py
Resultado: 7 skipped; requiere SIHS_ISOLATED_PG_URL con un clúster/socket temporal específico.
```

El contenedor de pruebas del puerto `55440` no satisface deliberadamente ese contrato aislado (`/tmp`, puerto `55439`, revisión Alembic fijada), así que esos siete casos quedan **sin verificar**.

### Frontend revalidado

```text
Comandos: pnpm lint; pnpm build; pnpm exec tsc -p tsconfig.login-tests.json --noEmit; pnpm test:coverage
Resultado: exit code 0; 56 archivos de test, 420 passed.
Cobertura: sentencias 80.65 %, ramas 69.38 %, funciones 76.89 %, líneas 83.78 %.
```

Lint/build emitieron advertencias, sin errores.

### Playwright

```text
Comando: corepack pnpm@12.11.2 exec playwright test
Revalidación: 13 tests, 7 passed, 4 failed, 2 skipped; exit code 1.
```

Falló el login autenticado porque faltan `E2E_LOGIN_IDENTIFIER`, `E2E_LOGIN_PASSWORD` y `E2E_EXPECTED_ROLE`; tres escenarios S5 de Mi horario fallan porque su stub no contempla `GET /usuarios/me/periodos-horario`. Dos flujos de horarios se omitieron por falta de cuenta e IDs de fixtures. No se usaron credenciales reales ni se ejecutó contra producción. Los fallos requieren preparar fixtures/cuenta de prueba y completar el stub antes de declarar verde la suite E2E.

### Límite de validación móvil

No se detectó `adb` ni un dispositivo Android conectado. DEMO-07 y DEMO-08 requieren APK y dispositivo; quedan pendientes de ensayo físico.

## Evidencia mínima requerida

Para completar la matriz con evidencia del flujo integral se debe adjuntar:

1. Capturas numeradas de DEMO-01 a DEMO-12.
2. Archivo de video corto o enlaces a capturas para el flujo completo.
3. Resultado de backend: `cd backend && python -m pytest -q`.
4. Resultado de frontend: `cd frontend && pnpm test:coverage && pnpm lint && pnpm build`.
5. Resultado E2E: `cd e2e && pnpm exec playwright test`, sin producción ni credenciales reales.
6. Registro de cualquier fallo P0/P1 mediante issue vinculada.

## Criterio de cierre

La matriz se considera completa cuando:

- Todos los casos tienen precondición, pasos y resultado esperado.
- Cada caso tiene una referencia de evidencia o el campo indicado como pendiente.
- Los casos ejecutados muestran resultado comprobable.
- Los fallos P0 bloqueantes tienen issue abierta y se registran en el reporte final.

Closes #215
