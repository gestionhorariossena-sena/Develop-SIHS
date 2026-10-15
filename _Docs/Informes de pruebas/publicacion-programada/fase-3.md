# SIHS — Publicación programada, fase 3

Fecha: 2026-09-28
Rama: `develop`
Commit de origen: `cba225750fc2112d50974c3207fe12f2fdb63141`

## Integración realizada

- La pantalla de coordinación usa los contratos existentes: `GET/POST /publicaciones-programadas/`, `GET /publicaciones-programadas/{id}`, `PUT /publicaciones-programadas/{id}` y `POST /publicaciones-programadas/{id}/cancelar`. Para consultar disponibilidad se añadió `GET /publicaciones-programadas/disponibilidad`.
- En Horarios completos se conserva la publicación inmediata y se agrega el acceso a programar un borrador. El constructor existente continúa siendo la entrada para crear/guardar borradores; el historial sigue disponible.
- La nueva vista permite elegir período, seleccionar borradores activos, indicar fecha/hora sin offset y revisar período, horarios y hora local antes de confirmar. El backend interpreta la cadena como `America/Bogota`; la interfaz muestra también las fechas devueltas en esa zona.
- La vista lista los estados reales del modelo: `pendiente`, `ejecutando`, `revision_requerida`, `publicada`, `fallida` y `cancelada`. Ofrece consulta, cancelación y reprogramación según estado. Al quedar `revision_requerida`, informa que la edición invalidó la aprobación y requiere una programación nueva.
- El panel de campana vuelve a consultar `GET /notificaciones/` al abrirse. Los resultados los genera el backend al ejecutar la publicación; el frontend no crea avisos ficticios.

## Disponibilidad del worker y migración

La existencia de `backend/Procfile` no se usa como señal de disponibilidad. Se agregó `worker_publicacion_estado`, una fila singleton actualizada por el proceso persistente en cada ciclo. `GET /publicaciones-programadas/disponibilidad` considera disponible el worker solo cuando la última señal tiene como máximo 30 segundos. Crear y reprogramar verifican la misma señal en backend y responden `503 worker_no_disponible` si falta, venció o no puede consultarse. Esto también bloquea las acciones si la migración aún no está instalada. La cancelación sigue disponible.

Migración añadida: `backend/alembic/versions/cc4815a70f22_estado_worker_publicacion.py`, desde `f7b812a4d091`. Se aplicó y verificó únicamente en el PostgreSQL temporal local `sihs_phase2_test`; no se ejecutó en PostgreSQL compartido. No se desplegó el worker.

La señal es una comprobación de liveness con una ventana de gracia de 30 segundos; un worker que se caiga inmediatamente después de reportar puede considerarse vivo durante esa ventana. No sustituye la supervisión, las alertas ni la comprobación de ejecución efectiva del proveedor.

## Pruebas

- Frontend completo: `npm test` — **325 aprobadas** (48 archivos).
- Frontend dirigido — **27 aprobadas** entre la pantalla nueva, Horarios completos, navegación y campana de notificaciones.
- `npm run build` — aprobado; Vite mantiene el aviso de bundle JavaScript mayor a 500 kB.
- Backend de publicaciones — **12 aprobadas**, 1 prueba de TestClient preexistente excluida porque quedó bloqueada en esta sesión. La dependencia de permisos y el rechazo `503` sin worker se probaron directamente; la puerta de ruta de frontend se probó con el router.
- Integración PostgreSQL fase 2 con Alembic actualizado a `cc4815a70f22` — **7 aprobadas** en el clúster local desechable.
- Migración `f7b812a4d091 -> cc4815a70f22` — aplicada correctamente en esa misma base aislada.

No se modificaron `main`, datos de PostgreSQL compartido ni cuentas. El worker no fue desplegado.
