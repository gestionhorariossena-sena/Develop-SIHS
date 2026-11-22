# Entorno local de demostración

El demo usa servicios locales y datos ficticios: Supabase Auth, PostgreSQL,
Studio, Mailpit, FastAPI y React. No utiliza Supabase remoto ni los respaldos
privados de `Downloads`.

## Requisitos y alcance

- Docker Engine y Docker Compose, Supabase CLI y un entorno de shell con `bash` y `make`.
- El contenedor backend se construye desde `backend/Dockerfile.dev` (Python 3.14) y el frontend desde `frontend/Dockerfile.dev` (Node 22).
- `compose.demo.yml` monta `backend/.env` dentro del contenedor en modo lectura; **verifica que este archivo apunte solo a servicios locales o de prueba** y que no introduzca secretos o conexiones de producción. El montaje no equivale a aislamiento automático.
- Los comandos de reset eliminan datos **del stack local**. No los uses contra entornos institucionales.

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

## Verificación

Después de iniciar, comprueba manualmente la API de salud, el login con cuentas ficticias y los flujos de horarios/asistencia. La presencia de scripts y semillas no demuestra que la demo haya sido validada de extremo a extremo.

## Seguridad

No agregar dumps, `.env`, claves ni datos personales a este repositorio. La
migración en `supabase/migrations/` se deriva solo de la estructura actual;
`supabase/seed.sql` contiene exclusivamente información sintética.

## Ensayo de cargas masivas para la sustentación

La guía [Cargas masivas de SIHS](docs/GUIA_CARGAS_MASIVAS.md) enumera los cuatro cargadores unificados (Fichas, Ambientes, Instructores y Plan curricular) y sus pruebas recomendadas. El asistente de horarios con IA sigue su propio flujo.

Después de `make demo-up`, verifica los cambios de catálogos en la base local y las invitaciones del alta de instructores en Mailpit. Si pruebas el envío de correo de cuentas nuevas, confirma que el SMTP del contenedor apunta a Mailpit; el archivo `backend/.env` montado no debe apuntar a correo institucional ni a Supabase remoto. Después de cada ensayo puedes restaurar la demo con `make demo-reset`.

## SMTP de la demo local (2026-11-22)

En `compose.demo.yml`, el backend usa `APP_ENV=demo`, `SMTP_HOST=host.docker.internal`, `SMTP_PORT=54325` y credenciales SMTP vacías; `supabase/config.toml` expone el puerto `54325` del servidor de correo de pruebas. **Solo** esa combinación (entorno demo, host interno y puerto 54325) permite a `EmailService` enviar sin STARTTLS ni usuario/contraseña. Los demás entornos conservan las exigencias SMTP anteriores.

1. Tras `git pull`, reinicia Supabase CLI si es necesario para que adopte el nuevo `smtp_port`.
2. Recrea el backend Docker con `docker compose -f compose.demo.yml up -d --build backend` o ejecuta `make demo-up` según el estado de tu stack.
3. Desde Fichas carga el Excel de aprendices, confirma, y consulta los mensajes capturados en la interfaz de correo de Supabase local: http://127.0.0.1:54324.
4. Prueba el acceso con la contraseña temporal mostrada **en el correo de prueba**, no en SIHS. Verifica que la aplicación obliga a cambiarla.

Este flujo no entrega correos a Gmail desde la demo: solo captura mensajes en el servidor de pruebas. Si se usa una configuración SMTP real en otro entorno, conserva STARTTLS y autenticación.


### Actualización: Mailpit incluido en compose.demo.yml (2026-11-22)

El SMTP de pruebas del backend ya **no depende del puerto 54325 de Supabase CLI**.
`compose.demo.yml` inicia un servicio `mailpit` en la misma red que el backend.
Usa `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, sin login/STARTTLS **solo en APP_ENV=demo**.
La bandeja accesible desde el navegador está en **http://127.0.0.1:8025**.
El puerto 54324 de Supabase local puede seguir mostrando otros mensajes nativos de Supabase Auth; no confundas ambos buzones.
Recrea la demo para aplicar los valores: `docker compose -f compose.demo.yml up -d --build`.
Verifica `docker compose -f compose.demo.yml logs --tail=100 backend mailpit` si falla el envío.
