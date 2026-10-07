# Estructura del backend — estado actual

El backend de SIHS usa **FastAPI + SQLAlchemy + Pydantic** sobre PostgreSQL
(Supabase). Está organizado por capas para separar rutas, reglas de negocio y
acceso a datos.

## Flujo de una petición

```text
api/v1/*.py  →  services/*.py  →  repositories/*.py  →  models/*.py
   rutas            reglas            consultas             tablas
```

Los `schemas/` de Pydantic definen los contratos de entrada y salida.

## Mapa de carpetas

```text
backend/
├── app/
│   ├── main.py
│   ├── api/v1/
│   ├── core/
│   ├── models/
│   ├── repositories/
│   ├── schemas/
│   ├── services/
│   └── workers/
├── tests/
├── alembic/
├── requirements.txt
└── .env.example
```

## Responsabilidad de cada capa

- **models:** definición ORM de las tablas y relaciones.
- **repositories:** consultas y persistencia. No deciden reglas de negocio.
- **services:** reglas, validaciones, transacciones y coordinación entre
  repositorios.
- **api/v1:** endpoints HTTP, dependencias de autenticación y traducción de
  errores a respuestas HTTP.
- **schemas:** validación y serialización.
- **workers:** procesos que deben ejecutarse fuera de una petición normal.

## Módulos funcionales actuales

El backend ya incluye, entre otros:

- usuarios, roles y relación usuario-rol;
- solicitudes de acceso;
- sedes, ambientes, jornadas y días de semana;
- coordinaciones, programas, trimestres y fichas;
- vínculo ficha-usuario;
- competencias, resultados, temáticas, guías y actividades;
- horarios y horarios guardados;
- asistencias;
- auditoría de cruces;
- avisos y notificaciones;
- mensajería;
- anotaciones de horario;
- solicitudes de cambio;
- publicaciones programadas.

Todos los routers se registran en `app/main.py` bajo el prefijo
`/api/v1`.

## Horarios: reglas relevantes

La lógica principal vive en `services/horario_service.py` y servicios
relacionados.

- Cruces por ficha, instructor y ambiente.
- Validación entre ficha y período académico.
- Control de resultados repetidos según las reglas del proyecto.
- Diferenciación entre horario activo/inactivo y publicado/borrador.
- Consulta de horarios personales solo sobre información publicada.
- Edición segura de snapshots de horarios.
- Conservación histórica cuando existen dependencias operativas.

La eliminación de un snapshot no debe dejar horarios activos huérfanos. Si
una clase posee dependencias históricas (por ejemplo asistencia), se conserva
para trazabilidad pero deja de participar como horario vigente.

## Asistencia

El módulo de asistencia valida que el instructor corresponda al bloque y que
la fecha seleccionada sea una sesión válida del horario. La interfaz puede
registrar asistencia en cualquiera de los días asociados a una clase
multidía.

## Publicaciones programadas

`app/workers/publicacion_programada_worker.py` procesa publicaciones
programadas. Puede ejecutarse como worker embebido cuando la configuración
lo habilita. Las ediciones de horarios relacionadas con una publicación
pendiente deben mantener la consistencia de revisión.

## Autenticación y permisos

`app/core/supabase_auth.py` valida la sesión de Supabase y expone
dependencias de autorización. Entre las más usadas están las de
Administrador, Coordinador, Instructor, Aprendiz y lectura/gestión de
catálogos.

El backend es la autoridad final de permisos; ocultar una pantalla en el
frontend no sustituye las validaciones del endpoint.

## Cómo crear o extender un módulo

Para un módulo con CRUD normal:

1. Crear o modificar el modelo en `app/models/`.
2. Definir schemas en `app/schemas/`.
3. Implementar consultas en `app/repositories/`.
4. Implementar reglas en `app/services/`.
5. Exponer las rutas en `app/api/v1/`.
6. Registrar el router en `app/main.py` si es un módulo nuevo.
7. Agregar migración de Alembic cuando cambie el esquema.
8. Agregar pruebas en `tests/`.

Evitar poner reglas de negocio directamente en el router o consultas SQL
dentro de componentes del frontend.

## Pruebas

La suite de backend se ejecuta con:

```bash
cd backend
pip install -r requirements.txt
pytest -v
```

Los tests usan una base aislada cuando corresponde y cubren autenticación,
roles, fichas, horarios, cruces, publicaciones, asistencia, notificaciones y
otros módulos.

GitHub Actions ejecuta `pytest -v` automáticamente en cada push y Pull
Request.

## Desarrollo local

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Swagger queda disponible en `http://127.0.0.1:8000/docs`.
