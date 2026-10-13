# Arquitectura: Cliente Móvil Flutter

## Decisión de Arquitectura

El sistema SIHS ahora tiene **tres clientes** consumiendo el mismo backend:
1. **Web (React/Vite)** — Coordinadores/Administradores (programación de horarios)
2. **Móvil (Flutter)** — Instructores/Aprendices (visualización de horarios)
3. **Backend (FastAPI)** — Lógica de negocio compartida

### Principio: Un Backend, Múltiples Clientes

- **Backend centralizado**: toda lógica vive en `backend/app/services/`
- **Móvil es read-only**: instructores y aprendices VEN horarios, no los editan
- **Misma autenticación**: Supabase Auth (JWT)
- **Misma BD**: PostgreSQL en Supabase
- **Reutilización de endpoints**: el móvil solo consume `GET /ficha-usuario/mi-horario` y `GET /usuarios/me/horarios`

---

## Estructura del Monorepo Actualizada

```
SIHS/
├── backend/        # FastAPI (todos los clientes lo usan)
├── frontend/       # React Web (Coordinadores/Admins)
├── mobile/         # Flutter (Instructores/Aprendices - READ-ONLY)
└── database/       # Supabase (BD compartida)
```

### Ventajas

✅ **Sincronización trivial** — cambios en API backend se usan en web + móvil inmediatamente
✅ **Un solo lugar para lógica** — no hay duplicación entre clientes
✅ **CI/CD unificado** — builds en paralelo para backend, web, móvil
✅ **Versionado atómico** — un commit afecta backend + clientes si es necesario

### Desventajas (controladas)

⚠️ **Repo más pesado** — `git clone` es más lento (mitigado con `.gitignore` en `mobile/`)
⚠️ **Builds pueden fallar en paralelo** — un bug en Android build no bloquea web (manejado con GitHub Actions)

---

## Stack Técnico: Móvil

| Capa | Tecnología |
|------|-----------|
| **Framework** | Flutter 3.12+ (Dart) |
| **UI** | Material Design 3 |
| **State** | Provider 6.4.0 |
| **HTTP** | Dio 5.6.0 + Interceptores |
| **Auth** | Supabase Flutter 2.7.0 |
| **Config** | flutter_dotenv |
| **Animaciones** | Shimmer, Lottie, SpinKit |

---

## Flujo de Datos

### Login
```
User (app) → LoginScreen.signIn()
  ↓
AuthProvider.signIn(email, password)
  ↓
AuthService.signInWithEmail()
  ↓
Supabase.auth.signInWithPassword()
  → SUPABASE_URL/auth/v1/token
  ← access_token + refresh_token
  ↓
AuthProvider notifica listeners
  ↓
HomeScreen se construye
```

### Cargar Horarios
```
HomeScreen.initState() → HorarioProvider.cargarHorarios(usuario)
  ↓
Si usuario.esAprendiz:
  HorarioService.obtenerMiHorario()
    ↓
    ApiClient.get("/ficha-usuario/mi-horario")
      ↓
      AuthInterceptor adjunta "Authorization: Bearer <token>"
      ↓
      Dio.get("https://api.../ficha-usuario/mi-horario")
      ← [HorarioResponse]
      ↓
    Parsea a List<Horario>
    ↓
HorarioProvider.notifyListeners()
  ↓
HomeScreen.Consumer<HorarioProvider> se reconstruye
  ↓
HorarioCard widgets muestran datos
```

---

## Estructura Interna: lib/

```
lib/
├── main.dart                  # WidgetsApp + Provider setup
│
├── config/
│   └── app_config.dart       # SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE_URL
│
├── models/
│   ├── usuario.dart          # Usuario { id, nombre, email, roles[] }
│   └── horario.dart          # Horario { id, dia, horaInicio, horaFin, ficha, instructor, ambiente }
│
├── services/
│   ├── api_client.dart       # HTTP wrapper (Dio + AuthInterceptor + ErrorInterceptor)
│   ├── auth_service.dart     # Supabase Auth { signIn, signOut, currentSession }
│   └── horario_service.dart  # API calls { obtenerMiHorario, obtenerHorariosInstructor }
│
├── providers/
│   ├── auth_provider.dart    # ChangeNotifier { isAuthenticated, usuarioActual, signIn, signOut }
│   └── horario_provider.dart # ChangeNotifier { horarios[], isLoading, error, cargarHorarios }
│
├── screens/
│   ├── login_screen.dart     # Email/Password form
│   └── home_screen.dart      # List de horarios
│
└── widgets/
    └── horario_card.dart     # Tarjeta de un horario (reutilizable)
```

---

## Ciclo de Desarrollo

### Agregar un Endpoint Nuevo (ej: ver carga semanal de instructor)

**Backend** (primero):
```python
# backend/app/api/v1/usuarios.py
@router.get("/me/carga-semanal", response_model=CargaSemanalResponse)
def obtener_carga_semanal(usuario: Usuario = Depends(require_instructor)):
    ...
```

**Móvil**:
1. Actualizar `models/usuario.dart` si necesita campos nuevos
2. En `services/horario_service.dart`:
   ```dart
   Future<CargaSemanal> obtenerCargaSemanal() async {
     final response = await _apiClient.get<Map<String, dynamic>>(
       '/usuarios/me/carga-semanal',
     );
     return CargaSemanal.fromJson(response);
   }
   ```
3. Crear `providers/carga_provider.dart` con estado
4. Nueva pantalla `screens/carga_screen.dart`
5. Agregar tab en `home_screen.dart` o menú lateral

No hay que cambiar auth ni cliente HTTP — reutiliza todo.

---

## Testing

### Setup Local para Testing

```bash
# Terminal 1: Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Terminal 2: Móvil
cd mobile
flutter pub get
cp .env.example .env
# Edita .env con SUPABASE_URL real, API_BASE_URL=http://127.0.0.1:8000/api/v1
flutter run
```

### Verificar Login
```bash
# Mismo usuario de prueba que web (ver database/README.md)
email: aprendiz@sena.edu.co
password: (la que figura en database/README.md)
```

---

## Notas

1. **CORS**: El backend ya está configurado para aceptar clientes de cualquier origen (necesario para móvil en Android emulator)
2. **Token refresh**: Supabase maneja automáticamente — si el access token expira, el refresh token lo renueva
3. **Horarios cachados**: Viven en `HorarioProvider` en memoria — se limpian al logout
4. **Offline-first**: En el futuro se puede agregar SQLite local con Drift
5. **Múltiples plataformas**: El mismo código Flutter corre en iOS, Android, Web (con ajustes mínimos de UI)

---

**Última actualización**: Septiembre 2026
**Versión**: 1.0 de decisión arquitectónica
