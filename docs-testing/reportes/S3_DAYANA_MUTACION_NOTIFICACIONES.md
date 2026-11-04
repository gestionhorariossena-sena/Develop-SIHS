# Semana 3 — Dayana: revisión y mutación de NotificacionesPanel

## Componente y regla de comportamiento

Los tres escenarios nuevos se consolidaron en la suite existente
`frontend/tests/unit/components/NotificacionesPanel.test.tsx`, que ahora reúne
los cuatro tests originales y los tres de esta entrega:

- Al marcar una notificación como leída, el botón de esa fila queda
  deshabilitado mientras se espera la respuesta, y la lista se actualiza al
  confirmarse.
- Si falla la actualización individual, la notificación permanece y el botón
  vuelve a estar disponible.
- Una notificación ya leída no envía otra solicitud.

Las interacciones usan `@testing-library/user-event`, consultas por rol y un
mock local de `apiPatch`. No se inicia el frontend, el backend ni se contacta
un servicio externo.

## Mutación manual

- **Cambio temporal:** se quitó de `frontend/src/components/NotificacionesPanel.tsx` la condición que
  deshabilita la fila mientras su solicitud está en curso:
  `marcandoId === notificacion.idNotificacion`.
- **Test que detecta el cambio:**
  `deshabilita la notificación mientras espera confirmación y luego actualiza la lista`.
- **Resultado mutado:** la aserción `expect(boton).toBeDisabled()` falló porque
  el botón seguía habilitado durante la solicitud. Los otros seis tests pasaron.
- **Restauración:** se repuso la condición original y los siete tests pasaron.
  La mutación no forma parte del código entregable.

## Evidencia reproducible

Los dos comandos se ejecutaron desde `frontend/` contra la suite consolidada.
Salida completa de la ejecución mutada (el código de salida fue 1):

```text
RUN  v4.1.11 D:/Desktop/Develop_SIHS/Develop-SIHS-S3-Dayana/frontend

(node:17680) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
 ❯ tests/unit/components/NotificacionesPanel.test.tsx (7 tests | 1 failed) 729ms
     × deshabilita la notificación mientras espera confirmación y luego actualiza la lista 70ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/unit/components/NotificacionesPanel.test.tsx > NotificacionesPanel — comportamiento visible > deshabilita la notificación mientras espera confirmación y luego actualiza la lista
Error: expect(element).toBeDisabled()

Received element is not disabled:
  <button
  class="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-surface disabled:cursor-default dark:hover:bg-slate-700/60"
  type="button"
/>
 ❯ tests/unit/components/NotificacionesPanel.test.tsx:157:19
    155|
    156|     expect(apiPatchMock).toHaveBeenCalledWith('/notificaciones/31/leid…
    157|     expect(boton).toBeDisabled()
       |                   ^
    158|
    159|     confirmarActualizacion(actualizada)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
   Start at  09:51:31
   Duration  20.18s (transform 470ms, setup 3.65s, import 803ms, tests 729ms, environment 13.31s)
```

Salida completa después de restaurar el componente (código de salida 0):

```text
RUN  v4.1.11 D:/Desktop/Develop_SIHS/Develop-SIHS-S3-Dayana/frontend

(node:6784) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  09:52:01
   Duration  3.28s (transform 73ms, setup 348ms, import 189ms, tests 517ms, environment 1.86s)
```

Comando usado en ambos estados, desde `frontend/`:

```powershell
pnpm vitest run tests/unit/components/NotificacionesPanel.test.tsx
```

La suite usa `user-event`, consultas por rol y un mock local de `apiPatch`;
no inicia el frontend ni el backend, ni contacta servicios externos.
