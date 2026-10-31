# Auditoría Técnica del Proyecto Anterior y Justificación del Reinicio

**Proyecto:** Sistema de Horarios SIHS — SENA CGMLTI (Teleinformática)
**Equipo:** Smart Cats (Angel Gómez, Edith Caro, Dayana Manrique, Nicol Neira)
**Repositorio auditado:** `PROYECTO_FORMATIVO` (versión anterior)
**Repositorio de destino:** `PROYECTO-SIHS-` (este repositorio)

> Nota: `database/01_creacion.sql` ya incorpora las correcciones descritas en
> este documento (especialidades, `codigoPrograma` único, FKs de `horarios`
> completas, adopción de Supabase Auth). Este archivo es la referencia formal
> de por qué se hicieron.

---

## 1. Objetivo del sistema (recordatorio)

El problema identificado en la elicitación con el coordinador de Teleinformática
es concreto: ambientes, instructores, horarios y fichas se administran
manualmente en PDF/Word/Excel, y no hay forma sistemática de evitar que un
mismo instructor, ambiente o ficha queden cruzados en el mismo bloque horario.
**Detectar y prevenir esos cruces es el objetivo central del sistema** — no un
detalle más entre otros módulos.

## 2. Diagnóstico técnico del proyecto anterior

Se analizó el repositorio `PROYECTO_FORMATIVO` completo (backend, documentación,
diagramas, requisitos en sus 4 versiones) mediante extracción estructural y
semántica (grafo de conocimiento, 655 nodos / 782 relaciones).

**Lo que sí se construyó** (backend FastAPI + SQLAlchemy + PostgreSQL,
arquitectura en capas `routes → controller → service → repository`):

- Módulo `auth`: login JWT, hash de contraseñas (bcrypt), recuperación de
  contraseña por token temporal.
- Módulo `roles`: CRUD completo.
- Módulo `usuario_rol`: asignación muchos-a-muchos.
- Módulo `usuarios`: CRUD completo.

**Lo que quedó únicamente en diseño, sin una sola línea de código:**

- `horarios` — el módulo que detecta cruces, es decir, el objetivo del
  proyecto.
- `fichas`, `ambientes`, `programas`, `trimestres`, `coordinaciones`, `sedes`,
  `jornadas`, `especialidades`.
- `competencias_formacion`, `resultados_aprendizaje`, `actividades_aprendizaje`.

En términos de dominio: **4 de 17 tablas del modelo de datos llegaron a tener
código funcional**, y ninguna de las 4 implementadas pertenece al núcleo del
problema que el sistema debía resolver.

## 3. Causas raíz identificadas

1. **Alcance inicial sobredimensionado.** La propuesta original (`Propuesta de
   proyecto V1.md`) cubría dos problemáticas no relacionadas (Teleinformática
   y Bienestar al Aprendiz) a la vez. Se corrigió en `cambio de alcance_01.md`,
   pero la corrección llegó tarde en el cronograma del trimestre.
2. **El esfuerzo de desarrollo se concentró en infraestructura de soporte**
   (autenticación, roles, conexión Docker/PostgreSQL) antes que en el dominio
   de negocio. Válido como base, pero consumió el tiempo disponible sin tocar
   el problema real.
3. **El modelo de datos tuvo que corregirse después de diseñado**, no antes:
   faltaban las FK completas en `horarios` (instructor/ambiente/ficha/resultado)
   necesarias para poder detectar cruces, y no existía un catálogo de
   especialidades ni un código único de programa. Estas correcciones ya están
   aplicadas en `database/01_creacion.sql` de este repositorio.
4. **Sin herramienta de migraciones.** Los cambios de esquema se hacían
   editando el script SQL directamente, sin historial versionado ni forma
   segura de aplicarlos en equipo.
5. **Persistencia local sin estrategia de colaboración.** La base de datos
   vivía en un contenedor Docker local de cada integrante, dificultando
   compartir datos de prueba y trabajar en paralelo.
6. **Autenticación propia sin endurecer.** El login JWT/bcrypt hecho a mano no
   llegó a cubrir rate-limiting de intentos, rotación/expiración de tokens ni
   un flujo de recuperación de contraseña robusto — justo el tipo de código
   más costoso de hacer bien con el tiempo disponible de un proyecto formativo.

## 4. Qué se reutiliza del proyecto anterior (activos validados)

- **Esquema de base de datos completo** (`database/01_creacion.sql`): las 17
  tablas, tipos ENUM, índices sobre las FK de `horarios` y el `EXCLUDE
  USING gist` (comentado, listo para activar) que bloquea cruces desde la
  propia base de datos.
- **Patrón de arquitectura en capas** del backend anterior — probado y
  funcional, se replica módulo por módulo en este repositorio.
- **Lógica de `roles`/`usuario_rol`/`usuarios`** — se porta como base (el
  módulo `auth` en sí se reemplaza por Supabase Auth, ver §6).
- **Wireframes y mockups de diseño** (Login, Dashboard, Recuperar contraseña)
  como referencia de flujo — pendientes de rediseño con identidad
  institucional SENA antes de implementarse.

## 5. Decisión

Se decide **no continuar sobre `PROYECTO_FORMATIVO`** y trabajar en un
monorepo nuevo (`PROYECTO-SIHS-`), reutilizando únicamente los activos
validados de la sección 4, y **priorizando el módulo `horarios` mucho antes**
en el cronograma de lo que ocurrió la vez anterior.

## 6. Stack tecnológico definido

| Capa | Decisión | Justificación |
|---|---|---|
| Base de datos | PostgreSQL gestionado en **Supabase** | Resuelve la colaboración en equipo (un solo origen de datos compartido, no una BD por integrante); el esquema existente migra con ajustes menores (ver §6.1) |
| Autenticación | **Supabase Auth** (SDK `supabase-js` en frontend, verificación de JWT en backend) — reemplaza el JWT/bcrypt propio | El auth propio es la parte del sistema anterior con más riesgo de seguridad no probado (sin rate-limiting de intentos, sin rotación de tokens); Supabase Auth ya cubre login, sesiones, recuperación de contraseña por correo y se integra nativamente con RLS de Postgres |
| Migraciones | **Alembic** | Historial de cambios de esquema versionado y aplicable en equipo, ausente en el proyecto anterior |
| Backend | FastAPI + SQLAlchemy 2.0 + Pydantic v2 | Mismo patrón en capas ya probado; el módulo `auth` deja de reimplementar login/hash y pasa a verificar los JWT que emite Supabase Auth |
| Integridad de horarios | `EXCLUDE USING gist` de PostgreSQL sobre `horarios` + Row Level Security por rol | Bloquea cruces de instructor/ambiente a nivel de base de datos, no solo con validación en la aplicación; RLS restringe qué horarios puede ver/editar cada rol usando `auth.uid()` |
| Frontend | React + Vite + TypeScript + React Router + TailwindCSS + `@supabase/supabase-js` | Se mantiene simple y consistente con el stack ya usado en otros proyectos del equipo; `supabase-js` sustituye el código de auth a mano, no es una librería "extra" |
| Testing | pytest (backend) | Ya presente en el esqueleto actual |
| CI | GitHub Actions | Gate automático de lint/test sobre el flujo de ramas `main`/`develop`/`feature` ya definido en el README |

### 6.1 Ajustes al esquema por adoptar Supabase Auth

`database/01_creacion.sql` ya se actualizó (2026-08-23) para reflejar esta
decisión:

- `usuarios."idUsuario"` pasa de `SERIAL` a `UUID REFERENCES auth.users(id)`
  — Supabase Auth genera UUIDs, no enteros. Toda FK que apuntaba a
  `usuarios` (`usuario_rol`, `usuario_especialidad`, `ficha_usuario`,
  `horarios.idInstructor`) se actualizó al mismo tipo.
- `usuarios` deja de guardar `password`: la contraseña vive en `auth.users`,
  administrada por Supabase.
- La tabla `password_reset_tokens` se elimina: el flujo de recuperación por
  correo ya lo cubre Supabase Auth nativamente.

### 6.2 Configuración del proyecto Supabase

Al crear el proyecto (2026-08-23) se activaron estas opciones de la Data API:

| Opción | Estado | Motivo |
|---|---|---|
| Habilitar API de datos | Activada | La usa `supabase-js` (aunque Auth en sí funciona por un servicio aparte, independiente de este toggle) |
| Exponer automáticamente nuevas tablas | Desactivada | Control manual de acceso — evita que una tabla quede pública por olvido |
| Habilitar RLS automático | Activada | Toda tabla nueva nace con RLS encendido y sin políticas: bloqueada por defecto hasta que se abra explícitamente módulo por módulo |

Con esta combinación, cada tabla que cree `01_creacion.sql` nace inaccesible
por la API hasta que el equipo agregue deliberadamente permisos y políticas
RLS por fase (auth/roles → catálogos → horarios), en vez de heredar acceso
por defecto como pudo pasar en el proyecto anterior.

## 7. Ruta de desarrollo

1. **Fase 0 — Cimientos**: Supabase configurado, esquema migrado desde
   `01_creacion.sql`, Alembic inicializado.
2. **Fase 1 — Auth/roles con Supabase Auth**: integrar `supabase-js` en el
   frontend y verificación de JWT de Supabase en el backend; portar la
   lógica de `roles`/`usuario_rol` (esa sí reutilizable tal cual) y las
   políticas RLS base por rol.
3. **Fase 2 — Catálogos base**: coordinaciones, programas, trimestres,
   fichas, sedes, ambientes, especialidades.
4. **Fase 3 — Núcleo del negocio**: módulo `horarios` con detección de cruces
   activa (`EXCLUDE` constraint). Objetivo real del sistema.
5. **Fase 4 — Resultados/competencias/actividades de aprendizaje.**
6. **Fase 5 — Frontend**: Login/Registro/Recuperar contraseña (con diseño
   institucional aprobado) → Dashboard → vista de horarios → CRUDs de apoyo.
7. **Fase 6 — Reportes, notificaciones, despliegue y endurecimiento.**

---

*Documento generado a partir de un análisis estructurado (grafo de
conocimiento) del repositorio `PROYECTO_FORMATIVO` completo: código backend,
documentación, requisitos (V1–V4), diagramas MER/UML y wireframes.*
