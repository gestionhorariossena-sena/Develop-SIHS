# Auditoría de trimestres y duplicados — 2026-09-28

**Rama auditada:** `develop` (`c0449a9d9d14fdbc0b8456b278e9b06faed80558` antes de este informe)
**Alcance:** consultas `SELECT` sobre PostgreSQL y revisión estática del backend/frontend. No se crearon ni modificaron horarios, fichas, trimestres ni usuarios.

## Resultado de base de datos

Fecha devuelta por PostgreSQL: **2026-09-28**.

| ID | Trimestre | Inicio | Fin | Estado | Horarios | Activos | Inactivos | Publicados | Borradores |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Trimestre 1 - 2026 | 2026-01-01 | 2026-03-31 | activo | 26 | 26 | 0 | 26 | 0 |
| 2 | Trimestre 2 - 2026 | 2026-04-01 | 2026-06-30 | planeado | 0 | 0 | 0 | 0 | 0 |

No existe un trimestre cuyo rango de fechas contenga la fecha actual de la base. El registro marcado como `activo` es el trimestre 1, aunque terminó el 31 de marzo de 2026.

Los 26 horarios pertenecen al trimestre 1. Todos están activos y publicados; no hay borradores. Tampoco se hallaron horarios con un `idTrimestre` distinto al de su ficha.

## Fichas, fases y cuentas piloto

- Las cuatro cuentas piloto están presentes: 2 con rol Instructor y 2 con rol Aprendiz. No se incluyen correos, UUID ni nombres en este informe.
- Los instructores piloto no tienen `usuarios.idTrimestre` asignado. Este campo documenta el trimestre de emisión de `codigoInstructor`; no es una asignación de programación vigente.
- Las dos fichas vinculadas a los aprendices piloto pertenecen al trimestre 1 y tienen `faseActual = 1`.
- Los 26 horarios están asignados a instructores piloto y pertenecen al trimestre 1.
- Distribución total de fases en fichas: 8 con fase 1, 2 con fase 4 y 45 sin fase; todas pertenecen al trimestre 1.

No se encontraron grupos de resultados repetidos con la misma combinación de trimestre, ficha e instructor, ni pares de horarios activos solapados dentro del mismo trimestre para ficha, instructor o ambiente.

## Comportamiento del código

### Trimestre y fase de ficha

`backend/app/models/ficha.py` relaciona cada ficha con un trimestre por `fichas.idTrimestre` y conserva `faseActual` como una propiedad independiente: representa la fase del pénsum de esa ficha, no el período calendario de programación.

`backend/app/services/asistente_horario_service.py`, en `_CatalogoPrograma.resultados_pendientes`, filtra resultados por `faseActual` cuando esa fase existe en el currículo. Luego excluye únicamente los resultados que ya tienen un horario **activo de esa misma ficha y del `idTrimestre` solicitado**.

### Generador y duplicados

`_CatalogoPrograma` carga horarios activos con `Horario.idTrimestre == id_trimestre` para dos fines:

1. Excluir resultados ya programados de la misma ficha en el período solicitado.
2. Sembrar los slots ocupados de instructor, ambiente y ficha en el generador OR-Tools.

Por tanto, el generador evita repetir resultados y reservar recursos ya ocupados dentro del mismo trimestre. No bloquea los de otros trimestres, que es el comportamiento esperado para períodos independientes.

### Validación manual de horarios

Hay una discrepancia con el generador:

- `HorarioRepository.buscar_solape` filtra por recurso, día, horas y `activo`, pero **no por `idTrimestre`**.
- `HorarioRepository.buscar_resultado_en_ficha` tampoco filtra por `idTrimestre`.
- `HorarioService._validar_reglas_instructor` invoca `obtener_por_instructor`, que suma todos los horarios activos del instructor sin limitar al trimestre.

Así, al crear o editar manualmente un horario de un trimestre nuevo, cruces, resultados repetidos y horas semanales pueden ser rechazados por horarios activos de un trimestre anterior. La base actual no revela el fallo porque solo tiene horarios en un período, pero la regla se activará al comenzar a programar el trimestre 2.

### Selección de trimestre en la interfaz

El asistente de horarios (`frontend/src/pages/AsistenteHorarios.tsx`) solicita `/trimestres/` y selecciona:

```ts
lista.find((t) => t.estado === 'activo') ?? lista[0]
```

No compara `fechaInicio` ni `fechaFin` con la fecha actual. La auditoría de horarios completos usa el mismo criterio. Por eso hoy ambas pantallas seleccionarán el trimestre 1: es el primero marcado como activo, aunque no cubre la fecha actual. Si no hubiera uno activo, tomarían el primer registro devuelto por la API, no necesariamente el trimestre 1 ni uno vigente por fechas.

## Propuesta de corrección — sin implementar

1. Definir una sola regla de período vigente: validar que exista exactamente un trimestre con `estado = activo` y con fecha actual dentro de `[fechaInicio, fechaFin]`, o decidir explícitamente que el estado administrativo prevalece sobre las fechas. Actualmente ambos criterios se contradicen.
2. Añadir `Horario.idTrimestre == data.idTrimestre` a `buscar_solape` y `buscar_resultado_en_ficha` y propagar ese parámetro desde `HorarioService._detectar_cruces`.
3. Hacer que `obtener_por_instructor` acepte `id_trimestre`; usarlo en `_validar_reglas_instructor` para calcular el máximo semanal por período de programación.
4. Mantener el filtro actual del generador, que ya acota duplicados y recursos al período solicitado.
5. Cambiar la selección del frontend para consumir un período vigente definido por backend, o al menos elegir por estado y fechas. Agregar una pantalla de estado vacío cuando no haya período vigente, en lugar de programar implícitamente el primer trimestre.
6. Agregar pruebas que creen dos trimestres y prueben: mismo instructor/ambiente/ficha en la misma hora en períodos distintos permitido; en el mismo período rechazado; máximo semanal calculado solo con el período solicitado; selección de UI ante trimestre activo vencido.

## Archivos implicados

- `backend/app/services/horario_service.py`: `_detectar_cruces`, `_validar_reglas_instructor`.
- `backend/app/repositories/horario_repository.py`: `buscar_solape`, `buscar_resultado_en_ficha`, `obtener_por_instructor`.
- `backend/app/services/asistente_horario_service.py`: `_CatalogoPrograma` y `resultados_pendientes`.
- `frontend/src/pages/AsistenteHorarios.tsx` y `frontend/src/pages/HorariosCompletos.tsx`: selección del trimestre por estado.
