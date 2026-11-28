# Tests del backend — pytest

Todo el código de prueba Python está aislado en `backend/tests/`. La implementación reside en `backend/app/`.

```bash
cd backend
pip install -r requirements.txt
pytest -v
```

Los tests PostgreSQL usan un entorno aislado; nunca utilizar bases institucionales de producción. La cobertura y su umbral se validan mediante CI.

# Pruebas de integración con PostgreSQL local

La suite ordinaria usa SQLite en memoria. Las pruebas de
`test_real_postgres.py` usan un PostgreSQL 16 desechable, aislado en Docker y
no leen `backend/.env` ni se conectan a Supabase.

Desde la raíz del repositorio:

```bash
make test-run
```

El comando levanta la base `sihs_test`, espera su healthcheck y ejecuta la
suite contra la URL local autorizada. Para inspeccionarla o detenerla:

```bash
make test-up
make test-logs
make test-down
```

`test-down` elimina el contenedor y cualquier volumen de pruebas. No contiene
ni debe contener datos institucionales.
