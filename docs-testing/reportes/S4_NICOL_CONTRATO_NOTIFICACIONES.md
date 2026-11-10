# Semana 4 — Nicol · Contrato HTTP/JSON de Notificaciones

**Rama:** `test/s4-front-contrato-nicol` · **PR entregable:** #178 · **Revisor:** David (E2E/seguridad).

## Recurso y pruebas nuevas

- `GET /api/v1/notificaciones/`: lista con **8 campos exactos** usados por la UI React, tipos esenciales y encabezado `application/json`.
- `GET /api/v1/notificaciones/conteo-no-leidas`: respuesta `{"noLeidas": número}`, excluye ya leídas y avisos de otro usuario.
- `PATCH /api/v1/notificaciones/{id}/leida`: serialización completa de la notificación, `leida: true`, persistencia en SQLite.
- `PATCH /api/v1/notificaciones/{id inexistente}/leida`: `404` con `detail` seguro, sin filtraciones SQL ni traceback.
- `GET /api/v1/notificaciones/?solo_no_leidas=true`: filtrado real del servidor; no devuelve mensajes leídos.
- `GET /api/v1/notificaciones/?limite=0`: `422` con detalle de validación JSON.

**Archivo:** `backend/tests/test_s4_contrato_notificaciones_nicol.py`. Son **6 pruebas HTTP nuevas** y diferentes de las de `backend/tests/test_notificaciones.py`; no se invoca el servicio como sustituto del router.

**Aislamiento:** `TestClient`, `db_session` SQLite en memoria, `autenticar_como` y `fake_supabase` del `conftest.py` existente. Sin conexiones a Supabase/PostgreSQL reales ni credenciales.

## Mutante propuesto y reproducción

Mutante manual **solo en la rama temporal** `test/s4-mutacion-nicol-evidencia` (PR #179, **NO FUSIONAR**). En `backend/app/api/v1/notificaciones.py`, ruta `PATCH /{id_notificacion}/leida`:

```diff
-            status_code=404,
+            status_code=400,
             detail="Notificación no encontrada",
```

La prueba `test_patch_id_inexistente_devuelve_404_sin_detalles_internos` exige `404` y debe detectar esa regresión; tras restaurar `404` debe aprobar. **No considerar demostrado hasta adjuntar los logs reales rojo/verde de pytest.** El cambio temporal no entra al PR entregable.

Comando de reproducción desde `backend/`:

```bash
python -m pytest -q tests/test_s4_contrato_notificaciones_nicol.py
```

## Criterios de cierre

- [x] Seis pruebas nuevas sobre rutas HTTP reales y contratos de React.
- [x] Cabeceras Content-Type, estado y cuerpo en escenarios relevantes.
- [x] Fixtures reutilizadas con autenticación simulada y base en memoria.
- [ ] Adjuntar evidencia roja real del mutante y verde restaurado.
- [ ] CI del PR #178 aprobada (backend completo con cobertura >=84%; frontend sin retroceso).
- [ ] Revisión independiente de David.

## Hallazgos

No se ha observado un bug de producción en el contrato. El `400` de la rama temporal es **intencional**, no un hallazgo del backend real. No se alteraron rutas de producción en el PR #178.
