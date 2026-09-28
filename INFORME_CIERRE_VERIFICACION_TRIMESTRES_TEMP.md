# Cierre de verificación — aislamiento de trimestres

Fecha: 2026-09-28

## Commit verificado

- Rama: `develop`
- Commit: `a901f5342960407899255c5c96e40f56cb2811d4`
- Estado remoto: `origin/develop` apunta al mismo SHA.

Los cuatro archivos de corrección están publicados en el remoto:

- `backend/app/api/v1/horarios.py`
- `backend/app/repositories/horario_repository.py`
- `backend/app/services/horario_service.py`
- `backend/tests/test_horarios_aislamiento_trimestre.py`

## Reproducción de pruebas

Entorno: Python 3.12.13 en `/tmp/sihs-py312-backend`, ejecutado fuera del sandbox.

| Comando | Resultado |
| --- | --- |
| `/tmp/sihs-py312-backend/bin/pytest backend/tests -q` | 289 aprobadas en 55.56 s |
| `/tmp/sihs-py312-backend/bin/pytest backend/tests/test_horarios_aislamiento_trimestre.py -q` | 7 aprobadas en 0.35 s |

Las pruebas de aislamiento son pruebas normales: no contienen marcadores `xfail`.

## Diferencia frente al bloqueo previo

No cambiaron código ni dependencias entre las dos ejecuciones. Dentro del sandbox la suite se detenía en el primer uso de `TestClient`; fuera del sandbox, con el mismo intérprete y el mismo entorno temporal, completó las 289 pruebas. Persistió únicamente la advertencia de deprecación de `starlette.testclient`, sin fallos funcionales.

No se ejecutaron migraciones ni operaciones contra PostgreSQL compartido.
