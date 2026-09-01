# Qué falta para una versión mínima demostrable

Estado al 2026-08-23, ~24h antes de mostrar algo. Esto no es el roadmap
completo (eso está en
[`AUDITORIA_TECNICA.md`](../_Docs/Documentación%20general/AUDITORIA_TECNICA.md))
— es la lista corta y honesta de qué falta para poder enseñar algo funcionando
mañana.

## ✅ Ya funciona (probado en vivo contra Supabase, no solo en teoría)

- Conexión del backend a Supabase (Postgres + Auth).
- Esquema completo aplicado (19 tablas).
- Login/registro por Supabase Auth (probado con un usuario real, se creó y se borró).
- El backend valida el token de sesión y crea automáticamente el perfil en
  `usuarios` la primera vez que alguien autenticado hace una petición.
- CRUD de `roles` (solo Administrador).
- Asignar/remover rol a un usuario (solo Administrador).
- `GET /usuarios/me` — perfil del usuario autenticado.
- Autorización por rol: un usuario sin el rol correcto recibe 403.
- Catálogo de roles sembrado: Administrador, Coordinador, Instructor, Aprendiz.
- CORS configurado para que un frontend en `localhost:5173` pueda llamar al backend.
- `database/02_datos_prueba.sql` corrido contra el proyecto compartido: 5
  usuarios de prueba reales (con Supabase Auth, no contraseñas falsas) con
  roles ya asignados — **incluye un Administrador**, así que el bloqueador
  de abajo ya no aplica. Ver la tabla de usuarios en
  [`database/README.md`](../database/README.md).

## ~~🚨 Bloqueador inmediato — el primer Administrador~~ (resuelto)

Ya no hace falta el bootstrap manual: `admin@mail.com` / `Prueba123!` ya
tiene rol Administrador y quedó probado contra `/api/v1/roles` y
`/api/v1/usuarios` en vivo. Si de todos modos necesitan un Administrador
"real" (no de prueba) más adelante, el procedimiento sigue siendo el mismo:
crear el usuario por signup, hacer una petición autenticada para que se cree
su fila en `usuarios`, y asignarle el rol por SQL o desde la cuenta admin de
prueba usando `POST /usuario-rol/asignar`.

## Para el demo de 24h, falta decidir

- **¿El demo es solo backend (Swagger en `/docs` + Postman) o necesitan algo
  de frontend?** El frontend quedó vacío a propósito — si necesitan mostrar
  una pantalla, avisen con tiempo porque hay que decidir qué mínimo tiene
  sentido (¿solo login? ¿login + lista de roles?).
- Si es solo backend: `/docs` ya sirve para probar todo en vivo sin escribir
  una sola línea de frontend — es la opción más rápida y segura para 24h.

## Pendiente real (no bloquea el demo, pero hay que saberlo)

- **Alembic no está configurado todavía.** El esquema se aplicó directo con
  `psql` sobre `database/01_creacion.sql`. Cualquier cambio de esquema desde
  ahora debería pasar por Alembic, no por editar el SQL a mano — si no,
  perdemos el historial que justamente nos faltaba en el proyecto anterior.
- **RLS está activo pero sin políticas** en las 19 tablas (verificado). Esto
  **no afecta al backend actual**: la conexión de FastAPI usa el rol dueño de
  las tablas, que RLS no restringe. Solo importa el día que el frontend use
  `supabase-js` para leer una tabla directamente sin pasar por el backend —
  ahí sí hace falta escribir políticas primero.
- ~~Sin tests para `roles`/`usuarios`/`usuario_rol`~~ — resuelto:
  `backend/tests/test_roles.py`, `test_usuarios.py` y `test_usuario_rol.py`
  simulan la respuesta de Supabase Auth (mock de `httpx.get`, sin red real) y
  corren contra SQLite en memoria en vez de Supabase.
- **Módulos de negocio (horarios, fichas, ambientes, etc.) no existen en
  código** — las tablas ya están creadas por el script SQL, pero no hay
  modelos/servicios/rutas todavía. Es la Fase 2/3 del roadmap general, fuera
  de alcance de las próximas 24h salvo que decidan meter uno mínimo (el más
  simple para empezar sería `ambientes`, es un catálogo plano sin relaciones
  complicadas).

## Cómo levantar esto ahora mismo

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # y completarlo con las credenciales reales
uvicorn app.main:app --reload
```

Swagger interactivo en `http://127.0.0.1:8000/docs` — ahí mismo se puede
pegar el token de Supabase (botón "Authorize") y probar todos los endpoints
protegidos sin escribir código.
