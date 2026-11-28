# Informe de ejecución: esquema de publicación programada

**Fecha:** 2026-09-28 (America/Bogota)  
**Rama:** `develop`  
**Commit evaluado:** `dbff53b2764521b9cf3360ce514137bc27a852d1`  
Los archivos Alembic no cambiaron entre este commit y el que se consultó inicialmente (`dc479a4d889c987f7e71be78dbc28fc82f1c84e3`).

## Resultado

La autenticación PostgreSQL ya funciona, pero **no se aplicaron migraciones**. El requisito de respaldo verificable no quedó satisfecho: el archivo lógico está íntegro y se restauraron los datos de aplicación y Auth en forma parcial, pero la restauración completa falló porque el PostgreSQL aislado no tiene la extensión `supabase_vault`. Además, se detectaron cambios de sesión/Auth posteriores al respaldo. Por las condiciones de seguridad indicadas, detuve la operación.

No se ejecutó DDL ni se modificaron datos en Supabase. La revisión inicial y final es `c9d4e1f70a33`.

## Revisión y migraciones pendientes

Servidor PostgreSQL `17.6`. HEAD local Alembic: `cc4815a70f22`. La secuencia exacta pendiente desde la revisión actual es:

1. `f7b812a4d091` — crea `publicaciones_programadas` y `publicacion_programada_horarios`, sus restricciones e índices.
2. `cc4815a70f22` — crea `worker_publicacion_estado` y su restricción singleton.

La revisión `c9d4e1f70a33` es la aplicada actualmente. Las tres tablas destino no existían. La inspección de ambos `upgrade()` muestra únicamente creación de tablas, índices y restricciones; estas dos revisiones no actualizan ni eliminan filas de horarios, fichas, usuarios o trimestres. No se ejecutó ninguna revisión.

## Respaldo y restauración

- Archivo: `/tmp/sihs-pg-backup-7b0acaqf/sihs-before-scheduled-publication.dump`
- Formato: archivo custom de `pg_dump` 18.6; servidor origen 17.6.
- Tamaño: 412,646 bytes; SHA-256: `bde3dc1ed4a1d61c62d2999bc2129e579e05765e2b4a32d38d030e96822986d6`
- Permisos: directorio `700`, archivo `600`.
- `pg_restore --list` pudo leer el archivo (725 entradas).

Restaurar en una base **vacía y aislada**, con las extensiones de Supabase requeridas:

```bash
pg_restore --exit-on-error --no-owner --no-acl \
  --host <host-aislado> --port <puerto> --username <usuario> \
  --dbname <base-vacia> /tmp/sihs-pg-backup-7b0acaqf/sihs-before-scheduled-publication.dump
```

La restauración completa de prueba falló al intentar crear `supabase_vault`; la extensión y la relación `vault.secrets` no están disponibles en el PostgreSQL local 18.6. Un segundo ensayo aislado restauró `public` y Auth omitiendo Vault: coincidieron los conteos de todas las tablas públicas y Auth salvo tres tablas transitorias de sesión de Auth, con dos filas menos cada una en el snapshot restaurado. `auth.users` conservó 14 identidades y las mismas claves; dos filas tuvieron cambios en marcas de último inicio/actualización. Las filas comparadas de `public.horarios`, `public.horario_dia`, `public.usuarios`, `public.fichas` y `public.trimestres` coincidieron. La prueba parcial no demuestra una restauración íntegra de Vault.

El archivo contiene los esquemas y datos incluidos por `pg_dump`; el ensayo no validó la recuperación de Vault. Se retiró el cluster local temporal después de la prueba. El dump permanece protegido en la ubicación indicada.

## Estado de datos y actividad

En las consultas finales de solo lectura:

- Horarios: **26**, todos activos y publicados, todos asociados a `idTrimestre=1`.
- Días asociados a horarios: **26**.
- Fichas: **55**; trimestres: **2**; perfiles públicos: **12**; identidades Auth: **14**.
- Las tres tablas de publicación programada siguen ausentes.
- No había transacciones activas ni locks de escritura observados durante la inspección; quedaron 16 conexiones remotas en estado idle. No se detuvieron servicios ni se bloqueó la posibilidad de nuevas escrituras.

Los horarios, estados y período se mantuvieron intactos durante esta operación. No se desplegó el worker ni se activó ninguna publicación.

## Qué falta antes de ejecutar

Usar un destino aislado compatible con `supabase_vault` para restaurar y comparar también Vault, y repetir la captura/validación inmediatamente antes de migrar para que el respaldo represente el estado previo al DDL. Mientras esas comprobaciones no pasen, no se ejecutará `alembic upgrade head`.

No hubo cambios de código. No se creó un commit de código ni se modificó `main`.
