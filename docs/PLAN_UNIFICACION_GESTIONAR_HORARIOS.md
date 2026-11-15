# Plan de unificación: Gestionar horarios

Fecha: 2026-11-14

Rama analizada: `fixes-multiples-nicol`
Estado: propuesta técnica; este documento no modifica componentes, rutas, permisos ni endpoints.

## Objetivo

Convertir las cuatro pantallas que consultan los mismos bloques de horario en
una sola experiencia de coordinación: **Gestionar horarios**. La entrada
canónica será `/horarios/completos` y tendrá un selector de perspectiva:

- Bloques
- Por ficha
- Por instructor
- Por ambiente

Las rutas actuales de perspectiva seguirán existiendo durante la migración,
como enlaces compatibles que redirigen a la combinación equivalente de
perspectiva y selección. No se eliminan permisos, APIs, grillas, enlaces a
directorios, auditoría, publicaciones ni el drawer de bloque.

## Auditoría técnica actual

### Rutas y permisos

Las cuatro rutas están protegidas con el mismo grupo `GESTION`
(`Administrador` y `Coordinador`) en `frontend/src/routes/AppRouter.tsx`:

| Ruta actual | Componente | Selección por URL | Representación principal |
| --- | --- | --- | --- |
| `/horarios/completos` | `HorariosCompletos` | `?id=<idHorario>` | Tabla global + `DrawerHorario` |
| `/vista-fichas` | `VistaFichas` | `?id=<idFicha>` | Selector lateral + `GridHorario` |
| `/vista-instructores` | `VistaInstructores` | `?id=<idUsuario>` | Selector lateral + `GridSemanalInstructor` |
| `/vista-ambientes` | `VistaAmbientes` | `?id=<idAmbiente>` | Selector lateral + `GridHorario` |

La coincidencia del nombre `id` para cuatro entidades distintas es el mayor
riesgo de compatibilidad: funciona porque cada ruta sabe interpretarlo, pero
no puede trasladarse a una ruta única sin nombres explícitos.

### Consultas y lógica repetida

| Responsabilidad | Bloques | Fichas | Instructores | Ambientes | Riesgo actual |
| --- | --- | --- | --- | --- | --- |
| Fuente transversal de clases | `GET /horarios/` | `GET /horarios/` | `GET /horarios/` | `GET /horarios/` | La misma colección se descarga y filtra en cuatro pantallas. |
| Catálogo de entidad | `/fichas/` | `/fichas/` | `/usuarios/instructores` | `/ambientes` | La carga, error, selección y lista lateral son variaciones del mismo patrón. |
| Horario de entidad seleccionada | No aplica | `/fichas/{id}/horarios` | `/usuarios/{id}/horarios` | `/ambientes/{id}/horarios` | Tres efectos con caché manual, estado de carga y error prácticamente idénticos. |
| Filtros cruzados | Texto, jornada, trimestre, estado | Texto, instructor | Texto, ficha, ambiente | Texto, ficha, instructor | Los valores se guardan como nombres en varios casos, no IDs, y no viajan en URL. |
| Grilla | No es la vista principal; el drawer usa `GridAsistente` | `GridHorario` + `convertirHorariosAGrid` | `GridSemanalInstructor` | `GridHorario` + `convertirHorariosAGrid` | La misma colección `Horario[]` se adapta tres veces con distinto contenedor. |
| Índices derivados | Mapas de catálogos locales | `indexarPorFicha`, `opcionesInstructor` | `indexarPorInstructor`, `opcionesFichaAmbiente` | `indexarPorAmbiente`, `opcionesFichaAmbiente`, `opcionesInstructor` | Las transformaciones ya están centralizadas parcialmente, pero el ciclo de carga no. |
| Conflictos | Drawer consulta auditoría por trimestre | No muestra estado contextual | No muestra estado contextual | Consulta auditoría y filtra por ambiente | El único origen correcto se consume de manera desigual. |
| Navegación contextual | Drawer enlaza las tres perspectivas | Enlace al directorio | Enlace al directorio | Enlace al directorio y auditoría | El usuario salta entre pantallas para cambiar de perspectiva sobre los mismos datos. |

Los componentes reutilizables existentes que deben conservarse son
`DrawerHorario`, `GridHorario`, `GridSemanalInstructor`, `GridAsistente`,
`convertirHorariosAGrid`, `celdasDesdeHorarios` e `indexarHorarios.ts`.
La unificación debe extraer el estado/orquestación, no reescribir esos
adaptadores visuales ni duplicar reglas de horarios.

### APIs que se deben conservar

| API | Papel objetivo |
| --- | --- |
| `GET /horarios/` | Fuente común de bloques, filtros y tabla/calendario. |
| `GET /fichas/`, `GET /usuarios/instructores`, `GET /ambientes` | Catálogos de las tres perspectivas. |
| `GET /fichas/{id}/horarios`, `GET /usuarios/{id}/horarios`, `GET /ambientes/{id}/horarios` | Compatibilidad y posible carga diferida para entidades muy grandes; no se elimina en esta migración. |
| `GET /horarios/auditoria-cruces` | Única fuente de conflictos persistidos; se filtra por bloque o entidad en cliente. |
| `GET /usuarios/{id}/carga-semanal` | Dato contextual del instructor, reutilizado por drawer y perspectiva de instructor. |
| `PATCH /horarios/{id}/estado` | Publicar/despublicar desde `DrawerHorario`; no se mueve la autorización al frontend. |

## Arquitectura objetivo

### Estado URL canónico

`/horarios/completos` acepta parámetros explícitos y serializables:

```text
perspectiva=bloques|ficha|instructor|ambiente
vista=lista|calendario|conflictos
idHorario=<número>
idFicha=<número>
idInstructor=<uuid>
idAmbiente=<número>
q=<texto>
jornada=manana|tarde|noche
idTrimestre=<número>
estado=publicado|borrador
pagina=<número>
```

Reglas:

1. `perspectiva=bloques` es el valor predeterminado; `vista=lista` también.
2. Cada perspectiva solo usa su identificador principal; los otros IDs son
   filtros relacionales, no sustituyen a la entidad seleccionada.
3. `idHorario` abre `DrawerHorario` sin alterar la perspectiva activa.
4. La URL representa todos los filtros compartidos. El estado local se usa
   únicamente para controles puramente visuales, como abrir filtros avanzados.
5. La migración reconoce `?id=` solo en las rutas antiguas; dentro de la
   ruta canónica se normaliza una vez a la clave explícita correspondiente.

Ejemplos:

```text
/horarios/completos?perspectiva=ficha&vista=calendario&idFicha=12&idTrimestre=3
/horarios/completos?perspectiva=instructor&vista=lista&idInstructor=uuid&idHorario=44
/horarios/completos?perspectiva=ambiente&vista=conflictos&idAmbiente=8
```

### Composición propuesta

```text
GestionarHorariosPage
├── useGestionarHorariosQuery      ← lee/escribe URL
├── useHorariosData                ← carga catálogos, bloques y auditoría
├── SelectorPerspectiva            ← Bloques / Por ficha / Por instructor / Por ambiente
├── SelectorVista                  ← Lista / Calendario / Conflictos
├── FiltrosHorariosCompartidos     ← texto, período, jornada, estado y relaciones
├── SelectorEntidad (solo perspectiva no global)
├── TablaHorarios | CalendarioHorarios | PanelConflictos
└── DrawerHorario                  ← `idHorario`, relaciones y publicación
```

`useHorariosData` debe iniciar en paralelo las peticiones independientes y
exponer un único estado de carga/error por recurso. En la primera fase puede
calcular todas las perspectivas desde `GET /horarios/`, que ya se usa para
índices globales. Si la cantidad de bloques exige reducir transferencia, una
fase posterior podrá cambiar internamente al endpoint contextual sin cambiar
el contrato de `GestionarHorariosPage` ni la URL.

Las grillas mantienen su semántica actual:

- Ficha y ambiente: `convertirHorariosAGrid` + `GridHorario`.
- Instructor: `GridSemanalInstructor`, porque expresa las franjas y carga
  que hoy usa la coordinación.
- Bloques: tabla como vista de trabajo; el calendario reutiliza el adaptador
  global existente. No se crea una cuarta fuente de calendario.

## Migración incremental

### Fase 0 — contrato y pruebas de caracterización

- Inventariar las pruebas actuales de las cuatro vistas y añadir pruebas que
  documenten los deep links `?id=` y el conjunto de bloques mostrado por cada
  una.
- Definir `PerspectivaHorario`, `VistaHorario` y el esquema de query params
  en un módulo puro con pruebas unitarias.
- No mover rutas ni enlaces todavía.

### Fase 1 — datos, filtros y URL compartidos

- Extraer un hook de consulta para `/horarios/completos` que cargue bloques,
  catálogos e índices de manera paralela.
- Extraer filtro puro por IDs, texto, jornada, trimestre y publicación.
- Hacer que tabla, calendario y conflictos lean el mismo objeto de filtros.
- Introducir los parámetros explícitos sin retirar la lectura interna actual.

Resultado verificable: cambiar de Lista a Calendario preserva filtros, entidad
seleccionada y `idHorario` en la URL.

### Fase 2 — perspectivas dentro de Gestionar horarios

- Añadir el selector de cuatro perspectivas en la cabecera de
  `HorariosCompletos` (que se podrá renombrar internamente a
  `GestionarHorariosPage` sin romper ruta ni export de transición).
- Reutilizar los selectores/listas y las grillas existentes como paneles de
  perspectiva, alimentados por el estado común.
- Conservar el drawer para cualquier bloque de cualquier perspectiva.
- Llevar la alerta de auditoría al panel contextual de ficha, instructor y
  ambiente, filtrando la respuesta oficial por ID y mostrando carga/error.

Resultado verificable: una misma URL con `perspectiva` cambia el panel sin
recargar ni perder filtros; abrir una relación conserva la selección.

### Fase 3 — compatibilidad de rutas antiguas

| Ruta antigua | Redirección compatible propuesta |
| --- | --- |
| `/vista-fichas?id=12` | `/horarios/completos?perspectiva=ficha&vista=calendario&idFicha=12` |
| `/vista-instructores?id=u1` | `/horarios/completos?perspectiva=instructor&vista=calendario&idInstructor=u1` |
| `/vista-ambientes?id=8` | `/horarios/completos?perspectiva=ambiente&vista=calendario&idAmbiente=8` |
| `/horarios/completos?id=44` | `/horarios/completos?perspectiva=bloques&vista=lista&idHorario=44` |

Las rutas antiguas se mantienen en el router con `Navigate` que conserve los
parámetros. No se elimina ningún endpoint ni se cambian los guards de
`ProtectedRoute`.

### Fase 4 — limpieza controlada

- Cambiar todos los enlaces internos a la URL canónica.
- Retirar del menú las entradas duplicadas de las vistas antiguas, pero no sus
  redirecciones.
- Dejar una ventana de compatibilidad acordada y buscar enlaces/documentación
  que aún usen `/vista-*` antes de una eliminación futura.

## Glosario de navegación y encabezados

El texto visible debe venir de una única constante de etiquetas. La ruta puede
permanecer histórica; la etiqueta no debe depender de ella.

| Concepto | Nombre canónico | Uso | Nombres que se dejan de mostrar |
| --- | --- | --- |
| Módulo principal | **Gestionar horarios** | Menú global, título, breadcrumb raíz y enlaces generales. | Horarios completos, Vistas de Horarios. |
| Perspectiva global | **Bloques** | Selector de perspectiva. | Lista global, Horarios completos. |
| Perspectiva académica | **Por ficha** | Selector, breadcrumb contextual y botones. | Vista por fichas, Ver horario por ficha. |
| Perspectiva de recurso humano | **Por instructor** | Selector, breadcrumb contextual y botones. | Vista por instructores, Ver horario por instructor. |
| Perspectiva de espacio | **Por ambiente** | Selector, breadcrumb contextual y botones. | Vista por ambientes, Ver horario por ambiente. |
| Forma de lectura | **Lista** | Selector de vista. | — |
| Forma de lectura | **Calendario** | Selector de vista. | Calendario general, cuando sea parte del módulo. |
| Validación persistida | **Conflictos** | Selector de vista y enlaces del módulo. | Auditoría de cruces, cuando se trate de navegación interna. |
| Pantalla especializada | **Publicaciones programadas** | Menú y título propios. | Publicaciones. |
| Pantalla especializada | **Borradores e historial** | Menú y título propios. | Historial de horarios, si también contiene borradores. |

Aplicación del glosario:

| Lugar | Texto objetivo |
| --- | --- |
| Menú global, grupo Programación | Gestionar horarios; Crear horario; Asistente IA; Publicaciones programadas; Borradores e historial. Las perspectivas, Lista/Calendario/Conflictos no repiten entradas globales. |
| Selector contextual de Gestionar horarios | Bloques · Por ficha · Por instructor · Por ambiente. |
| Selector de vista | Lista · Calendario · Conflictos. |
| Breadcrumb | `Dashboard / Gestionar horarios / Por ficha` (o la perspectiva activa). |
| H1 | `Gestionar horarios`; la perspectiva se expresa como subtítulo o selector, no con otro nombre de módulo. |
| Botones del drawer | `Ver por ficha`, `Ver por instructor`, `Ver por ambiente`; evitan prometer una pantalla distinta llamada “vista”. |
| Redirecciones heredadas | Conservan la ruta antigua, pero el documento cargado usa el glosario canónico. |

## Criterios de aceptación y regresión

1. Un Coordinador o Administrador puede abrir cada perspectiva desde
   `/horarios/completos` sin perder filtros al cambiar entre Lista,
   Calendario y Conflictos.
2. Cada URL canónica se puede copiar/pegar y recupera entidad, filtros y
   drawer del bloque cuando corresponda.
3. Las tres rutas `/vista-*?id=` redirigen a la combinación correcta y no
   pierden el ID seleccionado.
4. Tabla, grillas y drawer representan el mismo `Horario[]`; no aparecen
   bloques de otra entidad ni se recalculan conflictos localmente.
5. `DrawerHorario` conserva publicación, relaciones y enlaces a los
   directorios existentes.
6. La auditoría falla de forma explícita y no se muestra un falso “sin
   conflictos”.
7. El menú, breadcrumbs, H1 y botones usan el glosario sin contradicciones.
8. Se conservan permisos de `GESTION`, endpoints y enlaces a
   publicaciones/historial/directorios.

## Riesgos y decisiones pendientes

- `convertirHorariosAGrid` descarta franjas que no coinciden con la plantilla
  institucional; antes de declarar equivalencia visual total entre
  perspectivas, debe decidirse si la grilla contextual debe soportar también
  franjas del asistente.
- La auditoría global puede ser costosa. La fase 1 debe medirla y solo luego
  decidir carga diferida por la pestaña Relaciones/Conflictos.
- Los filtros actuales por instructor, ficha y ambiente usan a menudo
  nombres visibles. La URL canónica debe transportar IDs; las etiquetas se
  resuelven desde catálogos.
- La información de competencia y RAP no está separada en todos los contratos
  de `Horario`; el drawer debe continuar mostrando únicamente los campos
  disponibles y estados explícitos, sin sintetizar datos académicos.
