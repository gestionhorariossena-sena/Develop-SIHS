# SIHS: verificación del entorno de pruebas

Fecha: 2026-09-27. Rama: `develop`. Commit evaluado: `4779681a41ecc6c0feaae8a856cf6e93c8a4c9d7`.

## Entorno

- Python 3.12.13 encontrado en el sistema y utilizado en un entorno virtual independiente bajo `/tmp/sihs-python312-venv`.
- Dependencias instaladas desde `backend/requirements.txt`, sin modificar el entorno virtual existente.
- La configuración privada `backend/.env` ya usaba el dialecto `postgresql+psycopg` requerido por psycopg 3. Se ajustaron sus permisos locales a `600`; su contenido no se versionó.
- Ninguna prueba escribió en PostgreSQL compartido: `backend/tests/conftest.py` crea una base SQLite en memoria por prueba.

## Comandos y resultados

| Comando o comprobación | Resultado |
|---|---|
| `git fetch origin` y comparación `develop...origin/develop` | Sin divergencia antes de las pruebas (`0 0`). |
| `python3.12 -m venv /tmp/sihs-python312-venv` | Entorno creado con Python 3.12.13. |
| `/tmp/sihs-python312-venv/bin/python -m pip install -r backend/requirements.txt` | Instalación completa. |
| `TestClient` mínimo con Python 3.12.13 dentro del sandbox | Agotó 20 segundos. |
| El mismo `TestClient` mínimo fuera del sandbox | HTTP 200, cuerpo `{'status': 'ok'}`. |
| `backend/.venv/bin/python` 3.14.7, `TestClient` mínimo fuera del sandbox | HTTP 200, mismo cuerpo. |
| `/tmp/sihs-python312-venv/bin/python -m pytest -q` desde `backend/`, fuera del sandbox | **282 aprobadas, 0 fallidas**, 1 advertencia; 56.69 s. |

## Pendientes

- El sandbox bloquea el portal de hilos usado por `TestClient`; ejecutar las pruebas fuera de él en este equipo.
- Starlette 1.6.0 advierte que el uso de `httpx` en `TestClient` está obsoleto y recomienda `httpx2`. La advertencia no afectó las 282 pruebas.
