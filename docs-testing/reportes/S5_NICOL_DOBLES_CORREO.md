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

- 🔴 **[Corrida roja 43065968408](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43065968408)** — job **Backend (pytest): failure** ([ver job 130680905443](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43065968408/job/130680905443)). La ejecución focalizada documentó **3 failed, 3 passed**, detectando el destinatario alterado mediante el spy, el fake y un test SMTP preexistente. El job de frontend terminó **cancelled**, por lo que esta corrida **no demuestra una CI global completa**.
- 🟢 **[Corrida verde 43066170950](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43066170950)** — job **Backend (pytest): success** ([ver job 130681756715](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43066170950/job/130681756715)). Tras restaurar el destinatario correcto, la misma suite focalizada registró **6 passed, 1 warning**. El job de frontend aparece **cancelled**; el resultado verde corresponde al **backend**, no a una CI global validada.
- ✅ **[CI completa del commit entregable 43066638679](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43066638679)** — commit `b30935675b9867a174b83c3727c81f121b0879d1`: workflow **success**, job [Backend (pytest): success](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43066638679/job/130683387885) y job [Frontend (lint, build, test): success](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43066638679/job/130683388287). Esta corrida aporta la confirmación integral que no daban por sí solas las corridas de mutación.
- El **PR entregable #180 nunca contiene el mutante** ni modificaciones temporales del workflow de CI.

**Interpretación de estados:** en las corridas de mutación se debe evaluar la **conclusión del job Backend (pytest)** y el resultado de sus pruebas, no equiparar un job frontend cancelado con el resultado de pytest. La evidencia roja comprueba que la suite detecta el defecto; la verde confirma que vuelve a pasar tras restaurar el código. La CI integral se valida por separado en la corrida 43066638679.

## Revisión de exceso de mocks

**Test auditado:** `test_credencial_usa_spy_y_entrega_mensaje_con_contrato_real`.

La señal de riesgo es una prueba que solamente verifica `mock.enviar.assert_called_once()`; pasaría aunque el mensaje estuviera vacío o el destinatario fuera incorrecto. Para evitar ese falso positivo, el test comprueba también los argumentos y el contenido MIME **generado por el código real**, incluida la duración de 48 horas. El puerto externo es el único simulado. El test del fake verifica explícitamente el estado almacenado.

**Conclusión individual:** el doble permite aislar el SMTP incontrolable sin reemplazar la lógica de negocio ni limitarse a comprobar una llamada.

## Validación y pendiente

- [x] 4 tests nuevos, con tipos de doble explícitos.
- [x] Verificación de comportamiento, no-interacción y estado/resultado.
- [x] Interfaz propia ante librería externa; API pública de EmailService conservada.
- [x] Mutación roja reproducida en GitHub Actions.
- [x] Restauración y ejecución verde comprobadas: [6/6](../../actions/runs/43066170950).
- [x] **[CI integral del commit actual](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43066638679)**: backend y frontend en success. La [CI previa 43065874229](https://github.com/gestionhorariossena-sena/Develop-SIHS/actions/runs/43065874229) también estaba en verde.
- [ ] Revisión cruzada por Dayana y revisión grupal del exceso de mocks.
- [ ] Integración y medición consolidada con los otros PR de S5.

**Comando:** `cd backend && pytest -q tests/test_s5_dobles_correo_nicol.py tests/test_email_service.py`.
