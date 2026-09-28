# Resultados — aislamiento de períodos académicos

Fecha: 2026-09-28

## Cambio implementado

- Los solapes por ficha, instructor y ambiente ahora comparan únicamente horarios activos del mismo `idTrimestre`.
- La detección de resultado repetido se limita al período solicitado.
- RF-011 suma las horas semanales del instructor solo dentro del `idTrimestre` del horario candidato.
- Crear, editar y validar reutilizan esas mismas reglas.
- Antes de crear o editar se valida que el trimestre solicitado coincida con `fichas.idTrimestre`. La opción `forzar` no permite saltar esta relación.
- El generador no fue modificado: ya filtra resultados y slots ocupados por `idTrimestre`.

## Pruebas

| Comando | Resultado |
| --- | --- |
| `/tmp/sihs-py312-backend/bin/pytest backend/tests/test_scheduling_generator.py backend/tests/test_horarios_aislamiento_trimestre_pendiente.py -q` | 14 aprobadas |
| `/tmp/sihs-py312-backend/bin/python -m compileall -q backend/app` | Aprobado |
| `npm test` | 311 aprobadas en 46 archivos |
| `npm run build` | Aprobado |

La suite completa de backend se intentó con Python 3.12.13, pero queda bloqueada en el primer test HTTP existente: `backend/tests/test_anotaciones_horario.py::test_crear_requiere_aprendiz`. El comando no completa dentro de 30 segundos y no genera traceback. El mismo proyecto emite una advertencia de deprecación de `starlette.testclient`; este bloqueo no es introducido por la corrección, ya que ocurre antes de llegar a las pruebas de horarios.

## Archivos modificados

- `backend/app/repositories/horario_repository.py`
- `backend/app/services/horario_service.py`
- `backend/app/api/v1/horarios.py`
- `backend/tests/test_horarios_aislamiento_trimestre_pendiente.py`

No se ejecutaron migraciones ni operaciones contra PostgreSQL compartido.
