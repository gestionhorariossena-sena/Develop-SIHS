# Semana 5 — Nicol · Dobles para el envío de correo transaccional

**Capa:** API (rotación desde Front S4). **Rama:** `test/s5-api-correo-nicol`. **PR:** [#180](../../pull/180). **Revisora asignada:** Dayana (E2E).

## Dependencia inventariada y refactorización

`EmailService` se conecta a un servidor SMTP externo con `smtplib` y parámetros de `settings`. La implementación anterior instanciaba SMTP directamente en el servicio, dificultando sustituir la dependencia sin interceptar una librería de terceros.

Se añadió el puerto propio `TransporteCorreo` (Protocol) con `enviar(remitente, destinatario, mensaje)`, su adaptador productivo `TransporteSMTP`, y el punto de inyección `EmailService._crear_transporte()`. El servicio conserva la validación de configuración y la composición MIME reales. El adaptador real preserva `starttls`, `login` y `sendmail`. Los consumidores existentes no cambian de API.

## Cuatro tests nuevos con dobles

Archivo `backend/tests/test_s5_dobles_correo_nicol.py`:

| Test | Doble | Qué comprueba |
|---|---|---|
| `test_credencial_usa_spy_y_entrega_mensaje_con_contrato_real` | **Spy/Mock** del puerto | Verifica llamada única y sus argumentos; examina remitente, destinatario, MIME, nombre, contraseña y 48 h |
| `test_sin_configuracion_no_usa_el_transporte` | **Mock** de fábrica y transporte | `SmtpNoConfiguradoError`, `assert_not_called` en fábrica y transporte |
| `test_error_de_transporte_se_propaga_y_no_se_silencia` | **Stub fallido** con spy | Error `SMTPServerDisconnected` es observable, no se oculta |
| `test_rechazo_de_solicitud_envia_motivo_mediante_fake` | **Fake** en memoria | Estado real del fake: un mensaje entregado al destinatario correcto con el motivo de rechazo |

Los tests comprueban **comportamiento** (interacciones y ausencia de ellas) y **estado/resultado** (el contenido MIME enviado y el registro del fake). No sustituyen el servicio que se intenta probar: sólo el transporte externo.

## Mutación: destinatario equivocado

Ensayo en rama temporal `test/s5-mutacion-correo-nicol-evidencia` y [PR temporal #181](../../pull/181) (**NO FUSIONAR**):

```diff
- destinatario=destinatario_email,
+ destinatario="otro@example.test",
```

- 🔴 **[Corrida roja 43065968408](../../actions/runs/43065968408):** `pytest -q tests/test_s5_dobles_correo_nicol.py tests/test_email_service.py`: **3 failed, 3 passed**, detectado por el spy, el fake y el test SMTP anterior.
- 🟢 La restauración del código original fue subida a la rama temporal. **La ejecución verde se registrará solamente cuando exista el resultado de pytest.**
- El **PR entregable #180 nunca contiene el mutante** ni modificaciones del workflow de CI.

## Revisión de exceso de mocks

**Test auditado:** `test_credencial_usa_spy_y_entrega_mensaje_con_contrato_real`.

La señal de riesgo es una prueba que solamente verifica `mock.enviar.assert_called_once()`; pasaría aunque el mensaje estuviera vacío o el destinatario fuera incorrecto. Para evitar ese falso positivo, el test comprueba también los argumentos y el contenido MIME **generado por el código real**, incluida la duración de 48 horas. El puerto externo es el único simulado. El test del fake verifica explícitamente el estado almacenado.

**Conclusión individual:** el doble permite aislar el SMTP incontrolable sin reemplazar la lógica de negocio ni limitarse a comprobar una llamada.

## Validación y pendiente

- [x] 4 tests nuevos, con tipos de doble explícitos.
- [x] Verificación de comportamiento, no-interacción y estado/resultado.
- [x] Interfaz propia ante librería externa; API pública de EmailService conservada.
- [x] Mutación roja reproducida en GitHub Actions.
- [ ] Confirmar y registrar ejecución verde tras restaurar el mutante.
- [x] **[CI previa del PR #180](../../actions/runs/43065874229)** completada en verde en backend y frontend.
- [ ] Revisión cruzada por Dayana y revisión grupal del exceso de mocks.
- [ ] Integración y medición consolidada con los otros PR de S5.

**Comando:** `cd backend && pytest -q tests/test_s5_dobles_correo_nicol.py tests/test_email_service.py`.
