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
  faseActual?: number | null
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
  // El instructor no tiene la fortaleza (especialidad) que pide la
  // competencia del resultado — ver
  // HorarioService._validar_fortaleza_instructor. Forzable, igual que
  // regla_instructor.
  | 'fortaleza_instructor'

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

// Espejo de `app/schemas/solicitud_acceso.py#SolicitudAccesoResponse`
// (Epic SCRUM-96). El contrato se escribió acá primero, mientras el
// backend no existía; desde H-3 (2026-09-24) esos endpoints están vivos y
// devuelven exactamente esta forma.
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

/** Espejo de `app/schemas/mensajeria.py`. Hilo 1 a 1 entre un Aprendiz y
 * un Instructor que sí le dicta clase. Solo el Aprendiz puede abrirlo
 * (`POST /mensajeria/conversaciones` exige su rol y valida el vínculo), y
 * no hay tiempo real: se refresca al entrar. */
export interface Conversacion {
  idConversacion: number
  idAprendiz: string
  idInstructor: string
  fechaCreacion: string
  aprendizNombre: string | null
  instructorNombre: string | null
}

export interface Mensaje {
  idMensaje: number
  idConversacion: number
  idRemitente: string
  contenido: string
  adjuntoUrl: string | null
  leido: boolean
  fechaEnvio: string
}

/** Espejo de `app/schemas/anotacion_horario.py`. Nota privada del Aprendiz
 * sobre un bloque de SU horario — solo él las ve y solo él las escribe.
 *
 * `recordatorioActivo` guarda la preferencia y nada más: no hay envío de
 * recordatorios (push ni correo) en el backend, así lo dice el modelo. La
 * pantalla no puede prometer una alarma. */
export type EtiquetaAnotacion = 'Examen' | 'Entrega' | 'Importante' | 'Normal'

export interface AnotacionHorario {
  idAnotacion: number
  idUsuario: string
  idHorario: number
  nota: string
  etiqueta: EtiquetaAnotacion
  recordatorioActivo: boolean
  fechaCreacion: string
}

/** Espejo de `app/schemas/aviso.py`. Comunicado publicado por coordinación,
 * general del centro o dirigido a una ficha/sede. `fichaCodigo`,
 * `sedeNombre` y `publicadoPor` los resuelve el backend: un Aprendiz no
 * tiene permiso sobre /fichas/ ni /sedes/ para hacerlo por su cuenta. */
export type CategoriaAviso = 'reprog' | 'eventos' | 'sede' | 'extraordinario'

export interface Aviso {
  idAviso: number
  idUsuarioPublicador: string
  titulo: string
  cuerpo: string
  categoria: CategoriaAviso
  idFicha: number | null
  idSede: number | null
  adjuntoUrl: string | null
  fechaPublicacion: string
  vigenteHasta: string | null
  fichaCodigo: string | null
  sedeNombre: string | null
  publicadoPor: string | null
}

/** Espejo de `app/schemas/solicitud_cambio_horario.py`. Un instructor
 * reporta algo sobre un bloque SUYO ya programado y coordinación lo
 * resuelve. Ojo: aprobar registra la decisión, no mueve el horario real
 * (ver el docstring de `SolicitudCambioHorarioService.resolver`). */
export type TipoSolicitudCambio = 'novedad' | 'permuta' | 'cambio-ambiente'

export interface SolicitudCambioHorario {
  idSolicitud: number
  idInstructor: string
  idHorarioOrigen: number
  tipo: TipoSolicitudCambio
  motivo: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  fechaSolicitud: string
  fechaResolucion: string | null
  idAdminResolvio: string | null
}

/** Respuesta de `POST /solicitudes-acceso/{id}/aprobar`. Mientras el SMTP
 * del proyecto de Supabase siga sin configurar (H-15), `correoEnviado` es
 * false y la clave viaja acá para que el Administrador se la entregue a
 * mano — cuando ese correo funcione, `passwordTemporal` deja de venir. */
export interface SolicitudAccesoAprobada {
  solicitud: SolicitudAcceso
  email: string
  passwordTemporal: string | null
  correoEnviado: boolean
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
  faseActual: number | null
  // Solo viene lleno cuando fichaExiste=true -- lo que la ficha YA TIENE
  // guardado en la BD. El import solo escribe faseActual al CREAR una
  // ficha nueva, así que una que ya existe no se sincroniza sola con un
  // re-import; si difiere de `faseActual` (lo que trae el Excel), el
  // wizard ofrece el botón "Actualizar fase".
  faseActualEnBD: number | null
}

// Espejo de FichaFaseActualUpdate -- payload mínimo del botón
// "Actualizar fase" (PATCH /fichas/{id}/fase-actual).
export interface FichaFaseActualUpdate {
  faseActual: number
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
  faseActual?: number | null
}

// Espejo de app/schemas/curriculo.py -- importar competencias/resultados
// desde el Formato de Planeación Pedagógica real de SENA (Programas.tsx,
// drawer de un programa). Sin IA: el formato tiene encabezados fijos.
export interface ResultadoExtraido {
  descripcion: string
  horasAsignadas: number | null
  numeroFase: number | null
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
  numeroFase?: number | null
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
  fichasSinProgramar: string[]
}

export interface PreguntaHorarioRequest {
  pregunta: string
  contexto: string
}

export interface RespuestaPreguntaHorario {
  respuesta: string
}