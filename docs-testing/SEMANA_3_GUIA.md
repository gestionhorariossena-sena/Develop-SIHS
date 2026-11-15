# 🧩 SIHS · Semana 3 — Tests de componentes React

> **Rama base de trabajo:** `semana-3` · **Equipo:** Nicol, David, Dayana y Edith · **Reto:** tests de componentes del proyecto formativo · **Tiempo estimado:** 3 h · **Piso exigido:** 40 % de cobertura en frontend y backend, sin rebajar los umbrales heredados.

**Este README es exclusivo de `semana-3`.** No modificar el README de `main`, `develop`, `semana-1` o `semana-2` para preparar este reto. La rama fue creada desde `semana-2`; las cuatro PR personales de S2 aún deben revisarse y cerrarse por separado. Antes del cierre grupal de S3, incorporar por el flujo aprobado los cambios de S2 que procedan, sin sobrescribir trabajo de otras ramas.

## 🎯 Parte 1 — Reparto de componentes (10 min)

**Todos trabajan Front en S3.** En `docs/matriz-rotacion.md`, la columna **S3** debe mostrar `Front: <componente>`, con un componente distinto por persona. La rotación de capas se retoma la próxima semana.

| Integrante | Columna S3 | Componente real del proyecto | Rama individual | Pruebas de referencia (≥3) |
|---|---|---|---|---|
| **Nicol** | **Front: Login** | `frontend/src/pages/Login.tsx` | `test/s3-front-nicol` | Escribir usuario y clave + enviar; estado de carga/botón deshabilitado; bloqueo o error de autenticación visible |
| **David** | **Front: Registro** | `frontend/src/pages/Registro.tsx` | `test/s3-front-david` | Completar campos y enviar; validación de formulario; error de solicitud o estado de envío |
| **Dayana** | **Front: NotificacionesPanel** | `frontend/src/components/NotificacionesPanel.tsx` | `test/s3-front-dayana` | Interacción al seleccionar una notificación; estado vacío; lista con datos y/o error simulado al actualizar |
| **Edith** | **Front: RecuperarContrasena** | `frontend/src/pages/RecuperarContrasena.tsx` | `test/s3-front-edith` | Escribir correo + enviar; error de Supabase simulado; confirmación de envío y navegación al paso del código |

**Responsable adicional del backend: Edith**, porque tuvo Front en S2. Debe comprobar la cobertura real del backend, mantener como mínimo el 40 % del reto y **no permitir retrocesos respecto del 84 % heredado**. Si se necesitan pruebas unitarias adicionales, Edith las añade y documenta sin duplicar los componentes Front del equipo ni bajar el umbral.

Estos escenarios son una **planificación** y no se cuentan como tests implementados hasta existir código y evidencia CI. Se permite ajustar cada caso tras revisar el componente, manteniendo interacción, caso no feliz, mutación y componente único.

## 🧪 Parte 2 — Pruebas de componentes (2 h)

Cada integrante debe aportar **al menos tres tests nuevos** sobre su propio componente React con Vitest y React Testing Library:

1. **Interacción real:** usar `@testing-library/user-event` (`user.type`, `user.click`, `user.keyboard`, etc.) para escribir, hacer clic o enviar; verificar efecto observable mediante aserciones.
2. **Estado no feliz:** comprobar al menos uno de validación, carga, vacío, error o falta de permisos; no limitarse al renderizado inicial.
3. **Consultas accesibles:** preferir `getByRole` y `getByLabelText`; usar `findBy` para esperar contenido asíncrono y `queryBy` para comprobar ausencia. `getByTestId` solo con justificación explícita en comentario.
4. **Entorno aislado:** para rutas usar `MemoryRouter`, y para contexto **reutilizar** `frontend/tests/helpers/renderConProviders.tsx` (exporta `renderConProviders`). No crear otro helper global equivalente sin consensuarlo.
5. **Sin red real:** usar `vi.mock` para cliente HTTP y Supabase; datos y fechas controlados. No incluir credenciales reales ni usar producción.
6. **Accesibilidad:** corregir etiquetas asociadas, nombres accesibles y `role="alert"` donde falten. Los cambios de UI deben ser mínimos y centrados en el componente.
7. **Lógica separable:** si la lógica y la vista están excesivamente mezcladas, extraer una función pura y probarla adicionalmente, pero los tres tests de componente siguen siendo obligatorios.
8. **Un mutante por persona:** alterar temporalmente una condición, texto de error o reseteo; correr el test que debe fallar; guardar evidencia roja; **restaurar** código correcto; repetir tests y CI verde. Documentarlo en el mismo PR individual.

**Ubicación de suites:** `frontend/tests/unit/pages/` para Login, Registro y RecuperarContrasena; `frontend/tests/unit/components/` para NotificacionesPanel. No incorporar tests dentro de `frontend/src/`. Revisar los tests ya existentes y aportar escenarios **nuevos**, no renombrar ni contar pruebas anteriores.

### Distribución orientativa del tiempo

- 10 min: confirmar reparto y matriz.
- 120 min: tests, interacciones, mutantes, ajustes de accesibilidad y PR personales.
- 20 min: cobertura, PR de umbrales, CI y registro de cierre.
- 30 min restantes de las 3 h estimadas: margen para revisión cruzada, problemas del entorno y vocero.

## 🔄 Ramas personales, PR y revisiones cruzadas

Todos los trabajos comienzan desde `semana-3`, no desde `develop` ni desde `main`.

```bash
git fetch origin
git switch semana-3
git pull --ff-only origin semana-3
git switch -c test/s3-front-NOMBRE
# Implementar, documentar mutación y ejecutar tests...
git add ruta/de/mis/tests ruta/de/mi/componente
git commit -m "test(s3): pruebas de componente ..."
git push -u origin test/s3-front-NOMBRE
```

| PR personal | Base obligatoria | Revisor cruzado | Integrar solo cuando... |
|---|---|---|---|
| `test/s3-front-nicol` → `semana-3` | `semana-3` | David | 3+ tests, mutante documentado, revisión ejecutada y CI verde |
| `test/s3-front-david` → `semana-3` | `semana-3` | Dayana | 3+ tests, mutante documentado, revisión ejecutada y CI verde |
| `test/s3-front-dayana` → `semana-3` | `semana-3` | Edith | 3+ tests, mutante documentado, revisión ejecutada y CI verde |
| `test/s3-front-edith` → `semana-3` | `semana-3` | Nicol | 3+ tests, mutante documentado, revisión ejecutada y CI verde; revisar backend |

Los cuatro integrantes deben hacer commits desde **sus propias cuentas de GitHub**. El revisor debe ejecutar los tests del componente ajeno, comprobar las aserciones y verificar el comportamiento del mutante. No simular aprobaciones ni fusionar antes de la revisión. Si falla CI, corregir en la **misma rama y PR**.

## 📈 Parte 3 — Cobertura y PR de umbrales (20 min)

**Este reto pide un quinto PR específico de umbrales** después de fusionar los cuatro individuales. No incluir prematuramente las modificaciones de umbrales en los PR de componente.

1. Con los cuatro PR de componentes ya fusionados en `semana-3`, ejecutar Vitest con cobertura y pytest con cobertura.
2. Registrar en la matriz la cobertura **real** de Front (sentencias, ramas, funciones, líneas) y backend (global).
3. Abrir una rama técnica `chore/s3-umbrales-cobertura` desde `semana-3` y un **PR independiente** a `semana-3` que establezca para cada métrica el **máximo entre 40 % y la cobertura real redondeada hacia abajo**, conservando siempre cualquier umbral heredado superior.
4. Exigir CI verde con el umbral nuevo, revisión del PR y ausencia de regresiones. No rebajar el umbral por un error de pruebas.

### Umbrales heredados que NO se pueden reducir

| Métrica | Umbral anterior |
|---|---:|
| Frontend — sentencias | **76,73 %** |
| Frontend — ramas | **64,85 %** |
| Frontend — funciones | **73,89 %** |
| Frontend — líneas | **79,59 %** |
| Backend — global | **84 %** |

La regla por métrica al cierre es: **umbral S3 = máximo(40, piso(cobertura real), umbral previamente vigente)**. Si la cobertura actual cae debajo del umbral heredado, corregir los tests o el código: **no reducir el umbral**. El mínimo del 40 % ya está superado por los umbrales históricos, pero sigue siendo obligatorio medir y evidenciar ambas capas.

Archivos relevantes: `frontend/vite.config.ts` y configuración pytest/CI del backend (revisar ubicación y formato actual antes de editar). Las pruebas deben seguir ejecutándose con la configuración del proyecto y sin exclusiones artificiales.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm test:coverage
pnpm lint
pnpm build

cd ../backend
python -m pip install -r requirements.txt
python -m pytest -v --cov=app --cov-report=term --cov-fail-under=84
```

## ✅ Entregables y checklist

- [ ] `docs/matriz-rotacion.md`: columna S3 con **Front: Login**, **Front: Registro**, **Front: NotificacionesPanel**, **Front: RecuperarContrasena**, sin repeticiones.
- [ ] Cuatro suites de componente: ≥3 tests nuevos por persona, con **user-event** y al menos un estado no feliz.
- [ ] Cuatro mutantes distintos detectados, con CI rojo o log de test fallido, y código correcto restaurado.
- [ ] Cuatro PR personales revisados por otro integrante **que ejecutó los tests**; CI verde antes de fusionar.
- [ ] Un solo helper de render con proveedores y mocks aislados de red.
- [ ] Edith verificó backend, documentó cobertura real y agregó tests si fueran necesarios.
- [ ] La matriz muestra cobertura real Front y backend, fecha/PR de evidencias y revisores.
- [ ] Quinto PR de umbrales (después de los cuatro) fusionado con CI verde; pisos ≥40 % y sin retrocesos frente a S2.
- [ ] Acordar la integración posterior de `semana-3` a `develop` con el equipo; no tocar `main` durante la ejecución individual.

## 🎙️ Preparación para el vocero aleatorio

Cada integrante prepara **el componente de otra persona**, no solamente el suyo. Debe ser capaz de:

- Explicar por qué se usó `getByRole` o `getByLabelText`, cuándo conviene `findBy` y cuándo `queryBy`.
- Ejecutar la suite ajena sin credenciales externas.
- Introducir en vivo un cambio de comportamiento y mostrar el test que lo detecta.
- Explicar las mejoras de accesibilidad y el efecto en cobertura.

---

## 📘 Información general del proyecto

### SIHS — Sistema de Información de Horarios SENA

SIHS es un monorepo con una API REST, un cliente web y una aplicación móvil
para consultar y gestionar información académica y horarios. Los tres
clientes usan Supabase para autenticación y PostgreSQL; la web y el móvil
consumen la API FastAPI.

## Inicio rápido

### Requisitos

- Git
- Python y Node.js
- Flutter SDK, solo para ejecutar la aplicación móvil
- Acceso al proyecto Supabase del equipo

Antes de iniciar, configura las variables de entorno siguiendo
[`database/README.md`](./database/README.md). No compartas ni subas archivos
`.env`.

### Backend

En PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

La API queda en `http://127.0.0.1:8000`; Swagger, en
`http://127.0.0.1:8000/docs`. Completa `backend/.env` antes de usar las
funciones que requieren Supabase.

### Aplicación web

En otra terminal de PowerShell:

```powershell
cd frontend
pnpm install
Copy-Item .env.example .env
pnpm dev
```

Vite muestra la URL local, normalmente `http://localhost:5173`. Consulta
[`frontend/README.md`](./frontend/README.md) para pruebas unitarias y E2E.

### Aplicación móvil (opcional)

```powershell
cd mobile
flutter pub get
Copy-Item .env.example .env
flutter run
```

La configuración de red para emuladores y dispositivos físicos está en
[`mobile/README.md`](./mobile/README.md).

## Estructura

| Ruta | Contenido |
|---|---|
| [`backend/`](./backend/) | API FastAPI, reglas de negocio, pruebas y migraciones Alembic |
| [`frontend/`](./frontend/) | Cliente web React, TypeScript y Vite |
| [`mobile/`](./mobile/) | Aplicación Flutter |
| [`database/`](./database/) | Esquema SQL y guía de Supabase |
| [`docs-sihs/`](./docs-sihs/) | Documentación general, arquitectura, diseños, diagramas y presentaciones |
| [`docs-testing/`](./docs-testing/) | Documentación de testing, matriz ADSO, evidencias y bootcamp |

Guías de referencia:

- [Arquitectura móvil](./docs-sihs/Arquitectura/ARQUITECTURA_MOBILE.md)
- [Flujo de trabajo del monorepo](./docs-sihs/Documentación%20general/GUIA_MONOREPO.md)
- [Índice de informes de pruebas](./docs-testing/informes-historicos/README.md)

Cada componente mantiene su propia guía de ejecución. Para cambios de esquema
de base de datos, revisa primero
[`database/README.md`](./database/README.md); no ejecutes scripts de creación,
datos de prueba o migraciones contra una base compartida sin autorización.

## Flujo de trabajo

El trabajo se integra normalmente mediante Pull Request hacia `develop`. Crea
una rama para cada cambio:

```powershell
git switch develop
git pull origin develop
git switch -c feature/nombre-del-cambio
```

Al terminar:

```powershell
git add ruta/de/los/archivos
git commit -m "tipo(área): descripción breve"
git push -u origin feature/nombre-del-cambio
```

## Licencia y autores

Proyecto académico desarrollado en el programa de formación ADSO del SENA.
