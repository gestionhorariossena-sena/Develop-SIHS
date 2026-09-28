# Preparación de corrección de períodos académicos — 2026-09-28

**Rama:** `develop`
**Alcance:** revisión de código, pruebas aisladas en SQLite y consulta de fuentes institucionales. No se modificó PostgreSQL: los 26 horarios, trimestres y fichas existentes permanecen intactos.

## Referencia institucional 2026

Existe normativa institucional vigente: la [Resolución SENA 1-03775 de 2025](https://normograma.sena.edu.co/compilacion/docs/resolucion_sena_3775_2025.htm) establece el calendario académico y de labores para 2026. La [Resolución SENA 1-01190 de 2026](https://normograma.sena.edu.co/compilacion/docs/resolucion_sena_1190_2026.htm) modificó la trimestralización y los días de actividad formativa.

El cuadro de fechas de la trimestralización se publica como imagen dentro de la compilación normativa. La fuente permite confirmar qué acto gobierna el calendario, pero no permite transcribir las fechas exactas con una extracción automática verificable. Por esa razón no se propone crear ni actualizar períodos a partir de una lectura inferida. Se requiere el anexo oficial en PDF o una confirmación del Centro de Formación con las fechas que SIHS debe registrar.

## Consultas y validaciones que requieren límite por `idTrimestre`

| Ubicación | Situación actual | Corrección prevista |
| --- | --- | --- |
| `backend/app/repositories/horario_repository.py::buscar_solape` | Filtra recurso, día, rango horario y activo; compara todos los períodos. | Recibir y filtrar `id_trimestre`. |
| `backend/app/repositories/horario_repository.py::buscar_resultado_en_ficha` | Compara ficha, resultado, instructor y activo sin período. | Recibir y filtrar `id_trimestre`. |
| `backend/app/repositories/horario_repository.py::obtener_por_instructor` | Devuelve todos los horarios activos del instructor. | Añadir filtro opcional por período para RF-011. |
| `backend/app/services/horario_service.py::_detectar_cruces` | No propaga el período a los tres solapes ni al resultado repetido. | Pasar `data.idTrimestre` a las búsquedas. |
| `backend/app/services/horario_service.py::validar_dry_run` | Repite las mismas consultas de `_detectar_cruces`. | Mantener el mismo alcance por período. |
| `backend/app/services/horario_service.py::_validar_reglas_instructor` | Suma horas activas de todos los períodos. | Consultar solo `data.idTrimestre`. |
| `backend/app/services/horario_service.py::obtener_carga_semanal` | Consulta al instructor sin período; calcula semanas desde la ficha. | Confirmar si el endpoint debe recibir `idTrimestre` o inferirlo desde la ficha. |
| `frontend/src/pages/AsistenteHorarios.tsx` | Escoge el primer trimestre con estado `activo`, o el primer elemento. | Consumir un período vigente definido por backend o validar estado y rango de fechas. |
| `frontend/src/pages/HorariosCompletos.tsx` | Usa el mismo criterio para la auditoría inicial. | Usar el mismo criterio centralizado. |
| `backend/app/repositories/trimestre_repository.py::obtener_activo` | Devuelve el primer estado `activo`, sin fechas ni orden explícito. | Definir y aplicar el criterio de período vigente. |

El generador ya está correctamente aislado: `backend/app/services/asistente_horario_service.py::_CatalogoPrograma` limita resultados y slots existentes con `Horario.idTrimestre == id_trimestre`.

## Pruebas preparadas

Se añadió `backend/tests/test_horarios_aislamiento_trimestre_pendiente.py`.

- Dos trimestres, dos fichas y el mismo instructor/ambiente/resultado a la misma hora en períodos distintos: la validación manual debe permitirlo.
- Un instructor de planta con 32 horas en un período anterior: la validación del período siguiente debe permitir una nueva clase y no acumular las horas anteriores.

Las dos pruebas se marcan `xfail(strict=True)` porque describen el resultado objetivo y actualmente deben fallar hasta que la corrección se implemente. Esto mantiene visible el trabajo pendiente sin volver roja la suite antes de tiempo.

## Decisiones que requieren confirmación

1. **Definición de vigente:** ¿el estado administrativo `activo` manda, o debe coincidir obligatoriamente con la fecha actual? Se recomienda exigir ambos y permitir solo un período vigente.
2. **Histórico:** se propone conservar los horarios de períodos finalizados activos para consulta histórica, pero excluirlos de cruces, resultados repetidos y máximos semanales del nuevo período.
3. **Carga semanal:** confirmar si debe mostrarse por período de la ficha o si el endpoint recibirá un parámetro explícito de trimestre.
4. **Calendario 2026:** entregar el anexo oficial con fechas legibles o confirmar las fechas aprobadas por el Centro antes de cambiar datos.
