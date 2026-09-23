# PROMPT: LoginScreen para SIHS Mobile (Flutter)

## Contexto
Pantalla de autenticación para la app móvil de SIHS. Instructores y aprendices inician sesión con email + contraseña (Supabase Auth).

---

## 🎨 Diseño del Sistema (Material Design 3 + SIHS)

### Paleta de Colores
- **Primary**: #16a34a (verde SENA claro) / #4ade80 (oscuro)
- **Secondary**: #39a900 (verde SENA oscuro) / #6fdf43 (muy oscuro)
- **Tertiary (accent)**: #d97706 (naranja) / #fbbf24 (oscuro)
- **Error**: #dc2626 (rojo) / #f87171 (oscuro)
- **Surface light**: #f8fafc → #ffffff
- **Surface dark**: #0f172a → #1e293b
- **Text light**: #0f172a
- **Text dark**: #f1f5f9

### Tipografía
- **Display/Títulos**: "Hanken Grotesk", bold (600-700)
- **Body/Contenido**: "Geist", regular (400), semibold (600)
- **Estilos en Flutter**: `Theme.of(context).textTheme.headlineLarge`, `.titleMedium`, `.bodyLarge`, `.labelSmall`

### Spacing & Radius
- Padding default: 16dp
- Border radius: 12-16dp
- Componentes: 48-56dp de alto mínimo

---

## 📱 Estructura de la Pantalla

### 1. **Header (encabezado)**
- Gradiente de fondo: Primary → Primary Container (izq→der o arriba→abajo)
- Logo/Branding SIHS en el centro (o recortado en esquina)
- Título grande: "SIHS"
- Subtítulo: "Sistema de Información"
- Altura: ~140-180dp

**Tono**: Profesional, moderno, invita a ingresar.

### 2. **Formulario (tarjeta blanca/container)**
- Fondo: Surface Bright (#ffffff light / #334155 dark)
- Border radius: 16dp
- Padding: 24dp
- Box shadow: sutil (elevation 2-3)

**Campos**:
- Email: TextField con prefijo `@` icon
  - Placeholder: "Correo electrónico"
  - Keyboard: email
  - Validación: required, email format
  
- Contraseña: TextField con prefijo `🔒` icon
  - Placeholder: "Contraseña"
  - Obscure text por defecto (mostrar/ocultar toggle con icon eye)
  - Keyboard: default (no auto-suggest)

**Espaciado**: 16dp entre campos

### 3. **Botón de Login**
- Estilo: **Filled Button** (full width)
- Foreground: OnPrimary (#ffffff)
- Background: Primary (#16a34a)
- Altura: 48-56dp
- Texto: "Iniciar sesión" (bold, 16sp)
- Icon izquierda: login arrow
- Loading state: mostrar spinner adentro (sustituyendo icon)
- Disabled state: opacity 0.6, no clickeable

**Margin top**: 24dp desde contraseña

### 4. **Footer (pie)**
- Divider horizontal (color: OutlineVariant)
- Texto pequeño: "¿No tienes cuenta? [Registrarse]" (opcional, si habrá registro)
- Align: center
- Margin top: 16-24dp desde botón
- Color texto: OnSurfaceVariant (#475569 light / #cbd5e1 dark)

---

## 🎬 Estados & Interacciones

### Estado 1: **Idle**
- Formulario vacío
- Botón habilitado
- Icono de login visible

### Estado 2: **Focus**
- Campo enfocado: border + shadow, texto cursor visible
- Hint text desaparece cuando empieza a escribir

### Estado 3: **Loading**
- Botón deshabilitado
- Spinner girando dentro del botón (reemplazando icon)
- Campos de input deshabilitados (no se pueden editar)
- Texto: "Iniciando sesión..."

### Estado 4: **Error**
- Mostrar snackbar/banner ROJO encima del formulario (o debajo de campo error)
- Mensaje: "Error al iniciar sesión: [detalle]"
- Botón vuelve a estar habilitado
- Opción: X para cerrar el error

### Estado 5: **Success**
- Transición suave a siguiente pantalla (HomeScreen)
- Animación: fade out + slide (opcional)

---

## 🎭 Animaciones Sugeridas

- **Entrada de pantalla**: Fade in (300ms)
- **Focus de inputs**: Slight scale up + shadow (200ms)
- **Botón press**: Ripple effect (Material default)
- **Loading spinner**: Rotate continuous (smooth)
- **Error aparece**: Slide down desde top (200ms) + shake ligero
- **Success**: Fade out (300ms)

---

## 📐 Layout Grid

```
Top Safe Area (16dp padding)
├─ Header Gradient (140dp)
│  ├─ Logo SIHS (48x48dp)
│  ├─ "SIHS" (headline large)
│  └─ "Sistema de Información" (title medium, secondary)
│
├─ Spacer (24dp)
│
├─ Card Blanca (360dp wide, center)
│  ├─ Email TextField (56dp)
│  ├─ Spacer (16dp)
│  ├─ Password TextField (56dp)
│  ├─ Spacer (24dp)
│  ├─ Login Button (48dp)
│  ├─ Spacer (16dp)
│  └─ "Registrarse" link (24dp)
│
└─ Bottom Safe Area (16dp padding)
```

**Responsive**: 
- En pantallas chicas (< 600dp ancho): ajustar padding/margins a 12dp
- Card width: min(360dp, screen_width - 32)

---

## ✅ Checklist de Implementación

- [ ] Gradiente en header (Primary → Primary Container)
- [ ] Formulario en Card con border radius 16dp
- [ ] Email textfield con validación
- [ ] Password textfield con toggle show/hide
- [ ] Filled button full width con loading state
- [ ] Error snackbar/banner con styling rojo
- [ ] Safe areas respetados (top + bottom)
- [ ] Dark mode support (colores ajustados automáticamente)
- [ ] Animaciones entrada/salida
- [ ] Responsive (tablet/landscape)

---

## 📝 Notas Técnicas

- **Controladores**: Email y password TextEditingController (ya en LoginScreen.dart)
- **Validación**: en handleLogin() antes de enviar (email no vacío, 8+ chars password)
- **API call**: `AuthProvider.signIn(email, password)` retorna true/false
- **Error handling**: mostrar `AuthProvider.error` en snackbar
- **Navigation**: automática cuando `AuthProvider.isAuthenticated` = true

---

**Referencia web**: Buscar "SIHS Iniciar sesión" en el frontend web para inspiración visual.
