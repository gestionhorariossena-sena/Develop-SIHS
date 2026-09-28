# SIHS — Publicación programada, fase 1

Fecha: 2026-09-28

Rama: `develop`

Commit base revisado: `899cc50c7526f1dba51e10882c8a0cb528fc07f0`

## Resultado

Se agregó un mecanismo backend persistente para programar, consultar, cancelar y reprogramar la publicación de un conjunto de horarios. La API requiere rol Coordinador o Administrador. La hora recibida es local de `America/Bogota`; se convierte y almacena como instante UTC con zona inequívoca.

Antes de crear una programación y al ejecutarla, el servicio comprueba que todos los horarios existan, sigan activos y en borrador, correspondan al trimestre indicado y pasen la validación de ficha y conflictos de `HorarioService`. La validación de ejecución considera también conflictos entre los bloques del propio conjunto. La ejecución bloquea la fila de programación con `FOR UPDATE`, vuelve a revisar los horarios y confirma horarios, auditoría y notificaciones en una transacción. Una segunda ejecución encuentra un estado final y no repite los avisos.

Cada asignación guarda una huella de revisión. Una modificación por los endpoints de horario o por el reemplazo de un snapshot invalida la revisión y notifica a coordinación dentro de la transacción de edición. Mientras haya una programación pendiente o requiera revisión, el endpoint manual no puede publicar ese horario. Reprogramar captura las nuevas huellas y exige una nueva aprobación explícita.

La auditoría registra programación, reprogramación, cancelación, publicación efectiva, fallo y revisión requerida. Los avisos de coordinación se guardan para éxito, fallo o revisión; los avisos a instructores y aprendices solo se agregan en la misma transacción que hace efectiva la publicación.

## Archivos

- Modelo: `backend/app/models/publicacion_programada.py`
- Esquemas: `backend/app/schemas/publicacion_programada.py`
- Servicio y validación transaccional: `backend/app/services/publicacion_programada_service.py`
- API ` /api/v1/publicaciones-programadas`: `backend/app/api/v1/publicaciones_programadas.py`
- Router de horarios: control de edición y publicación manual en `backend/app/services/horario_service.py` y `backend/app/api/v1/horarios.py`
- Reemplazo de horarios guardados: `backend/app/services/horario_guardado_service.py`
- Worker independiente: `backend/app/workers/publicacion_programada_worker.py`
- Proceso declarado: `backend/Procfile` (`worker`)
- Migración pendiente: `backend/alembic/versions/f7b812a4d091_publicaciones_programadas.py`

Rutas: `POST /publicaciones-programadas/`, `GET /publicaciones-programadas/`, `GET /publicaciones-programadas/{id}`, `PUT /publicaciones-programadas/{id}` y `POST /publicaciones-programadas/{id}/cancelar`. El worker se inicia desde `backend` con `python -m app.workers.publicacion_programada_worker`; `--once` procesa vencidas una vez.

## Esquema requerido

La migración crea:

- `publicaciones_programadas`: trimestre, coordinador responsable, instante `TIMESTAMP WITH TIME ZONE`, estado restringido, creación, ejecución, resultado y número de revisión.
- `publicacion_programada_horarios`: conjunto de horarios y huella de cada revisión. Las referencias a horarios y al responsable usan `ON DELETE RESTRICT`; no se elimina silenciosamente el historial.
- Índices para búsqueda por estado/fecha e identificador de horario.

La migración se validó generando SQL offline con Alembic. **No se ejecutó contra PostgreSQL ni Supabase.** Para habilitar el flujo en un entorno, la migración requiere revisión y aplicación autorizada.

## Pruebas

Entorno: Python 3.12.13, SQLite en memoria para todas las pruebas; no se conectó a PostgreSQL compartido.

- `pytest -q backend/tests/test_publicaciones_programadas.py backend/tests/test_horarios_estado.py backend/tests/test_horarios_guardados_cascada.py` — 29 aprobadas.
- `pytest -q backend/tests/test_publicaciones_programadas.py` — 10 aprobadas en la comprobación final.
- `pytest -q backend/tests` — 310 aprobadas (suite completa).
- `alembic upgrade c9d4e1f70a33:f7b812a4d091 --sql` — SQL offline generado y revisado; sin ejecución de DDL.
- `git diff --check` — sin errores de whitespace.

Las pruebas cubren permisos por rol, zona horaria, borrador/período, cancelación, reprogramación, invalidez después de edición, conflicto/fallo, rollback cuando falla el aviso a destinatarios, notificaciones y rechazo de una segunda ejecución. El worker se prueba en su sondeo de vencidas y el servicio se prueba por separado para la ejecución; no se ensayó concurrencia real entre procesos contra PostgreSQL.

## Límite operativo

El código del worker y la entrada `worker` del Procfile están preparados. **La publicación automática todavía no está activa ni validada en un despliegue.** El Procfile por sí solo no demuestra que la plataforma inicie ese proceso; hay que configurar y desplegar una instancia worker junto al servicio web y aplicar la migración aprobada. Tampoco se verificó recuperación tras caída usando una base persistente real. Hasta completar esos pasos no se debe afirmar que las publicaciones se ejecutan automáticamente con la interfaz cerrada.

## Errores y riesgos pendientes

- Confirmar cómo configura la plataforma de despliegue procesos `web` y `worker`; no se encontró una configuración de plataforma versionada en el repositorio.
- Probar la concurrencia con dos procesos y PostgreSQL aislado antes del despliegue.
- Revisar/aplicar la migración únicamente mediante el procedimiento aprobado.
- La retención de filas de asociación conserva el historial y restringe borrar horarios referenciados, incluso después de cancelar o completar una programación; revisar esa política antes de habilitar borrados de horarios.

No se modificó `main`, no se ejecutaron migraciones, no se conectó a PostgreSQL compartido ni se cambiaron registros de la base.
