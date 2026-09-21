# Guía de Gestión del Monorepo

Documento para mantener coherencia en el desarrollo de un monorepo con Backend + Web + Móvil.

---

## 📋 Estructura de Ramas

```
main
  ↓ (releases solo)
develop
  ↓ (integración diaria)
  ├─ feature/back/<tarea>      # Solo cambios en backend/
  ├─ feature/front/<tarea>     # Solo cambios en frontend/
  ├─ feature/mobile/<tarea>    # Solo cambios en mobile/
  └─ feature/full/<tarea>      # Cambios coordinados en 2+ áreas
```

### Cuándo usar cada rama

| Rama | Cuándo | Ejemplo |
|------|--------|---------|
| `feature/back/*` | Cambios backend que NO afectan clientes | Optimizar query, agregar validación interna |
| `feature/front/*` | Cambios web SIN cambios de API | Diseño nuevo, bug en UI |
| `feature/mobile/*` | Cambios móvil SIN cambios de API | Nueva pantalla, rediseño de card |
| `feature/full/*` | Cambios backend QUE SUMAN API nueva O cambios que afectan clientes | Endpoint nuevo, cambio de schema de respuesta |

**Regla de oro**: Si tu cambio en el backend requiere que web O móvil actualicen su consumo → es `feature/full/*`.

---

## 📤 Flujo de una PR

### 1. Crear rama
```bash
git checkout develop
git pull origin develop
git checkout -b feature/<tipo>/<nombre>  # feature/back/optimizar-query-horarios
```

### 2. Commits pequeños pero descriptivos
```bash
git commit -m "Agregar índice en tabla horarios (performance)"
git commit -m "Refactor: extraer lógica de validación a servicio"
git push -u origin feature/back/optimizar-query-horarios
```

### 3. Abrir PR en GitHub
- **Title**: Corto, imperativo: "Agregar endpoint GET /usuarios/me/carga-semanal"
- **Description**:
  ```markdown
  ## ¿Qué cambia?
  - Backend: nuevo endpoint para ver carga semanal de instructor
  
  ## Tipo de cambio
  - [ ] API nueva (requiere actualización en web + móvil)
  - [x] Refactor interno (no afecta clientes)
  - [ ] Bug fix
  
  ## Clientes afectados
  - Móvil: SÍ (nuevo endpoint a consumir)
  - Web: NO (Coordinadores no lo necesitan)
  
  ## Testing
  curl -H "Authorization: Bearer <token>" \
    http://127.0.0.1:8000/api/v1/usuarios/me/carga-semanal
  ```

### 4. Code Review
- **Si es `feature/back/*` o `feature/front/*` o `feature/mobile/*`**: solo revisor del área respectiva
- **Si es `feature/full/*`**: 2+ revisores (backend + otros clientes)

### 5. Merge a develop
```bash
# GitHub: Squash and merge (opcional, según tamaño PR)
# En local:
git checkout develop
git pull origin develop
```

### 6. Cuando está listo para producción
```bash
# Desde GitHub:
# Create Release en main (automático con tags)
# O manual:
git checkout main
git pull origin main
git merge --no-ff develop -m "Release v0.2.0"
git tag -a v0.2.0 -m "Release: ..."
git push origin main --tags
```

---

## 🔄 Gestión de Cambios en API

### Caso 1: Endpoint Nuevo (backend-driven)

**Pasos en orden**:

1. **Backend** abre PR `feature/full/` con endpoint en `app/api/`
   ```python
   @router.get("/usuarios/me/carga-semanal")
   def obtener_carga_semanal(...):
   ```

2. **Code review**: verificar schema de respuesta, errores, permisos

3. **Merge a develop** (backend disponible en local/staging)

4. **Móvil** abre PR para consumir el endpoint:
   - `lib/models/carga.dart` (modelo nuevo)
   - `lib/services/horario_service.dart` (método nuevo)
   - `lib/providers/carga_provider.dart` (provider nuevo)
   - `lib/screens/carga_screen.dart` (pantalla nueva)

5. **Web** idem si es necesario

Ventaja: Uno por uno, endpoint probado antes de que los clientes lo usen.

### Caso 2: Schema de Respuesta Cambia (breaking change)

Ej: `Horario.horaInicio` de string `"09:00"` a object `{hour: 9, minute: 0}`.

**Proceso**:
1. Backend NO cambia el schema directamente — versionaría a `/api/v2/`
2. O bien, ambos formatos existen por N versiones
3. Móvil actualiza parsing en `models/horario.dart`
4. Web idem

**En nuestro caso** (proyecto pequeño, una sola versión `v1`): coordinar cambios en una rama `feature/full/breaking-change-schema` con revisores de backend + clientes.

---

## 🧪 Testing antes de Merge

### Backend
```bash
cd backend
python -m pytest tests/ -v
# Lint
flake8 app/
mypy app/
```

### Frontend
```bash
cd frontend
npm test
npm run lint
npm run build  # Verifica que no hay errores de TS
```

### Mobile
```bash
cd mobile
flutter test
flutter analyze
# Compilar (no es necesario en PR, pero verifica)
flutter build apk --release (opcional)
```

---

## 📚 Documentación de Cambios

### Si cambias un endpoint
Actualiza **inline** en `backend/ESTRUCTURA.md`:
```markdown
### `/usuarios/me/carga-semanal` — GET (NEW)
Retorna horas asignadas vs. tope según RF-011.
Requiere: rol Instructor.
Respuesta: { totalHoras, topeHoras, diaDetalle[] }
Consumido por: mobile (nueva pantalla "Mi Carga")
```

### Si cambias un modelo
En el archivo `.dart` del móvil, agregá comentario:
```dart
class Usuario {
  final String idUsuario;  // UUID de Supabase
  final String nombre;
  // ... resto
  
  // Getter helper — usado en HomeScreen para detectar rol
  bool get esInstructor => roles.any((r) => r.nombre == 'Instructor');
}
```

---

## 🚨 Troubleshooting: Sincronización de Cambios

### Caso: Cambio de API, pero olvidé sincronizar mobile/

**Síntoma**: Backend devuelve nuevo campo `cargaSemanal`, pero `models/horario.dart` aún tiene la vieja estructura.

**Solución**:
1. Entra a PR de mobile que consume el endpoint
2. Lee error en CI (Flutter Analyze fallará)
3. Actualiza `models/horario.dart` con todos los nuevos campos
4. Push a la rama
5. CI pasa, merge

### Caso: Mobile está en rama separada, backend ya en develop

**Situación**: Backend merged `feature/full/nuevo-endpoint`, móvil aún está en rama propia `feature/mobile/consumir-nuevo-endpoint`.

**Solución**:
```bash
git checkout feature/mobile/consumir-nuevo-endpoint
git rebase develop  # O merge develop
# Resuelve conflictos si hay (en ApiClient, auth, etc.)
# Push forzado (es tu rama)
git push -f origin feature/mobile/consumir-nuevo-endpoint
```

---

## 📊 Estadísticas de Commits

Para ver qué se toca en cada área:
```bash
# Commits en backend/
git log --oneline -- backend/ | wc -l

# Commits en mobile/
git log --oneline -- mobile/ | wc -l

# Commits en frontend/
git log --oneline -- frontend/ | wc -l

# Quién toca qué:
git log --pretty="%an" -- mobile/ | sort | uniq -c
```

---

## ✅ Checklist de Merge a Develop

- [ ] Todos los tests pasan (CI verde)
- [ ] Código sin warnings (Flutter Analyze, mypy, eslint)
- [ ] Si es API nueva: documentada en `backend/ESTRUCTURA.md`
- [ ] Si es consumo de API: modelos + services + providers listos
- [ ] Si es `feature/full/*`: ambos clientes (web + móvil) lo usan O está documentado por qué no
- [ ] Commit message descriptivo
- [ ] PR description clara (qué cambió, por qué, clientes afectados)

---

**Versión**: 1.0
**Última actualización**: Septiembre 2026
