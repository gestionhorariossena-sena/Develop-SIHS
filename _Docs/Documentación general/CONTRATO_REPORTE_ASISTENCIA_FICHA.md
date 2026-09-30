# Contrato — reporte de asistencia por ficha

Estado: **diseño de contrato v1; no implementa el endpoint**.

Este contrato se apoya únicamente en entidades que ya existen en SIHS:

- `Ficha` y su nómina en `ficha_usuario`.
- `Horario`, que identifica la ficha, instructor, ambiente y franja.
- `Asistencia`, que registra un aprendiz para una sesión concreta mediante
  `idHorario + idUsuarioAprendiz + fechaSesion`.
- Estados existentes de asistencia: `presente`, `tardanza`, `excusa`,
  `ausente`.

La tabla de asistencia no registra una entidad independiente de "sesión".
Por eso el reporte **no debe inventar clases realizadas a partir del horario
semanal**: una sesión con registro es la combinación distinta
`idHorario + fechaSesion` presente en `asistencias`.

## Endpoint propuesto

```http
GET /api/v1/fichas/{id_ficha}/asistencias/reporte
```

### Autorización v1

Solo:

- `Coordinador`
- `Administrador`

La implementación debe usar el mismo criterio de roles que
`require_admin_o_coordinador`.

Un Instructor no obtiene acceso global al reporte de una ficha en esta
primera versión. Si luego se requiere que un instructor consulte únicamente
fichas/horarios asignados a él, debe definirse como una regla de acceso
separada y no ampliarse este contrato implícitamente.

## Parámetros

### Path

| Nombre | Tipo | Requerido | Regla |
|---|---|---:|---|
| `id_ficha` | integer | sí | Identificador interno de la ficha. Debe existir. |

### Query

| Nombre | Tipo | Requerido | Regla |
|---|---|---:|---|
| `fechaInicio` | date ISO-8601 | sí | Primer día incluido en el reporte. Ej. `2026-07-01`. |
| `fechaFin` | date ISO-8601 | sí | Último día incluido en el reporte. Ej. `2026-09-30`. Debe ser mayor o igual a `fechaInicio`. |

El rango es inclusivo en ambos extremos:

```text
fechaInicio <= Asistencia.fechaSesion <= fechaFin
```

No se incluye `idTrimestre` como filtro v1: el dato determinante del
registro de asistencia es `fechaSesion`, y una ficha ya contiene
`idTrimestre`. Si negocio necesita después un atajo por período, puede
resolverse traduciendo el período a un rango de fechas sin cambiar la
semántica del reporte.

## Respuesta 200

Los nombres siguen el estilo camelCase usado por los schemas públicos del
backend.

```json
{
  "ficha": {
    "idFicha": 42,
    "codigoFicha": "3228973 B",
    "idTrimestre": 3,
    "programa": {
      "idPrograma": 7,
      "codigoPrograma": "ADSO",
      "nombrePrograma": "Análisis y Desarrollo de Software"
    },
    "aprendicesVinculados": 30
  },
  "rango": {
    "fechaInicio": "2026-07-01",
    "fechaFin": "2026-09-30"
  },
  "resumen": {
    "sesionesRegistradas": 18,
    "registrosAsistencia": 510,
    "aprendicesConRegistro": 29,
    "aprendicesImpactados": 27,
    "coberturaImpactoPct": 90.0,
    "estados": {
      "presente": 430,
      "tardanza": 25,
      "excusa": 15,
      "ausente": 40
    }
  },
  "sesiones": [
    {
      "idHorario": 123,
      "fechaSesion": "2026-09-14",
      "horaInicio": "08:00:00",
      "horaFin": "10:00:00",
      "instructor": {
        "idUsuario": "7fd6b5df-c3eb-4ed4-b173-67ca5f987abc",
        "nombre": "Instructor ejemplo"
      },
      "ambiente": {
        "idAmbiente": 12,
        "nombre": "Ambiente 301"
      },
      "resultado": {
        "idResultado": 55,
        "codigo": "RA-01",
        "descripcion": "Resultado de aprendizaje"
      },
      "registros": 29,
      "estados": {
        "presente": 24,
        "tardanza": 2,
        "excusa": 1,
        "ausente": 2
      }
    }
  ],
  "aprendices": [
    {
      "idUsuario": "1c9a21cd-6110-42ce-b681-57d472f239ab",
      "nombre": "Aprendiz ejemplo",
      "rolEnFicha": null,
      "sesionesRegistradas": 18,
      "estados": {
        "presente": 15,
        "tardanza": 1,
        "excusa": 1,
        "ausente": 1
      },
      "impactado": true
    }
  ],
  "advertencias": []
}
```

### Semántica de los agregados

- `aprendicesVinculados`: cantidad actual de vínculos de la ficha en
  `ficha_usuario`. No se deduce a partir de asistencias.
- `sesionesRegistradas`: cantidad de pares distintos
  `(idHorario, fechaSesion)` con al menos un registro dentro del rango.
- `registrosAsistencia`: cantidad total de filas de `asistencias`
  incluidas.
- `aprendicesConRegistro`: aprendices distintos con al menos una fila de
  asistencia, cualquiera que sea su estado.
- `aprendicesImpactados`: aprendices distintos con al menos un estado
  `presente` o `tardanza` dentro del rango.
- `coberturaImpactoPct`:
  `aprendicesImpactados / aprendicesVinculados * 100`, redondeado a dos
  decimales. Si `aprendicesVinculados == 0`, debe ser `null` y agregarse
  una advertencia.
- `impactado` por aprendiz: `true` si tiene al menos una asistencia
  `presente` o `tardanza` en el rango.
- `excusa` se reporta como su propia categoría y **no se cuenta como
  impacto**. Este contrato no inventa una equivalencia entre excusa y
  presencia.

Los cuatro contadores en `estados` deben sumar el total correspondiente.
La implementación debe tratar un valor de estado fuera de los cuatro valores
conocidos como inconsistencia de datos, no descartarlo silenciosamente.

### Orden estable

Para que frontend, exportaciones y pruebas sean deterministas:

- `sesiones`: `fechaSesion ASC, horaInicio ASC, idHorario ASC`.
- `aprendices`: `nombre ASC, idUsuario ASC`.

## Ficha existente sin registros en el rango

No es un error.

Debe devolver `200`, preservando los datos de ficha/nómina y usando:

```json
{
  "resumen": {
    "sesionesRegistradas": 0,
    "registrosAsistencia": 0,
    "aprendicesConRegistro": 0,
    "aprendicesImpactados": 0,
    "coberturaImpactoPct": 0.0,
    "estados": {
      "presente": 0,
      "tardanza": 0,
      "excusa": 0,
      "ausente": 0
    }
  },
  "sesiones": [],
  "aprendices": [],
  "advertencias": ["No hay registros de asistencia en el rango solicitado."]
}
```

Si además la ficha no tiene aprendices vinculados, `coberturaImpactoPct`
es `null` y la advertencia debe indicarlo.

## Casos de error

### 401 — no autenticado

Se mantiene el comportamiento estándar del backend cuando falta o no es
válido el token.

### 403 — rol sin permiso

Ejemplo:

```json
{
  "detail": "No autorizado"
}
```

Aplica, en v1, a Instructor y Aprendiz.

### 404 — ficha inexistente

```json
{
  "detail": "Ficha no encontrada"
}
```

No debe confundirse con una ficha válida sin asistencias, que responde 200.

### 422 — parámetros inválidos

FastAPI/Pydantic conserva su respuesta estándar para fechas ausentes o con
formato inválido.

Para un rango invertido:

```json
{
  "detail": "fechaFin debe ser mayor o igual a fechaInicio"
}
```

### 500 — inconsistencia interna de estados

Si existen filas cuyo `estado` no pertenece a
`presente|tardanza|excusa|ausente`, la implementación debe fallar de forma
visible y registrar el incidente en logs. No debe transformar esos valores
a otra categoría ni producir porcentajes aparentemente válidos.

La respuesta pública no debe incluir detalles de SQL ni datos sensibles.

## Invariantes de consulta

Al implementar:

1. Solo se incluyen asistencias cuyo `Horario.idFicha == id_ficha`.
2. Se filtra por `Asistencia.fechaSesion`, no por fecha de creación.
3. Una asistencia de un horario de otra ficha nunca entra aunque el aprendiz
   esté vinculado a ambas.
4. El detalle de aprendices del reporte parte de quienes tienen registros en
   el rango; `aprendicesVinculados` parte de `ficha_usuario`.
5. No se infieren ausencias para aprendices sin fila: con el modelo actual no
   se puede distinguir de forma fiable entre "faltó" y "esa sesión nunca
   tuvo lista completa". Una ausencia solo existe cuando hay una fila
   explícita con `estado = "ausente"`.
6. No se inventan sesiones a partir de la recurrencia semanal de
   `horarios`.

## Ejemplo de request

```http
GET /api/v1/fichas/42/asistencias/reporte?fechaInicio=2026-07-01&fechaFin=2026-09-30
Authorization: Bearer <token>
```

## Fuera de alcance de este contrato

- Crear o modificar asistencias.
- Exportar PDF/Excel.
- Reporte global de varias fichas.
- Acceso restringido de Instructor a sus fichas.
- Inferir ausencias faltantes.
- Sincronización con SOFIA Plus.
- Cambios de esquema o migraciones.
