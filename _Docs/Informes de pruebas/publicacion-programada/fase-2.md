# SIHS — Publicación programada, fase 2

Fecha: 2026-09-28
Rama: `develop`
Commit base evaluado: `708515c10b7b7eaf1fba4cd5a06b1370d0a2a813`
Entorno compartido: sin conexión ni cambios. Las migraciones y pruebas PostgreSQL se ejecutaron solo en un clúster desechable local.

## Resultado

- Suite completa backend, Python 3.12.13: **310 aprobadas, 7 omitidas**. Las omitidas requieren `SIHS_ISOLATED_PG_URL` y se ejecutaron por separado en PostgreSQL.
- Integración de robustez en PostgreSQL 18.6 temporal: **7 aprobadas**.
- Pruebas dirigidas de publicaciones, estados y snapshots: **30 aprobadas**.
- `git diff --check`: aprobado.
- Migraciones desde la revisión base `d109a7762c30` hasta `f7b812a4d091`: aplicadas satisfactoriamente en `sihs_phase2_test`, clúster local en `/tmp`; la revisión final registrada fue `f7b812a4d091`.
- No se usaron credenciales ni URL de Supabase, no se conectó a PostgreSQL compartido y no se desplegó ningún worker.

## Robustez cubierta

1. Dos conexiones y workers concurrentes compiten por la misma publicación: solo una confirma; el segundo observa el estado final. Se verificó una publicación de dos bloques y un único conjunto de tres notificaciones (coordinación, instructor y aprendiz).
2. Interrupción simulada antes del `COMMIT`: PostgreSQL revierte el estado y los efectos asociados; un reintento completa la publicación.
3. Pérdida simulada de confirmación después del `COMMIT`: el reintento es inocuo y no duplica notificaciones.
4. Cancelación y reprogramación mientras el worker posee el bloqueo: esperan la transacción y luego respetan el estado ya publicado.
5. Edición después de aprobar invalida la revisión; el worker no publica la revisión obsoleta.
6. Eliminación de horarios: una programación vigente bloquea el borrado; tras cancelarla, puede borrarse el horario y se conserva la referencia histórica sin una FK huérfana.

Las pruebas crean datos exclusivamente en la base aislada. El módulo de integración se omite si no se proporciona expresamente `SIHS_ISOLATED_PG_URL`; valida nombre de base, socket `/tmp`, puerto, directorio de datos y revisión Alembic, y no recurre a `DATABASE_URL` ni a archivos `.env`.

## Ajustes preparados

- La relación entre publicación y horarios guarda una revisión histórica y usa una FK nullable `ON DELETE SET NULL`; mantiene el ID de horario como dato histórico sin FK. El servicio bloquea el borrado de un horario mientras la publicación vigente siga pendiente o requiera revisión. Reprogramar crea una revisión nueva sin borrar las referencias anteriores.
- Cancelación/reprogramación recargan el estado ORM después de esperar un `FOR UPDATE`, evitando actuar sobre un estado obsoleto que ya estaba en la caché de sesión.
- El worker detecta horarios ausentes o modificados en la revisión aprobada, marca `revision_requerida` y no publica parcialmente.
- Se ajusta el manejo HTTP del borrado de horarios y snapshots para devolver conflicto `409` ante una publicación pendiente.
- La migración anterior `b73491403bb8` intentaba crear explícitamente un tipo ENUM que `create_table` ya creaba. La cadena limpia falló con `DuplicateObject: type "estado_solicitud_acceso" already exists`; se retiró la creación duplicada. La cadena completa volvió a ejecutarse con éxito en el PostgreSQL desechable.

La alteración de `f7b812a4d091` solo se aplicó en esta base temporal. No se aplicó a PostgreSQL compartido. Si esa migración ya se ejecutó en otro ambiente antes de este cambio, no se debe volver a aplicar a ciegas: hace falta una migración de avance compatible con el estado de ese ambiente.

## Despliegue del worker (sin desplegar)

El repositorio declara el comando de worker en `Procfile`; las dependencias provienen de `backend/requirements.txt`. Para Railway, la evidencia local menciona su uso en el servicio PDF, pero no permite confirmar la configuración actual del proyecto remoto. La preparación prevista es crear un servicio persistente separado desde el mismo repositorio, con raíz `backend` y comando `python -m app.workers.publicacion_programada_worker`, instalando las dependencias del backend. Debe recibir el `DATABASE_URL` mediante variables privadas del proveedor, sin dominio público, con política de reinicio y revisión de logs/estado del proceso. No usar un cron efímero para este worker.

Railway describe los servicios persistentes y el comando de inicio en su [referencia de servicios](https://docs.railway.com/services) y [referencia de despliegues](https://docs.railway.com/deployments/reference); su [guía de workers y colas](https://docs.railway.com/guides/cron-workers-queues) diferencia workers persistentes de tareas cron. Esta fase no confirma que exista un worker desplegado, ni prueba el comportamiento bajo reinicios del proveedor o pérdida física del servidor.

## Límites y acciones pendientes

- La prueba de concurrencia usa dos workers en hilos y conexiones PostgreSQL distintas dentro del mismo proceso; cubre el bloqueo real de PostgreSQL, pero no una caída de infraestructura distribuida.
- Las interrupciones se simularon antes del commit y después del commit con confirmación perdida, no mediante matar un proceso del proveedor.
- Cancelación/reprogramación durante una ejecución se verificaron mientras el worker retenía el bloqueo en la fase de validación; no se probaron latencias de red del proveedor.
- No se inspeccionó ni desplegó la configuración viva de Railway. Faltan configurar el servicio worker, variables, política de reinicio y monitorización en la plataforma autorizada.
- Las siete pruebas PostgreSQL están excluidas de la suite ordinaria para impedir que se conecte accidentalmente a una base no desechable; se deben ejecutar en CI con una instancia efímera que cumpla las guardas.

## Comandos reproducibles

```bash
# Base local efímera ya migrada a f7b812a4d091; no usar una URL compartida.
SIHS_ISOLATED_PG_URL='postgresql+psycopg://david@/sihs_phase2_test?host=/tmp&port=55439' \
DATABASE_URL='postgresql+psycopg://david@/sihs_phase2_test?host=/tmp&port=55439' \
/tmp/sihs-py312-backend/bin/pytest -q backend/tests/test_publicacion_programada_postgres.py

env -u SIHS_ISOLATED_PG_URL \
DATABASE_URL='postgresql+psycopg://david@/sihs_phase2_test?host=/tmp&port=55439' \
/tmp/sihs-py312-backend/bin/pytest -q backend/tests
```
