# SIHS Mobile - Brand Guide & Design System

## 📋 Resumen Ejecutivo

App móvil de SIHS para instructores y aprendices. **Lectura solo horarios**, no edición. Backend centralizado, clientes múltiples.

**Stack**: Flutter + Dart, Material Design 3, Supabase Auth.

---

## 🎨 Identidad Visual

### Paleta de Colores (Material Design 3)

#### **Modo Claro (Light)**
```
Primary        #16a34a  (Verde SENA - acciones principales)
On Primary     #ffffff  (Texto sobre primary)
Primary Cont   #dcfce7  (Fondo secundario, más suave)
On Primary Ct  #14532d  (Texto sobre container)

Secondary      #39a900  (Verde más oscuro - énfasis)
On Secondary   #ffffff
Secondary Ct   #eaf7ec
On Secondary Ct #14532d

Tertiary       #d97706  (Naranja - warnings/accents)
On Tertiary    #ffffff
Tertiary Cont  #fef3c7
On Tertiary Ct #92400e

Error          #dc2626  (Rojo - errores)
On Error       #ffffff
Error Cont     #fee2e2
On Error Cont  #991b1b

Surface        #f8fafc  (Gris muy claro - base)
Surface Dim    #e2e8f0  (Gris claro)
Surface Cont   #e2e8f0  (Contenedor)
On Surface     #0f172a  (Negro azulado - texto principal)
On Surf Var    #475569  (Gris - texto secundario)
```

#### **Modo Oscuro (Dark)**
```
Primary        #4ade80  (Verde brillante)
On Primary     #052e13  (Negro oscuro)
Primary Cont   #14532d  (Verde oscuro fondo)

Secondary      #6fdf43  (Verde muy brillante)
Tertiary       #fbbf24  (Naranja brillante)
Error          #f87171  (Rojo claro)

Surface        #0f172a  (Azul muy oscuro - base)
Surface Dim    #1e293b  (Azul oscuro)
On Surface     #f1f5f9  (Gris claro - texto)
On Surf Var    #cbd5e1  (Gris más claro)
```

**Regla**: 
- Primary para botones, links, highlights
- Tertiary para warnings, detalles opcionales
- Error solo para errores/validaciones
- OnSurfaceVariant para texto secundario/disabled

---

### Tipografía

```
Display/Títulos
├─ Font: "Hanken Grotesk"
├─ Weight: 600-700 (bold/semibold)
├─ Size: 32-48sp
└─ Uso: AppBar, títulos pantalla, headers grandes

Body/Contenido
├─ Font: "Geist" (fallback: system-ui, sans-serif)
├─ Weight: 400-600 (regular/semibold)
├─ Size: 14-16sp
└─ Uso: párrafos, labels, detalles

En Flutter:
├─ Theme.textTheme.displayLarge    → Hanken Bold 48sp
├─ Theme.textTheme.headlineSmall   → Hanken Bold 24sp
├─ Theme.textTheme.titleMedium     → Hanken 600 16sp
├─ Theme.textTheme.bodyLarge       → Geist 600 16sp
├─ Theme.textTheme.bodySmall       → Geist 400 12sp
└─ Theme.textTheme.labelSmall      → Geist 600 11sp
```

---

### Espaciado (Material Design 3 Scale)

```
8px   → space-1   (ínfimo, entre elementos)
12px  → space-1.5 (pequeño, dentro de grupos)
16px  → space-2   → ESTÁNDAR (padding default)
24px  → space-3   (grande, entre secciones)
32px  → space-4   (muy grande, entre áreas)
48px  → space-6   (gigante, entre pantallas)

En Flutter:
EdgeInsets.all(16)              // estándar
EdgeInsets.symmetric(h: 16, v:  // bordes
SizedBox(height: 16)            // espaciadores
```

---

### Border Radius

```
4px   → pequeños botones, inputs
8px   → campos de texto
12px  → tarjetas, containers normales
16px  → containers grandes, sheets
24px  → overlays, dialogs
rounded → fully rounded (56dp buttons)

En Flutter:
BorderRadius.circular(12)
BorderRadius.only(topLeft: Radius.circular(16), ...)
```

---

### Elevation / Shadows

```
Elevation 0    → flat, no sombra
Elevation 1    → sutil (cards)
Elevation 2-3  → modales, FABs
Elevation 4    → dialogs
Elevation 8+   → overlays importantes

En Flutter:
Card(elevation: 1)
BoxDecoration(boxShadow: [BoxShadow(blurRadius: 8, ...)])
```

---

## 🎬 Componentes Reutilizables

### 1. **Filled Button**
```dart
FilledButton(
  onPressed: isEnabled ? onTap : null,
  style: FilledButton.styleFrom(
    backgroundColor: Colors.primary,
    foregroundColor: Colors.onPrimary,
    padding: EdgeInsets.symmetric(vertical: 16),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
  ),
  child: Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      if (isLoading) SizedBox(
        width: 20, height: 20,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      if (!isLoading) Icon(Icons.check),
      SizedBox(width: 8),
      Text(label, style: TextStyle(fontWeight: FontWeight.w600)),
    ],
  ),
)
```
**Uso**: Login, acciones principales, confirmaciones.

### 2. **TextField**
```dart
TextField(
  enabled: !isLoading,
  obscureText: hideText,
  keyboardType: TextInputType.emailAddress,
  decoration: InputDecoration(
    labelText: 'Correo electrónico',
    prefixIcon: Icon(Icons.email_outlined),
    suffixIcon: hideText ? Icon(Icons.visibility) : null,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
    ),
    contentPadding: EdgeInsets.symmetric(vertical: 16, horizontal: 12),
  ),
)
```
**Uso**: Formularios de login, búsqueda.

### 3. **Card (Horario)**
```dart
Card(
  elevation: 1,
  borderRadius: BorderRadius.circular(12),
  margin: EdgeInsets.symmetric(vertical: 6),
  child: InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(12),
    child: Padding(
      padding: EdgeInsets.all(16),
      child: Column(...),
    ),
  ),
)
```
**Uso**: Listar horarios, mostrar bloques de información.

### 4. **Chip / Badge**
```dart
Container(
  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
  decoration: BoxDecoration(
    color: isPub ? primaryContainer : Colors.grey[300],
    borderRadius: BorderRadius.circular(8),
  ),
  child: Text(
    label,
    style: Theme.of(context).textTheme.labelSmall,
  ),
)
```
**Uso**: Estados (Publicado/Borrador), tags.

### 5. **Bottom Sheet**
```dart
showModalBottomSheet(
  context: context,
  builder: (context) => Container(
    padding: EdgeInsets.all(24),
    child: Column(...),
  ),
  shape: RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
  ),
)
```
**Uso**: Detalles de horario, confirmar acciones.

### 6. **Snackbar (Error)**
```dart
ScaffoldMessenger.of(context).showSnackBar(
  SnackBar(
    content: Text(message),
    backgroundColor: Colors.error,
    duration: Duration(seconds: 4),
    action: SnackBarAction(
      label: 'Cerrar',
      onPressed: () {},
    ),
  ),
)
```
**Uso**: Errores, notificaciones.

---

## 🎯 Patrones de Interacción

### **Loading State**
- Spinner circular Material
- Deshabilitado campos/botones
- Texto: "Cargando..." o "Iniciando sesión..."
- Duración típica: 1-3 segundos

### **Error State**
- Snackbar rojo (Error color) encima del contenido
- Mensaje legible en blanco
- Auto-dismiss 4 segundos
- Botón cerrar/reintentar (opcional)

### **Empty State**
- Icono centrado (48-64dp)
- Texto descriptivo (body medium)
- Botón "Reintentar" o "Agregar" (contexto)

### **Success Animation**
- Transición suave (fade/slide)
- Duración: 300ms
- Notificación visual breve (no intrusiva)

---

## 📐 Responsive Design

### **Breakpoints** (Material Design 3)
```
Compact   < 600dp width  (mobile)
Medium    600-840dp      (tablet pequeña)
Expanded  > 840dp        (tablet/desktop)
```

**En mobile (< 600dp)**:
- Padding: 16dp (estándar)
- Card width: full - 32
- Font sizes: no cambios
- Layout: single column

**En tablet (≥ 600dp)**:
```
Opcional: grid layout con 2 columnas
Padding: 24dp sides
Max width cards: 400dp
```

---

## 🌗 Dark Mode

El tema oscuro se activa automáticamente según preferencia del sistema.

```dart
// En main.dart
darkTheme: ThemeData(
  colorScheme: ColorScheme.fromSeed(
    seedColor: Color(0xFF4ade80),  // Primary green (dark)
    brightness: Brightness.dark,
  ),
  useMaterial3: true,
),
```

**Checklist dark mode**:
- [ ] Colores surface oscuros verificados
- [ ] Texto legible en fondo oscuro
- [ ] Imágenes/logos no desaparecen
- [ ] Inputs visible (border color)
- [ ] Shadows sutiles

---

## 🎨 Guía de Uso por Pantalla

### **LoginScreen**
- Header: Gradiente Primary → PrimaryContainer
- Formulario: Card blanca (Surface Bright)
- Botón: Filled Button Primary
- Error: Snackbar rojo
- Animación: Fade in 300ms

### **HomeScreen**
- AppBar: Primary background
- Welcome card: Primary Container
- Horarios: Card list con staggered animation
- Bottom sheet: Detalles con bordas 16dp
- Pull-to-refresh: Spinner Primary

---

## ✅ Checklist Visual

- [ ] Colores primarios (#16a34a light, #4ade80 dark) aplicados
- [ ] Fuentes Hanken (títulos) + Geist (body) usadas
- [ ] Spacing estándar 16dp respetado
- [ ] Border radius 12-16dp en containers
- [ ] Material Design 3 components (FilledButton, Card, TextField)
- [ ] Dark mode funcionando
- [ ] Animaciones suaves (300-500ms)
- [ ] Safe areas (notch, home indicator)
- [ ] Responsive layout (mobile/tablet)
- [ ] Accesibilidad (contraste, sizes mínimas)

---

## 📚 Referencias

- **Material Design 3**: https://material.io
- **Flutter Material Components**: https://flutter.dev/docs/development/ui/widgets/material
- **SIHS Web Frontend**: `/home/david/Proyectos/Develop-SIHS/frontend/src/index.css` (color tokens)

---

**Versión**: 1.0  
**Última actualización**: Septiembre 2026
