# T-005 — entregable de `codex`

**Rama:** `codex/t-005-corrige-los-3-puntos-de-la-revision-t-00`  
**Cerrado:** 2026-09-30 02:32

## Cambios contra develop

```
 .../CONTRATO_REPORTE_ASISTENCIA_FICHA.md"          | 304 +++++++++++++++++++++
 1 file changed, 304 insertions(+)
```

## Lo que reportó el agente

Corregí los 3 puntos en [CONTRATO_REPORTE_ASISTENCIA_FICHA.md](/home/david/dev/wt/codex-sihs/_Docs/Documentación%20general/CONTRATO_REPORTE_ASISTENCIA_FICHA.md):

- Ambiente: separa `nombre: "Ambiente"` y `numeroAmbiente: 301`; define la composición legible en UI.
- 422 por rango invertido: unificado con el precedente del backend.
- Historial: incluye explícitamente asistencias de horarios hoy inactivos o despublicados.

Alcance: solo el contrato documental; no se tocó backend ni frontend. Validé formato con `git diff --check`; no ejecuté pytest porque no hay código ejecutable modificado.

Pendiente para David: revisar el diff y registrar/agregar el documento nuevo. Quedó sin seguimiento en esta rama porque `origin/develop` aún no contiene el contrato base y el índice Git del worktree no es escribible desde este entorno.
