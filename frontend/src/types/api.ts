// Espejo de los schemas Pydantic del backend (backend/app/schemas/*.py).
// Si un schema cambia allá, este archivo hay que actualizarlo a mano — no
// hay generación automática todavía.

import type { BloqueClase, GridAsignaciones } from '../pages/horario/tipos'

export interface Rol {
  idRol: number
  nombre: string
}

export interface Especialidad {
  idEspecialidad: number
  nombre: string
  descripcion: string | null
  activo: boolean
}

export interface Usuario {
  idUsuario: string
  nombre: string
  email: string
  estado: 'activo' | 'inactivo'
  fechaRegistro: string
  tipoContrato?: string | null
  horasContratadasSemana?: number | null
  codigoInstructor?: string | null
  roles: Rol[]
  especialidades: Especialidad[]
}

// Espejo de CargaSemanalResponse (backend/app/schemas/usuario.py) —
// GET /usuarios/{id}/carga-semanal, para la sección "Carga semanal" del
// drawer de instructor. horasMaximas es null cuando el usuario no tiene
// tipoContrato definido (no hay tope de RF-011 que calcular).
export interface CargaSemanal {
  idUsuario: string
  tipoContrato: string | null
  horasAsignadas: number
  horasMaximas: number | null
}

export interface EstadoLogin {
  bloqueado: boolean
  intentos: number
  intentosRestantes: number
  segundosParaDesbloqueo: number | null
}

export interface Jornada {
  idJornada: number
  nombreJornada: string
}

export interface DiaSemana {
  idDia: number
  nombreDia: string
}

export interface Trimestre {
  idTrimestre: number
  nombre: string
  fechaInicio: string
  fechaFin: string
  estado: 'planeado' | 'activo' | 'finalizado'
}

export interface Ficha {
  idFicha: number
  codigoFicha: string
  idPrograma: number
  idTrimestre: number
  idSede: number | null
  programa: Programa
  trimestre: Trimestre
  sede: Sede | null
  aprendicesTotales: number
  jornadas: string[]
}

export interface Programa {
  idPrograma: number
  codigoPrograma: string
  nombrePrograma: string
  nivelFormacion: string | null
  activo: boolean
  idCoordinacion: number
}

export interface Sede {
  idSede: number
  nombreSede: string
  direccion: string | null
  tipoSede: 'principal' | 'secundaria' | 'alterna' | null
}

export interface Ambiente {
  idAmbiente: number
  numeroAmbiente: number
  nombreAmbiente: string
  tipoAmbiente: 'regular' | 'especial'
  estadoAmbiente: 'disponible' | 'mantenimiento' | 'inactivo'
  idSede: number
}

export interface ResultadoAprendizaje {
  idResultado: number
  codigo: string | null
  descripcion: string
  idCompetencia: number
  idGuia: number | null
  horasAsignadas: number | null
}

// Espejo de HorarioResponse (backend/app/schemas/horario.py) — el módulo
// real, con las 4 validaciones de cruce en el backend. Distinto de
// HorarioGuardado (más abajo), que es el puente JSONB anterior.
export interface Horario {
  idHorario: number
  horaInicio: string
  horaFin: string
  idJornada: number
  idTrimestre: number
  idAmbiente: number
  idInstructor: string
  idFicha: number
  idResultado: number
  dias: number[]
  instructorNombre: string | null
  fichaCodigo: string | null
  ambienteNombre: string | null
  resultadoCodigo: string | null
  resultadoDescripcion: string | null
}

export interface HorarioCreate {
  horaInicio: string
  horaFin: string
  idJornada: number
  idTrimestre: number
  idAmbiente: number
  idInstructor: string
  idFicha: number
  idResultado: number
  dias: number[]
  /** Si viene true, el backend salta los cruces FÍSICOS (no las reglas
   * RF-011, esas nunca se saltan) — ver HorarioService.crear/actualizar. */
  forzar?: boolean
}

// Mensaje de error que devuelve POST/PUT /horarios cuando hay un cruce
// (HTTP 409) — ver backend/app/services/horario_service.py CruceHorarioError.
export interface ErrorCruceHorario {
  mensajes: string[]
}

// Espejo de HorarioDryRunRequest (backend/app/schemas/horario.py) —
// POST /horarios/validar, para revisar cruces ANTES de guardar de verdad.
export interface HorarioDryRunRequest {
  horaInicio: string
  horaFin: string
  idJornada: number
  idTrimestre: number
  idAmbiente: number
  idInstructor: string
  idFicha: number
  idResultado: number
  dias: number[]
  excluirIdHorario?: number | null
}

// "tipo" distingue los 4 cruces FÍSICOS (overridables con forzar=true)
// de "regla_instructor" (RF-011, bloqueo duro — nunca se puede forzar).
// Ver ModalCruce.tsx y HorarioService._validar_reglas_instructor.
export type TipoConflictoHorario =
  | 'cruce_ficha'
  | 'cruce_instructor'
  | 'cruce_ambiente'
  | 'resultado_repetido'
  | 'regla_instructor'

export interface HorarioDryRunConflict {
  tipo: TipoConflictoHorario
  mensaje: string
  idHorarioExistente?: number | null
  idInstructor?: string | null
  idFicha?: number | null
  idAmbiente?: number | null
  idResultado?: number | null
}

export interface HorarioDryRunResponse {
  ok: boolean
  puedeGuardar: boolean
  mensaje: string
  conflictos: HorarioDryRunConflict[]
  resumen: { totalCruces: number; tipos: string[] }
}

// Espejo de HorarioGuardadoResponse (backend/app/schemas/horario_guardado.py).
// "Guardado" a propósito, no "Horario": esto es lo que arma el editor
// (frontend/src/pages/NuevoHorario.tsx) con ficha/instructor/ambiente como
// texto libre — no la tabla relacional `horarios` real (con FKs y
// detección de cruces), que todavía no existe en el backend. Ver
// `_Docs/Documentación general/SECCION_ESTUDIANTES.md`.
export interface HorarioGuardado {
  idHorarioGuardado: number
  idUsuario: string
  creadorNombre: string | null
  ficha: string
  aprendices: string | null
  horasTrimestre: string | null
  fechaInicio: string | null
  fechaFin: string | null
  bloques: BloqueClase[]
  grid: GridAsignaciones
  fechaCreacion: string
}
