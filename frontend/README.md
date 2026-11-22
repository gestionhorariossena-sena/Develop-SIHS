# Frontend SIHS

Cliente web construido con React + Vite + TypeScript + Tailwind.

## Requisitos y configuración

Se requiere Node.js y pnpm. Desde PowerShell, en la raíz del repositorio:

```powershell
Set-Location frontend
pnpm install
Copy-Item .env.example .env
```

Completa `frontend/.env` con la URL y la clave pública de Supabase y la URL
del backend. Consulta [`../database/README.md`](../database/README.md).

## Ejecución

```powershell
pnpm dev
```

Vite muestra la dirección local, normalmente `http://localhost:5173`. Para
cargar datos reales, inicia también el backend siguiendo
[`../backend/README.md`](../backend/README.md).

## Pruebas unitarias y lint

```powershell
pnpm test
pnpm lint
```

## Pruebas E2E

Playwright ejecuta el flujo de inicio de sesión en Chromium y levanta Vite
automáticamente. La prueba autentica una cuenta institucional real de prueba
y verifica que aparezca el panel del rol esperado. El backend y Supabase deben
estar disponibles según `VITE_API_URL` y las variables de `frontend/.env`.
Instala el navegador una vez y, desde PowerShell, pasa las credenciales y el
rol de la cuenta por variables de entorno (no se guardan en el repositorio):

```powershell
pnpm exec playwright install chromium
$env:E2E_LOGIN_IDENTIFIER = "correo-de-prueba@sena.edu.co"
$env:E2E_LOGIN_PASSWORD = "contraseña-de-prueba"
$env:E2E_EXPECTED_ROLE = "Aprendiz"
pnpm test:e2e
```

`E2E_EXPECTED_ROLE` acepta `Aprendiz`, `Instructor`, `Coordinador` o
`Administrador`; debe corresponder al rol asignado a la cuenta. La cuenta debe
poder iniciar sesión en Supabase y no tener cambio obligatorio de contraseña
pendiente. Los selectores del formulario usan sus etiquetas accesibles
(`getByLabel`), no placeholders. Para abrir el navegador mientras corre la
prueba:

```powershell
pnpm test:e2e --headed
```

Los resultados y trazas de fallos se guardan en `test-results/` y el reporte
HTML en `playwright-report/`; ambos directorios están excluidos de Git.

El test que valida solo la presentación del formulario puede ejecutarse sin
credenciales ni backend:

```powershell
pnpm test:e2e --grep "muestra los campos del formulario"
```

## Documentación de desarrollo

- [`ESTRUCTURA.md`](./ESTRUCTURA.md) — qué es cada carpeta/archivo, y cómo
  una pantalla consume el backend (con ejemplo copiable).
- [`OBJETIVO_Y_SERVICIOS_FALTANTES.md`](./OBJETIVO_Y_SERVICIOS_FALTANTES.md) —
  qué pantallas faltan y de qué módulo del backend dependen.

## Interfaz web y rutas vigentes (2026-11-21)

La identidad visual de la rama `fixes-multiples-nicol` utiliza los tokens de [Guía de marca v3](../docs-sihs/Diseño/GUIA_DE_MARCA.md). Las páginas se cargan con `React.lazy` desde `src/routes/AppRouter.tsx`, bajo `Suspense` en `src/App.tsx`.

- El menú **Programación** dirige la creación manual a `/horarios/nuevo`; `/horarios/crear` sigue registrada por compatibilidad. La opción `/horarios/asistente-ia` corresponde al flujo de importación con IA.
- **Gestionar horarios** se consulta en `/horarios/completos`, y la cabecera comparte navegación con `/calendario` y `/horarios/auditoria`. Las vistas contextuales de fichas, instructores y ambientes conservan rutas independientes.
- El panel global presenta métricas, clases del día y conflictos; los roles Instructor y Aprendiz tienen paneles y opciones de autoservicio distintos.
- Las páginas de administración y las acciones de coordinación tienen protecciones de ruta; la autorización definitiva reside en el backend.

Para el mapa de componentes, consultas y permisos consulta [ESTRUCTURA.md](ESTRUCTURA.md).

### Comandos recomendados

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

`pnpm test:e2e` delega en `../e2e`; se necesitan sus dependencias y el entorno que requiera cada escenario. No dar por hecho que las pruebas de login funcionan sin credenciales de prueba apropiadas.

### Flujo de edición y publicación desde Historial (2026-11-21)

El listado principal de Historial es **por horario de ficha y período**, no por bloque individual: combina en una tabla los horarios del constructor y los conjuntos del cargador/IA sin snapshot. Cada fila resume período, estado de publicación y número de clases; al abrirla se muestra la cuadrícula y se habilitan acciones de clases específicas. Cuando un snapshot del constructor conserva identidad propia, se mantiene como entrada separada para no mezclar accidentalmente versiones o conjuntos distintos.


- El detalle de un bloque en **Gestionar horarios** es de consulta: «Abrir en historial» navega a `/horarios/historial?idHorario=<id>` y abre el conjunto que contiene el bloque.
- Si el bloque pertenece a un horario completo del constructor, el historial ofrece **Modificar** (`/horarios/nuevo?editar=<idHorarioGuardado>`), publicación del conjunto, gestión de clases, borrado y exportación.
- Para bloques del cargador sin snapshot, el historial agrupa por ficha y período: ofrece edición individual de instructor, ambiente, RAP, jornada, horas y días, publicación/despublicación del grupo y borrado de bloques. La edición mantiene el estado de publicación y pasa por validaciones del backend.
- **Añadir asignaciones en el constructor** abre `/horarios/nuevo?idFicha=<idFicha>` para precargar la ficha. No convierte automáticamente los bloques importados en un snapshot del constructor.
- El historial no es el módulo de **publicaciones programadas**: este último administra fechas futuras, mientras que publicar/despublicar desde el historial cambia el estado actual.


### Registro de instructores sin código previo (2026-11-21)

El formulario público `/registro` permite solicitar el rol **Instructor** con datos personales y especialidad; **no exige un código `INS-*`** ni consulta endpoints de validación de códigos. La cuenta se crea mediante Supabase Auth con `rol_solicitado: Instructor` en los metadatos; el rol real se asigna posteriormente por un Administrador desde **Usuarios sin rol**. La selección de rol del solicitante nunca constituye autorización por sí misma.

Se retiraron la página `/codigo-instructor`, su acceso en el menú y el paso de generación al aprobar un rol. Permanecen los códigos históricos almacenados en usuarios por compatibilidad de esquema, sin ser utilizados como credenciales o requisito de registro. La solicitud separada de acceso a Coordinador mantiene su propio flujo de aprobación.

## Alta institucional de instructores (2026-11-21)

Los instructores **no se registran por su cuenta** en `/registro`. Esa pantalla queda para Aprendiz; la solicitud de acceso de Coordinador permanece separada.

Desde **Instructores → Registrar instructores**, Administrador y Coordinador pueden dar de alta personas de forma individual o con un archivo `.xlsx`. La nueva ruta `/instructores/registrar` está protegida con los roles de Gestión y consume `POST /instructores/alta/` o `POST /instructores/alta/importar`.

La importación ofrece una **vista previa obligatoria** antes de confirmar. Después de confirmar, el frontend procesa cada instructor con solicitudes individuales y muestra el progreso/resultados; así un Excel grande no depende del timeout de una sola petición. Si el proceso se interrumpe, se puede repetir el archivo: las cuentas ya existentes se omiten en lugar de recibir contraseñas nuevas. No se guardan contraseñas en el frontend ni se devuelven en las respuestas. Los resultados distinguen cuentas creadas, duplicados y correos pendientes. No confundir formato de archivo válido con cuenta nueva garantizada: el sistema también verifica duplicados en la base de datos y Supabase Auth.

**Encabezados provisionales del Excel:** `nombre`, `correo`, `documento` (obligatorios), `tipoContrato`, `horasContratadasSemana`, `sigla` (opcionales). Esta plantilla debe ajustarse al Excel real de coordinación cuando se facilite una muestra; no se presume compatibilidad con formatos no revisados.

Si SMTP no está configurado, la API no permite iniciar nuevas altas. Si la cuenta se crea pero falla el envío, se informa del fallo sin exponer la clave; la vía de recuperación disponible es Recuperar contraseña.


## Cargadores masivos unificados (2026-11-21)

Fichas, Ambientes, Instructores y el plan curricular de Programas comparten el patrón **Carga masiva** (selección → revisión → confirmación → resultado), estilos y ejecución progresiva por elemento. El asistente de horarios con IA permanece separado. Consulta la [guía de cargas masivas](../docs/GUIA_CARGAS_MASIVAS.md) para formatos admitidos, permisos, pruebas y limitaciones.

### Exportación de carga docente (2026-11-21)

En **Instructores**, el botón **Exportar carga docente (.csv)** descarga un CSV UTF-8 compatible con Excel/LibreOffice (separador `;`). Se exportan **todos los instructores que coincidan con los filtros**, sin limitarse a la página visible. Incluye nombre, correo, documento, especialidades, contrato, horas contratadas, horas asignadas semanales según las clases registradas, límite RF-011, horas disponibles, porcentaje de ocupación y estado.

La descarga utiliza datos ya consultados por el directorio, sin una llamada adicional ni un endpoint nuevo; si no se pueden recuperar los horarios, el botón permanece deshabilitado para no exportar cargas falsamente vacías. Las horas asignadas reflejan únicamente clases programadas; no estiman tareas administrativas o de preparación. La exportación está implementada en `src/utils/exportarCargaDocente.ts` y dispone de pruebas propias.
