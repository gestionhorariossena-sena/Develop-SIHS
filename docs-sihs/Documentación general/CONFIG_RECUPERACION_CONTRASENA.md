# Configuración pendiente: recuperación de contraseña (código por correo, en español, desde Gmail de gestión)

Ticket: **[DB/Arquitectura] Reparar recuperación de contraseña — código por
correo en español desde Gmail de gestión** (config Supabase, no PR de
código).

## Por qué este archivo y no un cambio de código

Investigado por completo el 2026-09-07: **no es un bug de código**. Se
verificó de nuevo el 2026-09-12 al tomar este ticket —
`frontend/src/pages/RecuperarContrasena.tsx` y
`frontend/src/pages/RestablecerContrasena.tsx` siguen exactamente como
describe el ticket:

- `RecuperarContrasena.tsx` llama a `supabase.auth.resetPasswordForEmail`.
- `RestablecerContrasena.tsx` ya espera un código de 6 dígitos vía
  `supabase.auth.verifyOtp({ type: 'recovery' })`, con un comentario
  explícito en el código que advierte la causa más probable (línea ~18).

No hay nada que arreglar en el repo. Lo que falta es 100% configuración
del Supabase Dashboard + una cuenta de Gmail con contraseña de aplicación
— ninguna de las dos cosas es accesible desde este entorno (agente de
código, sin credenciales de Supabase ni de la cuenta de Gmail de
gestión). Este archivo deja listo el contenido exacto para que quien
tenga acceso a ambas (la cuenta "gestión", según el ticket) lo pegue
directo, sin tener que redactar nada desde cero.

## Paso 1 — Email Templates → Reset Password

Supabase Dashboard → **Authentication → Email Templates → Reset
Password**. Confirmar/editar así:

**Subject:**
```
Recupera tu contraseña · SIHS SENA
```

**Message body (HTML):** — la clave es que use `{{ .Token }}` (código de
6 dígitos), **no** `{{ .ConfirmationURL }}` (link) como trae la
plantilla por defecto. Si el dashboard hoy solo tiene el link, esa es la
causa raíz del correo sin código.

```html
<h2>Recuperación de contraseña</h2>

<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en
el Sistema Integrado de Horarios y Sedes (SIHS) del CGMLTI.</p>

<p>Usa el siguiente código de verificación para continuar:</p>

<h1 style="text-align:center; letter-spacing: 6px; font-size: 32px;">{{ .Token }}</h1>

<p>Ingresa este código junto con tu correo institucional en la pantalla
"Restablecer contraseña" de SIHS. Es válido por <strong>30 minutos</strong>
y de un solo uso.</p>

<p>Si no solicitaste este cambio, puedes ignorar este correo — tu
contraseña actual sigue funcionando con normalidad y nadie más pudo
acceder a tu cuenta solo con este mensaje.</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

<p style="font-size:12px;color:#64748b;">
SENA · Sistema Integrado de Horarios y Sedes (SIHS)<br>
Este es un correo automático, no respondas directamente a este mensaje.
</p>
```

## Paso 2 — SMTP Settings (cuenta de Gmail de gestión)

Supabase Dashboard → **Authentication → SMTP Settings** → activar "Enable
Custom SMTP" y completar:

| Campo | Valor |
|---|---|
| Sender email | la dirección Gmail de gestión |
| Sender name | `SIHS SENA — Gestión de Horarios` (mismo remitente que ya usa `SMTP_FROM_NOMBRE` en `backend/.env.example`, ver más abajo) |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | la dirección Gmail de gestión completa |
| Password | **contraseña de aplicación** de Gmail (no la contraseña normal de la cuenta) — se genera en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), requiere verificación en dos pasos activada en esa cuenta de Google |

## Paso 3 — Reutilizar la misma cuenta en `EmailService` (ticket relacionado)

El ticket **"[DB/Arquitectura] Decidir mecanismo de envío de la
credencial temporal"** (mismo Epic SCRUM-96) ya está resuelto en código
— ver `_Docs/Documentación general/DECISION_ENVIO_CREDENCIAL_TEMPORAL.md`
y `backend/app/services/email_service.py` — y quedó explícitamente
bloqueado en la misma cuenta de Gmail. Con las credenciales del Paso 2 a
mano, completar también en el backend desplegado (`.env`, no committeado
— ver `backend/.env.example`):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<la misma cuenta Gmail de gestión>
SMTP_PASSWORD=<la misma contraseña de aplicación del Paso 2>
SMTP_FROM_NOMBRE=SIHS SENA — Gestión de Horarios
```

Una sola contraseña de aplicación de Gmail sirve para ambos (Supabase
SMTP + `EmailService`) — no hace falta generar dos.

## Paso 4 — Probar de punta a punta antes de cerrar la tarea

1. `/recuperar-contrasena` con un correo real → confirmar que llega en
   español, desde la cuenta de gestión (no `noreply@mail.app.supabase.io`),
   con el código de 6 dígitos visible.
2. `/restablecer-contrasena` con ese código → confirmar que
   `verifyOtp` lo acepta y deja definir la contraseña nueva.
3. Iniciar sesión con la contraseña nueva.

## Checklist

- [ ] Plantilla "Reset Password" en español, usando `{{ .Token }}`
- [ ] SMTP personalizado configurado con la cuenta Gmail de gestión + contraseña de aplicación
- [ ] `.env` del backend desplegado actualizado con las mismas credenciales SMTP (desbloquea `EmailService`)
- [ ] Flujo probado de punta a punta (correo llega en español, con código, desde la cuenta de gestión; el código funciona en `/restablecer-contrasena`)

Ninguno de estos pasos pasa por PR — son configuración de Supabase
Dashboard y variables de entorno del backend desplegado, no código en
este repo. Este documento solo se sube a git como referencia para quien
tenga acceso a ambas cuentas.
