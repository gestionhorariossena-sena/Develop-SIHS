# Cargas masivas de SIHS — interfaz y lógica compartidas

Actualizado para `fixes-multiples-nicol` (2026-11-21).

## Alcance

Los cargadores de **Fichas**, **Ambientes**, **Instructores** y **Plan curricular (Programas)** usan el término **Carga masiva**, el mismo flujo de selección → revisión → confirmación → resultado y las mismas primitivas de presentación.

**Excepción deliberada:** el asistente de horarios con IA (`/horarios/asistente-ia`) mantiene su propio wizard y motor de interpretación/generación; no fue modificado por esta unificación.

| Entrada | Archivo | Validación y confirmación | Persistencia |
| --- | --- | --- | --- |
| Fichas → Carga masiva | CSV | Encabezados exactos, campos obligatorios por fila y vista previa | Un `POST /fichas/` por fila; resolución de programa/período/sede existente |
| Ambientes → Carga masiva | CSV | Encabezados exactos, campos obligatorios por fila y vista previa | Un `POST /ambientes` por fila; resolución de sede existente |
| Instructores → Registrar instructores → Carga masiva | XLSX | Excel validado en servidor, revisión antes de alta y duplicados | Un `POST /instructores/alta/` por fila; cuenta nueva e invitación |
| Programas → plan curricular → Carga masiva | Excel pedagógico | Vista previa especializada de competencias y resultados | Un `POST /competencias-formacion/` por competencia y resultados asociados |

Los pasos tienen comportamientos compartidos, pero los **esquemas, permisos y reglas de negocio no se homogeneizan por la fuerza**. La validación estructural de un CSV no garantiza que un ID de catálogo exista: los errores de API de cada fila aparecen en el resultado.

## Código reutilizado

- `frontend/src/components/cargaMasiva/FlujoCargaMasiva.tsx`:
  - `PanelCargaMasiva`: contenedor, encabezado y estados de error/éxito.
  - `TituloPasoCarga`: jerarquía de selección, revisión y resultado.
  - `ResumenCargaMasiva`: resultado con filas correctas/fallidas.
  - `ejecutarCargaMasiva`: ejecutor secuencial que informa progreso, aísla errores de cada elemento y devuelve resultados completos.
  - Clases Tailwind compartidas para campos y botones, usando los tokens de [marca SIHS](../docs-sihs/Diseño/GUIA_DE_MARCA.md).
- `frontend/src/components/ImportarArchivo.tsx` es el adaptador CSV de Fichas y Ambientes y conserva las reglas específicas mediante `onImportarFila`.
- `frontend/src/pages/AltaInstructores.tsx` usa la vista previa del backend, el mismo ejecutor y los resultados individuales de invitación.
- `frontend/src/pages/Programas.tsx` utiliza el mismo contenedor y el ejecutor para competencias; cada una procesa sus resultados asociados.
- `backend/app/api/v1/alta_instructores.py` y `backend/app/services/curriculo_service.py` siguen siendo **interpretadores específicos** para sus Excel. No se mezclaron heurísticas de un archivo curricular con datos de identidad.

## Reglas compartidas

1. Ningún cargador crea registros antes de que el usuario confirme.
2. Los archivos se revisan y se muestran errores de formato/columnas antes de confirmar; los errores de relación o duplicados que solo conoce el servidor se registran por elemento.
3. Una fila fallida no interrumpe necesariamente las restantes. En los resultados se distingue lo confirmado de lo fallido para decidir qué repetir.
4. No mostrar datos secretos ni contraseñas temporales en la vista previa.
5. Mantener permisos en el backend: mostrar un botón no autoriza a importar.
6. En local pueden utilizarse datos ficticios y reiniciar la base Docker; no mezclar un `.env` remoto con la demo local.

## Cómo probar antes de la sustentación

Desde la rama `fixes-multiples-nicol`, con dependencias instaladas:

```bash
cd frontend

pnpm exec vitest run tests/unit/components/ImportarArchivo.test.tsx tests/unit/components/FlujoCargaMasiva.test.tsx tests/unit/pages/AltaInstructores.test.tsx tests/unit/pages/Fichas.test.tsx tests/unit/pages/Ambientes.test.tsx tests/unit/pages/Programas.test.tsx
pnpm lint
pnpm build
```

Para validar también los servicios de importación específicos del backend (en su entorno virtual):

```bash
cd ../backend
python -m pytest tests/test_alta_instructores.py tests/test_competencias_importar.py -q
cd ..
```

Para validar el flujo end-to-end, desde la raíz:

```bash
make demo-up
make demo-info
```

Usa los usuarios ficticios que muestra `make demo-info`, carga pequeños archivos de prueba y comprueba tanto los registros nuevos en la base local como el correo en **Mailpit** (http://127.0.0.1:54324). Para devolver la demo a su estado inicial usa `make demo-reset` **únicamente sobre la base local de demostración**.

### Casos mínimos de aceptación

- Fichas/Ambientes: CSV válido, columnas faltantes, celda obligatoria vacía, duplicado y ejecución parcial.
- Instructores: perfil Administrador y Coordinador, rechazo a Instructor/Aprendiz, Excel válido e inválido, duplicados, invitación y cambio obligatorio de contraseña.
- Currículo: Excel pedagógico válido, contenidos repetidos, fallo al crear un resultado sin bloquear todo el lote.
- Consistencia visual: mismas jerarquías y nombres, lectura móvil, mensajes de error accionables y estados de confirmación deshabilitados durante el procesamiento.

**Pendiente de validar en el entorno de ejecución:** esta refactorización no incluye ejecución real de Docker, correo ni Vitest desde el conector GitHub. El éxito de un commit no sustituye esos controles.

## Diferencia entre cargar y exportar

**Carga masiva** incorpora registros desde archivos (Fichas, Ambientes, Instructores y plan curricular). **Exportar carga docente** es una operación de salida desde el directorio de Instructores: genera un CSV con las horas semanales calculadas por las clases programadas, para todos los registros filtrados. No es un quinto importador ni requiere subir un archivo.

Pruebas específicas: `pnpm exec vitest run tests/unit/utils/exportarCargaDocente.test.ts tests/unit/pages/Instructores.test.tsx` desde `frontend/`.

**Accesos desde Instructores:** `Cargar instructores desde Excel` abre la pestaña de importación directamente; `Registrar instructor` abre el formulario manual; `Exportar carga docente (.csv)` genera un archivo de salida con las clases existentes. No confundir la recepción de registros de instructores con una futura importación de horas o asignaciones docentes.
