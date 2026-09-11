# Decisión: mecanismo de envío de la credencial temporal por correo

Ticket: **[DB/Arquitectura] Decidir mecanismo de envío de la credencial
temporal por correo** (Epic SCRUM-96). Consumido por el ticket **[Backend]
Endpoints /solicitudes-acceso** del mismo Epic.

## El requisito

Al aprobar una solicitud de acceso (mockup
`panel_de_administracion_sihs_sena/code.html`), el sistema debe enviar un
correo real al solicitante con su contraseña temporal:

> **Protocolo de Seguridad**: "Contraseña autogenerada con entropía
> SHA-256 válida por 48 horas con revocación automática."
>
> **Flujo al Aprobar, paso 2**: "El sistema envía un correo al dominio
> institucional con contraseña autogenerada de un solo uso."

El copy exige que la **contraseña literal** llegue en el cuerpo del
correo, no solo un enlace para que la persona elija la suya.

## Las dos opciones del ticket

1. **Reutilizar Supabase** (`POST /auth/v1/invite` o
   `generate_link` tipo `invite`) — Supabase envía el correo con el SMTP
   que se configure en el ticket de recuperación de contraseña (Gmail de
   gestión, mismo Epic).
2. **Enviar el correo manualmente desde FastAPI** (`smtplib` +
   `email.mime`) con las mismas credenciales Gmail, después de crear la
   cuenta vía Admin API de Supabase con una contraseña ya conocida por
   nosotros.

## Decisión: opción 2 — envío manual desde FastAPI

**Motivo principal: la opción 1 no puede cumplir el requisito literal del
mockup.** El flujo `invite`/`generate_link` de Supabase Auth no acepta que
el llamador fije una contraseña — genera un enlace de tipo "magic link"
para que la propia persona establezca su contraseña la primera vez. El
correo que Supabase manda con ese flujo nunca contiene una contraseña en
texto, así que no hay forma de que diga "tu contraseña temporal es X" —
solo puede decir "haz clic para elegir tu contraseña". Eso no es lo que
piden el mockup ni el resto de las pantallas de este Epic (que asumen una
contraseña temporal explícita, cambiable después vía
`usuarios.debe_cambiar_clave`).

Como la creación de la contraseña ya la controlamos nosotros (no
Supabase), y el copy en español con el texto exacto del mockup tampoco lo
da gratis ninguna plantilla nativa de Supabase (esas dependen igual de
`SCRUM-129`, la configuración de SMTP personalizado en el dashboard, y
siguen en inglés por defecto), la opción 1 no ahorra tanto como parece:
terminaríamos configurando SMTP personalizado de todos modos y
probablemente ajustando plantillas a mano en el dashboard para igual no
poder mostrar la contraseña.

La opción 2 sí cumple el requisito tal cual está escrito, a cambio de
mantener un servicio pequeño y aislado (`EmailService`,
`backend/app/services/email_service.py`) — no smtplib disperso en
routers. La creación de la cuenta en sí **sigue yendo por la Admin API de
Supabase** (mismo patrón ya probado en `backend/scripts/crear_admin.py`),
solo el transporte del correo con la contraseña es código propio.

Si más adelante el equipo decide que un enlace de "set password" alcanza
(cambiando el copy del mockup), migrar es acotado: solo hay que cambiar
la implementación interna de `EmailService.enviar_credencial_temporal`, el
resto del sistema (endpoint de aprobación, `usuarios.debe_cambiar_clave`)
no depende de cuál mecanismo se use.

## Qué se implementó en este ticket

- `backend/app/services/email_service.py` — `EmailService` con un único
  método público, `enviar_credencial_temporal(destinatario_email,
  destinatario_nombre, password_temporal)`. El endpoint de aprobación de
  solicitudes (otro ticket) debe llamar a este método en vez de armar el
  correo inline.
- `Settings.smtp_host/smtp_port/smtp_user/smtp_password/smtp_from_nombre`
  en `backend/app/core/config.py` + `backend/.env.example` documentado.
- Si `SMTP_USER`/`SMTP_PASSWORD` no están configurados, `EmailService`
  falla explícito con `SmtpNoConfiguradoError` en vez de fallar en
  silencio o mandar nada.

## Dependencia pendiente (fuera de alcance de este ticket)

El envío **real** del correo (contra un buzón de verdad, con la cuenta de
Gmail de gestión) depende de que exista la contraseña de aplicación de
Gmail — eso lo resuelve el ticket de recuperación de contraseña del mismo
Epic, que ya iba a necesitar esa misma cuenta. Mientras `SMTP_USER`/
`SMTP_PASSWORD` sigan vacíos en `.env`, `EmailService` lanza
`SmtpNoConfiguradoError` de forma controlada — no rompe nada más del
sistema, solo bloquea el paso de envío.

## Decisión pendiente / checklist

- [x] Elegir mecanismo (opción 2, documentado arriba)
- [x] Implementar `EmailService` con la interfaz que el endpoint de
      aprobación va a necesitar
- [ ] Configurar `SMTP_USER`/`SMTP_PASSWORD` reales en el `.env` del
      backend desplegado (depende del ticket de recuperación de
      contraseña — misma cuenta Gmail)
- [ ] Conectar `EmailService.enviar_credencial_temporal` desde el
      endpoint de aprobación (`[Backend] Endpoints /solicitudes-acceso`)
