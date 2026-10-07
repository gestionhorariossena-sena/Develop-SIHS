# Sistema de Información SIHS 🚀

El **Sistema de Información SIHS** es una plataforma web desarrollada con una arquitectura basada en API REST y desacoplada mediante un enfoque de **Monorepo**. Este repositorio contiene tanto el servidor Backend como el cliente Frontend, garantizando un desarrollo modular, escalable y mantenible.

---

## ▶️ Inicio rápido (para ver el proyecto andando)

Necesitas **dos consolas abiertas al mismo tiempo**, una para cada carpeta —
el backend y el frontend son dos servidores independientes que corren en
paralelo.

**Antes que nada:** consigue el `.env` de `backend/` y `frontend/` — ver
[`database/README.md`](./database/README.md) (son las credenciales de
Supabase, no se suben a GitHub).

**Consola 1 — Backend:**

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # y pegar ahí las credenciales reales
uvicorn app.main:app --reload
```

Déjala corriendo — queda en `http://127.0.0.1:8000` (probar en
`http://127.0.0.1:8000/docs`).

**Consola 2 — Frontend:**

```bash
cd frontend
npm install
cp .env.example .env        # y pegar ahí las credenciales reales
npm run dev
```

Déjala corriendo también — abre la URL que muestre la consola (normalmente
`http://localhost:5173`).

Con las dos consolas corriendo a la vez, ya se puede entrar al sistema
desde el navegador. Usuarios de prueba en
[`database/README.md`](./database/README.md).

**Opcional — Consola 3 — App Móvil (Flutter):**

La app móvil consume el mismo backend y Supabase que el frontend web.

```bash
cd mobile
flutter pub get
cp .env.example .env        # y pegar ahí las credenciales reales
flutter run
```

Para más detalles, ver [`mobile/README.md`](./mobile/README.md).

---

## ✅ Estado funcional actual

La versión web de SIHS ya cubre el flujo principal de gestión de horarios y
sus módulos relacionados. El sistema trabaja con cuatro perfiles:
**Administrador, Coordinador, Instructor y Aprendiz**, con acceso a rutas
según rol.

### Módulos principales disponibles

- **Horarios:** constructor manual por ficha, asistente de programación,
  calendario general, horarios completos, historial, auditoría de cruces y
  publicaciones programadas.
- **Fichas y formación:** fichas, programas, temáticas/resultados de
  aprendizaje, fase actual y vínculo de aprendices con su ficha.
- **Recursos:** ambientes, sedes, jornadas e instructores.
- **Instructor:** horario propio, detalle de franja, asistencia y solicitudes
  de cambio de horario.
- **Aprendiz:** horario propio, consulta de asistencia y mensajería.
- **Comunicaciones:** avisos y notificaciones.
- **Administración:** usuarios, roles, códigos de instructor y aprobación de
  solicitudes de acceso.

### Reglas importantes del horario

- Los horarios activos se validan por cruces de **ficha, instructor y
  ambiente**.
- Una ficha solo puede programarse en el período académico al que pertenece.
- Los borradores no aparecen en los horarios personales hasta ser publicados.
- Los horarios históricos con dependencias operativas se conservan para
  trazabilidad, pero pueden quedar inactivos y no publicados.
- La edición y creación por ficha mantienen separadas las asignaciones de cada
  ficha para evitar modificaciones accidentales sobre otras.

---

## 🛠️ Tecnologías Utilizadas

### **Backend**
* **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
* **Servidor ASGI:** Uvicorn
* **Modelado y ORM:** SQLAlchemy / Pydantic
* **Migraciones:** Alembic
* **Autenticación:** Supabase Auth (JWT)
* **Base de Datos:** PostgreSQL gestionado en [Supabase](https://supabase.com)

### **Frontend**
* **Librería/Framework:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Lenguaje:** TypeScript
* **Estilos:** TailwindCSS
* **Rutas:** React Router
* **Cliente Supabase:** `@supabase/supabase-js`

### **Mobile**
* **Framework:** [Flutter](https://flutter.dev/) (Dart)
* **Estado:** Provider
* **HTTP Client:** Dio
* **Autenticación:** Supabase Flutter SDK
* **Base de Datos:** PostgreSQL (misma que backend, vía Supabase)

### **Infraestructura y Herramientas**
* **Control de Versiones:** Git & GitHub
* **Pruebas de API:** Postman

---

## 📁 Estructura del Proyecto (Monorepo)

```text
PROYECTO-SIHS/
├── backend/                  # Servidor de API REST (FastAPI)
│   ├── app/
│   │   ├── api/              # Endpoints y rutas de la API
│   │   ├── core/             # Configuraciones globales y seguridad JWT
│   │   ├── models/           # Modelos de base de datos (SQLAlchemy)
│   │   ├── schemas/          # Esquemas de validación (Pydantic)
│   │   ├── repositories/     # Acceso a datos
│   │   └── services/         # Lógica de negocio
│   ├── app/main.py           # Punto de entrada de la aplicación FastAPI
│   ├── .env.example          # Plantilla de variables de entorno
│   ├── requirements.txt      # Dependencias de Python
│   ├── ESTRUCTURA.md         # 👉 Qué es cada archivo, patrón para agregar módulos
│   └── OBJETIVO_Y_SERVICIOS_FALTANTES.md  # 👉 Qué falta para cumplir el objetivo
│
├── frontend/                 # Cliente Web (React + Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── assets/           # Imágenes (logo SENA, etc.)
│   │   ├── components/       # Componentes de UI reutilizables (AuthLayout, FormField)
│   │   ├── context/          # AuthContext — sesión de Supabase
│   │   ├── hooks/            # useAuth
│   │   ├── pages/            # Login, Registro, RecuperarContrasena, Dashboard
│   │   ├── routes/           # AppRouter, ProtectedRoute
│   │   ├── services/         # supabaseClient.ts (Auth) y api.ts (consume el backend)
│   │   └── types/            # Tipos que reflejan los schemas del backend
│   ├── .env.example          # Plantilla de variables de entorno
│   ├── package.json          # Dependencias de Node.js
│   ├── ESTRUCTURA.md         # 👉 Qué es cada archivo, cómo consumir el backend
│   └── OBJETIVO_Y_SERVICIOS_FALTANTES.md  # 👉 Qué pantallas faltan
│
├── mobile/                   # Cliente Móvil (Flutter - iOS/Android/Web)
│   ├── lib/
│   │   ├── main.dart         # Punto de entrada de la app
│   │   ├── config/           # Configuración (AppConfig)
│   │   ├── models/           # Modelos de datos (Usuario, Horario)
│   │   ├── services/         # Servicios (Auth, API, Horarios)
│   │   ├── providers/        # State management (Provider)
│   │   ├── screens/          # Pantallas (Login, Home)
│   │   └── widgets/          # Widgets reutilizables
│   ├── .env.example          # Plantilla de variables de entorno
│   ├── pubspec.yaml          # Dependencias de Flutter
│   └── README.md             # 👉 Setup, arquitectura, endpoints
│
├── database/                 # Esquema y guía de la base de datos (Supabase)
│   ├── README.md             # 👉 Cómo configurar y conectarte a la BD
│   ├── 01_creacion.sql       # Esquema completo de tablas
│   ├── migrations/           # Migraciones de Alembic
│   └── seeds/                # Datos de prueba
│
├── .gitignore                # Archivos e itinerarios excluidos de Git
└── README.md                 # Documentación principal del proyecto
```

---

## 🗄️ Base de Datos

El proyecto usa **Supabase** (PostgreSQL en la nube) — nadie necesita instalar
una base de datos local. Para configurarla en tu máquina, sigue la guía paso
a paso en **[`database/README.md`](./database/README.md)**.

---

## ⚙️ Configuración e Instalación Local

### Requisitos Previos

* Node.js (versión 18 o superior)
* Python (versión 3.10 o superior)
* Git

### 1. Clonar el Repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd PROYECTO-SIHS
```

### 2. Configurar la Base de Datos

Antes de levantar el backend, sigue **[`database/README.md`](./database/README.md)**
para conseguir tus credenciales de Supabase y crear tu `.env`.

### 3. Configuración del Backend

Entrar a la carpeta del backend:

```bash
cd backend
```

Crear el entorno virtual:

```bash
# En Windows:
python -m venv venv
.\venv\Scripts\activate

# En Linux/Mac:
python3 -m venv venv
source venv/bin/activate
```

Instalar las dependencias:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Iniciar el servidor de desarrollo:

```bash
uvicorn app.main:app --reload
```

El backend estará corriendo en: `http://127.0.0.1:8000`

Documentación interactiva Swagger: `http://127.0.0.1:8000/docs`

### 4. Configuración del Frontend

Abrir una nueva terminal y entrar a la carpeta del frontend:

```bash
cd frontend
```

Instalar dependencias de Node:

```bash
npm install
```

Iniciar el servidor de desarrollo:

```bash
npm run dev
```

El frontend estará corriendo en: `http://localhost:5173`

---

## 🌿 Flujo de Trabajo en Git y CI

La rama estable es **`main`**. Para trabajo colaborativo normal se recomienda
crear una rama corta por tarea y abrir un Pull Request hacia `main`.

```bash
git checkout main
git pull origin main
git checkout -b feature/nombre-tarea

# trabajar y validar
git add .
git commit -m "feat: descripción clara"
git push -u origin feature/nombre-tarea
```

Cada `push` y Pull Request ejecuta GitHub Actions:

- **Frontend:** `npm ci`, `npm run lint`, `npm run build` y `npm run test`.
- **Backend:** instalación de `requirements.txt` y `pytest -v`.

Antes de integrar una rama, ambos jobs deben finalizar correctamente. Los
cambios directos sobre `main` se reservan para mantenimiento coordinado del
repositorio.

---

## 📝 Licencia y Autores

Proyecto desarrollado como parte del programa de formación Tecnológica en Análisis y Desarrollo de Software (ADSO) - SENA.
