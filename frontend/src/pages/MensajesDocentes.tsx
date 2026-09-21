import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPatch, apiPost, ApiError } from '../services/api'
import type { Conversacion, Horario, Mensaje, Usuario } from '../types/api'

interface InstructorFicha {
  idInstructor: string
  nombre: string
  materias: string[]
  ambiente: string | null
}

function letraInicial(nombre: string) {
  return nombre.trim().charAt(0).toUpperCase()
}

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function esMismoDia(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

/** Extrae un nombre de archivo legible de una URL de adjunto — v1 solo
 * guarda un link de referencia (ver comentario en `Mensaje` de types/api.ts),
 * no hay subida real de archivos. */
function nombreDeAdjunto(url: string) {
  try {
    const partes = new URL(url).pathname.split('/')
    return decodeURIComponent(partes[partes.length - 1] || url)
  } catch {
    return url
  }
}

/**
 * Pantalla "Mensajes Docentes" del Aprendiz (mockup Stitch
 * `mensajer_a_de_instructores_rol_aprendiz_sihs_sena`) — consulta 1 a 1 con
 * los instructores que sí le dictan clase a la ficha del aprendiz, sobre el
 * módulo de mensajería SCRUM-119 (`GET/POST /mensajeria/...`).
 *
 * "Mis Instructores" reutiliza la misma fuente de datos que "Mi Horario"
 * del Aprendiz (`GET /ficha-usuario/mi-horario`) en vez de inventar un
 * directorio aparte — cada fila sale de agrupar los `Horario` por
 * `idInstructor` (nombre, materias por `resultadoDescripcion`, ambiente
 * habitual). Solo se listan conversaciones/instructores reales; no hay
 * presencia en tiempo real (backend no la tiene, ver modelo `Conversacion`)
 * así que el indicador "En línea" del mockup se quitó en vez de fingirlo.
 *
 * Contenido explícitamente de vitrina (pedido del ticket, no datos
 * inventados con apariencia de reales):
 *  - Pestaña "Canal Ficha" (mensajería grupal): deshabilitada, fuera de
 *    alcance v1 (el backend no tiene canal grupal, solo 1 a 1).
 *  - "Respuesta promedio: < 4 horas hábiles": métrica no calculada.
 *
 * "Adjuntar" solo admite pegar un link de referencia (`adjuntoUrl`) porque
 * eso es lo único que el backend v1 soporta — no hay subida real de
 * archivos (ver modelo `Mensaje`), así que no se simula un selector de
 * archivos que no sube nada.
 */
export function MensajesDocentes() {
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [mensajesPorConversacion, setMensajesPorConversacion] = useState<Record<number, Mensaje[]>>({})

  const [busqueda, setBusqueda] = useState('')
  const [instructorSeleccionadoId, setInstructorSeleccionadoId] = useState<string | null>(null)
  const [conversacionSeleccionadaId, setConversacionSeleccionadaId] = useState<number | null>(null)

  const [texto, setTexto] = useState('')
  const [mostrarAdjunto, setMostrarAdjunto] = useState(false)
  const [adjuntoUrl, setAdjuntoUrl] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargandoInicial, setCargandoInicial] = useState(true)

  useEffect(() => {
    apiGet<Usuario>('/usuarios/me').then(setPerfil).catch(() => {})
    apiGet<Horario[]>('/ficha-usuario/mi-horario').then(setHorarios).catch(() => setHorarios([]))
  }, [])

  useEffect(() => {
    apiGet<Conversacion[]>('/mensajeria/conversaciones')
      .then(async (lista) => {
        setConversaciones(lista)

        const entradas = await Promise.all(
          lista.map(async (conversacion) => {
            try {
              const mensajes = await apiGet<Mensaje[]>(`/mensajeria/conversaciones/${conversacion.idConversacion}/mensajes`)
              return [conversacion.idConversacion, mensajes] as const
            } catch {
              return [conversacion.idConversacion, []] as const
            }
          }),
        )

        setMensajesPorConversacion(Object.fromEntries(entradas))
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus conversaciones.'))
      .finally(() => setCargandoInicial(false))
  }, [])

  const instructoresFicha = useMemo<InstructorFicha[]>(() => {
    if (!horarios) return []

    const mapa = new Map<string, InstructorFicha>()
    for (const horario of horarios) {
      if (!horario.idInstructor) continue

      const existente = mapa.get(horario.idInstructor)
      if (existente) {
        if (horario.resultadoDescripcion && !existente.materias.includes(horario.resultadoDescripcion)) {
          existente.materias.push(horario.resultadoDescripcion)
        }
        if (!existente.ambiente && horario.ambienteNombre) {
          existente.ambiente = horario.ambienteNombre
        }
      } else {
        mapa.set(horario.idInstructor, {
          idInstructor: horario.idInstructor,
          nombre: horario.instructorNombre ?? 'Instructor',
          materias: horario.resultadoDescripcion ? [horario.resultadoDescripcion] : [],
          ambiente: horario.ambienteNombre ?? null,
        })
      }
    }

    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-CO'))
  }, [horarios])

  const instructoresFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es-CO')
    if (!texto) return instructoresFicha
    return instructoresFicha.filter(
      (instructor) =>
        instructor.nombre.toLocaleLowerCase('es-CO').includes(texto) ||
        instructor.materias.some((materia) => materia.toLocaleLowerCase('es-CO').includes(texto)),
    )
  }, [instructoresFicha, busqueda])

  function conversacionDe(idInstructor: string) {
    return conversaciones.find((conversacion) => conversacion.idInstructor === idInstructor) ?? null
  }

  function previaDe(instructor: InstructorFicha) {
    const conversacion = conversacionDe(instructor.idInstructor)
    if (!conversacion) return { ultimoMensaje: null as Mensaje | null, noLeidos: 0 }

    const mensajes = mensajesPorConversacion[conversacion.idConversacion] ?? []
    const ultimoMensaje = mensajes.length > 0 ? mensajes[mensajes.length - 1] : null
    const noLeidos = perfil ? mensajes.filter((m) => m.idRemitente !== perfil.idUsuario && !m.leido).length : 0

    return { ultimoMensaje, noLeidos }
  }

  const totalNoLeidos = instructoresFicha.reduce((total, instructor) => total + previaDe(instructor).noLeidos, 0)

  const instructorSeleccionado = instructoresFicha.find((i) => i.idInstructor === instructorSeleccionadoId) ?? null
  const mensajesHilo = conversacionSeleccionadaId ? mensajesPorConversacion[conversacionSeleccionadaId] ?? [] : []

  function seleccionarInstructor(instructor: InstructorFicha) {
    setError(null)
    setInstructorSeleccionadoId(instructor.idInstructor)
    setMostrarAdjunto(false)
    setAdjuntoUrl('')

    const conversacion = conversacionDe(instructor.idInstructor)
    setConversacionSeleccionadaId(conversacion?.idConversacion ?? null)
    if (!conversacion || !perfil) return

    const mensajes = mensajesPorConversacion[conversacion.idConversacion] ?? []
    const noLeidos = mensajes.filter((m) => m.idRemitente !== perfil.idUsuario && !m.leido)

    for (const mensaje of noLeidos) {
      apiPatch<Mensaje>(`/mensajeria/mensajes/${mensaje.idMensaje}/leido`)
        .then((actualizado) => {
          setMensajesPorConversacion((previo) => ({
            ...previo,
            [conversacion.idConversacion]: (previo[conversacion.idConversacion] ?? []).map((m) =>
              m.idMensaje === actualizado.idMensaje ? actualizado : m,
            ),
          }))
        })
        .catch(() => {})
    }
  }

  async function enviarMensaje() {
    const contenido = texto.trim()
    if (!contenido || !instructorSeleccionadoId || enviando) return

    setEnviando(true)
    setError(null)

    try {
      let idConversacion = conversacionSeleccionadaId

      if (!idConversacion) {
        const conversacion = await apiPost<Conversacion>('/mensajeria/conversaciones', {
          idInstructor: instructorSeleccionadoId,
        })
        idConversacion = conversacion.idConversacion
        setConversaciones((previo) => [conversacion, ...previo])
        setConversacionSeleccionadaId(idConversacion)
      }

      const mensaje = await apiPost<Mensaje>(`/mensajeria/conversaciones/${idConversacion}/mensajes`, {
        contenido,
        adjuntoUrl: adjuntoUrl.trim() || undefined,
      })

      setMensajesPorConversacion((previo) => ({
        ...previo,
        [idConversacion as number]: [...(previo[idConversacion as number] ?? []), mensaje],
      }))
      setTexto('')
      setAdjuntoUrl('')
      setMostrarAdjunto(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje. Inténtalo otra vez.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AppShell activo="Mensajes Docentes">
      <nav className="mb-3 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
        <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
        <span>/</span>
        <span className="text-on-surface">Mensajes Docentes</span>
      </nav>

      <div className="mb-4 flex flex-col justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-primary">
            <span className="material-symbols-outlined text-[24px]">forum</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-on-surface">Consultas &amp; Mensajería Docente</h1>
            <p className="text-xs text-on-surface-variant">Canal directo con los instructores que te dictan clase.</p>
          </div>
        </div>

        {totalNoLeidos > 0 && (
          <div className="flex items-center gap-2 self-start rounded-xl bg-surface-container-low px-3 py-1.5 text-sm font-semibold text-on-surface sm:self-center">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {totalNoLeidos} {totalNoLeidos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} sin leer
          </div>
        )}
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid min-h-[640px] grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Columna izquierda: instructores + hilo de conversaciones */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest lg:col-span-4">
          <div className="space-y-2 p-3">
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-2.5 text-[18px] text-on-surface-variant">
                search
              </span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar instructor o materia..."
                className="w-full rounded-xl bg-surface-container-low py-2 pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-low p-1 text-center text-sm font-semibold">
              <button type="button" className="rounded-lg bg-surface-container-lowest py-1.5 text-primary shadow-xs">
                Mis Instructores
              </button>
              <button
                type="button"
                disabled
                title="Mensajería grupal por ficha — fuera de alcance v1"
                className="flex cursor-not-allowed items-center justify-center gap-1 rounded-lg py-1.5 text-on-surface-variant/50"
              >
                Canal Ficha
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {!horarios ? (
              <p className="p-4 text-center text-sm text-on-surface-variant">Cargando instructores…</p>
            ) : instructoresFiltrados.length === 0 ? (
              <p className="p-4 text-center text-sm text-on-surface-variant">
                {instructoresFicha.length === 0
                  ? 'Todavía no tenés instructores asignados en tu horario publicado.'
                  : 'Ningún instructor coincide con la búsqueda.'}
              </p>
            ) : (
              instructoresFiltrados.map((instructor) => {
                const { ultimoMensaje, noLeidos } = previaDe(instructor)
                const activo = instructor.idInstructor === instructorSeleccionadoId

                return (
                  <button
                    key={instructor.idInstructor}
                    type="button"
                    onClick={() => seleccionarInstructor(instructor)}
                    className={`w-full rounded-xl p-3 text-left transition-colors ${
                      activo ? 'bg-secondary-container/70' : 'hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-on-primary">
                        {letraInicial(instructor.nombre)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-sm font-bold text-on-surface">{instructor.nombre}</span>
                          {ultimoMensaje && (
                            <span className="shrink-0 text-[11px] text-on-surface-variant">{formatearHora(ultimoMensaje.fechaEnvio)}</span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-on-surface-variant">
                          {instructor.materias.length > 0 ? instructor.materias.join(' & ') : 'Sin materia registrada'}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-on-surface-variant">
                            {ultimoMensaje ? ultimoMensaje.contenido : 'Aún no hay mensajes — inicia la conversación.'}
                          </p>
                          {noLeidos > 0 && (
                            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary">
                              {noLeidos}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div
            className="m-2 flex items-center justify-between gap-2 rounded-xl bg-surface-container-low p-3"
            title="Vitrina — no es una métrica calculada a partir de los mensajes reales."
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">verified_user</span>
              <div>
                <p className="text-xs font-semibold text-on-surface">Trazabilidad Activa</p>
                <p className="text-[11px] text-on-surface-variant">Respuesta promedio: &lt; 4 horas hábiles</p>
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha: hilo activo */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest lg:col-span-8">
          {!instructorSeleccionado ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px]">chat</span>
              <p className="text-sm">Selecciona un instructor de la izquierda para ver la conversación.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-outline-variant p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-on-primary">
                    {letraInicial(instructorSeleccionado.nombre)}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-on-surface">{instructorSeleccionado.nombre}</h2>
                      <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-semibold text-primary">Docente</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {instructorSeleccionado.materias.length > 0 ? instructorSeleccionado.materias.join(' & ') : 'Sin materia registrada'}
                    </p>
                    {instructorSeleccionado.ambiente && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-on-surface-variant">
                        <span className="material-symbols-outlined text-[13px] text-primary">meeting_room</span>
                        Ambiente habitual: <strong className="text-on-surface">{instructorSeleccionado.ambiente}</strong>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-surface/40 p-4">
                {cargandoInicial ? (
                  <p className="py-16 text-center text-sm text-on-surface-variant">Cargando conversación…</p>
                ) : mensajesHilo.length === 0 ? (
                  <p className="py-16 text-center text-sm text-on-surface-variant">
                    Aún no has enviado mensajes a {instructorSeleccionado.nombre}. Escribe el primero abajo.
                  </p>
                ) : (
                  mensajesHilo.map((mensaje, indice) => {
                    const esMio = mensaje.idRemitente === perfil?.idUsuario
                    const mostrarSeparadorFecha = indice === 0 || !esMismoDia(mensaje.fechaEnvio, mensajesHilo[indice - 1].fechaEnvio)

                    return (
                      <div key={mensaje.idMensaje}>
                        {mostrarSeparadorFecha && (
                          <div className="mb-3 flex justify-center">
                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-[11px] text-on-surface-variant">
                              {formatearFecha(mensaje.fechaEnvio)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] space-y-1 ${esMio ? 'text-right' : ''}`}>
                            <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                              {esMio ? (
                                <span className="ml-auto">{formatearHora(mensaje.fechaEnvio)}</span>
                              ) : (
                                <>
                                  <span className="font-bold text-on-surface">{instructorSeleccionado.nombre}</span>
                                  <span>{formatearHora(mensaje.fechaEnvio)}</span>
                                </>
                              )}
                            </div>
                            <div
                              className={`space-y-1.5 rounded-xl p-3 text-left text-sm leading-relaxed shadow-xs ${
                                esMio ? 'rounded-tr-none bg-primary text-on-primary' : 'rounded-tl-none bg-surface-container-lowest text-on-surface'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{mensaje.contenido}</p>
                              {mensaje.adjuntoUrl && (
                                <a
                                  href={mensaje.adjuntoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center gap-2 rounded-lg p-2 text-xs font-semibold ${
                                    esMio ? 'bg-on-primary/15 text-on-primary' : 'bg-surface-container-low text-primary'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">attachment</span>
                                  <span className="truncate">{nombreDeAdjunto(mensaje.adjuntoUrl)}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="space-y-2 border-t border-outline-variant p-3">
                {mostrarAdjunto && (
                  <input
                    type="url"
                    value={adjuntoUrl}
                    onChange={(e) => setAdjuntoUrl(e.target.value)}
                    placeholder="Link del documento a adjuntar (Drive, ZAJUNA, etc.)"
                    className="w-full rounded-xl bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                  />
                )}
                <div className="flex items-end gap-2 rounded-xl bg-surface-container-low p-2">
                  <button
                    type="button"
                    onClick={() => setMostrarAdjunto((v) => !v)}
                    title="Adjuntar un link de referencia (v1 no sube archivos)"
                    className={`rounded-lg p-2 transition-colors ${mostrarAdjunto ? 'bg-secondary-container text-primary' : 'text-on-surface-variant hover:text-primary'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">attach_file</span>
                  </button>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void enviarMensaje()
                      }
                    }}
                    rows={2}
                    placeholder={`Escribe tu consulta para ${instructorSeleccionado.nombre}...`}
                    className="flex-1 resize-none bg-transparent py-1 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void enviarMensaje()}
                    disabled={!texto.trim() || enviando}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {enviando ? 'Enviando…' : 'Enviar'}
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                </div>
                <p className="flex items-center gap-1 px-1 text-[11px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[13px] text-primary">policy</span>
                  Mensajería académica institucional — los mensajes no reemplazan ZAJUNA para calificaciones oficiales.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
