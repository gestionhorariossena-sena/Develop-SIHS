# SIHS Mobile - Prompts para Stitch IA

Este documento consolida los prompts y guías para diseñar la versión móvil en Stitch IA.

---

## 📁 Archivos de Referencia

1. **`BRAND_GUIDE_SIHS_MOBILE.md`** ← **EMPEZAR AQUÍ**
   - Paleta de colores (claro/oscuro)
   - Tipografía
   - Componentes reutilizables
   - Patrones de interacción
   - Responsive design

2. **`PROMPT_LOGIN_SCREEN.md`**
   - Estructura detallada de LoginScreen
   - Estados (idle, loading, error, success)
   - Animaciones
   - Checklist

3. **`PROMPT_HOME_SCREEN.md`**
   - Estructura de HomeScreen
   - Tarjetas de horario
   - Bottom sheet
   - Flujos de usuario
   - Diferenciación por rol

---

## 🎯 Flujo de Trabajo Sugerido

### Paso 1: Brand Guide
Lee `BRAND_GUIDE_SIHS_MOBILE.md` completo. Entiende:
- ✅ Colores primarios y secundarios
- ✅ Fuentes (Hanken + Geist)
- ✅ Espaciado (16dp estándar)
- ✅ Border radius (12-16dp)
- ✅ Componentes (Button, TextField, Card, etc.)

### Paso 2: LoginScreen en Stitch
Lee `PROMPT_LOGIN_SCREEN.md`. Copia el contexto y:
```
[Pegar en Stitch]

## Contexto
Pantalla de autenticación para la app móvil SIHS...

## 🎨 Diseño del Sistema
[Pegar paleta + tipografía...]

## 📱 Estructura de la Pantalla
[Pegar secciones...]

[... resto del documento ...]
```

Diseña la pantalla. Genera mockup/figma link.

### Paso 3: HomeScreen en Stitch
Idem paso 2, pero con `PROMPT_HOME_SCREEN.md`.

### Paso 4: Iteración
- Si necesitas cambios: refina el prompt, regenera
- Ajusta colores, spacing, animaciones
- Verifica contra `BRAND_GUIDE_SIHS_MOBILE.md`

---

## 🎨 Resumen de Marca (Quick Reference)

### Colores
- **Primary**: Verde SENA #16a34a (light) / #4ade80 (dark)
- **Secondary**: Verde oscuro #39a900 / #6fdf43
- **Tertiary**: Naranja #d97706 / #fbbf24
- **Error**: Rojo #dc2626 / #f87171
- **Surface**: Gris claro #f8fafc (light) / Azul oscuro #0f172a (dark)

### Tipografía
- Títulos: **Hanken Grotesk** (bold 600-700)
- Body: **Geist** (regular 400, semibold 600)

### Espaciado
- Estándar: **16dp** (padding, margins)
- Pequeño: 8-12dp (entre elementos)
- Grande: 24-32dp (entre secciones)

### Corners
- Cards/inputs: **12dp**
- Containers grandes: **16dp**
- Botones: **12dp**

### Material Design 3
- Filled buttons (Primary color)
- Outlined inputs (border)
- Cards con elevation 1
- Bottom sheets 16dp radius

---

## ✅ Checklist por Pantalla

### **LoginScreen**
```
[ ] Gradiente header (Primary → Primary Container)
[ ] Email + Password inputs (outline border, 12dp radius)
[ ] Filled button "Iniciar sesión" (48dp height)
[ ] Toggle show/hide password
[ ] Error snackbar rojo
[ ] Loading spinner inside button
[ ] Responsive (mobile/tablet)
[ ] Dark mode (colores correctos)
[ ] Fade in animation (300ms)
[ ] Safe areas (notch, home indicator)
```

### **HomeScreen**
```
[ ] AppBar con Primary background
[ ] Welcome card (Primary Container)
[ ] Horarios list (scroll)
[ ] HorarioCard component
  [ ] Header (Día + Hora + Badge)
  [ ] Divider
  [ ] 3 filas (Ficha, Ambiente, Instructor)
[ ] Bottom sheet detalles (tap card)
[ ] Pull-to-refresh
[ ] Loading state (skeleton cards)
[ ] Empty state (icon + text)
[ ] Error state (snackbar + retry)
[ ] Staggered animation entrada
[ ] Dark mode
[ ] Safe areas
[ ] Logout menu
```

---

## 🔄 Cómo Cambiar Luego

Cuando tengas los diseños y quieras hacer iteraciones:

1. **Cambiar colores**:
   - Actualiza tema en `lib/main.dart`
   - `colorScheme: ColorScheme.fromSeed(seedColor: newColor)`

2. **Cambiar tipografía**:
   - Modifica `TextTheme` en `lib/main.dart`
   - O reemplaza Hanken/Geist en `pubspec.yaml`

3. **Ajustar spacing**:
   - Busca `EdgeInsets.all(16)`, `SizedBox(height: 16)`
   - Reemplaza valores

4. **Cambiar animaciones**:
   - `ScaleTransition`, `FadeTransition` en widgets
   - Ajusta `duration: Duration(milliseconds: 300)`

5. **Nuevos componentes**:
   - Crear widgets nuevos en `lib/widgets/`
   - Reutilizar en múltiples pantallas

---

## 📝 Tips para Stitch

1. **Exporta componentes**: Marca elementos como "component" para reutilizar
2. **Define design tokens**: Colors, typography, spacing como vars globales
3. **Prototype interactions**: Login → Home transition, bottom sheet
4. **States**: Diseña idle, loading, error, success de cada pantalla
5. **Responsive grids**: Usa 4 columnas mobile, 8 tablet
6. **Annotations**: Añade notas técnicas ("16dp padding", "Material3 button")

---

## 🚀 Una Vez Tengas los Diseños

1. Descargar/exportar como PNG/PDF/Figma link
2. Guardar en `mobile/design/` (o donde sea)
3. Empezar a codificar widgets
4. Usar diseño como referencia visual
5. Ajustar padding, colores, etc. en Flutter mientras avanzas

---

## 📞 Dudas Técnicas

Si surge algo que no está claro:

- **Colores**: Ver `lib/main.dart` theme
- **Layout**: Ver `lib/screens/` y `lib/widgets/`
- **Backend**: Ver `lib/services/` (API endpoints)
- **State**: Ver `lib/providers/` (how data flows)

---

**Versión**: 1.0  
**Creado**: Septiembre 2026

---

## 🎬 TL;DR - Quick Start

1. Abre Stitch IA
2. Lee `BRAND_GUIDE_SIHS_MOBILE.md` (5 min)
3. Copia contenido de `PROMPT_LOGIN_SCREEN.md` al prompt
4. Diseña LoginScreen (colores verde SENA, Hanken/Geist, 16dp spacing)
5. Idem HomeScreen con `PROMPT_HOME_SCREEN.md`
6. Exporta diseños
7. ¡Listo para codificar en Flutter!
