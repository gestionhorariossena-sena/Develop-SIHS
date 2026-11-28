# Verificación inicial de borradores

Fecha: 2026-09-27  
Rama evaluada: `develop` (base `5225da9` antes de este ajuste)

## Cambios verificados

- `POST /api/v1/horarios/` con `publicado: false` persiste un borrador, no crea notificaciones y no aparece en las consultas personales de instructor ni aprendiz.
- El mismo endpoint sin el campo `publicado` conserva el contrato anterior: crea una clase publicada y envía sus notificaciones.
- El asistente envía `publicado: false` por bloque y no ejecuta un `PATCH` posterior de publicación.
- Se restauró la importación de `apiPatch` en `AsistenteHorarios.tsx`: sigue siendo necesaria para actualizar la fase de una ficha. Su ausencia impedía compilar el frontend.

## Pruebas añadidas

Archivo: `backend/tests/test_notificaciones_disparadores.py`

- `test_post_borrador_permanece_privado_y_no_notifica`
- `test_post_sin_publicado_conserva_publicacion_y_notificacion`

Comando ejecutado con Python 3.12.13:

```text
/tmp/sihs-py312-backend/bin/pytest backend/tests/test_notificaciones_disparadores.py backend/tests/test_horario_borrador_schema.py -q
```

Resultado: **10 aprobadas**, 1 advertencia de deprecación de `starlette.testclient`.

La prueba pesada del generador también pasó aislada:

```text
/tmp/sihs-py312-backend/bin/pytest backend/tests/test_asistente_horario_service.py::test_generar_propuesta_diez_fichas_pesadas_no_devuelve_cero_bloques -vv
```

Resultado: **1 aprobada**.

## Frontend

```text
npm run build
```

Resultado: **aprobado**. Vite advierte que el paquete generado supera 500 kB; no bloquea la compilación.

`npm test` y la suite completa de backend no emitieron un resultado terminal desde el ejecutor externo: la primera quedó sin resumen después de iniciar Vitest; la segunda se interrumpió mientras ejecutaba la prueba pesada del generador. No se registró una falla de aserción. La prueba pesada pasó al ejecutarse de forma aislada.

## Límites

No se ejecutaron migraciones ni operaciones contra PostgreSQL compartido. Las pruebas HTTP usan SQLite en memoria y autenticación simulada.
