# SIHS Mobile — memoria de trabajo

Cliente **Flutter de solo lectura** para Instructores y Aprendices. Consume
el MISMO backend FastAPI y la MISMA base Supabase que el cliente web (ver
`../ARQUITECTURA_MOBILE.md`). Programar horarios sigue siendo de la web;
acá solo se consultan.

## Cómo correrlo

```bash
# 1. Backend arriba (otra terminal, desde la raíz del repo)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# 2. App
cd mobile
flutter pub get
flutter run            # -d linux | -d chrome | -d <emulador>
flutter analyze && flutter test
```

`mobile/.env` **ya existe** y NO se versiona (está en el `.gitignore` de la
raíz). Sus valores de Supabase son los mismos de `backend/.env` y
`frontend/.env`: los tres clientes hablan con la misma base. Si hay que
recrearlo, `.env.example` explica cada clave.

En emulador Android no hace falta un `.env` distinto: `AppConfig` reescribe
`127.0.0.1`/`localhost` a `10.0.2.2` solo. En dispositivo físico sí hay que
poner la IP LAN del PC en `API_BASE_URL`.

## Contrato con el backend (lo que hay que saber antes de tocar nada)

`HorarioResponse` (`backend/app/schemas/horario.py`) **no** tiene objetos
anidados de ficha/instructor/ambiente ni un `idDia` suelto — eso es lo que
asumía el código inicial y era incorrecto. Lo que devuelve de verdad:

| Campo | Forma |
|---|---|
| `horaInicio` / `horaFin` | `"HH:MM:SS"` (un `datetime.time` de Pydantic) |
| `dias` | `list[int]` de idDia; **1=Lunes … 6=Sábado** (tabla puente `horario_dia`) |
| `idInstructor` | UUID en string |
| `instructorNombre`, `fichaCodigo`, `ambienteNombre`, `resultadoDescripcion` | ya resueltos por el servidor |

Ese último punto es el que permite que la app funcione para un Aprendiz:
**un Aprendiz no tiene permiso sobre los catálogos** (`/dias-semana`,
`/ambientes` exigen Coordinador/Admin/Instructor), así que pedirlos le
daría 403. Los nombres de día se resuelven localmente en
`SesionHorario.nombresDia`, el resto viene ya resuelto en la respuesta.

### Endpoints que usa el móvil

| Rol | Endpoint | Notas |
|---|---|---|
| Aprendiz | `GET /ficha-usuario/mi-horario` | 404 si no tiene ficha vinculada. Devuelve TODO (publicado o no): el filtro de `publicado` lo hace el cliente |
| Instructor | `GET /usuarios/me/horarios` | el backend ya filtra a solo publicados |
| Todos | `GET /usuarios/me` | **imprescindible**: el JWT solo trae id y email; los roles están en la BD |

## Pantallas (diseños de `mobile/diseños movil/*.zip`)

Cada ZIP trae `screen.png` + `code.html` + `DESIGN.md` (tokens de Stitch).
La paleta de `AppTheme` sale de esos tokens (primary `#006b2c`, surface
`#faf8ff`); el esquema oscuro se derivó a mano porque los diseños solo
traen el claro.

| Diseño | Implementación |
|---|---|
| Login Aprendices / Login Instructores | `login_screen.dart` — una sola pantalla; el chip de portal alterna el titular. El backend no distingue portales: el rol lo decide `/usuarios/me` |
| Recuperación de contraseña | `recuperar_password_screen.dart` — `resetPasswordForEmail` de Supabase |
| Vista movil Aprendiz / Vista Instructor Movil | `home_screen.dart` + `sesion_card.dart` — mismo layout para ambos roles |

**Del diseño se implementó**: encabezado verde con saludo y rol, ficha del
aprendiz (`/ficha-usuario/mi-ficha`), selector de días de la semana con
fecha real y marca de "Hoy", filtro Mañana/Tarde/Noche, tarjetas con franja
de color y píldora de estado (En curso / Finalizado / Por iniciar, calculada
contra el reloj), detalle en bottom sheet, pull-to-refresh, bottom nav
(Mi horario / Perfil).

**Del diseño se omitió, por no existir en el backend**: asistencias, nº de
aprendices por sesión, "Ver lista" de aprendices, "Novedad", sincronización
con SOFIA Plus, buscador global, tabs "Por ambientes"/"Fichas asignadas" y
la campana de avisos. Se prefirió omitirlos a dibujarlos con datos
inventados. `/avisos` y `/notificaciones` sí existen (`get_current_user`,
sin exigir rol) y son el siguiente candidato natural.

## Decisiones tomadas (y por qué)

- **Una tarjeta por día, no por fila de `horarios`.** Una clase de 3 días es
  1 fila en BD pero 3 bloques en la agenda de quien la ve. Lo expande
  `SesionHorario.desdeHorarios`, ordenando por día y luego por hora.
- **Los borradores no se muestran.** Mismo criterio que
  `MiHorarioAprendiz.tsx`: un borrador que el coordinador está armando no es
  horario para quien lo cursa.
- **Aprendiz sin ficha = estado propio, no error.** El 404 se traduce a una
  instrucción ("vincúlala en la web") en vez de "algo salió mal". Vincular es
  una escritura y el móvil es de lectura — de ahí que remita a la web.
- **"Mantener sesión iniciada" se respeta al revés.** supabase_flutter
  persiste siempre; se guarda la decisión en SharedPreferences y
  `AuthService.cerrarSesionSiNoSeDebeRecordar()` descarta la sesión en el
  siguiente arranque si se desmarcó.
- **Jornada deducida de la hora, no de `idJornada`.** El catálogo
  `/jornadas` exige Coordinador/Admin: un Aprendiz recibiría 403.
- **Cuenta sin roles = estado propio.** Reproducido el 2026-09-24 con
  `juan@mail.com` de `database/02_datos_prueba.sql`: el backend responde
  403 "No autorizado", que manda a revisar la contraseña cuando lo que falta
  es el rol. Se corta antes de llamar al endpoint (ver H-13 en
  `backend/scripts/crear_cuentas_prueba.py`, que repone esos roles).
- **401 cierra sesión, 403 no.** Un 401 es token muerto; un 403 es un rol que
  no alcanza para ESE endpoint — expulsar por eso sería un bug.
- **Nada de `ColorScheme.fromSeed`.** El brand guide fija hex exactos y
  `fromSeed` los reinterpreta: el verde dejaría de ser el verde SENA.
- **`AuthGateway` / `HorarioGateway`.** Interfaces para poder inyectar dobles
  en los tests: los servicios reales tocan `Supabase.instance`, que no existe
  en `flutter test`.
- Se quitaron `flutter_spinkit` y `lottie` del pubspec (no se usaban) y se
  subió `google_fonts` a ^8.2.1, la primera versión que trae **Geist**.

## Tests

`flutter test` — 40 casos. `test/ayudas.dart` tiene los dobles
(`AuthFalso`, `HorariosFalsos`), los constructores de datos de prueba y
`envolver()` para montar un widget con tema y providers.

`usarFuentesDelSistema()` apaga la descarga de google_fonts: en test no hay
red, y una fuente que no carga cambia las métricas de texto.

## Pendiente / ideas

- Pantalla de avisos/notificaciones (`/avisos`, `/notificaciones`) — la
  campana del diseño.
- Descarga del horario en PDF: `GET /usuarios/me/horarios/pdf` ya existe.
- Deep link para que el correo de recuperación abra la app y no la web.
- Los prompts de diseño viejos (`BRAND_GUIDE_SIHS_MOBILE.md`,
  `PROMPT_*.md`) ya no están en el árbol de trabajo; siguen en git, en el
  commit `4d71eac`. Los diseños vigentes son los ZIP de `diseños movil/`.
- No hay caché offline. Si se quiere, el camino es SQLite/Drift en
  `HorarioService`, sin tocar pantallas.
