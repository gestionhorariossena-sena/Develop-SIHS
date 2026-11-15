# Estructura del frontend — qué es cada cosa

Guía para entender el código sin tener que preguntar — misma idea que
`backend/ESTRUCTURA.md`. Si van a programar una pantalla nueva, este
documento dice exactamente qué archivos tocar y cómo conectarla al backend.

## Tecnologías usadas

| Pieza | Para qué |
|---|---|
| **React 19 + Vite** | Ya venían en el esqueleto del repo |
| **TypeScript** | Ya venía; los tipos de los datos del backend están en `src/types/api.ts` |
| **React Router** (`react-router-dom`) | Navegación entre páginas — ver `src/routes/` |
| **Tailwind CSS v4** (`@tailwindcss/vite`) | Estilos. No hay `tailwind.config.js`: los colores custom (`sena-600`, etc.) se definen directo en `src/index.css` con `@theme` |
| **`@supabase/supabase-js`** | Login, registro, recuperar contraseña y sesión — habla directo con Supabase Auth, no con nuestro backend |

**A propósito NO se agregó** ninguna librería de manejo de estado de
servidor (TanStack Query), formularios (React Hook Form) ni de componentes
(shadcn/ui) — se decidió mantenerlo simple con `useState`/`useEffect` y
`fetch` normal. Si en algún punto el proyecto crece tanto que esto empieza a
doler (muchas pantallas repitiendo el mismo patrón de carga/error), ahí sí
vale la pena reconsiderarlo — no antes.

## Mapa de carpetas

```text
frontend/
├── src/
│   ├── main.tsx              # Punto de entrada — monta <App /> en el DOM. No se toca casi nunca.
│   ├── App.tsx                 # Envuelve todo en <BrowserRouter> y <AuthProvider>. No se toca casi nunca.
│   ├── index.css                 # Import de Tailwind + colores institucionales (sena-*)
│   ├── vite-env.d.ts               # Tipos de las variables de entorno (VITE_*)
│   │
│   ├── services/                    # Todo lo que habla con algo externo
│   │   ├── supabaseClient.ts          # El cliente de Supabase (una sola instancia, se importa donde haga falta)
│   │   └── api.ts                       # Wrapper de fetch hacia el backend — CONSUME EL BACKEND, ver abajo
│   │
│   ├── context/                     # Estado compartido por toda la app
│   │   └── AuthContext.tsx            # Sesión de Supabase (quién está logueado)
│   ├── hooks/
│   │   └── useAuth.ts                 # Atajo para leer el AuthContext: `const { session } = useAuth()`
│   │
│   ├── types/
│   │   └── api.ts                     # Los tipos de datos que devuelve el backend (Usuario, Rol...)
│   │
│   ├── routes/
│   │   ├── AppRouter.tsx              # Todas las rutas de la app viven acá
│   │   └── ProtectedRoute.tsx           # Envuelve una página que exige sesión iniciada
│   │
│   ├── components/                  # Piezas de UI reutilizadas entre páginas
│   │   ├── AuthLayout.tsx             # Tarjeta blanca + barra verde de Login/Registro/Recuperar
│   │   └── FormField.tsx              # Un input con su label, estilado
│   │
│   ├── pages/                       # Una pantalla completa = una ruta
│   │   ├── Login.tsx
│   │   ├── Registro.tsx
│   │   ├── RecuperarContrasena.tsx
│   │   └── Dashboard.tsx              # La única pantalla que hoy consume el backend además de Auth
│   │
│   └── assets/
│       └── sena-logo.jpeg             # Logo oficial, lo usa AuthLayout y el sidebar del Dashboard
│
├── .env / .env.example        # Credenciales de Supabase + URL del backend
└── package.json
```

## Cómo se conecta cada pantalla

| Pantalla | Con qué habla | Cómo |
|---|---|---|
| `Login.tsx` | Supabase Auth | `supabase.auth.signInWithPassword()` |
| `Registro.tsx` | Supabase Auth | `supabase.auth.signUp()` — el rol elegido se guarda como metadata (`rol_solicitado`), **no asigna un rol real todavía** (ver más abajo) |
| `RecuperarContrasena.tsx` | Supabase Auth | `supabase.auth.resetPasswordForEmail()` |
| `Dashboard.tsx` | **Backend FastAPI** | `apiGet()` — ver la siguiente sección |

## Cómo el Dashboard consume el backend (y cómo seguir haciéndolo)

`src/services/api.ts` es el único lugar que sabe hablarle al backend. Antes
de cada petición, toma el token de la sesión actual de Supabase
(`supabase.auth.getSession()`) y lo manda como
`Authorization: Bearer <token>` — así es como el backend identifica quién
está pidiendo qué (ver `backend/app/core/supabase_auth.py`).

Para traer datos de un endpoint nuevo, el patrón es siempre el mismo (así
está hecho en `Dashboard.tsx`):

```tsx
import { useEffect, useState } from 'react'
import { apiGet, ApiError } from '../services/api'
import type { Usuario } from '../types/api'

const [datos, setDatos] = useState<Usuario[] | null>(null)

useEffect(() => {
  apiGet<Usuario[]>('/usuarios')
    .then(setDatos)
    .catch((err: ApiError) => {
      // err.status === 403 si el rol del usuario no alcanza
    })
}, [])
```

`apiGet`/`apiPost`/`apiPut`/`apiDelete` reciben la ruta **sin** `/api/v1`
(esa parte ya la agrega `VITE_API_URL` del `.env`) — por ejemplo
`apiGet('/roles')`, no `apiGet('/api/v1/roles')`.

**Cuando exista un módulo nuevo en el backend** (horarios, ambientes, etc. —
ver `backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md`), para consumirlo desde el
frontend:

1. Agregar el tipo correspondiente en `src/types/api.ts`.
2. Llamar `apiGet`/`apiPost`/etc. con la ruta nueva, igual que en el
   ejemplo de arriba — no hace falta tocar `api.ts`.
3. Si la pantalla no existe todavía, crearla en `src/pages/` y agregarla a
   `AppRouter.tsx`.

## Sobre el registro y los roles (ojo con esto)

El backend no tiene todavía un flujo de "aprobar solicitud de registro" — el
`rol_solicitado` que guarda `Registro.tsx` en la metadata del usuario de
Supabase **no lo lee nadie automáticamente**. Un Administrador tiene que
asignar el rol real a mano, por ahora vía `POST /usuario-rol/asignar` (con
Postman/Swagger) o SQL directo. Construir una pantalla de "aprobar
solicitudes" para que un Administrador lo haga desde la UI es trabajo
pendiente — ver `backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md`.

## Cómo levantar esto y ver la app de verdad

```bash
cd frontend
pnpm install
cp .env.example .env    # y completar con las credenciales reales
pnpm dev
```

Necesita el backend corriendo en paralelo (`cd backend && uvicorn app.main:app --reload`)
para que el Dashboard cargue datos — si no, se queda en "Cargando…" y la
consola del navegador muestra el error real.

Usuarios de prueba ya sembrados (ver `database/README.md`), contraseña
`Prueba123!` para todos: `admin@mail.com` (ve todo), `ana@mail.com`
(Coordinador), `carlos@mail.com` (Instructor), `juan@mail.com` /
`maria@mail.com` (Aprendiz) — sirven para probar cómo se ve el Dashboard con
y sin permisos de Administrador.
