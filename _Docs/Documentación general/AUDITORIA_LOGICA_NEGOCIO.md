# Auditoría de lógica de negocio (2026-09-06)

Auditoría enfocada en LÓGICA DE NEGOCIO, no estilo/tipos — busca casos donde
el sistema haga algo distinto de lo que el negocio (SENA/coordinación
académica) realmente necesita, comparando código real contra
`_Docs/Informes de requisitos/Requisitos Funcionales V4.pdf` (RF-001,
RF-002, RF-011, RF-012) y `_Docs/Documentación general/
REGLAS_DE_NEGOCIO_CONOCIDAS.md`. No se corrigió nada — solo hallazgo.
Archivos leídos completos: `backend/app/services/horario_service.py`,
`backend/app/core/supabase_auth.py`, `backend/app/repositories/
horario_repository.py`.

## Hallazgo 1 — CRÍTICO: "resultado repetido" no verifica que sea el mismo instructor

**Dónde:** `backend/app/repositories/horario_repository.py`,
`buscar_resultado_en_ficha` (líneas ~110-137), usado por
`HorarioService._detectar_cruces`/`validar_dry_run`.

**Regla real (RF-011, pág. 15-16):** *"2 instructores no pueden ser
asignados a un mismo resultado dentro de la misma ficha."*

**Qué hace el código:** la función busca horarios existentes con el mismo
`(idFicha, idResultado)`. Si el horario existente comparte **al menos un
día** con el candidato nuevo, lo trata como "continuación de la misma
clase" y **no lo marca como conflicto** — sin mirar en ningún momento si el
`idInstructor` es el mismo. Esta lógica de "continuación por día
compartido" se agregó a propósito el 2026-09-02 para resolver un falso
positivo real (partir una clase en dos bloques el mismo día), pero al
hacerlo se perdió la comparación de instructor que la regla original sí
exige.

**Caso concreto que lo dispara:** ficha 5, resultado 10.
- Horario A: instructor X, lunes 06:00–09:00, ficha 5, resultado 10 (ya guardado).
- Horario B: instructor Y (**distinto**), lunes 10:00–12:00, ficha 5, resultado 10.

`buscar_resultado_en_ficha` ve que A y B comparten el lunes → lo trata como
continuación → no hay conflicto de "resultado_repetido". Tampoco hay
`cruce_ficha` (A y B no se solapan en horas) ni `cruce_instructor` (X ≠ Y).
**El sistema deja pasar sin ninguna alerta que dos instructores distintos
queden asignados al mismo resultado de la misma ficha** — exactamente el
caso que RF-011 prohíbe explícitamente.

**Por qué importa:** es la validación de contenido pedagógico (no de
horario) que evita que un mismo tema quede "dictado por dos personas
distintas" sin que nadie se entere — el propio negocio lo señaló como un
problema real en la entrevista de Logística (marca con punto rojo en su
Excel). Hoy el sistema es más permisivo que el proceso manual que reemplaza.

**Posible arreglo (no implementado, solo la idea):** en el bucle de
`buscar_resultado_en_ficha`, cuando los días se solapan, seguir tratándolo
como "continuación válida" **solo si** `horario.idInstructor == data.idInstructor`
(o el id de instructor que traiga el candidato); si el instructor es
distinto, sí marcar conflicto aunque compartan día.

## Hallazgo 2 — MODERADO: RF-001 pide bloquear el login, el código solo bloquea funcionalidades

**Dónde:** `backend/app/core/supabase_auth.py`, función `get_current_user`
(líneas 44-75).

**Regla real (RF-001, pág. 1-2):** *"Solo los coordinadores verificados por
un administrador podrán iniciar sesión."* Es una restricción sobre el
**login**, no sobre el acceso a una función puntual.

**Qué hace el código:** `get_current_user` acepta cualquier token válido de
Supabase Auth. Si no existe fila en `usuarios` para ese `idUsuario`, **la
crea automáticamente en el momento**, sin rol, sin ningún chequeo de
"verificado por administrador". El usuario queda autenticado (login exitoso
a nivel de sesión/token) de inmediato. La verificación real solo ocurre
después, y de forma indirecta: cada *endpoint* protegido exige un rol vía
`require_roles(...)`, y el rol se asigna manualmente en
`AprobarlicitarSolicitudes.tsx` (`POST /usuario-rol/asignar`). Sin rol
asignado, el usuario "inició sesión" (tiene sesión válida) pero no puede
usar nada — que es un resultado observable distinto de "no podrá iniciar
sesión".

**Por qué importa:** no es una brecha de seguridad de datos (los endpoints
sensibles sí exigen rol), pero es una discrepancia literal con el
requisito, y tiene un efecto práctico real: cualquier persona con acceso al
formulario de registro obtiene una sesión autenticada y una fila en
`usuarios` inmediatamente, en vez de quedar bloqueada hasta que un
administrador la verifique. Si el negocio espera que un coordinador no
autorizado ni siquiera pueda "entrar" (ver una pantalla de "pendiente de
aprobación", por ejemplo), hoy no pasa así — entra y ve una app vacía por
falta de rol, que es una experiencia distinta a un login rechazado.

**No confundir con:** el bloqueo de 3 intentos fallidos de login sí está
cubierto aparte (`POST /auditoria/intento-fallido-login`, RNF-26/27) — este
hallazgo es sobre la verificación de coordinador, no sobre fuerza bruta.

## Hallazgo 3 — Tensión documentada (no es un bug oculto): regla de sede única en jornadas continuas

**Dónde:** `backend/app/services/horario_service.py`,
`_validar_reglas_instructor` (líneas 397-405, comentario explícito ya
presente en el código).

El propio código ya deja escrito que implementa la regla de RF-011 ("un
instructor asignado en un centro de formación no puede ser asignado a otro
centro en jornadas continuas") **a pesar de** que una entrevista real
documentada en `REGLAS_DE_NEGOCIO_CONOCIDAS.md` describe un caso real de un
instructor programado el mismo día en dos sedes distintas (mañana en una,
tarde en otra) como práctica normal y válida. No es un hallazgo nuevo ni un
error de programación — el autor ya lo señaló y dejó la decisión pendiente
para el equipo/producto. Lo dejo listado acá para que quede en el mismo
documento que el resto de la auditoría: **hay que decidir qué manda** (el
requisito formal escrito, o la práctica real confirmada en campo) antes de
que alguien "corrija" esto en una dirección u otra sin saber que ya se
discutió.

## Lo que se revisó y NO mostró discrepancia

- Tope de horas semanales por tipo de contrato (32h planta / 40h contrato,
  RF-011) — implementado correctamente en `_validar_reglas_instructor`,
  suma horas existentes + la nueva antes de comparar contra el límite.
- Jornada Noche vedada para instructores de planta (RF-011) — implementado
  correctamente, condición directa sobre `tipoContrato == "planta"` y
  `nombreJornada == "Noche"`.
- Cruce de ficha/instructor/ambiente por solape de horas (RF-011 último
  párrafo, y las 3 reglas de `REGLAS_DE_NEGOCIO_CONOCIDAS.md`) —
  implementado con solape real de horas + día compartido vía
  `buscar_solape`, cubre los 3 tipos.
- `auditar_conflictos` (barrido para la pantalla de Auditoría) reutiliza
  `validar_dry_run` sin duplicar reglas — no hay riesgo de que el barrido y
  la validación en vivo diverjan con el tiempo.
- No se pueden listar fichas con "Formación finalizada" (RF-012) — fuera
  del alcance de los archivos leídos en esta pasada, no verificado; alguien
  debería confirmarlo en el servicio de fichas.

## Siguiente paso sugerido

Empezar por el Hallazgo 1 (es el más concreto y el más barato de corregir:
un solo `if` extra en `buscar_resultado_en_ficha`), después decidir el
Hallazgo 3 con el coordinador (es una decisión de negocio, no de código), y
evaluar si el Hallazgo 2 amerita agregar un estado explícito
`pendiente_verificacion` a `usuarios` en vez de solo "sin rol".
