# Base de datos — guía paso a paso

Usamos **Supabase**: es un PostgreSQL ya instalado y funcionando en internet.
Nadie del equipo tiene que instalar PostgreSQL en su computador ni usar
Docker para la base de datos. Solo necesitas las credenciales del proyecto.

## 1. Consigue las credenciales

Pídele a quien creó el proyecto en [supabase.com](https://supabase.com) que
te comparta (por un canal privado, no en un grupo público):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo si vas a tocar backend)
- `DATABASE_URL` y `ALEMBIC_DATABASE_URL` (las dos cadenas de conexión)

Estas credenciales salen del panel de Supabase en **Project Settings → API**
y **Project Settings → Database**.

## 2. Ponlas en tu `.env`

En `backend/`, copia el archivo de ejemplo y pega ahí los valores reales:

```bash
cd backend
cp .env.example .env
```

Abre `backend/.env` y reemplaza cada valor vacío con lo que te compartieron.

Si vas a tocar frontend, haz lo mismo en `frontend/`:

```bash
cd frontend
cp .env.example .env
```

**Nunca subas tu `.env` a GitHub.** Ya está en `.gitignore`, así que con
`git status` no debería aparecer — si aparece, algo está mal, avisa antes de
hacer commit.

## 3. Crea las tablas (solo la primera vez, alguien ya lo hizo)

El archivo [`01_creacion.sql`](./01_creacion.sql) de esta carpeta crea todas
las tablas del sistema (usuarios, roles, horarios, fichas, ambientes, etc.).
**No necesitas correrlo tú** salvo que estén armando un proyecto de Supabase
nuevo desde cero — ya se corrió una vez contra el proyecto compartido del
equipo.

Si en algún momento sí necesitas correrlo (por ejemplo, en un proyecto de
pruebas propio), la forma más simple es:

1. Entra al proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** (en el menú de la izquierda).
3. Abre `01_creacion.sql` de esta carpeta, copia todo el contenido, pégalo
   en el editor de Supabase y dale "Run".

## 4. ¿Y ahora qué?

Con el `.env` configurado, ya puedes seguir las instrucciones normales del
[README general](../README.md) para levantar el backend y el frontend — ellos
se conectan solos a la base de datos usando esas variables.

## Sobre `02_datos_prueba.sql` y por qué no hay Docker aquí

**No usamos Docker para la base de datos** — es Supabase, nadie necesita
levantar nada local. Si en algún momento vuelve a aparecer un
`docker-compose.yml`, avisen antes de usarlo, seguimos con Supabase.

**`02_datos_prueba.sql`** ya está adaptado a Supabase Auth y probado en vivo
contra el proyecto del equipo: crea coordinaciones, programas, fichas,
sedes, ambientes, horarios (con su consulta de detección de cruces incluida
al final) y **4 usuarios de prueba que sí pueden iniciar sesión de
verdad**, porque se crean primero en `auth.users` (con contraseña real,
usando `pgcrypto`) y recién ahí se les crea la fila de perfil en
`usuarios` con el mismo UUID — no un `INSERT` directo con contraseña
inventada, que ya no funciona con Supabase Auth.

Los 4 usuarios de prueba, todos con contraseña `Prueba123!`:

| Email | Rol |
|---|---|
| `ana@mail.com` | Coordinador |
| `carlos@mail.com` | Instructor |
| `juan@mail.com` | Aprendiz |
| `maria@mail.com` | Aprendiz |

Úsenlos para probar el backend con un token real sin tener que registrar un
usuario nuevo cada vez (`POST {SUPABASE_URL}/auth/v1/token?grant_type=password`
con cualquiera de esos emails).

## Qué es cada carpeta aquí

- `01_creacion.sql` — el esquema completo (todas las tablas), listo para
  correr una sola vez.
- `02_datos_prueba.sql` — datos de ejemplo para desarrollo, ya corrido
  contra el proyecto del equipo (ver tabla de usuarios arriba).
- `migrations/` — cambios de esquema aplicados a mano **antes** de que
  Alembic existiera en el proyecto (2026-08 a 2026-09). Quedan como
  historial, no se vuelven a correr. **Los cambios de esquema nuevos van en
  `backend/alembic/versions/`** (ver más abajo), no acá.

### Alembic (cambios de esquema desde 2026-09-01)

Ya configurado — `backend/alembic/env.py` usa `ALEMBIC_DATABASE_URL` (el
pooler de sesión, puerto 5432, necesario para DDL) y conoce todos los
modelos de `backend/app/models/`.

Flujo para un cambio de esquema nuevo:

```bash
cd backend
source .venv/bin/activate
# 1. Cambia el modelo en app/models/ primero.
# 2. Genera la migración comparando modelos vs. la BD real:
alembic revision --autogenerate -m "descripción corta"
# 3. ABRE el archivo generado en alembic/versions/ y revísalo a mano —
#    autogenerate no siempre acierta (ver el comentario en la migración
#    baseline sobre por qué el ON DELETE CASCADE hay que vigilarlo).
```

Aplicar la migración contra la base compartida de Supabase es un cambio de
esquema, así que sigue la misma regla que cualquier otro: no lo corre
Claude por su cuenta, lo corre quien esté en la sesión con `!`:

```
!cd backend && source .venv/bin/activate && alembic upgrade head
```
- `seeds/` — carpeta original del esqueleto, sin usar todavía (los datos de
  prueba quedaron en `02_datos_prueba.sql` en su lugar).

## Si algo no conecta

- Revisa que copiaste el `.env` completo, sin espacios de más ni comillas.
- Revisa que la contraseña dentro de `DATABASE_URL`/`ALEMBIC_DATABASE_URL`
  sea la actual — si alguien la reseteó en Supabase, hay que actualizarla en
  tu `.env` local.
- Si nada de esto funciona, pregunta en el grupo del equipo antes de cambiar
  nada en Supabase — es un proyecto compartido.
