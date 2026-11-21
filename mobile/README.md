# SIHS Mobile

Aplicación Flutter de SIHS para instructores y aprendices. Permite consultar
horarios y avisos; el instructor también puede consultar y registrar la
asistencia de sus sesiones. La autenticación se realiza con Supabase y las
funciones académicas consumen la API FastAPI.

## Funcionalidades

- Inicio de sesión y recuperación de contraseña con Supabase Auth.
- Horario personal y datos de ficha para aprendices.
- Horarios publicados del instructor.
- Consulta del historial de asistencia del aprendiz.
- Consulta y registro/corrección de asistencia por el instructor.
- Avisos, notificaciones y perfil.
- Caché local de perfil y horario para mostrar los últimos datos conocidos
  mientras se actualizan desde la API.

## Requisitos

- Flutter y Dart según las restricciones de `pubspec.yaml`.
- Android Studio o VS Code con las herramientas de Flutter.
- Un emulador o dispositivo para ejecutar la app.
- Acceso a los proyectos Supabase y backend de desarrollo.

## Configuración y ejecución

Desde PowerShell, en la raíz del repositorio:

```powershell
Set-Location mobile
flutter pub get
Copy-Item demo.local.example.json demo.local.json
```

### APK para la demo local

El identificador Android es `co.edu.sena.sihs` y el nombre visible es `SIHS`.
Para compilar contra la demo local (emulador Android):

1. Desde la raíz del repositorio, inicia Supabase local y el backend:

   ```powershell
   make demo-up
   ```

2. Desde la raíz, consulta únicamente `ANON_KEY`:

   ```powershell
   supabase status -o env | Select-String '^ANON_KEY='
   ```

   Desde `mobile/`, crea la configuración local ignorada por Git y copia esa
   clave en `SUPABASE_ANON_KEY`:

   ```powershell
   Copy-Item demo.local.example.json demo.local.json
   ```

   No uses `SERVICE_ROLE_KEY`: la configuración se incorpora al APK. El
   archivo `demo.local.json` está excluido de Git.

3. Compila o ejecuta el APK con esa configuración:

   ```powershell
   flutter build apk --dart-define-from-file=demo.local.json
   flutter run --dart-define-from-file=demo.local.json
   ```

El APK se genera en `build/app/outputs/flutter-apk/app-release.apk`. En Android,
`AppConfig` convierte las URLs locales `127.0.0.1`/`localhost` en `10.0.2.2`
para que el emulador llegue al Supabase y al backend del computador. Las
variables de build se empaquetan en la aplicación; deben ser solo configuración
pública del cliente. No pases claves de servicio ni otros secretos.

Variables requeridas:

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave pública de cliente de Supabase |
| `API_BASE_URL` | URL base de la API, incluyendo `/api/v1` |

El valor local predeterminado para la API es
`http://127.0.0.1:8000/api/v1`. En el emulador Android, la app convierte
automáticamente `127.0.0.1` o `localhost` en `10.0.2.2`. En un dispositivo
físico, usa la dirección IP local del computador que ejecuta
el backend, por ejemplo `http://192.168.1.20:8000/api/v1`, y la URL LAN de
Supabase si también se ejecuta localmente.

La guía de configuración de Supabase está en
[`../database/README.md`](../database/README.md); los pasos del backend, en
[`../backend/README.md`](../backend/README.md).

## Pruebas y análisis

Desde `mobile/`:

```powershell
flutter test
flutter analyze

# Pruebas relacionadas con el contrato de asistencia
flutter test test\screens\asistencia_screen_test.dart
flutter test test\adaptacion_pantallas_test.dart
```

## Arquitectura

- `lib/screens/`: pantallas de autenticación, horario, asistencia, avisos y
  perfil.
- `lib/services/`: integración con Supabase y la API a través de Dio.
- `lib/providers/`: estado compartido con Provider.
- `lib/models/`: representación tipada de las respuestas.
- `lib/config/app_config.dart`: carga de variables de build y ajuste de URL
  para Android.
- `test/`: pruebas Flutter.

`ApiClient` agrega el token de Supabase a las solicitudes protegidas. El
backend determina qué información puede consultar o modificar cada rol; la
app no debe usarse para saltarse esas reglas.

## Endpoints de la API utilizados

| Endpoint | Uso |
|---|---|
| `GET /usuarios/me` | Perfil del usuario autenticado |
| `GET /ficha-usuario/mi-ficha` | Ficha del aprendiz |
| `GET /ficha-usuario/mi-horario` | Horario del aprendiz |
| `GET /usuarios/me/horarios` | Horario publicado del instructor |
| `GET /asistencias/mias` | Historial de asistencia del aprendiz |
| `GET /asistencias/sesion` | Nómina de una sesión del instructor |
| `POST /asistencias/sesion` | Registro o corrección de asistencia |
| `GET /avisos/` | Avisos visibles para el usuario |
| `GET /notificaciones/` | Notificaciones del usuario |

El inicio de sesión y la recuperación de contraseña van directamente a
Supabase Auth.
