import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPatch, apiPost, ApiError } from '../services/api'
import type { Conversacion, Horario, Mensaje, Usuario } from '../types/api'

/** Un instructor con el que el aprendiz PUEDE hablar: alguien que le dicta
 * al menos un bloque. No hay endpoint que devuelva esta lista, y el
 * aprendiz no puede leer `/usuarios/`, así que sale de su propio horario
 * — que es exactamente la regla que el backend valida al crear el hilo. */
interface InstructorDisponible {
  idInstructor: string
  nombre: string
  /** Para dar contexto en la lista: qué le dicta esta persona. */
  temas: string[]
}

function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/)
  return ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase()
}

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function diaLegible(iso: string) {
  const fecha = new Date(iso)
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)

  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()

  if (mismoDia(fecha, hoy)) return 'Hoy'
  if (mismoDia(fecha, ayer)) return 'Ayer'
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

/**
 * "Mensajes con mis instructores" del Aprendiz — `/mensajeria`, backend
 * completo desde SCRUM-119 y sin ninguna pantalla hasta ahora.
 * Mockup: `_Docs/Diseño/mockups-stitch/mensajer_a_de_instructores_rol_aprendiz_sihs_sena`.
 *
 * Con quién se puede hablar sale del horario propio, no de un catálogo:
 * el backend solo deja abrir un hilo con un instructor que le dicte a la
 * ficha del aprendiz, así que la lista se arma con esa misma regla y no
 * se ofrece a nadie con quien la creación fuera a fallar.
 *
 * La conversación se crea al mandar el primer mensaje, no al entrar al
 * hilo: así curiosear no deja conversaciones vacías en la base.
 *
 * Diferencias deliberadas con el mockup, por lo que el backend no tiene:
 * no hay "en línea"/"escribiendo…" (no hay websockets: esto se refresca
 * al entrar), ni adjuntar archivos desde el equipo (el mensaje guarda un
 * `adjuntoUrl`, no sube nada), ni canales de vocería o grupos de ficha
 * (el modelo es 1 a 1).
 */
export function MensajesAprendiz() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [instructores, setInstructores] = useState<InstructorDisponible[]>([])
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [elegido, setElegido] = useState<InstructorDisponible | null>(null)
  // El hilo guarda a QUÉ conversación pertenece: así, al cambiar de
  // instructor, lo que se pinta nunca es lo del anterior mientras carga
  // el nuevo (y no hace falta vaciarlo a mano dentro de un efecto).
  const [hilo, setHilo] = useState<{ idConversacion: number; mensajes: Mensaje[] } | null>(null)
  const [borrador, setBorrador] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const finDelHilo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      apiGet<Conversacion[]>('/mensajeria/conversaciones'),
      apiGet<Horario[]>('/ficha-usuario/mi-horario'),
      apiGet<Usuario>('/usuarios/me'),
    ])
      .then(([listaConversaciones, horarios, usuario]) => {
        setConversaciones(listaConversaciones)
        setPerfil(usuario)

        const porInstructor = new Map<string, InstructorDisponible>()
        for (const horario of horarios) {
          if (!horario.idInstructor) continue

          const previo = porInstructor.get(horario.idInstructor)
          const tema = horario.resultadoDescripcion
          porInstructor.set(horario.idInstructor, {
            idInstructor: horario.idInstructor,
            nombre: horario.instructorNombre ?? 'Instructor',
            temas: tema && !previo?.temas.includes(tema) ? [...(previo?.temas ?? []), tema] : (previo?.temas ?? []),
          })
        }
        setInstructores([...porInstructor.values()])
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus mensajes.')
      })
      .finally(() => setCargando(false))
  }, [])

  const conversacionDe = useCallback(
    (idInstructor: string) => conversaciones.find((c) => c.idInstructor === idInstructor) ?? null,
    [conversaciones],
  )

  const conversacionAbierta = elegido ? conversacionDe(elegido.idInstructor) : null

  // Al abrir el hilo, lo que me escribieron pasa a leído. Los propios no:
  // `leido` en un mensaje mío lo marca el otro al abrirlo.
  const marcarRecibidosComoLeidos = useCallback(
    (lista: Mensaje[], idPropio: string) => {
      const sinLeer = lista.filter((m) => m.idRemitente !== idPropio && !m.leido)
      if (sinLeer.length === 0) return

      Promise.all(sinLeer.map((m) => apiPatch(`/mensajeria/mensajes/${m.idMensaje}/leido`).catch(() => null))).then(
        () =>
          setHilo((previo) =>
            previo
              ? {
                  ...previo,
                  mensajes: previo.mensajes.map((m) => (m.idRemitente !== idPropio ? { ...m, leido: true } : m)),
                }
              : previo,
          ),
      )
    },
    [],
  )

  const hiloCargado = Boolean(conversacionAbierta) && hilo?.idConversacion === conversacionAbierta?.idConversacion

  const mensajes = useMemo(
    () => (hiloCargado && hilo ? hilo.mensajes : []),
    [hiloCargado, hilo],
  )

  // Derivado, no un estado aparte: hay conversación abierta y todavía no
  // tenemos SU hilo. Se apaga solo cuando llega (o cuando falla, que deja
  // el hilo vacío para esa conversación).
  const cargandoHilo = Boolean(conversacionAbierta) && !hiloCargado

  useEffect(() => {
    if (!conversacionAbierta) return

    const { idConversacion } = conversacionAbierta
    let cancelado = false

    apiGet<Mensaje[]>(`/mensajeria/conversaciones/${idConversacion}/mensajes`)
      .then((lista) => {
        if (cancelado) return
        setHilo({ idConversacion, mensajes: lista })
        if (perfil) marcarRecibidosComoLeidos(lista, perfil.idUsuario)
      })
      .catch(() => {
        if (!cancelado) setHilo({ idConversacion, mensajes: [] })
      })

    return () => {
      cancelado = true
    }
  }, [conversacionAbierta, perfil, marcarRecibidosComoLeidos])

  useEffect(() => {
    // Bajar al último mensaje es una comodidad, no parte del contenido:
    // `scrollIntoView` no existe en todos los entornos (jsdom, por
    // ejemplo), y que falte no puede tumbar la conversación entera.
    finDelHilo.current?.scrollIntoView?.({ block: 'end' })
  }, [mensajes])

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()

    const contenido = borrador.trim()
    if (!contenido || !elegido || enviando) return

    setEnviando(true)
    setErrorEnvio(null)

    try {
      // La conversación se crea recién acá, con el primer mensaje. El
      // endpoint es idempotente (unique aprendiz+instructor), así que
      // reintentar no duplica nada.
      const yaExistia = conversacionDe(elegido.idInstructor)
      const conversacion =
        yaExistia ??
        (await apiPost<Conversacion>('/mensajeria/conversaciones', { idInstructor: elegido.idInstructor }))

      const mensaje = await apiPost<Mensaje>(
        `/mensajeria/conversaciones/${conversacion.idConversacion}/mensajes`,
        { contenido },
      )

      setHilo((previo) => ({
        idConversacion: conversacion.idConversacion,
        mensajes: [...(previo?.idConversacion === conversacion.idConversacion ? previo.mensajes : []), mensaje],
      }))
      setBorrador('')

      // Se registra la conversación nueva AL FINAL, no al crearla: meterla
      // antes dispara la recarga del hilo (el efecto depende de ella) y esa
      // respuesta —todavía sin el mensaje, porque aún no se había
      // enviado— pisaba lo recién escrito.
      if (!yaExistia) {
        setConversaciones((previas) => [...previas, conversacion])
      }
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo enviar tu mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  const sinLeerPorInstructor = useMemo(() => {
    // Solo se sabe de la conversación abierta: el backend no expone un
    // conteo de no leídos por hilo, y pedir los mensajes de cada uno para
    // contarlos sería un request por instructor en cada carga.
    const mapa: Record<string, number> = {}
    if (elegido && perfil) {
      mapa[elegido.idInstructor] = mensajes.filter((m) => m.idRemitente !== perfil.idUsuario && !m.leido).length
    }
    return mapa
  }, [elegido, perfil, mensajes])

  return (
    <AppShell activo="Mensajes">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Autoservicio del aprendiz</p>
        <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Mis instructores</h1>
        <p className="mb-6 text-sm text-on-surface-variant dark:text-slate-400">
          Consultas a los instructores que te dictan clase. Te responden cuando entran al sistema.
        </p>

        {cargando && <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando tus mensajes…</p>}

        {error && (
          <p className="rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {!cargando && !error && instructores.length === 0 && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800">
            <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-on-surface-variant">
              forum
            </span>
            <p className="mt-2 text-sm font-semibold text-on-surface dark:text-slate-100">
              Todavía no tienes instructores a quién escribirle
            </p>
            <p className="mt-1 text-sm text-on-surface-variant dark:text-slate-400">
              Cuando tu ficha tenga horario publicado, vas a poder escribirle a quien te dicta.
            </p>
          </div>
        )}

        {!cargando && !error && instructores.length > 0 && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <ul className="flex flex-col gap-2">
              {instructores.map((instructor) => {
                const activo = elegido?.idInstructor === instructor.idInstructor
                const sinLeer = sinLeerPorInstructor[instructor.idInstructor] ?? 0

                return (
                  <li key={instructor.idInstructor}>
                    <button
                      type="button"
                      onClick={() => setElegido(instructor)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        activo
                          ? 'border-primary bg-primary-container/40'
                          : 'border-outline-variant hover:bg-surface-container-low dark:border-slate-700'
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                        {iniciales(instructor.nombre)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-on-surface dark:text-slate-100">
                          {instructor.nombre}
                        </span>
                        <span className="block truncate text-xs text-on-surface-variant dark:text-slate-400">
                          {instructor.temas[0] ?? 'Te dicta clase'}
                        </span>
                      </span>
                      {sinLeer > 0 && (
                        <span className="rounded-full bg-error px-1.5 text-xs font-bold text-white">{sinLeer}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="flex min-h-[26rem] flex-col rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800">
              {!elegido ? (
                <p className="m-auto max-w-xs px-4 text-center text-sm text-on-surface-variant dark:text-slate-400">
                  Elige un instructor para escribirle o leer lo que ya conversaron.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-3 dark:border-slate-700">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                      {iniciales(elegido.nombre)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface dark:text-slate-100">
                        {elegido.nombre}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant dark:text-slate-400">
                        {elegido.temas.join(' · ') || 'Te dicta clase'}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                    {cargandoHilo && (
                      <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando la conversación…</p>
                    )}

                    {!cargandoHilo && mensajes.length === 0 && (
                      <p className="py-6 text-center text-sm text-on-surface-variant dark:text-slate-400">
                        Todavía no se han escrito. Escribe el primer mensaje.
                      </p>
                    )}

                    {mensajes.map((mensaje, indice) => {
                      const propio = mensaje.idRemitente === perfil?.idUsuario
                      const anterior = mensajes[indice - 1]
                      const nuevoDia =
                        !anterior || diaLegible(anterior.fechaEnvio) !== diaLegible(mensaje.fechaEnvio)

                      return (
                        <div key={mensaje.idMensaje}>
                          {nuevoDia && (
                            <p className="my-2 text-center text-xs font-semibold text-on-surface-variant dark:text-slate-400">
                              {diaLegible(mensaje.fechaEnvio)}
                            </p>
                          )}

                          <div className={`flex ${propio ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                                propio
                                  ? 'bg-primary text-white'
                                  : 'bg-surface-container-low text-on-surface dark:bg-slate-700 dark:text-slate-100'
                              }`}
                            >
                              <p className="whitespace-pre-line">{mensaje.contenido}</p>

                              {mensaje.adjuntoUrl && (
                                <a
                                  href={mensaje.adjuntoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold underline"
                                >
                                  <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                                    description
                                  </span>
                                  Ver adjunto
                                </a>
                              )}

                              <span
                                className={`mt-0.5 block text-[10px] ${propio ? 'text-white/70' : 'text-on-surface-variant dark:text-slate-400'}`}
                              >
                                {horaCorta(mensaje.fechaEnvio)}
                                {propio && (mensaje.leido ? ' · Leído' : ' · Enviado')}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    <div ref={finDelHilo} />
                  </div>

                  <form
                    onSubmit={enviar}
                    className="flex items-end gap-2 border-t border-outline-variant px-4 py-3 dark:border-slate-700"
                  >
                    <label htmlFor="mensaje-nuevo" className="sr-only">
                      Escribe tu consulta
                    </label>
                    <textarea
                      id="mensaje-nuevo"
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      rows={2}
                      placeholder={`Escribe tu consulta para ${elegido.nombre}…`}
                      className="flex-1 resize-none rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      disabled={!borrador.trim() || enviando}
                      className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {enviando ? 'Enviando…' : 'Enviar'}
                    </button>
                  </form>

                  {errorEnvio && (
                    <p role="alert" className="px-4 pb-3 text-sm text-error">
                      {errorEnvio}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
