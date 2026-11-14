# Plan de simplificación de directorios

Fecha: 2026-11-14
Base de análisis: `docs/AUDITORIA_FLUJOS_Y_VISTAS.md`, rutas actuales, páginas de directorio y sus pruebas unitarias. Este documento es de planeación: no cambia rutas, permisos, APIs ni reglas de negocio.

## Objetivo

Consolidar Fichas, Instructores y Ambientes en un patrón común de **Directorio de entidad**. Las vistas `vista-*` dejarán de ser destinos funcionales independientes y pasarán gradualmente a enlaces compatibles hacia el directorio correspondiente, con la entidad seleccionada. `codigo-instructor` dejará de ser un módulo aislado y se convertirá en una acción contextual del detalle de instructor.

El objetivo es reducir cambios de contexto sin eliminar capacidades actuales ni invalidar enlaces guardados.

## Alcance actual comprobado

| Entidad | Directorio actual | Vista duplicada | Capacidades ya presentes |
| --- | --- | --- | --- |
| Fichas | `/fichas` | `/vista-fichas` | Búsqueda/filtros/paginación, crear/editar, CSV, drawer, horarios de ficha y enlaces cruzados. |
| Instructores | `/instructores` | `/vista-instructores`, `/codigo-instructor` | Búsqueda/filtros/paginación, carga semanal, especialidades, horarios y drawer de relacionados. |
| Ambientes | `/ambientes` | `/vista-ambientes` | Búsqueda/filtros/paginación, crear/editar, CSV, ocupación, conflictos, horarios y drawer. |

Las tres vistas `vista-*` vuelven a cargar la colección de entidad y sus horarios, permiten seleccionar una fila y renderizan la programación. Los directorios ya tienen esa selección o el drawer necesario para absorberla. Todos estos módulos están protegidos para `Administrador` y `Coordinador`.

## Patrón único: Directorio de entidad

### Estructura de pantalla

```
Directorio de [Entidad]
├── Encabezado: contexto + acción principal
├── Búsqueda, filtros, estados y conteo
├── Tabla/listado de entidades
│   ├── acciones frecuentes visibles
│   └── menú de acciones secundarias por fila
└── Detalle lateral (o ruta de detalle futura)
    ├── Información
    ├── Relacionados
    ├── Horario / ocupación
    ├── Historial
    └── Acciones administrativas
```

### 1. Listado con búsqueda, filtros y estados

- Mantener la búsqueda inmediata, filtros actuales, contador y paginación ya presentes en los tres directorios.
- Estandarizar el orden: búsqueda primero; filtros principales visibles; filtros avanzados expandibles; acción “limpiar filtros” cuando correspondan.
- Mostrar estado como una etiqueta con texto, no solo color. Los estados deben provenir de datos existentes: fase/estado de ficha, disponibilidad/mantenimiento/inactivo de ambiente, contrato/carga de instructor. No se deben inventar estados nuevos.
- La fila debe abrir el detalle y aceptar selección por teclado. El enlace profundo `?id=` debe seleccionar la misma entidad al cargar.

### 2. Acciones frecuentes visibles

Cada tabla conservará solo una o dos acciones de alto uso, coherentes entre entidades:

| Entidad | Acción frecuente visible |
| --- | --- |
| Ficha | Ver detalle / programar horario. |
| Instructor | Ver detalle / revisar carga. |
| Ambiente | Ver detalle / revisar ocupación. |

Crear/editar debe conservarse donde ya esté permitido por el rol; no altera la matriz de permisos. “Programar horario” debe llevar al constructor existente, no crear un flujo paralelo.

### 3. Menú de acciones secundarias

Un botón etiquetado “Más acciones de [entidad]” agrupará operaciones de baja frecuencia. Debe ser accesible por teclado, cerrar con Escape y no depender solo de iconos.

| Entidad | Acciones secundarias candidatas, solo si ya existen |
| --- | --- |
| Ficha | Editar; importar CSV desde acción de encabezado; abrir programación relacionada. |
| Instructor | Editar especialidades; generar/ver código de instructor; abrir programación relacionada. |
| Ambiente | Editar; abrir auditoría de cruces; importar CSV desde acción de encabezado. |

La eliminación no se añade como funcionalidad nueva: solo podrá exponerse cuando la política y el endpoint correspondiente ya existan y el diálogo explique impacto y confirmación.

### 4. Detalle lateral o página de detalle

Fase inicial: reutilizar `DrawerRelacionados`, ya empleado por Fichas, Instructores y Ambientes. Esto conserva el contexto de búsqueda y evita otra navegación.

Evolución posible: si el detalle gana acciones largas, URL compartible o navegación entre múltiples pestañas complejas, crear una ruta de detalle canónica (`/fichas/:id`, `/instructores/:id`, `/ambientes/:id`) sin retirar primero el drawer. Esa decisión depende de necesidades de enlace/uso aún no definidas.

### 5. Pestañas internas

El contenido del drawer/detalle tendrá el mismo orden. Las pestañas sin datos o sin endpoint se ocultan o muestran estado vacío; no se rellenan con datos ficticios.

| Pestaña | Fichas | Instructores | Ambientes |
| --- | --- | --- | --- |
| Información | Código, programa, trimestre, sede, etapa y jornadas. | Perfil, contrato, código y especialidades. | Nombre/número, sede, tipo, estado y coordinación si está disponible. |
| Relacionados | Instructores, ambientes, resultados y voceros que ya pueden derivarse/consultarse. | Fichas, temas/resultados y ambientes asignados. | Fichas e instructores asociados a horarios. |
| Horario / ocupación | Horario de la ficha. | Horario y carga semanal. | Horario y ocupación; conflictos existentes. |
| Historial | Solo si existe fuente de datos que distinga historial de programación. | Solo si existe fuente de cambios/carga aplicable. | Solo si existe fuente de cambios de disponibilidad/asignación. |
| Acciones administrativas | Editar y acciones ya autorizadas. | Especialidades y código de instructor. | Editar y acciones ya autorizadas. |

No se infiere un historial de entidad: la auditoría de horarios y los datos actuales no equivalen automáticamente a historial completo de ficha, instructor o ambiente.

### 6. Importación CSV secundaria

`ImportarArchivo` se conserva y no se reescribe. En Fichas y Ambientes debe abrirse desde una acción secundaria del encabezado o menú de administración, con la previsualización actual antes de confirmar. No debe ocupar el espacio principal del directorio ni convertirse en ruta distinta.

Instructores no incorpora importación CSV en este plan: el código actual no tiene el endpoint/flujo de alta masiva de usuarios necesario. Diseñarlo requeriría una decisión explícita sobre Auth, credenciales temporales, roles y eliminación de datos de prueba.

## Plan por entidad

### Fichas

**Conservar**

- Ruta canónica `/fichas`, tabla, búsqueda, filtros, paginación, modal de crear/editar, `ImportarArchivo`, `DrawerRelacionados` y consulta `GET /fichas/{id}/horarios`.
- Enlace existente al constructor de horarios, que debe apuntar a la entrada principal actual de creación cuando se ajuste su navegación.

**Unir**

- La grilla y selección de `/vista-fichas` en la pestaña “Horario” del drawer de `/fichas`.
- La información de programación y los enlaces hacia la ficha desde las dos pantallas en un único detalle.

**Mover al detalle**

- Horarios de una ficha, instructores/ambientes/resultados relacionados, estado de programación y acciones contextuales.

**Acción secundaria**

- Cargar CSV, editar ficha y acciones no requeridas para explorar el listado.

**Compatibilidad de ruta**

- Mantener `/vista-fichas?id={id}` durante la transición y redirigir a `/fichas?id={id}`.
- Si no llega `id`, redirigir a `/fichas` y permitir seleccionar una fila; no inventar una ficha predeterminada.

### Instructores

**Conservar**

- Ruta canónica `/instructores`, filtros por especialidad/contrato/ficha/ambiente, carga semanal, especialidades, `DrawerRelacionados`, grilla de horario y endpoints de instructor.

**Unir**

- El selector y la vista semanal de `/vista-instructores` con la pestaña “Horario y carga” del detalle de `/instructores`.
- La operación de código actualmente aislada en `/codigo-instructor` con la pestaña “Acciones administrativas” del instructor seleccionado.

**Mover al detalle**

- Carga semanal, especialidades, fichas/temas/ambientes asignados, horario, generación y visualización de código.

**Acción secundaria**

- Generar código de instructor. Debe conservar los permisos actuales (`Administrador` o `Coordinador`) y mostrar el resultado usando el endpoint ya existente.

**Compatibilidad de ruta**

- `/vista-instructores?id={id}` → `/instructores?id={id}`.
- `/codigo-instructor?id={id}` → `/instructores?id={id}&tab=administracion` cuando exista selección; sin `id`, mantener temporalmente la lista de selección o redirigir al directorio con una explicación breve. Esta decisión debe validarse por UX antes de retirar la pantalla.

### Ambientes

**Conservar**

- Ruta canónica `/ambientes`, filtros, tabla, modal CRUD, `ImportarArchivo`, drawer, consulta de horarios y vínculo a auditoría.

**Unir**

- La grilla de ocupación de `/vista-ambientes` en la pestaña “Horario y ocupación” del drawer de `/ambientes`.
- La indicación de conflictos en una misma sección contextual, enlazando a la auditoría global existente cuando haga falta profundidad.

**Mover al detalle**

- Horarios asignados, ocupación, fichas/instructores relacionados y conflictos del ambiente.

**Acción secundaria**

- Importar CSV, editar ambiente y abrir auditoría de cruces.

**Compatibilidad de ruta**

- `/vista-ambientes?id={id}` → `/ambientes?id={id}`.
- Sin `id`, `/vista-ambientes` → `/ambientes`.

## Eliminación gradual sin romper rutas

| Fase | Cambio | Compatibilidad | Criterio para avanzar |
| --- | --- | --- | --- |
| 0. Inventario | Medir navegación a rutas duplicadas, si hay analítica disponible. | Ninguna ruta cambia. | Confirmar destinos canónicos y matriz de permisos. |
| 1. Consolidación visual | Añadir pestañas y selección por `?id=` al directorio canónico. | Las vistas duplicadas permanecen. | El detalle canónico muestra información/horario equivalente. |
| 2. Enlaces internos | Cambiar menús, drawers y enlaces internos a rutas canónicas. | Rutas antiguas siguen atendidas. | No quedan enlaces internos apuntando a `vista-*`. |
| 3. Redirección | Redirigir `vista-*` preservando query `id`; manejar ausencia de id. | Enlaces externos y marcadores siguen funcionando. | E2E de redirección, selección y autorización pasan. |
| 4. Retiro de vistas | Retirar componentes duplicados solo tras un periodo acordado y comprobación de uso. | Mantener redirección de ruta si se requiere compatibilidad. | Equipo aprueba fecha de retiro y soporte de enlaces. |

`/codigo-instructor` no debe retirarse hasta que la acción contextual esté disponible y probada en el detalle de instructor. El código no permite asumir que todos los accesos llegan con `id` en la URL.

## Componentes y contratos reutilizables

| Recurso existente | Uso en el patrón |
| --- | --- |
| `DrawerRelacionados` y `SeccionDrawer` | Contenedor inicial de detalle lateral y secciones/pestañas. |
| `SeccionesFicha` y `SeccionesInstructor` | Contenido de relacionados ya modelado para ficha e instructor. |
| `GridHorario`, `convertirHorariosAGrid`, `GridSemanalInstructor` | Horario/ocupación contextual sin duplicar representación de celdas. |
| `indexarHorarios` y `opcionesFichaAmbiente` | Filtros y relación entre entidades donde ya se usan. |
| `ImportarArchivo` y `parsearCsv` | Importación CSV secundaria de fichas y ambientes. |
| `FormField` | Formularios modales de alta/edición. |
| `apiGet`, `apiPost`, `apiPut` | Servicios existentes; no crear una capa de API paralela. |
| `GET /fichas/{id}/horarios`, `GET /usuarios/{id}/horarios`, `GET /ambientes/{id}/horarios` | Fuente de horario específica de cada detalle. |
| `GET /horarios/auditoria-cruces` | Fuente de conflictos existentes para ambiente/programación; no sustituye historial de entidad. |
| `POST /usuarios/instructor/codigo/generar` | Acción contextual de código para el instructor seleccionado. |

## Criterios de aceptación

### Comunes

1. Administrador y Coordinador pueden abrir los tres directorios; Instructor y Aprendiz reciben la protección actual al intentar entrar.
2. El listado conserva búsqueda, filtros, estados, paginación y selección por teclado.
3. Una entidad seleccionada por fila o por `?id=` abre el mismo detalle sin recargar ni duplicar la consulta de entidad.
4. El detalle ofrece Información, Relacionados, Horario/Ocupación y Acciones administrativas; Historial solo aparece con datos reales disponibles.
5. Acciones frecuentes están visibles y las secundarias se agrupan en un control accesible con nombre, foco y cierre por teclado.
6. Fichas y Ambientes conservan importación CSV con previsualización, como acción secundaria.
7. Los enlaces y rutas antiguas de `vista-*` continúan resolviendo hacia el directorio canónico y preservan `id`.
8. No se crean endpoints, servicios, validaciones o reglas de negocio duplicadas.

### Específicos

- **Fichas:** su pestaña Horario presenta lo mismo que la vista antigua para la ficha seleccionada.
- **Instructores:** carga, especialidades, horarios y código se consultan/accionan solo sobre el instructor seleccionado y con los permisos actuales.
- **Ambientes:** ocupación y conflictos se muestran con los datos reales existentes; la auditoría global conserva su ruta propia.
- **Código de instructor:** generar no está disponible sin una selección inequívoca de instructor cuando se migre al detalle.

## Pruebas E2E necesarias

Las pruebas unitarias actuales cubren cada directorio y cada `vista-*`, pero la consolidación necesita pruebas de navegador que protejan rutas, selección y enlaces reales.

| Caso E2E | Resultado esperado |
| --- | --- |
| Abrir `/fichas?id={id}` | La ficha correcta queda seleccionada y muestra su detalle/horario. |
| Abrir `/instructores?id={id}` | Se ve el instructor, carga semanal y horario correspondiente; no datos de otro instructor. |
| Abrir `/ambientes?id={id}` | Se ve ocupación del ambiente y, si aplica, acceso a auditoría. |
| Enlaces de vista antigua | `/vista-fichas`, `/vista-instructores`, `/vista-ambientes` redirigen al directorio canónico y preservan el `id`. |
| Sin `id` legado | La ruta antigua llega al directorio sin selección insegura ni error. |
| Acción de código | Desde instructor seleccionado, generar código llama al endpoint existente y muestra el resultado; permisos se respetan. |
| CSV secundario | Fichas/Ambientes permiten abrir carga, previsualizar y cancelar sin crear registros; la confirmación se valida en ambiente de pruebas aislado. |
| Autorización | Aprendiz e Instructor no alcanzan directorios ni rutas legadas por URL directa. |
| Navegación de teclado | Foco llega a filtros, fila, detalle, pestañas y menú secundario; Escape cierra drawer/menú. |

## Decisiones pendientes

1. ¿La organización requiere una ruta de detalle permanente y compartible por entidad, o el drawer es suficiente como patrón definitivo?
2. ¿Qué datos constituyen “Historial” para ficha, instructor y ambiente? No hay un contrato común que lo defina actualmente.
3. ¿Qué debe ocurrir con `/codigo-instructor` sin parámetro `id` durante y después de la migración?
4. ¿Qué acciones administrativas puede ejecutar Coordinador frente a Administrador en cada entidad? El plan conserva el comportamiento actual y no resuelve discrepancias potenciales entre interfaz y endpoints.
5. ¿Existe una política aprobada de eliminación de fichas, instructores y ambientes, incluyendo dependencias de horarios e historial? Este plan no añade eliminación hasta tenerla.
