# Semana 3 — David: pruebas del formulario de registro

## Componente y comportamientos probados

Los tests de `frontend/tests/unit/pages/Registro.test.tsx` cubren el registro
como aprendiz:

- Completar los campos requeridos y enviar los datos esperados como metadata
  a Supabase Auth; comprobar la navegación al login tras el éxito.
- Rechazar contraseñas distintas antes de llamar a Supabase.
- Mostrar el error devuelto por Supabase sin navegar al login.
- Mantener el botón deshabilitado y mostrar el estado de envío mientras la
  petición está pendiente.

Los tests usan dobles de `supabase.auth.signUp` y `apiPost`; no realizan
llamadas de red ni requieren credenciales reales.

## Mutación manual

- **Implementación correcta:** `password !== confirmarPassword`.
- **Mutante temporal:** `password === confirmarPassword`.
- **Prueba ejecutada:**
  `muestra validación y no crea la cuenta si las contraseñas no coinciden`.
- **Resultado con el mutante:** falló porque no se mostró la alerta de
  validación y se navegó al formulario de inicio de sesión.
- **Estado final:** se restauró `!==`; el mutante no forma parte del código.

## Ejecución local

Pruebas del componente:

```powershell
pnpm --dir frontend exec vitest run tests/unit/pages/Registro.test.tsx
```

Resultado con la implementación restaurada: **9 passed**.

Prueba de mutación:

```powershell
pnpm --dir frontend exec vitest run tests/unit/pages/Registro.test.tsx -t "muestra validación y no crea la cuenta"
```

Con el mutante temporal, esta prueba falló en la aserción de la alerta, como
se esperaba. Tras restaurar el código, la suite completa del componente pasó.

Validaciones globales de frontend:

- `pnpm --dir frontend lint` — correcto, sin errores ni advertencias.
- `pnpm --dir frontend build` — correcto.
- `pnpm --dir frontend test:coverage` — **54 archivos y 382 tests pasaron**;
  sentencias **78,77 %**, ramas **67,07 %**, funciones **74,91 %** y líneas
  **81,77 %**. Todos superan los umbrales existentes.
