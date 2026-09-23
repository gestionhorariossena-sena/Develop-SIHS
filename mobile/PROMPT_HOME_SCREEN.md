# PROMPT: HomeScreen para SIHS Mobile (Flutter)

## Contexto
Pantalla principal post-login. Instructores y aprendices ven SUS horarios en una lista bonita, animada, fácil de explorar. **Read-only** — no se editan acá, solo se visualizan.

---

## 🎨 Diseño del Sistema (Material Design 3 + SIHS)

### Paleta de Colores
*(Idéntica a LoginScreen)*
- **Primary**: #16a34a (verde SENA claro) / #4ade80 (oscuro)
- **Secondary**: #39a900 / #6fdf43
- **Tertiary**: #d97706 (naranja) / #fbbf24
- **Success**: verde (para "publicado")
- **Draft**: gris (para "borrador")
- **Surface light**: #f8fafc → #ffffff
- **Surface dark**: #0f172a → #1e293b

### Tipografía
- **Display/Títulos**: "Hanken Grotesk", bold (600-700)
- **Body**: "Geist", regular (400-600)

---

## 📱 Estructura de la Pantalla

### 1. **AppBar (encabezado)**
- Altura: 56dp (default Material)
- Fondo: Primary (#16a34a light) / Primary (#4ade80 dark)
- Título: "Mi Horario" (bold, white/OnPrimary)
- **Actions (derecha)**:
  - Refresh icon (circular button) → recarga horarios
  - Más opciones menu (3 dots) → "Cerrar sesión"

**Estilo**: Elevation 0 (sin sombra, flat)

---

### 2. **Header Info (debajo AppBar)**
- **Card/Container** con fondo Primary Container (#dcfce7 light / #14532d dark)
- Padding: 16dp
- Texto: "Bienvenido, [nombre usuario]" (title medium, bold)
- Subtext: "Instructor" o "Aprendiz" (body small, secondary color)
- Icono: usuario profile (opcional)
- Border radius: 12dp
- Margin: 16dp sides, top 16dp

**Tono**: Cálido, personal, profesional.

---

### 3. **Horarios List (contenido principal)**

#### **Empty State** (si no hay horarios)
- Icono grande: calendar icon (64dp, grayed)
- Texto: "No hay horarios disponibles"
- Body small, centered
- Margin top: 32dp desde header info

#### **Loading State** (mientras carga)
- Spinner circular (Material default)
- Centrado en pantalla
- Backdrop shimmer en tarjetas (skeleton loaders)

**3 skeleton cards** (efecto carga):
```
[░░░░░░ Día ░░░░░░] [░░ 09:00 ░░]
[░░░░░░░░ Ficha ░░░░░░░░]
[░░░░░░░░ Ambiente ░░░░░░░░]
```

#### **Tarjetas de Horario** (HorarioCard widget)

Cada tarjeta contiene:

**Encabezado de tarjeta**:
```
┌─────────────────────────────────┐
│ Lunes        [Publicado]        │
│ 09:00 a 11:30                   │
└─────────────────────────────────┘
```

- **Día**: Bold, body large (#0f172a light)
- **Hora**: Semibold, large, Primary color (#16a34a)
- **Badge**: Secondary color container (#eaf7ec) con text pequeño
  - "Publicado" → verde
  - "Borrador" → gris

**Divisor**: Línea fina (color outline)

**Detalles (abajo)**:
```
📖 Ficha:     [nombre ficha]
📍 Ambiente:  [ambiente]
👤 Instructor: [nombre] (solo si no es instructor viendo su propio horario)
```

- Icons pequeños (16-18dp)
- Texto: body small, on-surface-variant
- Máximo 3 filas (overflow ellipsis)
- Row layout: icon + label + value

**Spacing**: 8dp entre filas de detalles

**Bottom Sheet (tap en tarjeta)**:
- Abre modal con detalles completos
- Título: "Detalles del Horario"
- Muestra todos los campos (Día, Hora, Ficha, Ambiente, Instructor, Observaciones)
- Botón "Cerrar" filled button primary

---

### 4. **Interactividad**

**Tap en tarjeta**: Abre bottom sheet con detalles completos

**Swipe down**: Pull-to-refresh (recargar horarios)

**Refresh button (AppBar)**: Recarga horarios con loading state

**Logout (menu)**: Cierra sesión, vuelve a LoginScreen

---

## 🎬 Estados & Animaciones

### Estado 1: **Loaded (lista visible)**
- Tarjetas apiladas verticalmente
- Scroll habilitado si hay más de 4 horarios
- Entrada: Fade in staggered (cada tarjeta entra 100ms después de la anterior)

### Estado 2: **Pull-to-Refresh**
- Indicador de refresh visible arriba
- Spinner rotando
- Dureza: 300-500ms
- Al terminar: snap back, lista se actualiza

### Estado 3: **Empty**
- Centered icon + text
- Botón "Reintentar" (opcional)

### Estado 4: **Error**
- Banner rojo en top (o snackbar)
- Mensaje de error legible
- Opción cerrar/reintentar
- Lista anterior sigue visible de fondo

---

## 🎨 Animaciones Sugeridas

- **Entrada tarjetas**: Staggered fade in + slide up (100ms cada una)
- **Tap tarjeta**: Scale 0.98 → 1.0 (ripple effect)
- **Bottom sheet**: Slide up desde bottom (300ms)
- **Refresh spinner**: Rotate continuous smooth
- **Error banner**: Slide down de top (200ms)
- **Pull-to-refresh**: Deceleration smooth
- **Logout transition**: Fade out pantalla (200ms)

---

## 📐 Layout Grid

```
┌─ Top Safe Area
│
├─ AppBar (56dp)
│  ├─ "Mi Horario" title
│  └─ Refresh + Menu icons
│
├─ Welcome Card (88dp)
│  ├─ "Bienvenido, [nombre]" (title medium)
│  └─ "Instructor/Aprendiz" (body small)
│
├─ List ScrollView (rest)
│  ├─ HorarioCard (140dp each)
│  │  ├─ Header row (32dp)
│  │  ├─ Divider (1dp)
│  │  └─ Details rows (3 x ~20dp = 60dp)
│  │
│  ├─ Spacer (12dp)
│  ├─ [next card...]
│  └─ Bottom padding (16dp)
│
└─ Bottom Safe Area
```

**Responsive**:
- Card width: full - 32dp margins (left + right)
- Icon size: 18dp base
- Texto: no overflow, truncate with ellipsis

---

## 🔄 Flujos de Usuario

### Flujo 1: Ver horarios
```
HomeScreen carga
  → HorarioProvider.cargarHorarios()
  → Loading spinner
  → [1-2 segundos]
  → Tarjetas aparecen (staggered)
  → Usuario scroll/ve lista
```

### Flujo 2: Ver detalles de un horario
```
Usuario tap tarjeta
  → BottomSheet aparece
  → Muestra todos los detalles
  → Usuario cierra (tap close o swipe down)
  → Vuelve a lista
```

### Flujo 3: Refrescar horarios
```
Usuario pull-to-refresh (o tap refresh icon)
  → Spinner visible
  → Loading state
  → [1-2 segundos]
  → Lista actualiza (staggered)
  → Refresh completa
```

### Flujo 4: Logout
```
Usuario tap menu → "Cerrar sesión"
  → Diálogo confirmar (opcional)
  → Fade out HomeScreen
  → LoginScreen aparece
```

---

## ✅ Checklist de Implementación

- [ ] AppBar con Primary color, título, refresh + menu
- [ ] Welcome card con Primary Container, nombre usuario + rol
- [ ] HorarioCard componente reutilizable
  - [ ] Header con Día + Hora + Badge (Publicado/Borrador)
  - [ ] Divider
  - [ ] 3 filas de detalles (icon + label + value)
  - [ ] Tap → bottom sheet
- [ ] List view con scroll
- [ ] Loading state (spinner + skeleton cards)
- [ ] Empty state (icon + texto)
- [ ] Error state (snackbar rojo + retry)
- [ ] Pull-to-refresh (swipe down)
- [ ] Refresh button (AppBar)
- [ ] Logout en menu
- [ ] Dark mode support
- [ ] Animaciones entrada/scroll/tap
- [ ] Safe areas (top + bottom)
- [ ] Responsive (tablet/landscape)

---

## 📝 Notas Técnicas

- **Data source**: `HorarioProvider.horarios` (List<Horario>)
- **Loading**: `HorarioProvider.isLoading`
- **Error**: `HorarioProvider.error`
- **Refresh trigger**: `HorarioProvider.cargarHorarios(usuario)`
- **Navigation**: `AuthProvider.signOut()` → auto-redirige a LoginScreen
- **Modelo Horario**: tiene fields: dia, horaInicio, horaFin, ficha, instructor, ambiente, publicado

---

## 🎯 Diferenciación por Rol

### Si usuario.esAprendiz:
- Botón logout visible
- Muestra su ficha + horarios asignados
- Instructor puede estar vacío (no siempre tiene)

### Si usuario.esInstructor:
- Botón logout visible
- Muestra sus horarios asignados (dónde es instructor)
- Ficha no es relevante (omitir o grisear)

**Ambos**: mismo diseño de tarjeta, mismo flujo.

---

**Referencia web**: Buscar "SIHS Dashboard" en frontend web para inspiración de cómo se ve horario ahí.
**Referencia Material 3**: https://material.io/components (Material Design 3 specs)
