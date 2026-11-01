# Semana 2 — Evidencia de mutación de Nicol (API / servicios)

## Regla de negocio
`HorarioAccesoService.puede_ver_bloque` en
`backend/app/services/horario_acceso_service.py`.

Un bloque solo puede ser consultado por un instructor cuando está **activo Y publicado**
y le pertenece; un aprendiz también debe pertenecer a la ficha.
Los administradores y coordinadores tienen la excepción explícita de gestor.

## Pruebas unitarias nuevas
Archivo: `backend/tests/test_horario_acceso_s2_nicol.py`.

Casos cubiertos (con parametrización y aserciones): gestores, aprendiz con/sin
vínculo, instructor con/sin vínculo, instructor dueño de bloque, bloque desactivado,
bloque sin publicar, bloque ajeno y aprendiz con/sin membresía de ficha.

No se utiliza PostgreSQL, Supabase ni servicios externos: los resultados
de las consultas se sustituyen por dobles controlados (`Mock`).

## Mutación manual real: OR → AND

**Código correcto:**

```python
if not horario.activo or not horario.publicado:
    return False
```

**Mutante temporal (introducido y posteriormente restaurado):**

```python
if not horario.activo and not horario.publicado:
    return False
```

La mutación permitiría a un instructor consultar su bloque cuando una sola
de las dos condiciones de visibilidad fuera falsa.

### Evidencia roja de GitHub Actions
- Commit del mutante: `52e99a28fc4ba8a93c1bfb530f74c9b22a7f2192`.
- [Workflow del mutante (push)](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/41338803840).
- Resultado de backend: **2 failed, 430 passed, 10 skipped**; cobertura **84,24 %**.
- Fallaron los siguientes parámetros de la prueba
  `test_instructor_no_puede_ver_bloque_si_falta_una_condicion_de_visibilidad`:
  - `[False-True]`: desactivado, publicado.
  - `[True-False]`: activo, no publicado.
- Ambos fallaron con `AssertionError: assert True is False` en la línea 78.
- La combinación `[False-False]` sí siguió pasando: evidencia de que
  se distinguen las particiones y límites.

### Restauración
- Commit que restaura `or`: `2151e65b70145a62041c4d8d2788674f3082631e`.
- El mutante **no permanece en el código final**.
- La validación definitiva del CI debe consultarse en el PR
  [#163](https://github.com/gestionhorariossena-sena/Develop-SIHS/pull/163).

## Comandos de reproducción

```bash
cd backend
python -m pytest tests/test_horario_acceso_s2_nicol.py -v
python -m pytest -v --cov=app --cov-report=term --cov-fail-under=84
```

## Flujo de revisión
- Rama: `test/s2-api-nicol`, nacida de `semana-2`.
- Base del PR: `semana-2`.
- Revisión cruzada prevista por el README: **David**.
- No fusionar antes de revisión y CI verde.
