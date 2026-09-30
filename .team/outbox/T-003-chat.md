# T-003 — entrega de chat

## Qué hice

Diseñé el contrato v1 del endpoint de reporte de asistencia por ficha y lo
documenté en:

`_Docs/Documentación general/CONTRATO_REPORTE_ASISTENCIA_FICHA.md`

Contrato propuesto:

```http
GET /api/v1/fichas/{id_ficha}/asistencias/reporte?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
```

El documento define:

- autorización inicial para Coordinador/Administrador;
- parámetros de path y rango de fechas inclusivo;
- respuesta con datos de ficha, resumen, sesiones y agregados por aprendiz;
- semántica exacta de `aprendicesImpactados`, cobertura y estados;
- comportamiento 200 para una ficha válida sin registros;
- errores 401, 403, 404, 422 y tratamiento de estados inconsistentes;
- orden determinista de colecciones;
- invariantes para no inventar sesiones ni ausencias que el modelo actual no
  puede demostrar;
- aspectos explícitamente fuera de alcance.

## Rama

`chat/t-003-disena-el-contrato-del-endpoint-de-repor`

Commit:

`3b01f1f2b2612ba20b03272ba7487edd6173a21e`

## Territorio declarado

Alcance mínimo: **solo documentación del contrato HTTP del reporte de
asistencia por ficha**.

No modifiqué routers, servicios, repositorios, modelos, migraciones,
frontend, `develop` ni `main`.

## Decisiones importantes

- El rango filtra por `Asistencia.fechaSesion`, no por
  `fechaCreacion`.
- Una sesión registrada es el par `idHorario + fechaSesion` existente en
  la tabla de asistencias. No se infieren sesiones desde la recurrencia del
  horario.
- No se infieren ausencias para aprendices sin fila explícita.
- `aprendicesImpactados` significa aprendices distintos con al menos una
  marca `presente` o `tardanza`.
- Una ficha existente sin asistencias en el rango responde 200 con totales
  en cero, no 404.
- Instructor queda fuera de acceso v1 hasta definir una regla explícita de
  "solo fichas/horarios propios".

## Pruebas

No ejecuté pytest porque la tarea es exclusivamente de diseño documental y
no modifica código ejecutable.

## Pendiente

La implementación del router, schemas Pydantic, repositorio/servicio y
pruebas HTTP queda para una tarea posterior.

Antes de implementar conviene que David confirme si:

1. `presente | tardanza` es la definición de "aprendiz impactado";
2. Coordinador/Administrador son los únicos roles autorizados al reporte v1;
3. el detalle por aprendiz debe formar parte de la respuesta inicial o
   separarse en un endpoint posterior.

## Qué debe verificar David

Revisar especialmente las tres decisiones de negocio anteriores. Si se
aprueban, el contrato queda listo para convertirse en schemas + endpoint sin
cambiar su semántica.
