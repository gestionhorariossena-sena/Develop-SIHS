# T-006 — entrega de chat

## Qué hice

Cerré el trabajo pendiente de T-005 en una rama remota utilizable.

Tomé como base el contrato de T-003 y apliqué los tres puntos reportados en
la revisión T-004 / entrega T-005:

1. **Ambiente**
   - La respuesta separa `nombre: "Ambiente"` y
     `numeroAmbiente: 301`.
   - El contrato aclara que la UI puede componer visualmente
     `Ambiente 301`, sin falsear el esquema.

2. **422 por rango invertido**
   - Se alineó el mensaje con el precedente del backend:
     `fechaInicio no puede ser posterior a fechaFin.`

3. **Historial de asistencia**
   - El contrato declara explícitamente que una asistencia registrada sigue
     formando parte del reporte aunque el horario posteriormente quede
     `activo=False` o `publicado=False`.

Documento:

`_Docs/Documentación general/CONTRATO_REPORTE_ASISTENCIA_FICHA.md`

## Rama

`chat/t-006-t-005-done`

Commit:

`d3ecee739e076360a6be9ce694926446a20f5ce9`

## Territorio declarado

Alcance mínimo: únicamente el documento de contrato HTTP del reporte de
asistencia por ficha.

No modifiqué backend ejecutable, frontend, modelos, migraciones, tests,
`develop` ni `main`.

## Pruebas

No ejecuté pytest porque el cambio es exclusivamente documental y no toca
código ejecutable.

Verifiqué directamente en la rama que quedaron presentes:

- `numeroAmbiente`;
- el mensaje 422 unificado;
- la regla histórica para `activo=False` / `publicado=False`.

## Qué quedó pendiente

La implementación del endpoint continúa fuera de alcance:
schemas Pydantic, router, servicio/repositorio y pruebas HTTP.

## Qué debe verificar David

Revisar el documento corregido y decidir si autoriza su integración a
`develop`. No hace falta recuperar la rama local de T-005: estas
correcciones ya quedaron publicadas en `chat/t-006-t-005-done`.
