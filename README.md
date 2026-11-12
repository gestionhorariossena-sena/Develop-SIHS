# 🧪 SIHS · Semana 4 — El API desde cuatro ángulos

> **Rama base:** `semana-4` · **Equipo:** Nicol, David, Dayana y Edith · **Reto:** ≥4 tests nuevos de API por persona + 1 mutante detectado por persona · **Tiempo estimado:** 3 h · **Piso de cobertura:** 50 % en frontend y backend, **sin reducir umbrales heredados superiores**.

**Este README es exclusivo de `semana-4`.** La rama nace de `semana-3`, como base de planificación: **los PR personales pendientes de S2/S3 no se consideran integrados automáticamente**. Antes del cierre de S4, revisar e incorporar por PR los cambios previos que correspondan; no sobreescribir trabajos paralelos. No modificar el README de `main`, `develop` ni de semanas anteriores para este reto.

## 🎯 Parte 1 — Rotación de capa (10 min)

En S2: **Nicol = API**, **David = CI** (rol transversal), **Dayana = BD**, **Edith = Front**. Como David no tuvo una de las cuatro capas de esta consigna, recibe **E2E/seguridad**, nueva para él. El reparto asigna **una capa distinta por persona**, sin repetir la de S2. Aunque roten los ángulos, **todos escriben pruebas HTTP contra endpoints reales FastAPI**.

| Integrante | Capa S2 | Capa S4 / ángulo | Recurso real de SIHS | Rama personal | Revisor de otra capa |
|---|---|---|---|---|---|
| **Nicol** | API | **Front — contrato JSON consumido por React** | `/api/v1/notificaciones`: lista, conteo, lectura individual y error | `test/s4-front-contrato-nicol` | David (E2E) |
| **David** | CI (transversal) | **E2E — permisos, autenticación y errores API** | `/api/v1/fichas`: creación/listado según rol; peticiones inválidas y errores genéricos | `test/s4-e2e-seguridad-david` | Edith (BD) |
| **Dayana** | BD | **API — CRUD del recurso central** | `/api/v1/horarios`: crear, consultar, actualizar y eliminar | `test/s4-api-horarios-dayana` | Nicol (Front) |
| **Edith** | Front | **BD — dependencias de datos** | `/api/v1/solicitudes-acceso`: solicitud duplicada y filtro por estado; relaciones en fichas si aplica | `test/s4-bd-datos-edith` | Dayana (API) |

**No duplicar casos existentes:** revisar `backend/tests/` y añadir al menos cuatro escenarios **nuevos por persona**. Los escenarios siguientes son una propuesta verificable contra los routers actuales, no afirmaciones de tests ya implementados.

### Nicol — Front / contrato de notificaciones (≥4)

Archivo sugerido: `backend/tests/test_s4_contrato_notificaciones_nicol.py`. Router: `backend/app/api/v1/notificaciones.py`. Pantalla consumidora: `frontend/src/components/NotificacionesPanel.tsx`.

1. `GET /api/v1/notificaciones/` autenticado: `200`, JSON array con campos exactos que consume la interfaz (por ejemplo `idNotificacion`, `tipo`, `mensaje`, `leida`, `fechaCreacion`); comparar esquema con `app/schemas/notificacion.py`.
2. `GET /api/v1/notificaciones/conteo-no-leidas`: `200`, `application/json` y `noLeidas` numérico.
3. `PATCH /api/v1/notificaciones/{id}/leida`: respuesta JSON actualizada con `leida=true` y los campos usados al refrescar la lista.
4. `PATCH /api/v1/notificaciones/{id-inexistente}/leida`: `404` con `detail` utilizable por el frontend; comprobar ausencia de stack trace o SQL.

Usar `TestClient`, identidad simulada y servicio/repo aislado; verificar **código, cuerpo y Content-Type** en al menos uno. No sustituir pruebas HTTP por mocks de la interfaz React.

### David — E2E / seguridad transversal HTTP (≥4)

Archivo sugerido: `backend/tests/test_s4_seguridad_errores_david.py`. Router: `backend/app/api/v1/fichas.py`, dependencias `app/core/supabase_auth.py` y manejo de errores en `app/main.py`.

1. `POST /api/v1/fichas/` sin token → `401` y error JSON.
2. `POST /api/v1/fichas/` con rol sin permiso → `403` y error JSON (crear datos de acceso falsos con fixtures).
3. `GET /api/v1/fichas/` con rol autorizado → respuesta definida por contrato, sin red real.
4. Enviar **JSON sintácticamente mal formado** a un endpoint que reciba body: verificar el código **real de FastAPI** (normalmente `422`, no asumir `400`), `application/json` y ausencia de traceback, SQL o secretos.
5. Caso adicional recomendado: payload con tipos inválidos y respuesta segura, o `500` simulado con `TestClient(..., raise_server_exceptions=False)`.

Los tests deben ejecutarse mediante HTTP simulado contra `app`; **no** llamar entornos productivos ni usar credenciales reales. Para roles, diferenciar no autenticado (`401`) de autenticado sin permisos (`403`).

### Dayana — API / CRUD de horarios (≥4)

Archivo sugerido: `backend/tests/test_s4_crud_horarios_dayana.py`. Router: `backend/app/api/v1/horarios.py`.

1. `POST /api/v1/horarios/` con datos válidos y rol programador → `201`, campos de respuesta.
2. `GET /api/v1/horarios/{id}` existente → `200`; contrastar identidad y campos esenciales.
3. `GET /api/v1/horarios/{id-inexistente}` → `404` y `detail`.
4. `PUT /api/v1/horarios/{id}` o método de actualización que realmente defina el router → validar el cambio; alternativa adicional: `DELETE` según la ruta existente.
5. Recomendado: `POST` inválido → `422` y estructura de error; o cruce de horario → `409` con estructura de conflictos.

Confirmar las rutas exactas y preparar datos sin dependencias externas; reutilizar fixtures y aislar el servicio/repositorio donde corresponda. El `409` sólo se exige si ese escenario real existe.

### Edith — BD / datos y reglas (≥4)

Archivo sugerido: `backend/tests/test_s4_datos_solicitudes_edith.py`. Router: `backend/app/api/v1/solicitudes_acceso.py`.

1. `POST /api/v1/solicitudes-acceso/` válido → `201` con contrato de respuesta, simulando el servicio.
2. Solicitud duplicada pendiente → verificar el contrato **actual `400`** y `detail`; el reto propone `409` como ejemplo, pero **no cambiarlo a ciegas**: si se acuerda estandarizar a `409`, documentar y corregir implementación, consumidores y tests.
3. `GET /api/v1/solicitudes-acceso/?estado=pendiente` con administrador simulado → sólo registros pendientes; otros estados sin contaminación.
4. `GET /api/v1/solicitudes-acceso/?estado=...` inválido → `422` en JSON, sin acceso a BD real.
5. Recomendado: recurso relacionado inexistente (rol de solicitud) → `404`; o regla de integridad en `fichas` conforme al servicio existente.

Simular servicio/repositorio con `monkeypatch` y `vi.mock` **no aplica** a Python. Verificar las respuestas HTTP reales, no sólo las funciones Python. Buscar una regla dependiente de datos auténtica y evitar inventar restricciones de borrado.

## 🧪 Parte 2 — Pruebas HTTP y mutantes (2 h)

- Framework existente: **FastAPI + pytest + `fastapi.testclient.TestClient`**. Reutilizar `backend/tests/conftest.py`: fixture `client` sustituye `get_db` por SQLite en memoria; `fake_supabase` y `autenticar_como` simulan autenticación. Si una tabla no está en SQLite, elegir un mock de servicio/repositorio en el endpoint probado o ampliar las fixtures **sólo cuando sea necesario**, sin conectar Supabase/PostgreSQL de producción.
- Cada integrante agrega **≥4 tests API nuevos**, con `status_code`, contenido JSON y, en al menos uno, encabezado `Content-Type: application/json`. Diferenciar `400`, `401`, `403`, `404`, `409`, `422`, `500` según el contrato implementado; **no forzar valores que el backend no usa**.
- Un **mutante por integrante**: modificar temporalmente un código de estado, condición, permiso o estructura de error; ejecutar un test que falle, guardar **log rojo**, restaurar código y guardar **log verde**. Nunca subir el mutante final ni presentar la descripción sin evidencia de ejecución.
- Registrar cada hallazgo de contrato/seguridad en el **PR individual**, con endpoint, reproducción, comportamiento anterior, corrección y test que evita regresión. Corregir el backend en la misma semana cuando corresponda, coordinando si afecta otra capa.
- No incluir secretos, `.env`, tokens auténticos, migraciones sobre BD compartida ni llamadas a producción. Datos y fechas deterministas; controles de dependencia restaurados entre tests.

### Ejemplo de hallazgo

> 🔎 Hallazgo: `POST /api/v1/...` con JSON inválido devolvía un formato no documentado. Reproducción: petición de TestClient. Corrección: respuesta JSON uniforme con `detail`. Prueba: `test_json_malformado_devuelve_error_json_seguro`. **Sólo registrar si se reproduce realmente.**

## 🔄 Ramas personales, PR y revisiones cruzadas

Partir siempre de `semana-4`, **nunca directamente de `develop` o `main`**:

```bash
git fetch origin
git switch semana-4
git pull --ff-only origin semana-4
git switch -c test/s4-<capa>-<nombre>
# Implementar ≥4 tests, guardar evidencia mutante rojo/verde...
git add backend/tests/ docs-testing/
git commit -m "test(s4): pruebas API desde angulo <capa>"
git push -u origin test/s4-<capa>-<nombre>
```

| PR individual | Base | Revisor cruzado | Criterio para fusionar |
|---|---|---|---|
| Nicol `test/s4-front-contrato-nicol` | `semana-4` | David | ≥4 tests, mutante rojo/verde, CI verde y revisión |
| David `test/s4-e2e-seguridad-david` | `semana-4` | Edith | ≥4 tests, `401/403` y autorizado, mutante, CI verde y revisión |
| Dayana `test/s4-api-horarios-dayana` | `semana-4` | Nicol | ≥4 tests CRUD, mutante, CI verde y revisión |
| Edith `test/s4-bd-datos-edith` | `semana-4` | Dayana | ≥4 tests según datos, mutante, CI verde y revisión |

Cada persona hace commits desde **su cuenta de GitHub**. El revisor de otra capa ejecuta los tests propios y comprueba evidencia de mutante; no simular aprobaciones. **No fusionar** con CI fallido ni revisión pendiente. La rama general S4 se incorpora a `develop` por flujo aprobado una vez cerrado el trabajo; no tocar `main` durante las entregas individuales.

## 📈 Parte 3 — Cobertura y PR exclusivo de umbrales (20 min)

1. Tras fusionar los cuatro PR personales a `semana-4`, ejecutar la cobertura real del frontend **y** backend, además de lint/build y CI.
2. Registrar en `docs/matriz-rotacion.md` las métricas de frontend (sentencias, ramas, funciones, líneas), global de backend, los PR y las evidencias.
3. Crear desde `semana-4` la rama técnica `chore/s4-umbrales-cobertura` y un **quinto PR** a `semana-4`; no mezclar el aumento de umbrales en los PR personales.
4. Por cada métrica: **umbral nuevo = máximo(50 %, piso de cobertura real, umbral heredado vigente)**. Si la medición no alcanza el umbral heredado, agregar o corregir tests y código; **jamás reducir umbrales** para forzar CI verde.
5. El frontend no incorpora tareas nuevas de implementación esta semana, pero **sí debe medirse y mantener su cobertura**. Si estuviera por debajo de 50 %, asignar pruebas de componentes adicionales y registrarlo en la matriz.

**Umbrales heredados conocidos (mínimos que no pueden reducirse):**

| Métrica | Umbral anterior |
|---|---:|
| Front — sentencias | 76,73 % |
| Front — ramas | 64,85 % |
| Front — funciones | 73,89 % |
| Front — líneas | 79,59 % |
| Backend — global | 84 % |

Comprobar si S2/S3 aprobadas subieron estas cifras: el valor vigente puede ser mayor. **No confundir pisos del reto (50 %) con los umbrales reales del repositorio.**

```bash
cd backend
python -m pip install -r requirements.txt
python -m pytest -v --cov=app --cov-report=term --cov-fail-under=84

cd ../frontend
pnpm install --frozen-lockfile
pnpm test:coverage
pnpm lint
pnpm build
```

### Entregables y checklist

- [ ] Columna **S4** de la matriz: una capa distinta a S2 para cada integrante.
- [ ] Cuatro suites personales con **≥4 tests nuevos API** cada una (≥16 total).
- [ ] Cuerpo, código y Content-Type verificados, errores y datos simulados.
- [ ] Cuatro mutantes independientes con evidencia **roja y verde** y código restaurado.
- [ ] Hallazgos de contratos/seguridad registrados y corregidos cuando se reproduzcan.
- [ ] Seguridad `401`, `403` y autorizado probada en endpoints reales.
- [ ] Cuatro PR personales revisados por otra capa, CI verde y fusionados en `semana-4`.
- [ ] Cobertura real de **frontend y backend** en matriz sin retrocesos.
- [ ] Quinto PR de umbrales cerrado con piso ≥50 % y umbrales heredados conservados; CI verde.
- [ ] Integración de `semana-4` a `develop` acordada con el equipo.

## 🎙️ Vocero aleatorio

Cada integrante prepara **un endpoint de otra persona**: explicar códigos HTTP, mostrar aislamiento de BD mediante `client`/`get_db` y mocks, y ejecutar una solicitud mal formada con TestClient o `curl` contra **entorno local**, explicando JSON y código. No depender de credenciales ni servicios reales.

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
| [`docs-sihs/`](./docs-sihs/) | Documentación funcional, técnica y de diseño |

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

## Pruebas de Semana 3

Los tests de componentes de la Semana 3 (Login, Registro, NotificacionesPanel y RecuperarContrasena), su evidencia de mutación y la matriz de revisión están documentados en la [guía completa de Semana 3](./docs-testing/SEMANA_3_GUIA.md), los [informes de pruebas](./docs-testing/reportes/) y la [matriz de rotación](./docs/matriz-rotacion.md).
