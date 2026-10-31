# Tests del backend — pytest

Todo el código de prueba Python está aislado en `backend/tests/`. La implementación reside en `backend/app/`.

```bash
cd backend
pip install -r requirements.txt
pytest -v
```

Los tests PostgreSQL usan un entorno aislado; nunca utilizar bases institucionales de producción. La cobertura y su umbral se validan mediante CI.
