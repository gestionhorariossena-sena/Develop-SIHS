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
  idTrimestre?: number | null
  sigla?: string | null
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
  fechaInicioLectiva?: string | null
  fechaFinLectiva?: string | null
  fechaInicioProductiva?: string | null
  fechaFinProductiva?: string | null
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

export interface Coordinacion {
  idCoordinacion: number
  nombreCoordinacion: string
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

// Espejo de CompetenciaFormacionResponse (backend/app/schemas/competencia_formacion.py).
export interface CompetenciaFormacion {
  idCompetencia: number
  codigo: string | null
  descripcion: string
  idPrograma: number
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
  fechaCreacion: string
  fechaModificacion: string
  activo: boolean
  publicado: boolean
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

// Espejo de AuditoriaConflicto/AuditoriaCrucesResponse
// (backend/app/schemas/horario.py) — GET /horarios/auditoria-cruces.
// Igual que HorarioDryRunConflict, pero el conflicto es entre dos
// horarios YA guardados (idHorario), no un candidato sin guardar.
export interface AuditoriaConflicto extends HorarioDryRunConflict {
  idHorario: number
}

export interface AuditoriaCrucesResponse {
  conflictos: AuditoriaConflicto[]
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
  programaNombre: string | null
  ficha: string
  aprendices: string | null
  horasTrimestre: string | null
  fechaInicio: string | null
  fechaFin: string | null
  bloques: BloqueClase[]
  grid: GridAsignaciones
  // idHorario de cada fila real en `horarios` creada junto con este
  // snapshot — permite que borrar el "Horario completo" también libere
  // esas clases reales (ver backend/app/services/horario_guardado_service.py).
  idsHorarios?: number[]
  fechaCreacion: string
}

export interface Notificacion {
  idNotificacion: number
  idUsuario: string
  tipo: 'cruce' | 'horario' | 'ambiente' | 'sistema'
  mensaje: string
  leida: boolean
  fechaCreacion: string
  entidadRelacionada: string | null
  idEntidadRelacionada: string | null
}

// Espejo de la tabla `solicitudes_acceso` (ticket "[DB/Arquitectura] Tabla
// solicitudes_acceso...", Epic SCRUM-96) y de `SolicitudAccesoResponse` del
// endpoint `GET /solicitudes-acceso/` (ticket "[Backend] Endpoints
// /solicitudes-acceso", mismo Epic) — ninguno de los dos existe en el
// backend todavía. Los nombres de campo acá son el contrato documentado en
// esos tickets de Jira (SCRUM-103/SCRUM-109), no una adivinanza: cuando el
// backend exista debería devolver exactamente esta forma.
export interface SolicitudAcceso {
  idSolicitud: number
  nombre: string
  email: string
  numeroDocumento: string
  idRolSolicitado: number
  rolSolicitado: Rol
  motivo: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  motivoRechazo: string | null
  fechaSolicitud: string
  fechaResolucion: string | null
  idAdminResolvio: string | null
}

// Espejo de app/schemas/asistente_horario.py -- el wizard de 4 pasos
// (AsistenteHorarios.tsx): subir archivo -> revisar -> generar
// propuesta -> confirmar. Ninguno de estos 3 endpoints persiste nada;
// confirmar sigue siendo POST /horarios/ (HorarioCreate, más arriba).
export interface ColumnaClasificada {
  columnaOriginal: string
  campo: string | null
  confianza: number
}

export interface FilaImportada {
  fila: number
  // El número de ficha del Excel (codigoFicha, texto) -- NO el idFicha
  // interno de la BD (autoincremental, sin relación con el número real).
  codigoFicha: string | null
  fichaExiste: boolean
  // Solo viene lleno cuando fichaExiste=true.
  idFicha: number | null
  programa: string | null
  jornada: string | null
  instructorNombre: string | null
  advertencia: string | null
  // Solo vienen si se subió un archivo complementario y traía estos datos
  // para la misma ficha (cruce por codigoFicha).
  nivelFormacion: string | null
  coordinacion: string | null
  codigoPrograma: string | null
  fechaInicioLectiva: string | null
  fechaFinLectiva: string | null
  fechaFinProductiva: string | null
}

// Espejo de ProgramaCreate/CoordinacionCreate -- usados por "Crear
// programa nuevo" dentro del formulario "Crear ficha" del asistente.
export interface ProgramaCreate {
  codigoPrograma: string
  nombrePrograma: string
  nivelFormacion?: string | null
  activo?: boolean
  idCoordinacion: number
}

export interface CoordinacionCreate {
  nombreCoordinacion: string
}

// Espejo de FichaCreate (backend/app/schemas/ficha.py) -- usado por el
// botón "Crear ficha" del asistente (paso 2), que reusa POST /fichas/ ya
// existente en vez de un endpoint nuevo.
export interface FichaCreate {
  codigoFicha: string
  idPrograma: number
  idTrimestre: number
  idSede?: number | null
}

// Espejo de app/schemas/curriculo.py -- importar competencias/resultados
// desde el Formato de Planeación Pedagógica real de SENA (Programas.tsx,
// drawer de un programa). Sin IA: el formato tiene encabezados fijos.
export interface ResultadoExtraido {
  descripcion: string
  horasAsignadas: number | null
}

export interface CompetenciaExtraida {
  descripcion: string
  resultados: ResultadoExtraido[]
}

export interface PreviewCurriculoResponse {
  nombreArchivo: string
  hoja: string
  competencias: CompetenciaExtraida[]
  totalCompetencias: number
  totalResultados: number
}

export interface CompetenciaFormacionCreate {
  codigo?: string | null
  descripcion: string
  idPrograma: number
}

export interface CompetenciaFormacionResponse extends CompetenciaFormacionCreate {
  idCompetencia: number
}

export interface ResultadoAprendizajeCreate {
  codigo?: string | null
  descripcion: string
  idCompetencia: number
  idGuia?: number | null
  horasAsignadas?: number | null
}

export interface ImportarExcelPreviewResponse {
  nombreArchivo: string
  hoja: string
  filaEncabezado: number
  columnas: ColumnaClasificada[]
  filas: FilaImportada[]
  totalFilas: number
  filasConAdvertencia: number
  advertenciaGeneral: string | null
  archivoComplementario: string | null
  hojaComplementaria: string | null
}

export type JornadaAsistente = 'MAÑANA' | 'TARDE' | 'NOCHE'

export interface GenerarPropuestaRequest {
  idTrimestre: number
  idsFicha: number[]
  jornada: JornadaAsistente
}

export interface BloquePropuesto {
  idFicha: number
  fichaCodigo: string
  idResultado: number
  resultadoDescripcion: string
  idInstructor: string
  instructorNombre: string
  idAmbiente: number
  ambienteNombre: string
  idJornada: number
  dias: number[]
  horaInicio: string
  horaFin: string
}

export interface GenerarPropuestaResponse {
  bloques: BloquePropuesto[]
  factible: boolean
  mensaje: string
}

export interface PreguntaHorarioRequest {
  pregunta: string
  contexto: string
}

export interface RespuestaPreguntaHorario {
  respuesta: string
}