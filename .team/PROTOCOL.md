# Protocolo del equipo de agentes — Develop-SIHS

Tres agentes trabajan sobre este repo. Esta rama (`team/board`) es la pizarra
compartida: NO contiene código, solo coordinación. El código vive en `develop`
y en las ramas de trabajo de cada agente.

## Agentes y territorios

| Agente     | Dónde trabaja                   | Ramas de trabajo |
|------------|---------------------------------|------------------|
| `chat`     | GitHub (conector de ChatGPT)    | `chat/*`         |
| `codex`    | worktree local `wt/codex-sihs`  | `codex/*`        |
| `cc`       | worktree local `wt/cc-sihs`     | `cc/*`           |

Regla de oro: **nadie comparte working tree y nadie escribe en `develop` ni
`main`**. Los merges a `develop` los autoriza David. `chat` puede mergear
libremente dentro de `chat/*`, nunca hacia `develop`.

## Reparto por fortaleza

- `chat` — arquitectura, especificaciones, diseño de esquema, código nuevo
  extenso, documentación larga. Tareas gruesas y pocos viajes (cada viaje
  cuesta atención humana).
- `codex` — implementación acotada, tests, refactors mecánicos, migraciones,
  corrección de bugs concretos. Corre headless, sin supervisión.
- `cc` — integración y merges, verificación real en la máquina (builds, correr
  la app, Flutter), y cualquier cosa que requiera el entorno local.

## Ciclo de vida de una tarea

1. David lanza `duo "<lo que quiere>"`.
2. El router (script, sin IA) clasifica y elige dueño balanceando el ledger.
3. Se escribe el brief en `.team/inbox/<agente>/T-NNN.md` y se publica.
4. El agente trabaja **en su rama**, y al terminar escribe su entregable en
   `.team/outbox/T-NNN-<agente>.md` (qué hizo, qué rama, qué falta).
5. `duo status` muestra el tablero. La integración es un paso aparte y humano.

## Para el agente que lee un brief

- Trabaja solo en la rama indicada en el brief. Si no existe, créala desde
  `develop`.
- No toques archivos fuera del alcance declarado en `Territorio`.
- Si necesitas algo de otro agente, escríbelo en la sección `Bloqueos` de tu
  entregable en `outbox/`. No lo resuelvas invadiendo su territorio.
- Al terminar, entregable en `outbox/` y push de tu rama. Nada más.
