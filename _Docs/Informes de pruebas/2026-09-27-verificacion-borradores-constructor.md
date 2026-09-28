# Verificación de borradores del constructor manual

Fecha: 2026-09-27  
Rama: `develop`  
Commit remoto evaluado: `9734b5f` (`docs: explicar protección temporal de edición de horarios`)

## Resultado

- El constructor manual marca «Guardar como borrador» inicialmente y envía `publicado: false` a `POST /horarios/`.
- Al desmarcar la opción, envía explícitamente `publicado: true`.
- Los borradores no aparecen en las consultas personales de instructor ni aprendiz y no generan notificaciones. Esto queda cubierto por las pruebas de integración de `backend/tests/test_notificaciones_disparadores.py` y `backend/tests/test_horario_borrador_schema.py`.
- Historial permite abrir y consultar las clases actuales vinculadas al snapshot. «Modificar» abre el constructor con los datos cargados, pero la edición y el botón de guardado están deshabilitados; no se ejecutan `DELETE` ni nuevos `POST` desde ese modo. Se mantiene protegido el contenido original hasta implementar un reemplazo seguro.

## Regresiones añadidas o actualizadas

`frontend/src/pages/NuevoHorario.test.tsx` ahora comprueba:

- creación privada por defecto y snapshot de historial;
- publicación explícita al desmarcar la opción;
- compatibilidad del guardado forzado con publicación explícita;
- consulta del snapshot y bloqueo de operaciones destructivas desde el modo de edición.

Las pruebas existentes de `frontend/src/pages/HistorialHorarios.test.tsx` comprueban que «Ver horario» muestra los bloques vigentes asociados al snapshot.

## Comandos y resultados

- `npx vitest run src/pages/NuevoHorario.test.tsx src/pages/HistorialHorarios.test.tsx --no-file-parallelism`: **16 aprobadas**.
- `npm test`: **318 aprobadas**, 47 archivos.
- `/tmp/sihs-py312-backend/bin/pytest backend/tests/test_notificaciones_disparadores.py backend/tests/test_horario_borrador_schema.py backend/tests/test_horarios_estado.py backend/tests/test_ficha_usuario.py -q`: **32 aprobadas**.
- `/tmp/sihs-py312-backend/bin/pytest backend/tests -q`: **293 aprobadas** con Python 3.12.13.
- `npm run build`: **aprobado** (TypeScript y Vite).

## Advertencias y alcance

Pytest reportó una advertencia de deprecación: Starlette recomienda `httpx2` para `TestClient`; no afecta los resultados actuales. Vite avisó que el bundle principal supera 500 kB; el build terminó correctamente.

Las pruebas backend usan SQLite aislada y autenticación simulada. No se modificó PostgreSQL compartido ni se ejecutaron migraciones.
