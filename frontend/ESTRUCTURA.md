# Estructura del frontend — estado actual

Esta guía describe la estructura **actual** del cliente web de SIHS. El
frontend está desarrollado con React + TypeScript y consume el backend
FastAPI mediante `src/services/api.ts`.

## Tecnologías

| Pieza | Uso |
|---|---|
| React 19 | Componentes y estado de interfaz |
| TypeScript | Tipado del frontend y contratos de API |
| Vite 8 | Servidor de desarrollo y build |
| React Router | Rutas y navegación |
| Tailwind CSS 4 | Estilos |
| Supabase JS | Autenticación y sesión |
| Vitest + Testing Library | Pruebas de componentes y páginas |
| ESLint | Validación estática |

## Carpetas principales

```text
frontend/src/
├── assets/                 # Recursos estáticos
├── components/             # Componentes reutilizables
│   └── horario/            # Grid, editor, modal y piezas del constructor
├── context/                # AuthContext
├── hooks/                  # Hooks compartidos
├── pages/                  # Pantallas completas
│   └── horario/            # Estado y tipos auxiliares del editor
├── routes/                 # AppRouter y ProtectedRoute
├── services/               # api.ts y supabaseClient.ts
├── test/                   # Utilidades para pruebas
└── types/                  # Tipos compartidos de la API
```

## Roles y protección de rutas

`src/routes/AppRouter.tsx` es la fuente principal de navegación. Las rutas
privadas se envuelven en `ProtectedRoute` y pueden limitarse por rol.

- **Gestión:** Administrador y Coordinador.
- **Administración:** Administrador.
- **Instructor:** Instructor.
- **Aprendiz:** Aprendiz.
- Algunas rutas, como dashboard, avisos y notificaciones, requieren sesión
  pero no un rol único.

`ProtectedRoute` también controla el cambio obligatorio de contraseña para
usuarios que ingresan con una credencial temporal.

## Pantallas funcionales principales

### Gestión de horarios

- `NuevoHorario.tsx`: constructor manual. El flujo actual parte de una ficha
  seleccionada, carga sus asignaciones existentes y evita recrearlas al
  guardar nuevas asignaciones.
- `AsistenteHorarios.tsx`: asistente de programación.
- `CalendarioGeneral.tsx`: vista general.
- `HorariosCompletos.tsx`: consulta de horarios completos.
- `HistorialHorarios.tsx`: historial y snapshots.
- `AuditoriaCruces.tsx`: revisión de conflictos.
- `PublicacionesProgramadas.tsx`: programación de publicación de borradores.

### Fichas, recursos y formación

- `Fichas.tsx` / `VistaFichas.tsx`
- `Ambientes.tsx` / `VistaAmbientes.tsx`
- `Sedes.tsx`
- `Instructores.tsx` / `VistaInstructores.tsx`
- `Programas.tsx`
- `Tematicas.tsx`

### Instructor

- `MiHorario.tsx`
- `DetalleFranjaAmbiente.tsx`
- `AsistenciaInstructor.tsx`
- `MisSolicitudesCambioHorario.tsx`

La asistencia soporta horarios que ocurren en varios días de la semana: el
instructor puede escoger el día de la sesión antes de registrar la lista.

### Aprendiz

- `MiHorarioAprendiz.tsx`
- `MiAsistencia.tsx`
- `MensajesAprendiz.tsx`

### Administración y comunicación

- `Usuarios.tsx`
- `Roles.tsx`
- `CodigoInstructor.tsx`
- `AprobarlicitarSolicitudes.tsx`
- `PanelAdministracion.tsx`
- `Avisos.tsx`
- `Notificaciones.tsx`
- `CambiosHorario.tsx`

## Comunicación con el backend

Todas las llamadas HTTP deben pasar por `src/services/api.ts`. El helper
obtiene la sesión de Supabase y envía el token como:

```text
Authorization: Bearer <token>
```

Las funciones principales son `apiGet`, `apiPost`, `apiPut` y
`apiDelete`. Las rutas se pasan sin repetir `/api/v1`.

Ejemplo:

```tsx
const fichas = await apiGet<Ficha[]>('/fichas/')
```

Los tipos de respuesta reutilizables viven en `src/types/api.ts`.

## Constructor de horarios

Los componentes reutilizables del constructor viven en
`src/components/horario/`.

- `HorarioEditor.tsx`: coordina panel, grid y modal.
- `GridHorario.tsx`: dibuja la grilla institucional.
- `CeldaHorario.tsx`: representa cada celda.
- `ModalBloque.tsx`: captura resultado, instructor y ambiente.
- `convertirHorarios.ts`: transforma horarios reales del backend al formato
  del editor.

Cuando el constructor se abre para una ficha, los horarios ya persistidos se
muestran en solo lectura. El guardado crea únicamente las asignaciones nuevas.

## Pruebas y validación

Comandos locales:

```bash
cd frontend
npm ci
npm run lint
npm run build
npm run test
```

El mismo conjunto se ejecuta automáticamente en GitHub Actions antes de
integrar cambios.

## Agregar una pantalla nueva

1. Crear el componente en `src/pages/`.
2. Agregar o reutilizar sus tipos en `src/types/api.ts`.
3. Consumir el backend mediante `src/services/api.ts`.
4. Registrar la ruta en `src/routes/AppRouter.tsx`.
5. Definir los roles permitidos con `ProtectedRoute`.
6. Agregar pruebas para el comportamiento relevante.
7. Ejecutar lint, build y tests antes del Pull Request.
