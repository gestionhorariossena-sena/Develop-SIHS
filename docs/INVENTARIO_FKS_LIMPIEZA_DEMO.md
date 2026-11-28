# Inventario de FKs y orden de limpieza de la demo

**Issue:** #192

**Fuente validada:** migración local `supabase/migrations/20261118231423_sihs_schema_from_20261118_backup.sql`, extraída del esquema PostgreSQL/Supabase vigente el 18 de noviembre de 2026.
**Alcance:** base DEMO local; no se consultan ni eliminan datos institucionales.

## Relaciones que condicionan el reset

| Padre | Hijos directos relevantes | Acción FK |
| --- | --- | --- |
| `auth.users` | `usuarios` | `ON DELETE CASCADE` |
| `usuarios` | `usuario_rol`, `usuario_especialidad`, `ficha_usuario`, `horarios_guardados`, `notificaciones`, `anotaciones_horario` | `ON DELETE CASCADE` |
| `usuarios` | `horarios`, `asistencias`, `avisos`, `conversaciones`, `mensajes`, solicitudes y publicaciones programadas | sin cascada, salvo los hijos indicados arriba |
| `horarios` | `horario_dia`, `anotaciones_horario` | `ON DELETE CASCADE` |
| `horarios` | `asistencias`, `solicitud_cambio_horario`, `publicacion_programada_horarios` | sin cascada / `SET NULL` en publicación programada |
| `fichas` | `ficha_usuario`, `horarios`, `avisos` | cascada solo en `ficha_usuario` |
| `ambientes` | `horarios` | sin cascada |
| `resultados_aprendizaje` | `actividades_aprendizaje`, `horarios` | cascada solo en actividades |
| `competencias_formacion` | `resultados_aprendizaje`, `especialidad_competencia` | `ON DELETE CASCADE` |
| `programas` y `trimestres` | fichas, guías, resultados/horarios/publicaciones | sin cascada en las relaciones de planificación |
| `sedes` | ambientes, fichas, avisos | sin cascada |

`auditoria.idUsuario` usa `ON DELETE SET NULL`: eliminar un perfil no bloquea
la limpieza, pero para un reset total de DEMO se elimina también la auditoría.

## Orden seguro de eliminación explícita

El reset debe ejecutarse dentro de una transacción y borrar de hojas a raíces;
no debe usar `CASCADE` global porque oculta nuevas dependencias no inventariadas.

1. `publicacion_programada_horarios`, `publicaciones_programadas`,
   `solicitud_cambio_horario`, `solicitudes_acceso`.
2. `asistencias`, `anotaciones_horario`, `horario_dia`,
   `horarios_guardados`, `horarios`.
3. `mensajes`, `conversaciones`, `notificaciones`, `avisos`, `auditoria`.
4. `ficha_usuario`, `usuario_especialidad`, `usuario_rol`.
5. `actividades_aprendizaje`, `resultados_aprendizaje`, `guias`,
   `especialidad_competencia`, `competencias_formacion`.
6. `fichas`, `ambientes`.
7. `usuarios` y, solo si el entorno recrea también las credenciales,
   `auth.users`.
8. Catálogos reinicializables: `programas`, `coordinaciones`, `trimestres`,
   `sedes`, `especialidades`, `roles`, `jornadas` y `diasDeLaSemana`.
9. Estado auxiliar: `worker_publicacion_estado`; la tabla
   `alembic_version` se conserva o se vuelve a sembrar con la revisión que
   corresponda al esquema instalado.

## Verificación antes de automatizar

Antes de aplicar una receta de borrado a otra base DEMO, se debe comparar su
esquema con la migración anterior y ejecutar la operación en una transacción
que termine en `ROLLBACK`. Solo después se habilita el reset que termina en
`COMMIT` y carga el seed sintético. Este inventario no autoriza operaciones
contra Supabase institucional o producción.
