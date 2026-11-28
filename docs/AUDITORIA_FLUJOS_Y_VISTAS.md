> **Actualización del 21-11-2026 (`fixes-multiples-nicol`):** este documento describe una auditoría histórica. Se eliminó el flujo de códigos de instructor: `/codigo-instructor` y los endpoints de generar/validar ya no existen; `/registro` no requiere código `INS-*`. El alta de Instructor se completa con Supabase Auth y aprobación administrativa del rol. Las referencias históricas que siguen se conservan como diagnóstico de la implementación anterior.

# Auditoría funcional de flujos y vistas de SIHS

Fecha de revisión: 2026-11-14
Alcance: código de `frontend/src`, routers y servicios de `backend/app`, y suites de `frontend/tests`, `backend/tests` y `e2e/tests`. Esta auditoría describe el comportamiento que se puede deducir del código; no modifica el producto ni presupone reglas que no estén implementadas.

## 1. Mapa actual

### Roles y control de acceso

| Rol de negocio | Nombre en código | Alcance observable |
| --- | --- | --- |
| Administrador | `Administrador` | Todo lo de Coordinación más usuarios, roles y aprobación de solicitudes de acceso. |
| Coordinador | `Coordinador` | Catálogos de lectura/gestión, creación y publicación de horarios, cruces, recursos y comunicaciones. No administra usuarios/roles ni aprueba accesos. |
| Profesor | `Instructor` | Consulta solo su horario publicado, carga semanal, asistencia de sus clases y solicitudes de cambio. |
| Estudiante | `Aprendiz` | Consulta su ficha, horario, asistencia, instructores, avisos, notificaciones y, si es vocero/subvocero, mensajería con instructores. |

Las rutas se protegen en `frontend/src/routes/AppRouter.tsx`; el frontend también oculta opciones en `AppShell.tsx`. La protección real de datos está en `backend/app/core/supabase_auth.py` y en cada router: `require_admin`, `require_admin_o_coordinador`, `require_instructor`, `require_aprendiz` y permisos de lectura de catálogo. Hay una barrera adicional para quien tiene `debeCambiarClave`: no puede navegar antes de cambiar la clave temporal.

### Navegación actual

`AppShell` agrupa el menú en **Mi trabajo, Programación, Formación, Recursos, Comunicaciones y Administración**. Para Aprendiz existe además un submenú persistente. La campana de notificaciones, selector de tema y perfil son transversales. La presentación, autenticación y recuperación de cuenta viven fuera del shell.

Los bloques principales reutilizables son:

- Horarios: `HorarioEditor`, `ModalBloque`, `ModalCruce`, `GridHorario`, `GridAsistente`, `PanelBloques`, `SelectorFechaHora` y conversores de grilla.
- Relacionados: `DrawerRelacionados` y secciones de instructor/ficha, usados para profundizar una fila sin abandonar el directorio.
- Datos tabulares: páginas de fichas, ambientes, instructores, usuarios, temáticas, horarios y solicitudes usan filtros, paginación y acciones por fila.
- Formularios/diálogos: `FormField`, modales de ficha/ambiente/rol/aviso, `ModalReportarNovedad`, anotaciones del horario y confirmaciones de eliminación.
- Archivos: `ImportarArchivo` es un importador CSV genérico usado por Fichas y Ambientes; el asistente de horarios usa `FormData` y carga Excel a `/horarios/asistente/importar`; competencias tiene su propia vista previa de importación.

## 2. Inventario de vistas y acciones

Abreviaturas de dependencias: **API** = endpoints bajo `/api/v1`; **Auth** = Supabase/AuthContext; **Cat.** = catálogos (fichas, personas, ambientes, resultados, jornadas, días, trimestres); **H** = horarios.

| Vista / ruta | Rol que la usa | Objetivo, entradas y resultado | Dependencias principales | Posible duplicidad o problema UX | Recomendación inicial |
| --- | --- | --- | --- | --- | --- |
| Presentación `/` | Público | Conocer SIHS y pasar a iniciar sesión/registro. | Rutas públicas. | Es una portada separada; sin problema funcional visible. | Conservar. |
| Login `/login` | Público | Ingresar con correo/documento y clave; registra intentos fallidos. | Auth, `/usuarios/login-documento`, auditoría. | Dos mecanismos de autenticación aparecen en el código (Supabase y login por documento); debe explicarse al usuario cuál usar. | Simplificar el mensaje y unificar el punto de entrada. |
| Registro `/registro` | Público | Solicitar cuenta como Instructor o Aprendiz; pide datos, código de instructor o ficha y acepta política. | Supabase `signUp`, `/usuarios/instructor/codigo/validar`, `/solicitudes-acceso/`. | El Instructor se registra por `signUp`, mientras otra ruta de solicitud crea cuentas vía administración; se perciben como altas distintas. | Unificar el lenguaje y documentar los dos flujos. |
| Recuperar/restablecer `/recuperar-contrasena`, `/restablecer-contrasena` | Público | Recuperar y fijar clave. | Supabase Auth. | Flujo estándar, sin duplicidad visible. | Conservar. |
| Cambio obligatorio `/cambiar-clave-obligatorio` | Todos autenticados con clave temporal | Cambiar clave antes de usar el sistema. | Supabase, `PATCH /usuarios/me/confirmar-cambio-clave`. | Es correcto; depende de un estado que el usuario puede no entender. | Conservar y explicar el motivo. |
| Dashboard `/dashboard` | Según rol | Redirigir al tablero de cada perfil. | `DashboardRouter`, perfil Auth. | Ruta útil solo como enrutador. | Conservar como infraestructura; no exponer como vista independiente. |
| Dashboard de programación | Administrador, Coordinador | Ver indicadores, horarios, recursos y cruces; navegar a acciones de programación. | `/horarios/`, `/usuarios/`, `/fichas/`, `/ambientes`, `/jornadas/`, `/dias-semana/`, auditoría. | Repite parte de los indicadores y enlaces de Horarios completos/auditoría. | Simplificar a resumen y accesos rápidos. |
| Dashboard instructor | Profesor | Consultar clases publicadas, carga semanal y accesos de trabajo. | `/usuarios/me`, `/usuarios/me/horarios`, fichas, días, carga semanal. | Se solapa con Mi horario. | Unificar como inicio-resumen de Mi trabajo, sin otra grilla completa. |
| Dashboard aprendiz | Estudiante | Resumen de ficha, horario, asistencia, avisos y notificaciones. | Perfil, ficha-usuario, asistencias, avisos, notificaciones. | Buena función de resumen, pero repite datos de cinco vistas. | Conservar como tablero resumido con enlaces. |
| Mi horario `/mi-horario` | Profesor | Consultar horario publicado, filtrar, descargar PDF, abrir detalle de franja y reportar novedad. | `/usuarios/me/horarios`, perfil, fichas, carga semanal, PDF y `ModalReportarNovedad`. | Solapa funcionalmente con Dashboard instructor. | Conservar como vista de detalle; retirar duplicación del dashboard. |
| Detalle franja `/mi-horario/detalle-franja` | Profesor | Ver detalle de una sesión y ambiente. | Horario/catálogos de lectura. | Ruta subordinada, no aparece como módulo propio. | Mover como panel lateral/modal desde Mi horario si no necesita URL compartible. |
| Asistencia `/asistencia` | Profesor | Elegir clase/fecha y registrar o eliminar asistencia. | `/asistencias/sesion`, `/usuarios/me/horarios`. | Correcta separación del horario; el paso de seleccionar sesión puede ser largo. | Conservar; enlazar desde cada clase de Mi horario. |
| Mis solicitudes `/mis-solicitudes-cambio` | Profesor | Consultar cambios solicitados. | `GET /solicitudes-cambio-horario/mias`. | La creación nace dentro de un modal en Mi horario; la lista está apartada. | Unificar en “Mis solicitudes” dentro de Mi trabajo. |
| Mi horario aprendiz `/mi-horario-aprendiz` | Estudiante | Vincular ficha si falta, consultar por trimestre y administrar anotaciones personales. | ficha-usuario, trimestres, anotaciones. | Comparte nombre con la vista del profesor, aunque las capacidades son distintas. | Conservar y nombrar “Horario de mi ficha”. |
| Mi asistencia `/mi-asistencia` | Estudiante | Consultar propio resumen de asistencia. | `GET /asistencias/mias`. | Sin duplicidad relevante. | Conservar. |
| Mis instructores y chat `/mensajes`, `/mensajes/chat` | Estudiante; chat solo vocero/subvocero | Ver instructores de la ficha; iniciar/leer/enviar conversaciones si corresponde. | mensajería, ficha-usuario, perfil y horarios. | Una misma página cambia mucho según ruta; “Mis instructores” oculta que contiene mensajería. | Unificar en una vista con pestañas “Instructores” y “Mensajes”. |
| Notificaciones `/notificaciones` | Todos | Ver, marcar leídas y eliminar notificaciones. | `/notificaciones/`; campana global. | La campana y esta pantalla duplican bandeja y estados. | Mantener campana como resumen y pantalla como historial; explicitarlo. |
| Avisos `/avisos` | Todos; edición según permiso | Leer comunicados; gestión crea/edita/elimina y segmenta por ficha/sede. | avisos, fichas, sedes. | “Comunicados” en menú y “Avisos” en URL/título alternan términos. | Unificar el nombre a “Comunicados”. |
| Crear horario manual `/horarios/nuevo` | Administrador, Coordinador | Seleccionar ficha, bloques, resultado, instructor, ambiente y celda; validar cruces, guardar borrador/publicar o guardar plantilla. | Cat., `/horarios/validar`, `/horarios/`, `/horarios-guardados/`, `HorarioEditor`, `ModalCruce`. | Compite con Asistente IA como segundo creador de horarios. | Unificar en **Crear horario > Manual**. |
| Asistente IA `/horarios/asistente-ia` | Administrador, Coordinador | Cargar Excel (y opcional complementario), revisar/crear fichas, generar propuesta IA, preguntar, validar y guardar bloques. | trimestres, programas, coordinaciones, fichas, `/horarios/asistente/*`, `/horarios/validar`, `/horarios/`. | Reimplementa carga de catálogos, validación, grilla y guardado del constructor manual. | Unificar en **Crear horario > Importar y procesar con IA**. |
| Horarios completos `/horarios/completos` | Administrador, Coordinador | Buscar/listar horarios, filtrar, abrir detalle y publicar/despublicar; ofrece resolución en constructor. | H, Cat., carga semanal, auditoría de cruces. | “Vistas de Horarios” mezcla listado operativo, detalle, estado y atajo de corrección. | Simplificar a “Gestionar horarios” y enlazar a Crear/Editar. |
| Historial `/horarios/historial` | Administrador, Coordinador | Gestionar bloques activos/publicados, borrar y restaurar publicaciones; administrar horarios guardados. | H, horarios guardados, días. | Mezcla historial de sesiones reales con plantillas/borradores; varias acciones también están en Horarios completos. | Separar “Borradores/plantillas” de “Historial y publicaciones”. |
| Publicaciones programadas `/horarios/publicaciones-programadas` | Administrador, Coordinador | Elegir horarios y fecha, programar/reprogramar/cancelar publicación. | H, trimestres, worker de publicación. | Se relaciona con publicar en Horarios completos pero está separada. | Conservar como opción de publicación dentro de Gestionar horarios. |
| Auditoría de cruces `/horarios/auditoria` | Administrador, Coordinador | Filtrar por trimestre/sede, conocer conflictos y saltar al constructor. | trimestres, sedes, `/horarios/auditoria-cruces`. | Parte de la auditoría ya se muestra en dashboard y Horarios completos. | Unificar la lectura de conflictos en un único centro de validación. |
| Calendario general `/calendario` | Administrador, Coordinador | Ver agenda global por ficha/trimestre y navegar fechas. | H, fichas, trimestres, días. | Solapa parcialmente con las tres “vistas por”. | Conservar como vista transversal, diferenciada de vistas por entidad. |
| Vista por fichas `/vista-fichas` | Administrador, Coordinador | Explorar una ficha y su programación. | Fichas, H y relacionados. | Puede confundirse con Directorio de Fichas, que ya abre detalle/horarios. | Unificar detalle de programación dentro de Fichas. |
| Vista por instructores `/vista-instructores` | Administrador, Coordinador | Buscar instructor y ver su horario. | `/usuarios/instructores`, H, días. | Duplica el drawer/horarios de Instructores. | Unificar dentro de Instructores. |
| Vista por ambientes `/vista-ambientes` | Administrador, Coordinador | Buscar ambiente y ver ocupación. | Ambientes, H, días. | Duplica detalle de Ambientes y se parece a Calendario general. | Unificar dentro de Ambientes. |
| Fichas `/fichas` | Administrador, Coordinador | Directorio, filtros, detalle, crear/editar y cargar CSV de fichas. | Fichas, programas, trimestres, sedes, días, H, `ImportarArchivo`. | Concentra directorio, CRUD, importación y programación relacionada. | Simplificar a directorio + detalle; mover importación a acción secundaria. |
| Programas `/programas` | Administrador, Coordinador | Administrar programas y resultados de aprendizaje. | programas, resultados. | Mezcla dos niveles del currículo y sus acciones. | Unificar con Temáticas en “Currículo”, usando niveles/pestañas. |
| Temáticas `/tematicas` | Administrador, Coordinador | Consultar/editar competencias y resultados, filtrados por programa. | programas, temáticas, competencias, resultados. | Se solapa con Programas en resultados y con importación curricular. | Unificar en “Currículo”. |
| Instructores `/instructores` | Administrador, Coordinador | Directorio, filtros, carga semanal, especialidades y relacionados (fichas, temas, ambientes, horario). | instructores, H, días, especialidades, carga semanal. | Tiene casi toda la funcionalidad de Vista por instructores. | Conservar como único punto de instructor; absorber la vista por instructor. |
| Código de instructor `/codigo-instructor` | Administrador, Coordinador | Generar y consultar código para registro de instructor. | instructores, `/usuarios/instructor/codigo/generar`. | Es una operación puntual escondida como módulo separado. | Mover a la ficha/detalle de instructor o a Administración. |
| Ambientes `/ambientes` | Administrador, Coordinador | Directorio, filtros, detalle, CRUD e importación CSV; muestra ocupación/conflictos. | ambientes, sedes, coordinaciones, fichas, H, auditoría, `ImportarArchivo`. | Duplica Vista por ambientes y mezcla inventario con ocupación. | Conservar directorio; absorber vista por ambiente en el detalle. |
| Sedes `/sedes` | Administrador, Coordinador | Crear, editar y eliminar sedes. | CRUD de sedes. | Es un catálogo muy pequeño como entrada principal. | Mover a Configuración/Catálogos. |
| Solicitudes de cambio `/cambios` | Administrador, Coordinador | Revisar y resolver solicitudes de instructores. | solicitudes-cambio-horario. | El nombre de menú no aclara que son solicitudes. | Renombrar “Cambios solicitados”. |
| Usuarios `/usuarios` | Administrador | Consultar usuarios y asignar/quitar roles. | usuarios, roles, usuario-rol; modal de confirmación. | Solapa parcialmente con Usuarios sin rol. | Unificar la gestión de roles en esta vista con filtro “sin rol”. |
| Roles `/roles` | Administrador | CRUD de roles. | roles. | Puede ser una configuración técnica poco frecuente. | Mover a Configuración avanzada. |
| Usuarios sin rol `/aprobar-solicitudes` | Administrador | Asignar rol a cuentas ya registradas y generar código a instructores. | usuarios, roles, usuario-rol, código instructor. | El nombre se parece a Solicitudes de acceso pero es otro flujo; principal fuente de confusión. | Unificar con Usuarios, bajo estado “Pendiente de rol”. |
| Panel administración `/panel-administracion` | Administrador | Aprobar/rechazar solicitudes de acceso sin cuenta y entregar credencial temporal. | solicitudes-acceso, roles, email/Supabase vía backend; modales. | Nombre genérico y coexistencia con “Aprobar solicitudes”. | Renombrar “Solicitudes de acceso” y mantenerla separada por tratarse de altas externas. |

## 3. Flujos actuales por rol

### Administrador

1. Inicia sesión y, si su acceso fue creado con credencial temporal, debe cambiar su clave.
2. Entra al Dashboard de programación y ve un resumen de horarios, recursos y cruces.
3. Puede crear horarios manualmente o usar el Asistente IA; también consulta, publica, programa publicaciones, revisa historial y audita cruces.
4. Mantiene fichas, currículo, instructores, ambientes y sedes. En instructores puede consultar carga y especialidades; en recursos/formación hay CRUD e importaciones CSV para fichas/ambientes.
5. Atiende cambios de horario y publica avisos.
6. Como administrador, además gestiona roles, usuarios sin rol y solicitudes de acceso. Aprobar una solicitud crea/reutiliza la cuenta de Auth, asigna rol y genera una clave temporal.

### Coordinador

1. Inicia sesión y llega al Dashboard de programación.
2. Usa la misma operación académica que el administrador: catálogos de lectura/gestión, creación manual o IA, validación de cruces, publicación y vistas de ocupación.
3. Consulta instructores, fichas y ambientes para tomar decisiones; puede cambiar especialidades de un instructor y generar su código.
4. Atiende solicitudes de cambio y gestiona comunicados.
5. No puede asignar roles, administrar usuarios ni resolver solicitudes de acceso. El menú y los endpoints buscan respetar esa separación.

### Profesor (Instructor)

1. Inicia sesión; si es primer acceso temporal, cambia la clave.
2. En Dashboard instructor/Mi horario consulta exclusivamente bloques publicados propios y carga semanal.
3. Desde cada sesión puede ver detalle/ambiente, descargar su horario y reportar una novedad o solicitud de cambio.
4. En Asistencia registra, consulta o elimina la asistencia de sus sesiones.
5. Revisa sus solicitudes de cambio y avisos/notificaciones. No tiene una bandeja de mensajería equivalente a la del Aprendiz en el código actual.

### Estudiante (Aprendiz)

1. Inicia sesión y llega a Dashboard aprendiz. En su primer acceso, `get_current_user` intenta vincular la ficha indicada durante el registro; si no puede, Mi horario ofrece vínculo manual por código.
2. Consulta Horario de mi ficha, filtra por trimestre y agrega anotaciones personales a bloques.
3. Consulta Mi asistencia, avisos y notificaciones.
4. En Mis instructores ve a quienes dictan a su ficha. Si ocupa rol de vocero/subvocero, puede abrir y escribir conversaciones con ellos; el backend lo valida.

## 4. Horarios y Asistente IA: propuesta de unificación

### Hallazgo

`NuevoHorario` y `AsistenteHorarios` son dos entradas al mismo resultado: crear bloques de horario con ficha, resultado, instructor, ambiente, jornada, días, validación de cruces y estado de publicación. Ambos consultan catálogos, validan con `/horarios/validar` y terminan creando con `POST /horarios/`. El asistente añade carga de Excel, extracción/clasificación IA, creación/edición de ficha y propuesta automática; el manual aporta un editor de bloques y grilla más directo.

Mantenerlos como módulos paralelos obliga a aprender dos flujos, dispersa el manejo de errores y multiplica las superficies que deben permanecer coherentes. La diferencia es el **origen de los datos**, no el objetivo final.

### Módulo objetivo: Crear horario

```
Crear horario
├── Crear manualmente
│   └── seleccionar ficha y definir bloques
└── Importar archivo y procesar con IA
    └── cargar Excel → revisar extracción/propuesta
        ↓
Editor único de horario
        ↓
Validar cruces y carga
        ↓
Vista previa
        ↓
Guardar borrador | Publicar ahora | Programar publicación
```

Características recomendadas para el editor único:

- Recibe bloques manuales o bloques extraídos/propuestos por IA con una estructura común.
- Muestra una sola grilla, un solo `ModalCruce` y la misma regla de forzar/no forzar conflictos.
- Permite corregir antes de guardar cualquier propuesta IA; la IA nunca publica directamente.
- Centraliza borradores/plantillas como opción de salida del editor, no como otro recorrido de creación.
- Deja la importación como un paso inicial opcional y conserva los metadatos de origen para trazabilidad.

No se propone eliminar el motor IA: se cambia su posición de “constructor alternativo” a “método de preparación del mismo constructor”.

## 5. Redundancias, fricción y nombres

### Redundancias principales

- **Instructores + Vista por instructores**, **Fichas + Vista por fichas** y **Ambientes + Vista por ambientes** duplican seleccionar una entidad y ver sus horarios. Los drawers de relacionados ya permiten consolidarlo en los directorios.
- **Dashboard instructor + Mi horario** presentan la misma información nuclear; el primero debe resumir y el segundo profundizar.
- **Dashboard de programación + Horarios completos + Auditoría de cruces** muestran indicadores o conflictos relacionados. Hace falta una fuente visible de verdad para cada propósito.
- **Horarios completos + Historial + Publicaciones programadas** reparten el ciclo de vida de un horario en tres lugares, con acciones de publicación repetidas.
- **Programas + Temáticas** comparten resultados de aprendizaje y dividen la administración curricular sin una frontera clara.
- **Usuarios + Usuarios sin rol** son la misma población con filtros y acciones de rol distintos.

### Pasos o responsabilidades a revisar

- El asistente IA puede crear programa, coordinación y ficha mientras intenta crear horario. Eso mezcla parametrización curricular y operación de programación en un flujo largo.
- Fichas y Ambientes combinan directorio, formulario CRUD, importación CSV, filtros, detalle y relaciones de horario. Es viable, pero conviene priorizar primero el directorio y abrir acciones secundarias bajo detalle/menú.
- El detalle de franja del instructor es una navegación adicional para una acción contextual; debe justificarse por URL compartible o convertirse en panel.
- El chat usa dos rutas para un mismo componente y el permiso especial de vocero; las pestañas explícitas reducen contexto oculto.

### Nombres confusos

- “Horarios” (manual), “Asistente IA” y “Horarios completos” no describen claramente su relación de creación, revisión y administración.
- “Aprobar solicitudes de registro” (`/aprobar-solicitudes`) en realidad atiende usuarios ya creados pero sin rol; “Solicitudes de acceso” atiende otro caso. Son nombres peligrosamente cercanos.
- “Mis instructores” contiene también mensajería; “Avisos” y “Comunicados” nombran lo mismo en lugares distintos.
- “Mi horario” se usa para Instructor y Aprendiz, aunque el contenido y permisos son diferentes.

### Funciones con propósito o usuario poco claro

- El ítem “Configuración” se muestra deshabilitado: no hay módulo ni contrato de responsabilidades implementado.
- Hay páginas de código para instructor, roles y sedes como destinos principales aunque son acciones de configuración menos frecuentes.
- La pantalla de Historial mezcla snapshots/horarios guardados con registros operativos; no queda claro qué debe conservar un coordinador ni qué puede borrar.

## 6. Navegación final propuesta (sin cambios de código)

### Administrador

```
Inicio
Programación
  Crear horario (Manual | Importar con IA)
  Gestionar horarios (borradores, publicaciones, historial)
  Calendario y validación de cruces
Formación y recursos
  Fichas | Instructores | Ambientes
  Currículo (programas, competencias, resultados)
  Catálogos (sedes, jornadas, trimestres, especialidades)
Comunicaciones
  Cambios solicitados | Comunicados
Administración
  Solicitudes de acceso
  Usuarios y roles (incluye “sin rol”)
  Configuración avanzada
```

### Coordinador

```
Inicio
Programación
  Crear horario (Manual | Importar con IA)
  Gestionar horarios
  Calendario y validación de cruces
Formación y recursos
  Fichas | Instructores | Ambientes | Currículo
Comunicaciones
  Cambios solicitados | Comunicados
```

### Profesor

```
Inicio (resumen de hoy y carga)
Mi trabajo
  Mi horario
  Asistencia
  Mis solicitudes de cambio
Comunicaciones
  Comunicados | Notificaciones
```

### Estudiante

```
Inicio (resumen de ficha)
Mi trabajo
  Horario de mi ficha
  Mi asistencia
  Instructores y mensajes
Comunicaciones
  Comunicados | Notificaciones
```

## 7. Pruebas existentes y cobertura E2E

### Cobertura existente

- **Frontend/Vitest:** pruebas unitarias de rutas protegidas, navegación, componentes de horario, importación CSV, y prácticamente cada página, incluidas IA, horarios, solicitudes, asistencia, mensajería y catálogos.
- **Backend/pytest:** pruebas de roles, usuarios, solicitudes de acceso, horarios, aislamiento de trimestre, cruces, fuerza de reglas, auditoría, asistentes IA, importaciones curriculares, publicaciones programadas, asistencia, notificaciones, mensajería y PDF. Hay pruebas específicas contra PostgreSQL desechable.
- **Playwright (`e2e/tests`):** login por rol, validación de login, asistente IA con respuestas interceptadas, publicar horario para que Instructor lo vea y flujos de horarios contra backend de pruebas. `horarios-flujos.spec.ts` crea y limpia horarios, pero depende de IDs de fixture configurados por entorno.

### Flujos que Playwright puede verificar hoy

| Flujo | Estado observable |
| --- | --- |
| Login y redirección por rol | Cubierto por `login.spec.ts` y `login-validacion.spec.ts`. |
| Importar y recorrer el asistente IA con contratos simulados | Cubierto por `asistente-ia.spec.ts`. |
| Crear borrador, publicar desde la UI y persistir el resultado | Cubierto por `horarios-flujos.spec.ts`, si existen credenciales/fixtures de backend de pruebas. |
| Crear y publicar bloque manual y comprobar persistencia | Cubierto por `horarios-flujos.spec.ts`, con limpieza de horario en `finally`. |
| Coordinación publica e Instructor consulta su horario | Cubierto por `publicar-horario.spec.ts` con API interceptada. |

### E2E que faltan

1. Registro completo de Instructor y Aprendiz, aprobación/rol y primer cambio de clave; debe usar ambiente aislado porque toca Supabase/Auth.
2. Flujo real de carga Excel → propuesta IA → corrección en editor → validación → borrador/publicación. La prueba actual simula contratos; no cubre integración real del mismo flujo.
3. Corrección de conflicto desde `ModalCruce`, incluida regla de no forzar/forzar según permiso y auditoría resultante.
4. Publicación programada ejecutada por worker y visible para Instructor/Aprendiz después de la fecha.
5. Profesor registra asistencia y Estudiante la observa en Mi asistencia.
6. Profesor reporta cambio, Coordinador lo resuelve y ambos ven estado/notificación.
7. Vocero crea conversación/envía mensaje y un no-vocero recibe rechazo de interfaz/API.
8. CRUD/importación de ficha y ambiente desde UI con limpieza de datos creados.
9. Restricciones de autorización directamente en navegador: Coordinador no ve ni puede invocar administración de usuarios/roles; Instructor/Aprendiz no acceden a catálogos de gestión.
10. Un flujo aislado de datos de prueba que cree sus propios usuarios/recursos y los elimine, para eliminar la dependencia de `E2E_TEST_*` preexistentes.

## 8. Decisiones pendientes para el equipo

Estas reglas no se pueden resolver con certeza solo a partir del código revisado:

1. ¿Cuál es el flujo oficial de alta de Instructor y Aprendiz: registro autónomo seguido de asignación de rol, o solicitud de acceso aprobada por Administrador? Ambos aparecen en el producto.
2. ¿Quién puede crear, editar o borrar fichas y ambientes? Las rutas de frontend permiten Gestión en varios puntos, pero algunos endpoints de catálogo aplican `require_admin`; debe definirse una matriz única y alinearla.
3. ¿Qué diferencia de negocio debe existir entre horario guardado, borrador, historial, horario activo y horario publicado? Las pantallas agrupan estos conceptos de forma distinta.
4. ¿La IA puede crear programas, coordinaciones y fichas durante una importación, o estas entidades deben existir y ser aprobadas antes de programar?
5. ¿La publicación programada es por bloque individual, por ficha, por trimestre o por paquete de horario? El formulario permite seleccionar horarios, pero falta la política funcional de consistencia para el usuario.
6. ¿Debe existir mensajería para Instructor, o el alcance es deliberadamente unidireccional desde voceros/subvoceros?
7. ¿Cuál es el propietario de configuración avanzada (sedes, jornadas, trimestres, roles, especialidades) y qué catálogos puede administrar un Coordinador?
8. ¿Se requiere conservar historiales/auditoría al borrar horarios y usuarios, y qué retención aplica? El código permite eliminaciones en varios módulos, pero la política de retención no es evidente.

## Archivos revisados

La auditoría se basó especialmente en:

- `frontend/src/routes/AppRouter.tsx`, `frontend/src/routes/ProtectedRoute.tsx`, `frontend/src/components/AppShell.tsx`.
- Todas las páginas de `frontend/src/pages/` y los componentes de `frontend/src/components/horario/`, `frontend/src/components/relacionados/`, `ImportarArchivo.tsx`, `ModalReportarNovedad.tsx` y `NotificacionesPanel.tsx`.
- `backend/app/core/supabase_auth.py`, `backend/app/main.py`, todos los routers de `backend/app/api/v1/`, y servicios/modelos de usuario, horario, asistencia, mensajería, solicitudes y publicación.
- `frontend/tests/`, `backend/tests/` y `e2e/tests/`.
