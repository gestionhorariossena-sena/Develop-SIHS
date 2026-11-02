# Semana 3 — Dayana: mutación de NotificacionesPanel

## Componente y regla de comportamiento

La suite `frontend/tests/unit/components/NotificacionesPanel.s3-dayana.test.tsx`
cubre interacciones de lectura de notificaciones:

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

- **Cambio temporal:** se quitó de `NotificacionesPanel.tsx` la condición que
  deshabilita la fila mientras su solicitud está en curso:
  `marcandoId === notificacion.idNotificacion`.
- **Test que detecta el cambio:**
  `deshabilita la notificación mientras espera confirmación y luego actualiza la lista`.
- **Resultado mutado:** el test falló en `expect(boton).toBeDisabled()` porque
  el botón seguía habilitado durante la solicitud.
- **Restauración:** se repuso la condición original. La mutación no forma
  parte del código entregable.

## Ejecución

Desde `frontend/`:

```powershell
pnpm test -- tests/unit/components/NotificacionesPanel.s3-dayana.test.tsx
```

Resultado final con el componente restaurado: **3 passed**.

Para repetir solo el caso durante una mutación:

```powershell
pnpm test -- tests/unit/components/NotificacionesPanel.s3-dayana.test.tsx -t "deshabilita la notificación mientras espera confirmación"
```

