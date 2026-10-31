# Documentación de SIHS — Testing

Esta carpeta **`docs/` se reserva para el trabajo de pruebas**: guías, matriz de rotación, reportes, evidencia y el bootcamp ADSO.

- [Matriz de rotación ADSO](./matriz-rotacion.md) — **permanece aquí** porque la rúbrica del instructor exige exactamente `docs/matriz-rotacion.md`.
- [Inicio e índice de testing](./testing/README.md) — bootcamp, reportes y archivo histórico.

**Documentación general** de arquitectura, requisitos, diseño y diagramas: [`_Docs/`](../_Docs/README.md).

Los tests que se ejecutan siguen en `backend/tests/`, `frontend/src/` y `e2e/`; no se trasladan a `docs/` porque pytest, Vitest y Playwright dependen de esas rutas.
