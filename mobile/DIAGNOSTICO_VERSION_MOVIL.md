# Versión móvil: diagnóstico, vistas faltantes y adaptación responsive

Origen: `Tareas_proyecto_horarios.pdf`, sección 8 (T-30 a T-33).
Fecha: 2026-10-06. Alcance: la app Flutter de `mobile/`, el cliente de
Aprendices e Instructores. La web tiene su propio menú compacto para
pantallas chicas (`AppShell.tsx`, por debajo de `xl`); al final hay una
nota sobre ella.

| Tarea | Resultado | Sección |
|---|---|---|
| T-30 | Estado actual revisado y medido | §1 |
| T-31 | Vistas y funciones faltantes, priorizadas; la prioridad 1 quedó hecha | §2 |
| T-32 | Pantallas adaptadas a teléfono chico, horizontal y tablet | §3 |
| T-33 | Flujos principales validados en 5 tamaños y 2 tamaños de letra | §4 |

---

## 1. T-30 — Estado actual

### Qué hay

App Flutter **de solo lectura** (decisión de `ARQUITECTURA_MOBILE.md`):
programar horarios es de la web.

| Pantalla | Archivo | Rol | Endpoint |
|---|---|---|---|
| Login (portal Aprendiz / Instructor) | `login_screen.dart` | todos | Supabase Auth + `GET /usuarios/me` |
| Recuperar contraseña | `recuperar_password_screen.dart` | todos | Supabase `resetPasswordForEmail` |
| Mi horario | `home_screen.dart` | Aprendiz, Instructor | `GET /ficha-usuario/mi-horario`, `GET /usuarios/me/horarios` |
| Mi asistencia | `asistencia_screen.dart` | Aprendiz | `GET /asistencias/mias` |
| Asistencia de mis clases (consulta) | `asistencia_instructor_screen.dart` | Instructor | `GET /asistencias/sesion` |
| Perfil | `perfil_screen.dart` | todos | (datos ya cargados) |

### Cómo estaba al empezar

- `flutter analyze`: **2 advertencias**. `pubspec.yaml` declara
  `assets/` y `assets/images/`, pero esas carpetas no estaban en git; en
  un clon limpio no existen.
- `flutter test`: 56 pruebas, todas pasaban. Ninguna probaba la app en
  un tamaño de pantalla distinto al de por defecto (800×600).
- Se montó cada pantalla en 5 tamaños (320×568, 360×740, 740×360,
  800×1280 y 1280×800), con la letra al 100 % y al 130 %. Hubo errores
  en **todas** las pantallas menos Perfil:

| Dónde | Qué pasaba | Desde qué tamaño |
|---|---|---|
| `sesion_card.dart` (tarjeta de clase) | La hora y la píldora de estado no cabían en la fila y desbordaban | **360 px**, el teléfono Android más común |
| `login_screen.dart`, botón "Iniciar sesión" y chip de portal | Desbordaban hacia la derecha | 360 px; con letra grande, incluso en tablet |
| `recuperar_password_screen.dart`, encabezado | El título desbordaba | 360 px |
| `asistencia_instructor_screen.dart`, hora + ambiente | Desbordaba | 360 px |
| `asistencia_screen.dart`, cifras Presente/Tarde/Ausente | Desbordaba | 320 px con letra al 130 % |
| `home_screen.dart` | `setState() called during build` al volver a montar el Home con el horario ya cargado (por ejemplo, al entrar otra vez después de un 401) | cualquiera |

- En tablet o con el teléfono en horizontal, todo se estiraba al ancho
  completo (tarjetas de 1280 px) y la barra inferior le quitaba alto a
  una pantalla que en horizontal ya es baja.
- **Android release sin permiso de Internet.** Solo
  `android/app/src/debug/AndroidManifest.xml` declaraba `INTERNET`; el de
  `main` no. Con `flutter run` funciona, pero un APK release instalado en
  un teléfono no puede hablar con Supabase ni con el backend, así que ni
  siquiera entra.
- El nombre visible de la app era "mobile" en Android y "Mobile" en iOS.

---

## 2. T-31 — Vistas y funciones faltantes, priorizadas

Criterio: primero lo que el backend **ya expone** a Aprendiz/Instructor
y respeta la decisión de solo lectura; después lo que exige escribir
desde el móvil (requiere decidirlo con el equipo); al final lo que
falta en el backend.

| Prioridad | Vista / función | Estado del backend | Notas |
|---|---|---|---|
| **1** | **Avisos y notificaciones** (la campana de los diseños) | `GET /avisos/`, `GET /notificaciones/` (cualquier rol) | ✅ **Hecha en este PR**, ver §2.1 |
| **1** | **Permiso de Internet en Android release** | — | ✅ **Corregido en este PR** |
| 2 | Descargar mi horario en PDF | `GET /usuarios/me/horarios/pdf` ya existe | Solo lectura; falta abrir/compartir el archivo (`share_plus` o `open_filex`) |
| 2 | Deep link de recuperación de contraseña | Supabase lo soporta | Hoy el correo abre la web, no la app |
| 2 | Identificador real de la app | — | `applicationId` sigue en `com.example.mobile`. Hay que elegir el definitivo (ej. `co.edu.sena.sihs`) **antes** de la primera publicación en tienda: cambiarlo después crea "otra app" |
| 3 | Marcar notificaciones como leídas | `PATCH /notificaciones/{id}/leida` y `/marcar-todas-leidas` | Es una escritura: rompe la regla de solo lectura. Decisión del equipo |
| 3 | Mis solicitudes de cambio de horario (Instructor) | `GET /solicitudes-cambio-horario/mias` y `POST` | La consulta es de lectura; crear una solicitud es escritura |
| 3 | Mensajes con docentes (Aprendiz) | `/mensajeria/conversaciones` | Lectura y escritura; en la web es `MensajesAprendiz.tsx` |
| 3 | Vista semanal en cuadrícula | Datos ya cargados | En tablet aprovecharía el ancho; hoy es un día a la vez |
| 4 | Notificaciones push | No hay infraestructura (FCM) | Requiere backend |
| 4 | Modo sin conexión completo | — | Hoy hay caché de perfil y horario; lo demás necesita red |
| 4 | Tema oscuro validado | — | Existe `AppTheme.oscuro`, pero está apagado hasta tener un diseño aprobado |

Fuera de alcance a propósito: todo lo del Coordinador y el
Administrador (programar, catálogos, asistente, aprobaciones). Sigue
siendo de la web.

### 2.1 Lo que se agregó: pestaña "Avisos"

- `lib/models/aviso.dart`: `Aviso` y `Notificacion`, espejo de
  `app/schemas/aviso.py` y `app/schemas/notificacion.py`.
- `lib/services/aviso_service.dart`: `AvisoGateway` + `AvisoService`
  (inyectable en las pruebas, igual que los demás servicios).
- `lib/screens/avisos_screen.dart`: dos pestañas.
  - **Avisos**: el tablón de la coordinación con categoría
    (Reprogramación, Evento, Sede, Extraordinario), a quién va dirigido
    (ficha, sede o todo el centro), quién lo publicó y hasta cuándo es
    vigente. Los vencidos no se muestran: el backend no los descarta.
  - **Notificaciones**: las personales, con un contador de no leídas.
  - Las dos fuentes se piden en paralelo y fallan por separado: si se
    cae una, la otra pestaña sigue funcionando.
  - Solo lectura: no publica avisos ni marca notificaciones (ver
    prioridad 3).
- La pestaña aparece para todos los roles en el menú principal.

---

## 3. T-32 — Adaptación a distintos tamaños

| Cambio | Archivo |
|---|---|
| Hora de la tarjeta en `Expanded` en vez de `Text` + `Spacer`: la píldora de estado ya no empuja la fila fuera de la pantalla | `widgets/sesion_card.dart` |
| Texto del botón "Iniciar sesión" y del chip de portal en `Flexible` con elipsis | `screens/login_screen.dart` |
| Título del encabezado en `Expanded` | `screens/recuperar_password_screen.dart` |
| Hora y ambiente en un `Wrap`: si no caben en una línea, el ambiente baja a la siguiente | `screens/asistencia_instructor_screen.dart` |
| Cifras del resumen en `Expanded` (reparto parejo en vez de `spaceEvenly`) | `screens/asistencia_screen.dart` |
| **Riel lateral desde 600 px de ancho** (el "medium" de Material 3): en tablet o teléfono horizontal el menú pasa de la barra inferior a un `NavigationRail`, y el contenido se centra con un ancho máximo de 720 px | `screens/home_screen.dart` |
| Carga del horario después del frame, no durante `didChangeDependencies` (arregla el `setState() called during build`) | `screens/home_screen.dart` |
| Carpeta `assets/images/` versionada con `.gitkeep` (quita las 2 advertencias de `flutter analyze`) | `assets/images/.gitkeep` |

Login y recuperación de contraseña ya limitaban su ancho a 420 px, así
que en tablet se veían bien.

---

## 4. T-33 — Validación de los flujos principales

**Automática** (`test/adaptacion_pantallas_test.dart`, 30 casos). Cada
flujo se monta en los 5 tamaños, con la letra al 100 % y al 130 %, y la
prueba falla si cualquier pantalla desborda o lanza un error de Flutter:

| Flujo | Aprendiz | Instructor |
|---|---|---|
| Login → recuperar contraseña | ✅ | ✅ |
| Mi horario (con clases todos los días) | ✅ | ✅ |
| Navegación: barra inferior < 600 px, riel lateral ≥ 600 px | ✅ | ✅ |
| Perfil → botón de cerrar sesión | ✅ | ✅ |
| Asistencia (historial / nómina de la clase) | ✅ | ✅ |
| Avisos → pestaña Notificaciones | ✅ | ✅ |

La fuente de `flutter test` dibuja cada letra como un cuadrado del ancho
de su tamaño, más ancha que Hanken o Geist. Por eso, lo que cabe en la
prueba cabe con holgura en un teléfono real.

**Resultado:** `flutter analyze` sin advertencias; `flutter test`
**93 pruebas, todas pasan** (56 que ya había + 7 de Avisos + 30 de
tamaños).

**Pendiente: validación manual en dispositivo físico.** Las pruebas
automáticas cubren el layout, pero no la red real, el teclado en pantalla
ni el rendimiento. Lista sugerida, con un APK release
(`flutter build apk --release`) apuntando al backend de pruebas:

- [ ] Instalar el APK release y entrar como Aprendiz y como Instructor
      (confirma el permiso de Internet).
- [ ] Recorrer las 4 pestañas en vertical y en horizontal.
- [ ] Cambiar el tamaño de letra del sistema al máximo y repetir.
- [ ] Abrir el formulario de login con el teclado en pantalla abierto, en
      un teléfono chico.
- [ ] Probar en una tablet si hay una a mano.
- [ ] Sin conexión: abrir la app con horario en caché.

---

## Nota sobre la web en el celular

La web ya tiene un menú compacto por debajo de `xl` (`AppShell.tsx`).
No se revisó página por página en esta tarea. Estas páginas no usan
ningún prefijo responsive de Tailwind (`sm:`, `md:`, `lg:`), así que son
las primeras a revisar si se decide que el aprendiz o el instructor
también usen la web desde el celular: `AsistenciaInstructor`,
`AsistenteHorarios`, `CalendarioGeneral`, `CambiosHorario`,
`CodigoInstructor`, `MiAsistencia`, `MisSolicitudesCambioHorario`,
`NuevoHorario`, `Usuarios` (más las de autenticación, que ya son de una
columna).
