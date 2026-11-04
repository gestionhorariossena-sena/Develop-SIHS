# Semana 2 — David: mutación de disponibilidad del worker

## Regla probada

`consultar_disponibilidad` mantiene habilitado el worker cuando la última
señal tiene como máximo 30 segundos. Una señal futura (por diferencia de
relojes) se trata como reciente y no produce antigüedad negativa. Si falla la
consulta a la base de datos, la función revierte la sesión y responde como
worker no disponible.

Las tres pruebas unitarias están en
`backend/tests/test_worker_publicacion_service_s2_david.py`. Usan una sesión
simulada: no conectan con PostgreSQL, Supabase ni servicios externos.

## Mutación manual y detección

- **Mutante temporal:** `antiguedad <= MAX_ANTIGUEDAD_SEGUNDOS` →
  `antiguedad < MAX_ANTIGUEDAD_SEGUNDOS`.
- **Prueba que lo detecta:** `test_senal_en_el_limite_de_30_segundos_sigue_habilitando_worker`.
- **Resultado con el mutante:** 1 fallo. Con exactamente 30 segundos, la
  implementación mutada deshabilitó el worker, aunque el límite es inclusivo.
- **Estado final:** se restauró la comparación `<=`; el mutante no forma parte
  del código entregable.

## Ejecución local

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q backend\tests\test_worker_publicacion_service_s2_david.py
```

Resultado con la implementación restaurada: **3 passed**.

La mutación se ejecutó sobre el test de frontera:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q backend\tests\test_worker_publicacion_service_s2_david.py::test_senal_en_el_limite_de_30_segundos_sigue_habilitando_worker
```

Resultado con `<=` cambiado temporalmente a `<`: **1 failed**, como se
esperaba; se restauró `<=` y el test volvió a pasar.

## CI y cobertura

`.github/workflows/tests.yml` conserva el pipeline existente y sus umbrales:

- Frontend: lint, build y Vitest con coverage; mantiene los mínimos S1 de
  76,73 % sentencias, 64,85 % ramas, 73,89 % funciones y 79,59 % líneas.
- Backend: pytest-cov con mínimo global de 84 %.

Los resultados de CI de GitHub se deben adjuntar o enlazar en el PR cuando
esté abierta la rama. No se rebajan los umbrales heredados para cumplir el
mínimo del reto.

### Verificación local de esta rama

- Backend: `python -m pytest -q --cov=app --cov-report=term --cov-fail-under=84`
  — **422 passed, 10 skipped**, cobertura global **84,22 %**.
- Frontend: `pnpm lint` — correcto, sin errores ni advertencias después de
  limpiar los reportes de cobertura generados localmente.
- Frontend: `pnpm build` — correcto; Vite mostró su advertencia habitual sobre
  el tamaño de un bundle superior a 500 kB.
- Frontend: `pnpm test:coverage` — **54 archivos y 378 tests pasaron**;
  sentencias **78,16 %**, ramas **66,63 %**, funciones **74,29 %** y líneas
  **81,10 %**. Todos superan los umbrales configurados.
