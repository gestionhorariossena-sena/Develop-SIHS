# SIHS Mobile - Versión Móvil del Sistema de Información

Cliente móvil de Flutter para el sistema de horarios SIHS. Permite a instructores y aprendices visualizar sus horarios en tiempo real.

## 🚀 Features Actuales

- ✅ Autenticación con Supabase
- ✅ Visualización de horarios personales
- ✅ Diferenciación de roles (Instructor/Aprendiz)
- ✅ Diseño responsive con Material 3

## 🔮 Expansión Futura

- Notificaciones de cambios en horarios
- Historial de asistencia (Aprendices)
- Estadísticas de carga (Instructores)
- Comentarios y anotaciones en horarios
- Sincronización offline
- Más...

## 📦 Dependencias Principales

```yaml
supabase_flutter:       # Autenticación y BD
dio:                    # Cliente HTTP
provider:               # State Management
flutter_dotenv:         # Variables de entorno
google_fonts:           # Fuentes
shimmer:                # Efecto de carga
flutter_spinkit:        # Spinners
lottie:                 # Animaciones
```

## 📁 Estructura del Proyecto

```
lib/
├── main.dart                      # Punto de entrada
├── config/
│   └── app_config.dart           # Configuración global
├── models/
│   ├── usuario.dart              # Usuario y Rol
│   └── horario.dart              # Horario y entidades relacionadas
├── services/
│   ├── api_client.dart           # Cliente HTTP (Dio)
│   ├── auth_service.dart         # Autenticación Supabase
│   └── horario_service.dart      # Llamadas API de horarios
├── providers/
│   ├── auth_provider.dart        # Provider de autenticación
│   └── horario_provider.dart     # Provider de horarios
├── screens/
│   ├── login_screen.dart         # Pantalla de login
│   └── home_screen.dart          # Pantalla de horarios
└── widgets/
    └── horario_card.dart         # Tarjeta de horario reutilizable
```

## 🔐 Autenticación

La app usa **Supabase Auth** — el mismo servicio que el backend. No requiere registro separado:

1. El usuario inicia sesión con email/contraseña
2. Supabase genera un JWT access token
3. El token se envía automáticamente en cada request al backend (vía interceptor en `ApiClient`)
4. El backend valida contra Supabase Auth

### Variables de Entorno (`.env`)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Para desarrollo local:
- `SUPABASE_*`: obtenén de https://app.supabase.com/project/[project-id]/settings/api
- `API_BASE_URL`: apunta a tu backend local (por defecto `http://127.0.0.1:8000`)

## 🏗️ Arquitectura

### State Management (Provider)

- **`AuthProvider`**: sesión del usuario, login/logout
- **`HorarioProvider`**: horarios cargados, estado de carga, errores

Ambos son globales (inicializados en `main.dart`) y accesibles desde cualquier pantalla via `context.read()` o `Consumer`.

### Cliente API

`ApiClient` es un wrapper sobre Dio que:
1. **Adjunta token automáticamente** (interceptor `AuthInterceptor`)
2. **Maneja errores comunes** (interceptor `ErrorInterceptor`)
3. **Parsea respuestas** a modelos Dart fuerte tipados

Métodos disponibles:
```dart
await apiClient.get<T>(path)
await apiClient.post<T>(path, data: body)
await apiClient.put<T>(path, data: body)
await apiClient.delete<T>(path)
```

## 🎯 Flujo de una Request

```
[Usuario hace tap] → HomeScreen llama HorarioProvider.cargarHorarios()
  → HorarioService.obtenerMiHorario() → ApiClient.get("/ficha-usuario/mi-horario")
    → AuthInterceptor adjunta Bearer token
    → Dio envía GET https://...api/v1/ficha-usuario/mi-horario
    → Backend valida token contra Supabase, responde con [HorarioResponse...]
    → ApiClient parsea a List<Horario>
    → HorarioProvider notifica listeners
  → UI se reconstruye con horarios
```

## 🚀 Desarrollo Local

### Requisitos

- Flutter 3.12.2 o superior
- Android Studio / VS Code con Flutter extension
- Emulador o dispositivo físico

### Setup

```bash
cd mobile
flutter pub get
cp .env.example .env
# Edita .env con credenciales reales de Supabase
flutter run
```

### Debug

```bash
# Modo verbose
flutter run -v

# Hot reload en vivo (tecla 'r')
# Hot restart (tecla 'R')
```

## 🧪 Testing

Endpoint de prueba (si el backend está levantado):

```bash
curl -H "Authorization: Bearer <token-supabase>" \
  http://127.0.0.1:8000/api/v1/ficha-usuario/mi-horario
```

## 🔗 Endpoints Consumidos

| Endpoint | Rol | Descripción |
|----------|-----|------------|
| `POST /auth/v1/token` | - | Login (via Supabase SDK) |
| `GET /usuarios/me` | Any | Usuario actual |
| `GET /ficha-usuario/mi-horario` | Aprendiz | Horarios de su ficha |
| `GET /usuarios/me/horarios` | Instructor | Sus horarios asignados |

## 🎨 Diseño

La app usa **Material Design 3** con tema claro/oscuro automático según preferencias del sistema.

## 📝 Notas

- Los horarios son de **lectura solamente** — la edición sigue siendo en el web (Coordinadores)
- Los cambios en el backend se reflejan en la app en el siguiente refresh
- El token de Supabase se renueva automáticamente cuando expira (30 min default)
- La app cachea los horarios en memoria (se pierden al cerrar sesión)

---

**Última actualización**: Septiembre 2026
**Versión**: 0.1.0
