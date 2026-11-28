# SIHS — Verificación de edición segura de horarios

Fecha: 2026-09-28

Rama: `develop`

Commit de implementación evaluado: `2d01aee` (`feat: habilitar edición transaccional de horarios`)

## Resultado

El constructor ahora reemplaza un horario completo mediante `PUT /horarios-guardados/{id}/reemplazar`. El servidor bloquea el snapshot y las filas originales, comprueba la versión de cada clase, valida ficha/período y todos los cruces antes de confirmar, y actualiza las clases existentes por su ID. Las clases retiradas quedan inactivas y despublicadas para conservar referencias históricas.

La operación actualiza clases, snapshot, auditoría y notificaciones dentro de una transacción. Un conflicto o error revierte el conjunto. La publicación se hereda de cada clase original; nuevas clases quedan como borrador si el conjunto original no estaba enteramente publicado. Los borradores no producen notificaciones. El endpoint está limitado a Coordinador y Administrador. Snapshots antiguos o incompletos siguen deshabilitados en el editor.

Se añadieron pruebas para edición, preservación de borrador, avisos de horarios publicados, conflicto entre propuestas, error intermedio con rollback, permiso por rol y rechazo de versiones obsoletas. También se corrigió una prueba de asistencia que consideraba “futuro” el lunes actual cuando la suite se ejecutaba un lunes.

## Verificaciones

| Comando | Resultado |
|---|---|
| `python 3.12.13 -m pytest -q` desde `backend/` | 300 aprobadas |
| `npm test` desde `frontend/` | 318 aprobadas, 47 archivos |
| `npm run build` desde `frontend/` | TypeScript y Vite completados |
| `git diff --check` | Sin errores de whitespace |

El TestClient mínimo se comprobó fuera del sandbox; dentro del sandbox se quedaba esperando al portal de AnyIO. Se instaló `httpx2` solo en el entorno virtual aislado y fuera del repositorio; eso no resolvió el bloqueo dentro del sandbox, pero la prueba mínima y la suite completa funcionaron fuera de él. No se cambió ninguna dependencia versionada.

Vite mantiene el aviso existente de que el bundle JavaScript supera 500 kB minificado. No afecta el resultado del build.

No se ejecutaron migraciones ni se modificó PostgreSQL compartido.
