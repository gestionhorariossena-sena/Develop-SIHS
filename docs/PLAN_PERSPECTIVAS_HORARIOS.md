# Plan de perspectivas de horarios

Fecha: 2026-11-14
Alcance: análisis de las vistas de programación existentes. Este documento no modifica rutas, permisos, reglas de negocio, endpoints ni componentes.

## Decisión de arquitectura

Las vistas por Ficha, Instructor y Ambiente **no son redundantes**. Son perspectivas complementarias de los mismos bloques de horario y responden preguntas operativas distintas:

- Ficha: «¿qué clases tiene este grupo?».
- Instructor: «¿qué clases tiene este instructor y cuál es su carga?».
- Ambiente: «¿qué usa este ambiente y cuándo?».

La consolidación adecuada no es eliminar esas entradas, sino compartir su fuente de bloques, sus transformaciones y sus enlaces. Cada entrada conserva su entidad seleccionada, sus filtros de contexto y su representación apropiada.

```
                         Bloques de horario vigentes
                 GET /horarios/ y consultas por entidad
                                      |
           +--------------------------+--------------------------+
           |                          |                          |
  Gestión global                Contexto académico          Auditoría
  Lista / calendario             Ficha / Instructor          Conflictos
                                / Ambiente
```

`GET /horarios/` sigue siendo la fuente transversal de bloques. Las consultas específicas (`GET /fichas/{id}/horarios`, `GET /usuarios/{id}/horarios`, `GET /ambientes/{id}/horarios`) son adaptadores de contexto: reducen el conjunto de bloques al sujeto seleccionado y no constituyen una segunda verdad. La auditoría usa `GET /horarios/auditoria-cruces`; los snapshots/borradores usan `GET /horarios-guardados/`; y las publicaciones programadas usan `GET /publicaciones-programadas/`.

## Arquitectura objetivo: una fuente, entradas por contexto

### Núcleo compartido

| Capa | Recursos actuales reutilizables | Responsabilidad propuesta |
| --- | --- | --- |
| Bloque de horario | `Horario`, `GET /horarios/`, `apiGet` | Contrato único: franja, días, ficha, instructor, ambiente, trimestre, estado de publicación. |
| Consulta contextual | `GET /fichas/{id}/horarios`, `GET /usuarios/{id}/horarios`, `GET /ambientes/{id}/horarios` | Cargar solo los bloques de la entidad activa; no volver a modelar un horario diferente por cada vista. |
| Transformación a grilla | `convertirHorariosAGrid`, `GridHorario`, `GridSemanalInstructor`, `GridAsistente`, `celdasDesdeHorarios` | Derivar la presentación semanal desde `Horario[]` real. La variante visual depende del contexto, no del origen de datos. |
| Índices y filtros relacionados | `indexarHorarios.ts`, `indexarPorFicha`, `indexarPorInstructor`, `indexarPorAmbiente`, `opcionesFichaAmbiente`, `opcionesInstructor` | Construir filtros cruzados desde bloques ya cargados, sin endpoints por combinación de filtros. |
| Validación/auditoría | `POST /horarios/validar`, `GET /horarios/auditoria-cruces`, `AuditoriaCrucesResponse` | Separar conflictos preventivos de la edición de los conflictos persistidos que requieren gestión global. |
| Navegación contextual | parámetros `?id=`, enlaces actuales a directorio y perspectiva | Preservar la entidad seleccionada al pasar de un bloque global a una perspectiva, y permitir el regreso sin perder contexto cuando sea posible. |

### Entradas de producto

| Área | Entrada | Objetivo | Fuente principal |
| --- | --- | --- | --- |
| Gestionar horarios | Lista | Operar estados, publicación, borradores y bloques globales. | `/horarios/`, `/horarios-guardados/`, publicaciones. |
| Gestionar horarios | Calendario | Entender la distribución temporal de clases. | `/horarios/`. |
| Gestionar horarios | Conflictos | Detectar, filtrar y resolver cruces persistidos. | `/horarios/auditoria-cruces`. |
| Directorio Fichas | Horario | Ver las clases del grupo seleccionado. | `/fichas/{id}/horarios`. |
| Directorio Instructores | Horario y carga | Ver clases del instructor y su carga. | `/usuarios/{id}/horarios`, `/usuarios/{id}/carga-semanal`. |
| Directorio Ambientes | Ocupación | Ver uso temporal del ambiente y sus alertas. | `/ambientes/{id}/horarios`, auditoría de cruces. |

No se propone cambiar rutas ni permisos en esta fase. Las rutas de gestión y las tres perspectivas permanecen protegidas por el grupo de gestión actual (`Administrador` y `Coordinador`).

## Vistas de gestionar horarios

### `/horarios/completos` — Lista global

| Aspecto | Análisis |
| --- | --- |
| Pregunta que responde | «¿Qué bloques existen, cuáles están publicados o en borrador y sobre cuál debo actuar?» |
| Conservar | Tabla/listado global, filtros de estado y jornada, detalle expandible de un bloque, cambio de publicación, enlaces a programación diferida, historial y las tres perspectivas. |
| Componentes/endpoints compartibles | `Horario`, `GridAsistente`, `celdasDesdeHorarios`, `GridHorario` cuando corresponda, `GET /horarios/`, `PATCH /horarios/{id}/estado`, catálogos de fichas/instructores/ambientes/trimestres/sedes y `GET /horarios/auditoria-cruces`. |
| Filtros que recibe o envía | Recibe `?id=<idHorario>` para abrir el bloque. Debe conservar estado de publicación, jornada, trimestre, sede, ficha, instructor y ambiente como criterios globales cuando estén disponibles. Envía el identificador de ficha/instructor/ambiente al abrir la perspectiva respectiva. |
| Enlaces contextuales necesarios | A `/fichas?id=`, `/instructores?id=`, `/ambientes?id=` para información de entidad; a `/vista-fichas?id=`, `/vista-instructores?id=`, `/vista-ambientes?id=` para programación enfocada; a publicaciones, historial y auditoría desde el bloque. |
| Evitar duplicidad | El detalle debe mostrar los datos del bloque ya listado; los nombres y relaciones se resuelven a partir de los catálogos o del mismo contrato de horario. No crear tres tablas globales por entidad. |
| E2E requerido | Filtrar, abrir `?id`, publicar/despublicar según permiso, navegar a las tres perspectivas con el `id` correcto y volver al detalle global. |

### `/calendario` — Calendario global

| Aspecto | Análisis |
| --- | --- |
| Pregunta que responde | «¿Cómo se distribuyen temporalmente las clases y qué ocurre en un día o franja?» |
| Conservar | Calendario de bloques reales, navegación temporal, detalle de clase y enlace desde una clase al detalle global. |
| Componentes/endpoints compartibles | `Horario`, `GET /horarios/`, formato de días/horas y adaptadores de bloques usados por grillas. |
| Filtros que recibe o envía | Debe conservar rango/fecha visible y filtros por trimestre, sede, ficha, instructor, ambiente, jornada y estado si la interfaz los ofrece. Envía `?id=<idHorario>` a `/horarios/completos`. |
| Enlaces contextuales necesarios | A lista global para operar el bloque; a la perspectiva de ficha/instructor/ambiente cuando el usuario necesite cambiar de pregunta, conservando el sujeto del bloque. |
| Evitar duplicidad | El calendario no gestiona un almacenamiento temporal propio ni reimplementa publicación: representa `Horario[]` y delega acciones administrativas a la lista/detalle global. |
| E2E requerido | Cambiar de periodo, abrir una clase, comprobar que navega al bloque correcto de la lista y que los filtros no muestran bloques fuera del contexto seleccionado. |

### `/horarios/auditoria` — Conflictos

| Aspecto | Análisis |
| --- | --- |
| Pregunta que responde | «¿Qué cruces persistidos existen, a qué recursos afectan y dónde se corrigen?» |
| Conservar | Resumen por tipo, filtros de trimestre y sede, búsqueda, pares de bloques en conflicto y enlaces al detalle global. |
| Componentes/endpoints compartibles | `AuditoriaCrucesResponse`, `AuditoriaConflicto`, `GET /horarios/auditoria-cruces`, filtros de trimestre/sede y enlaces a `/horarios/completos?id=`. |
| Filtros que recibe o envía | Recibe trimestre y sede al consultar el endpoint. Puede enviar el `idHorario` de cada lado del cruce a la lista global; cuando el conflicto afecta una ficha/instructor/ambiente, debe ofrecer su perspectiva como contexto adicional, no como sustituto de la auditoría. |
| Enlaces contextuales necesarios | A ambos bloques en `/horarios/completos?id=`, al creador existente para corregir, y a la perspectiva de recurso afectado cuando ayude a entender el uso. |
| Evitar duplicidad | No recalcular cruces en cada vista. La auditoría persistida es la fuente para la gestión global; `POST /horarios/validar` continúa siendo la validación preventiva de edición. |
| E2E requerido | Filtrar por trimestre/sede, abrir cada bloque del par correcto, verificar estado sin conflictos y comprobar que un usuario no autorizado no alcanza la vista. |

### `/horarios/historial` — Snapshots, borradores y edición posterior

| Aspecto | Análisis |
| --- | --- |
| Pregunta que responde | «¿Qué conjuntos de horario se guardaron, cuál puedo reabrir, exportar o administrar?» |
| Conservar | Listado de `HorarioGuardado`, vista del conjunto, exportación PDF, reabrir en el creador y acciones existentes sobre clases vigentes. |
| Componentes/endpoints compartibles | `GET /horarios-guardados/`, `GET /horarios/`, `GET /dias-semana/`, `GridHorario`, `convertirHorariosAGrid`, `PATCH /horarios/{id}/estado`, `DELETE /horarios/{id}`. |
| Filtros que recibe o envía | Hoy el identificador individual desde la lista global no identifica inequívocamente un snapshot; esta limitación debe mantenerse explícita. Puede recibir una futura referencia de `idHorarioGuardado` solo si el contrato la define. Envía `?editar=<idHorarioGuardado>` a `/horarios/nuevo`. |
| Enlaces contextuales necesarios | A `/horarios/nuevo?editar=`, a lista global para bloques sin snapshot y a las perspectivas cuando un bloque real del conjunto tenga entidad disponible. |
| Evitar duplicidad | No presentar el historial como segunda lista de bloques individuales. Conserva el nivel de agregado «horario guardado» y usa los bloques vigentes solo para la visualización/acción ya existente. |
| E2E requerido | Abrir un snapshot, exportar, reabrir, activar/desactivar o borrar una clase con confirmación y comprobar que un bloque sin snapshot sigue siendo gestionable desde la lista global. |

### `/horarios/publicaciones-programadas` — Publicación diferida

| Aspecto | Análisis |
| --- | --- |
| Pregunta que responde | «¿Qué publicaciones están pendientes, requieren revisión, se pueden reprogramar o cancelar?» |
| Conservar | Disponibilidad del worker, lista de publicaciones, crear/reprogramar/cancelar y enlace a historial/borradores. |
| Componentes/endpoints compartibles | `GET/POST /publicaciones-programadas/`, `PUT /publicaciones-programadas/{id}`, `POST /publicaciones-programadas/{id}/cancelar`, `GET /publicaciones-programadas/disponibilidad`, `GET /horarios/`. |
| Filtros que recibe o envía | Debe aceptar `?idHorario=` desde un bloque borrador de la lista global para preseleccionarlo. Puede filtrar por estado de programación y fecha programada; debe conservar el vínculo al bloque, no copiar sus datos. |
| Enlaces contextuales necesarios | Al bloque en `/horarios/completos?id=`, a historial/borradores y, desde el bloque resultante, a las perspectivas de entidad. |
| Evitar duplicidad | La vista controla la agenda de publicación, no recrea la edición del bloque ni el calendario de clases. La fuente de estado de agenda es `publicaciones-programadas`; la fuente de bloque es `horarios`. |
| E2E requerido | Crear publicación desde un bloque, reprogramar, cancelar, mostrar indisponibilidad del worker, comprobar que `idHorario` preselecciona el bloque y validar autorización. |

## Perspectivas por entidad

### Fichas: `/vista-fichas` y pestaña Horario de `/fichas?id=`

| Aspecto | Análisis |
| --- | --- |
| Pregunta que responde | «¿Qué clases tiene este grupo?» |
| Conservar | Selector/listado de fichas, búsqueda por código/programa, filtros por instructor/ambiente, grilla semanal, selección por `?id=` y enlace bidireccional con el directorio. En el directorio, la pestaña Horario conserva la misma pregunta dentro del drawer. |
| Componentes/endpoints compartibles | `GET /fichas/`, `GET /horarios/` para índices y filtros, `GET /fichas/{id}/horarios` para la grilla, `GridHorario`, `convertirHorariosAGrid`, `indexarPorFicha`, `opcionesInstructor`, `SeccionInstructoresAsignados`, `SeccionAmbientesAsignados`. |
| Filtros que recibe o envía | Recibe `?id=<idFicha>`. Filtra por texto, instructor y ambiente. Debe enviar `idFicha` al directorio, y los IDs de instructor/ambiente de un bloque seleccionado a sus respectivas perspectivas. |
| Enlaces contextuales necesarios | A `/fichas?id=`, `/vista-instructores?id=`, `/vista-ambientes?id=`, lista global por bloque y creador para programación, según acciones ya autorizadas. |
| Evitar duplicidad | La pestaña del directorio y la vista dedicada comparten consulta y grilla, pero no se eliminan: el drawer conserva contexto de administración de ficha; la vista dedicada permite exploración y comparación desde el contexto de programación. |
| E2E requerido | Abrir `/vista-fichas?id=`, filtrar por instructor y ambiente, verificar que la grilla solo muestra bloques de la ficha, abrir el drawer de `/fichas?id=` y confirmar equivalencia de bloques, además de los enlaces cruzados. |

### Instructores: `/vista-instructores` y pestaña Horario y carga de `/instructores?id=`

| Aspecto | Análisis |
| --- | --- |
| Pregunta que responde | «¿Qué clases tiene este instructor y cuál es su carga?» |
| Conservar | Selector por instructor, búsqueda por nombre/correo/especialidad, filtros por ficha/ambiente, grilla semanal, `?id=`, carga semanal y enlace al directorio. En el directorio, mantener la pestaña Horario y carga como acceso contextual. |
| Componentes/endpoints compartibles | `GET /usuarios/instructores`, `GET /horarios/`, `GET /usuarios/{id}/horarios`, `GET /usuarios/{id}/carga-semanal`, `GridSemanalInstructor`, `indexarPorInstructor`, `opcionesFichaAmbiente`. |
| Filtros que recibe o envía | Recibe `?id=<idUsuario>`. Filtra por texto, ficha y ambiente. Envía el instructor al directorio y los IDs de ficha/ambiente de las clases hacia sus perspectivas. |
| Enlaces contextuales necesarios | A `/instructores?id=`, `/vista-fichas?id=`, `/vista-ambientes?id=`, lista global de bloque y acciones existentes de programación. |
| Evitar duplicidad | La carga semanal se calcula/consulta una sola vez por instructor seleccionado. La vista dedicada conserva la tarea de planificación personal del recurso; el drawer acompaña la gestión del directorio sin sustituirla. |
| E2E requerido | Abrir deep link de instructor, filtrar por ficha/ambiente, comprobar suma/carga correcta, validar que no aparecen bloques de otro instructor y navegar al detalle de cada entidad ligada. |

### Ambientes: `/vista-ambientes` y pestaña Ocupación de `/ambientes?id=`

| Aspecto | Análisis |
| --- | --- |
| Pregunta que responde | «¿Qué usa este ambiente y cuándo?» |
| Conservar | Selector de ambiente, búsqueda por nombre/número, filtros por ficha/instructor, grilla semanal, aviso de conflicto, `?id=` y vínculo con el directorio. En el directorio, mantener la pestaña Ocupación para revisar el recurso sin abandonar su información administrativa. |
| Componentes/endpoints compartibles | `GET /ambientes`, `GET /horarios/`, `GET /ambientes/{id}/horarios`, `GET /horarios/auditoria-cruces`, `GridHorario`, `convertirHorariosAGrid`, `indexarPorAmbiente`, `opcionesFichaAmbiente`, `opcionesInstructor`. |
| Filtros que recibe o envía | Recibe `?id=<idAmbiente>`. Filtra por texto, ficha e instructor; la auditoría puede aportar trimestre/sede. Envía el ambiente al directorio y las entidades de sus bloques a las otras perspectivas. |
| Enlaces contextuales necesarios | A `/ambientes?id=`, `/vista-fichas?id=`, `/vista-instructores?id=`, `/horarios/auditoria` y lista global por bloque. |
| Evitar duplicidad | La alerta de conflicto referencia la auditoría existente; no recrea reglas de cruce dentro de la pantalla. Ocupación es una interpretación temporal del mismo `Horario[]`, no una tabla independiente de reservas. |
| E2E requerido | Abrir deep link, filtrar por ficha/instructor, verificar ocupación de un ambiente, mostrar solo conflictos que lo afectan y navegar al par conflictivo en auditoría/lista global. |

## Matriz de filtros y enlaces

| Origen | Filtros propios | Identificador que recibe | Destino contextual recomendado |
| --- | --- | --- | --- |
| Lista global | Estado, jornada, trimestre, sede, ficha, instructor, ambiente | `idHorario` | Ficha, Instructor, Ambiente, publicaciones, historial, auditoría. |
| Calendario | Rango temporal y filtros de bloque | Fecha/rango; `idHorario` al detalle | Lista global y perspectiva de la entidad del bloque. |
| Auditoría | Trimestre, sede, texto/tipo | IDs de ambos horarios del conflicto | Lista global, creador y perspectiva del recurso afectado. |
| Historial | Conjunto/snapshot y acciones de clase | `idHorarioGuardado` cuando exista | Creador, lista global, perspectiva derivada de clase. |
| Publicaciones | Estado y fecha de publicación | `idHorario` | Lista global y, desde allí, las perspectivas. |
| Ficha | Texto, instructor, ambiente | `idFicha` | Directorio de ficha; instructor/ambiente de los bloques. |
| Instructor | Texto, ficha, ambiente | `idUsuario` | Directorio de instructor; ficha/ambiente de los bloques. |
| Ambiente | Texto, ficha, instructor | `idAmbiente` | Directorio de ambiente; ficha/instructor y auditoría. |

Los filtros deben tener una representación única de valores (`idFicha`, `idInstructor`, `idAmbiente`, `idTrimestre`, `idSede`, jornada y estado) aunque la UI muestre nombres. Un cambio futuro puede sincronizarlos con la URL, pero no debe introducirlo sin definir primero compatibilidad y contratos.

## Reglas para no duplicar lógica ni datos

1. Representar siempre una clase con `Horario`; no crear modelos de «horario de ficha», «horario de instructor» o «ocupación» que repliquen campos.
2. Reutilizar las transformaciones existentes de `Horario[]` a grilla, celdas e índices. Las diferencias válidas son el encabezado, la entidad seleccionada y los metadatos contextuales.
3. Mantener una sola fuente de conflictos persistidos: `GET /horarios/auditoria-cruces`. La prevalidación de edición se mantiene en `POST /horarios/validar`.
4. Mantener una sola fuente de borradores/snapshots: `GET /horarios-guardados/`, sin mezclarlos con la lista de bloques reales.
5. Mantener una sola fuente de publicaciones diferidas: `publicaciones-programadas`; su vínculo es `idHorario`, no una copia del bloque.
6. Reutilizar `?id=` para selección contextual donde ya existe. No inferir identificadores desde nombres ni crear rutas nuevas en este plan.
7. La pestaña de un directorio y la perspectiva dedicada pueden compartir la misma consulta y componente, pero siguen siendo accesos distintos porque el usuario llega con una pregunta distinta.

## Pruebas E2E transversales requeridas

1. Con un bloque visible en la lista global, recorrer ficha, instructor y ambiente; cada perspectiva abre con el `?id=` correcto y contiene el mismo bloque.
2. Desde cada perspectiva, abrir el directorio correspondiente y comprobar que el detalle conserva la misma entidad seleccionada.
3. Comprobar que la pestaña de horario/ocupación en cada directorio y su vista dedicada muestran el mismo conjunto de bloques para la entidad, sin exigir que tengan la misma composición visual.
4. Verificar aislamiento: un filtro de ficha, instructor o ambiente nunca incluye bloques de otra entidad; una consulta contextual no muestra bloques ajenos.
5. Desde calendario y auditoría, abrir el `idHorario` correcto en la lista global; desde la lista, abrir la perspectiva de cada relación del bloque.
6. Verificar publicación inmediata y programada con los permisos vigentes, y que el estado se refleja en lista/calendario sin duplicar el bloque.
7. Verificar que snapshot/historial y lista global mantienen su nivel de agregado: el snapshot no se confunde con un bloque individual y los bloques sin snapshot siguen accesibles.
8. Verificar filtros de auditoría por trimestre/sede, ambos lados de un cruce y enlaces a corrección.
9. Probar acceso directo con roles no autorizados a todas las rutas de gestión y perspectivas; deben conservar la protección actual.
10. Probar teclado y lectores de pantalla: filtros con etiquetas, selección de entidad, grillas con encabezados y enlaces contextuales con destino comprensible.

## Decisiones pendientes

1. El historial actual no tiene una asociación inequívoca entre un `idHorario` individual y un `HorarioGuardado`; por tanto, el enlace desde lista global a historial no puede prometer abrir el snapshot exacto sin ampliar el contrato.
2. Definir si los filtros contextuales deben serializarse completamente en la URL. Hoy los deep links por `?id=` están implementados; persistir trimestre, sede, rango temporal y demás filtros requiere una decisión de compatibilidad.
3. Definir el comportamiento de regreso entre lista global, perspectiva y directorio: conservar filtros en URL, historial del navegador o estado local, sin inventar una nueva navegación.
4. Confirmar si la vista Calendario debe exponer todos los filtros globales o solo una selección operativa; el código actual demuestra fuente común, pero no fija aún ese contrato de UX.
