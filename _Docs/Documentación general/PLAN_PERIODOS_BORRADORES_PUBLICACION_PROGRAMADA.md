# SIHS — Plan de períodos, borradores y publicación programada

**Estado:** plan de implementación; no es evidencia de funciones completas.
**Rama de trabajo:** `develop`. No modificar `main` ni datos reales sin autorización.

## Objetivo

El coordinador puede preparar el siguiente período antes de que empiece, revisar asignaciones
sin exponerlas y elegir entre publicar ahora o programar la publicación para una fecha y hora.
Los horarios de períodos anteriores se conservan para consulta histórica. Una publicación
programada es una orden persistida en servidor, no un temporizador del navegador.

## Reglas de negocio

1. **Período de programación ≠ fase curricular de ficha.** `idTrimestre` delimita
   fechas y recursos; `faseActual` identifica la fase del currículo. No fabricar
   períodos ni deducir el número de fase a partir del nombre del período.
2. **Vigencia**: requiere `estado=activo` y fecha local dentro del rango. Si hay
   cero o varios períodos vigentes, no seleccionar uno arbitrariamente. Los
   períodos futuros `planeado` pueden escogerse para preparar borradores.
3. **Visibilidad**: solo `activo=true` y `publicado=true` es visible para
   instructor/aprendiz. La fecha de publicación no es la fecha de la primera
   clase. Permitir consultar de manera explícita semanas futuras publicadas.
4. **Borrador**: `publicado=false` al guardar. Solo coordinación/administración
   puede revisar y programar su publicación. Borradores siguen reservando
   recursos mientras `activo=true`.
5. **Publicación programada**: fecha/hora explícita zona `America/Bogota`;
   persistir instante UTC y mostrar hora local. No publicar automáticamente
   por cambio de trimestre. El coordinador puede cancelar/reprogramar antes
   de la ejecución.
6. **Control al ejecutar**: comprobar permisos y estado de la programación,
   pertenencia ficha-período, recursos y cruces vigentes, que todos los
   bloques seleccionados siguen existiendo, activos y sin editar desde la
   revisión. Si algo falla, no publicar parcialmente el lote; dejarlo
   privado y registrar el motivo.
7. **Consistencia**: transacción única para cambiar todos los bloques del
   lote y registrar el resultado. Ejecución idempotente: no avisar dos
   veces si el trabajador reintenta después de un reinicio.
8. **Avisos**: notificar a coordinación al confirmar programación,
   al publicar y ante fallo/cancelación; avisar a instructor/aprendiz solo
   después de la publicación efectiva. Evitar duplicados por ficha,
   usuario y evento; permitir revisar el historial.
9. **Histórico**: finalizar un período no borra sus horarios. Despublicar
   los oculta; desactivar los excluye de cruces; eliminar definitivamente
   solo para errores/datos de prueba y tras confirmación explícita.
10. **Edición segura**: no borrar las clases originales antes de validar
    y persistir su reemplazo. Proteger snapshots y relaciones en transacción.
    Reactivar requiere verificar conflictos. Cambiar un borrador programado
    invalida la aprobación anterior y exige revisión/reprogramación.
11. **Calendario**: obtener y verificar anexo oficial 2026 (Resoluciones
    SENA 1-03775/2025 y 1-01190/2026, según informe de auditoría) o
    calendario aprobado por el Centro. No inferir fechas ni modificar
    PostgreSQL compartido sin autorización.

## Fases de entrega y condiciones de aceptación

### Fase 0 — selección de período (código frontend ya iniciado)
- No autoseleccionar período activo vencido.
- Selector explícito; distinguir período vigente, futuro e histórico.
- Advertir fechas/estado inconsistentes; no ocultar historial.
- Codex: verificar pruebas frontend/build en ambiente local.
- **Dependencia externa:** calendario institucional confirmado para crear
  períodos 2026, y migración/alta administrativa autorizada.

### Fase 1 — borradores manuales y desde asistente (iniciada)
- `POST /horarios/` acepta `publicado=false`; si se omite conserva
  temporalmente `true` por compatibilidad con consumidores existentes.
- El asistente guarda explícitamente `publicado=false` y no ejecuta
  publicación inmediata; revisar regresiones y tests.
- Siguiente: constructor manual con opción visible `Guardar borrador`;
  tests de no visibilidad/no notificación; publicación explícita y
  revalidación antes del cambio a publicado.
- No confundir borrador persistido con previsualización no guardada.

### Fase 2 — calendario, histórico y edición segura
- Configuración administrativa de períodos con validación de fechaFin >= fechaInicio,
  sin períodos vigentes superpuestos y sin borrar períodos referenciados.
- UI de selección actual/siguiente/histórico; saltar al período publicado
  sin retroceder semana a semana en Mi horario.
- Sustituir flujo de NuevoHorario que hace DELETE antes del guardado por
  reemplazo transaccional no destructivo.
- Desactivar antes que borrar; exigir doble confirmación para borrado definitivo,
  auditar actor y motivo, conservar respaldo cuando corresponda.
- Distinguir claramente horario individual y snapshot `horarios_guardados`.

### Fase 3 — publicación programada (nueva)
- Nueva tabla `publicaciones_programadas`: id, período, creador,
  fecha_publicacion_utc, zona_horaria, estado
  (`programada/en_proceso/publicada/fallida/cancelada`), fecha de
  creación/ejecución, último error sanitizado, revisión/versión y
  referencia a conjunto inmutable de IDs del horario; índice por
  estado y fecha. Decidir tabla hija para IDs y modelo lote según DB.
- API coordinador/admin: crear, consultar, reprogramar, cancelar; nunca
  permitir programar una fecha pasada ni sobre un conjunto ya publicado.
- Worker periódico **externo a los procesos web**, con transacción y
  bloqueo de filas (ej. `FOR UPDATE SKIP LOCKED` en PostgreSQL).
  No `setTimeout` en frontend ni scheduler `startup` por worker web:
  en Railway podría duplicar ejecuciones o perderlas en un reinicio.
- Reintentos recuperables y claim lease; reconciliar ejecución
  interrumpida; estado legible y trazabilidad. Si no hay worker
  desplegado, la UI no debe ofrecer una programación que no se ejecutará.
- Notificaciones mediante patrón de evento/outbox o garantía equivalente
  para evitar duplicación si fallan después del commit. Avisar
  coordinación en éxito/fallo y usuarios finales al hacerse visible.
- Pruebas de hora local/UTC, reinicio, doble worker, carrera entre
  editar/cancelar/publicar, conflicto posterior, notificaciones únicas,
  programación futura, fallo parcial, permisos y no exposición.

### Fase 4 — prueba piloto y despliegue
- Base SQLite aislada para tests y PostgreSQL de pruebas autorizado
  para semántica de bloqueo/transacciones; prohibido usar PostgreSQL
  compartido durante los tests.
- Suite backend completa con Python 3.12 fuera del sandbox si es
  necesario, frontend test/build, pruebas HTTP y roles.
- Demostración: hoy crear borrador de período futuro, coordinar revisión,
  programar mañana 09:00 Bogotá; comprobar invisibilidad previa,
  publicación tras fecha, notificaciones y auditoría.
- Publicar informe sanitizado en `_Docs/Informes de pruebas/`;
  commit/push en `origin/develop` y comunicar SHA. `main` intacta.

## Riesgos conocidos por revisión de código

- `NuevoHorario.tsx` en modo edición borra primero IDs reales y snapshot;
  potencial pérdida parcial si falla el guardado posterior.
- `HorarioService.cambiar_estado` reactiva sin nueva comprobación de cruces.
- `horarios_guardados.idsHorarios` puede faltar en snapshots antiguos.
- La ruta de publicación manual ya existe, pero aún no hay revalidación
  de lote ni programación horaria persistida.
- Crear períodos futuros requiere validar la relación `fichas.idTrimestre`;
  no reasignar los 26 horarios piloto antiguos de manera automática.

## Entrega incremental

Este documento no autoriza modificar la base real, ni afirma que existe
un trabajador de publicación programada. Cada fase exige su propia
implementación, pruebas y revisión antes de considerarse completada.
