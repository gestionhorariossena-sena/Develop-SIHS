# Dónde quedó todo — 2026-09-25

Punto de retomada. Lo primero es el incidente de ramas: hasta resolverlo,
`main` y `develop` no tienen el trabajo de estos dos días.

---

## 🔴 1. `main` y `develop` fueron reescritos hacia atrás

Detectado el 2026-09-25 al final de la jornada. **No se perdió nada**: todas
las ramas de trabajo siguen intactas en el remoto. Lo que se perdió son los
*merges* — `main` y `develop` apuntan a commits anteriores.

| Rama | Estaba en | Quedó en |
|---|---|---|
| `develop` | `2c71f0d` (PR #99) | `68e7f8f` (PR #72) |
| `main` | `8dddc1b` (PR #102) | `c28a1ca` ("Dejar que los menús del navbar…") |

`develop` perdió los merges de los PR **#76, #93, #95, #96, #98, #100, #101
y #99**. `main` perdió el release (**#102**) y todo lo anterior: hoy apunta a
un commit suelto que antes solo existía en el working dir local.

### Cómo se recupera

Todo está en ramas vivas del remoto, así que es cuestión de volver a
apuntar (o de rehacer los merges por PR, que es lo limpio):

| Rama remota | Commit | Qué contiene |
|---|---|---|
| `integracion/cierre-huecos` | `0b6c075` | H-1 a H-9, H-13, H-14 reconciliados con develop |
| `feature/full/asistencia` | `0198204` | Módulo de asistencia completo (web + móvil) |
| `fix/asistencia-y-tema` | `0b8f8f7` | Modo oscuro del navbar y pre-login, menú <1024px, PR #103 |
| `feature/full/cierre-huecos-flujos` | `e755878` | Respaldo del trabajo original, por si hace falta |
| `movil/cliente-flutter` | `069ae4d` | Cliente Flutter |

**Antes de tocar nada, confirmar con el equipo quién hizo el force-push y
por qué** — puede haber sido deliberado. Rehacer los merges encima de un
reset intencional solo repetiría el conflicto.

---

## 2. Lo que se construyó y está listo

### Cierre de huecos por rol (11 de 15)
`PLAN_CIERRE_DE_HUECOS_FLUJOS.md` tiene el detalle de cada una y una sección
*Cierre del 2026-09-24* con cómo quedó. Resumen: H-1 a H-9, H-13 y H-14.

Quedan **H-10 parcial, H-11 y H-12** (piden decisión de producto) y **H-15**
(configurar el SMTP en el panel de Supabase; hasta entonces el panel de
administración muestra la credencial temporal para entregarla a mano).

### Módulo de asistencia
Verificado contra la base compartida, no solo en tests: el instructor pasa
lista, corrige —queda **una sola fila** y dos entradas de auditoría
(`REGISTRAR_ASISTENCIA` / `CORREGIR_ASISTENCIA`)— y el aprendiz consulta lo
suyo. Los permisos cruzados responden 403 en ambos sentidos.

- Migración **`c9d4e1f70a33`** (`fechaSesion`) **ya está aplicada** en la base.
- Móvil: solo lectura para el Aprendiz. `ARQUITECTURA_MOBILE.md` sigue
  valiendo tal cual, el cliente Flutter no escribe.
- **Falta decidir**: coordinación no tiene ninguna vista de asistencia. Hoy
  el instructor registra y el aprendiz consulta, y ahí se acaba — nadie
  puede ver cómo va una ficha completa.

### Excel maestro para programar 200 fichas
`_Docs/datos-muestra/MAESTRO_PROGRAMACION_200_FICHAS.xlsx`, generado por
`backend/scripts/armar_excel_maestro.py` (semilla fija: regenerarlo da un
archivo idéntico).

Una hoja por tabla, con una columna **`origen`** en cada una: `excel`,
`derivado` o `inventado`. Esa marca es la que permite borrar la siembra
cuando lleguen los datos reales — **sin ella no hay forma de distinguir una
ficha sembrada de una real**.

**Probado con el generador CP-SAT real**, ficha por ficha acarreando lo ya
ocupado: **1898 de 1898 bloques programados, 0 sin programar, 0 fichas
parciales y 0 choques** de instructor, ambiente o ficha (los choques se
contaron aparte del solver, no me fío de que él mismo se dé el visto bueno).

> **Tardó 35 minutos** (~10 s por ficha). Para las 10-15 fichas del uso
> normal del asistente son 1-2 minutos, pero programar un centro entero no
> puede ser una pantalla que espera: necesitaría un proceso en segundo plano
> con avance visible.

---

## 3. Lo que el sistema NO tiene y hace falta

Del inventario de los Excel del centro contra la base:

| Dato | Estado | Dónde está |
|---|---|---|
| **Horas contratadas** de instructores | **0 de 243 en la base** | En el Excel: dos columnas sin encabezado que suman 32 en planta y 40 en contrato, sin excepción en 216 filas — o sea RF-011. **La validación de tope de horas no puede estar funcionando de verdad.** |
| **`usuario_especialidad`** | **vacía** | El generador valida que el instructor domine la competencia; con la tabla en cero esa regla no filtra nada. El Excel trae 741 filas instructor→actividad. |
| **Capacidad de los ambientes** | **0 de 91** | **No existe en ningún archivo.** Hay que salir a buscarla: sin ella no se valida que una ficha de 30 quepa en un laboratorio de 20. |
| Fechas lectivas y sede de ficha | 0 en la base | 221 y 188 fichas en el Excel |
| Nómina de aprendices | **1 vínculo** | En ningún Excel. Sin esto la asistencia sale casi vacía. |
| Currículo | 14 competencias, 2 de 10 programas | Excel con 741 actividades |

---

## 4. Siguientes pasos sugeridos

1. **Resolver lo de `main`/`develop`** (punto 1). Todo lo demás depende de eso.
2. **Mergear el PR #103** (modo oscuro + menú), si sigue abierto tras la reescritura.
3. **Importador del Excel maestro**, guardando el `origen` de cada fila para
   poder limpiar después con una consulta.
4. **Decidir la capacidad de los ambientes** — el único dato sin respaldo real.
5. **Decidir si coordinación necesita vista de asistencia.**

---

## 5. Estado del entorno local

La carpeta de trabajo (`/home/david/Proyectos/Develop-SIHS`) quedó **sin
sincronizar a propósito**: tenía 11 archivos del móvil sin commitear
(`cache_local.dart` nuevo, `home_screen.dart` modificado) que chocan con lo
que cambió en develop. Conviene que esa sesión termine y commitee antes de
traer nada.

Cuentas de prueba (`backend/scripts/crear_cuentas_prueba.py` las recrea):
`instructor.demo@`, `aprendiz.demo@`, `coordinador.demo@` — todas en
`sihs-pruebas.com`. Las passwords se imprimen al correr el script.
