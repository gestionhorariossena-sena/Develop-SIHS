# Entorno local de demostración

El demo usa servicios locales y datos ficticios: Supabase Auth, PostgreSQL,
Studio, Mailpit, FastAPI y React. No utiliza Supabase remoto ni los respaldos
privados de `Downloads`.

## Inicio

Desde la raíz del repositorio:

```bash
make demo-up
```

- Aplicación: http://127.0.0.1:5173
- API: http://127.0.0.1:8000/api/v1/health
- Studio de Supabase: http://127.0.0.1:54323
- Mailpit: http://127.0.0.1:54324

Para devolver la base demo a su estado inicial:

```bash
make demo-reset
```

Este comando elimina los cambios locales de la base y vuelve a aplicar las
migraciones y el seed. Para detener todo:

```bash
make demo-down
```

## Cuentas ficticias

Todas tienen la contraseña `Demo123!`.

| Rol | Correo |
| --- | --- |
| Administrador | `admin.demo@sihs.local` |
| Coordinador | `coordinador.demo@sihs.local` |
| Instructor | `instructor.demo@sihs.local` |
| Aprendiz | `aprendiz.demo@sihs.local` |

El seed crea un período vigente relativo a la fecha local, un horario
publicado, una asistencia, una notificación y los catálogos mínimos para
demostrar los flujos principales.

## Seguridad

No agregar dumps, `.env`, claves ni datos personales a este repositorio. La
migración en `supabase/migrations/` se deriva solo de la estructura actual;
`supabase/seed.sql` contiene exclusivamente información sintética.
