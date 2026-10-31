import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPatch, apiPost, ApiError } from '../services/api'
import type { Conversacion, Horario, Mensaje, Usuario } from '../types/api'

/** Un instructor que le dicta clase al aprendiz. No hay endpoint que
 * devuelva esta lista, y el aprendiz no puede leer `/usuarios/`, así que
 * sale de su propio horario -- que es exactamente la regla que el backend
 * valida al crear un hilo (para quien sí puede escribir, ver `puedeEscribir`). */
interface InstructorDisponible {
  idInstructor: string
  nombre: string
  email: string | null
  /** Para dar contexto en la tarjeta: qué le dicta esta persona. */
  temas: string[]
  ambientes: string[]
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
  // Misma página, dos rutas (ver AppRouter.tsx): "/mensajes" es el
  // directorio de solo lectura; "/mensajes/chat" es la bandeja de verdad
  // -- lista de instructores con su contador de no leídos + el hilo --,
  // y solo aparece en el subnav (AppShell.tsx) para quien puede escribir.
  const location = useLocation()
  const navigate = useNavigate()
  const vistaChat = location.pathname === '/mensajes/chat'

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [instructores, setInstructores] = useState<InstructorDisponible[]>([])
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Solo el vocero/subvocero de la ficha puede abrir conversaciones nuevas
  // -- si cualquier aprendiz pudiera escribirle al mismo instructor, sería
  // imposible de atender (pedido explícito). El resto ve el directorio de
  // solo lectura; el backend hace cumplir esto de verdad en
  // POST /mensajeria/conversaciones (RemitenteNoAutorizadoError), esto es
  // solo para no ofrecer en la UI algo que va a fallar.
  const [rolEnFicha, setRolEnFicha] = useState<string | null>(null)
  const puedeEscribir = rolEnFicha === 'vocero' || rolEnFicha === 'subvocero'
  const [correoCopiado, setCorreoCopiado] = useState<string | null>(null)

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
      apiGet<{ rolEnFicha: string | null }>('/ficha-usuario/mi-rol'),
    ])
      .then(([listaConversaciones, horarios, usuario, rol]) => {
        setConversaciones(listaConversaciones)
        setPerfil(usuario)
        setRolEnFicha(rol.rolEnFicha)

        const porInstructor = new Map<string, InstructorDisponible>()
        for (const horario of horarios) {
          if (!horario.idInstructor) continue

          const previo = porInstructor.get(horario.idInstructor)
          const tema = horario.resultadoDescripcion
          const ambiente = horario.ambienteNombre
          porInstructor.set(horario.idInstructor, {
            idInstructor: horario.idInstructor,
            nombre: horario.instructorNombre ?? 'Instructor',
            email: horario.instructorEmail ?? previo?.email ?? null,
            temas: tema && !previo?.temas.includes(tema) ? [...(previo?.temas ?? []), tema] : (previo?.temas ?? []),
            ambientes:
              ambiente && !previo?.ambientes.includes(ambiente)
                ? [...(previo?.ambientes ?? []), ambiente]
                : (previo?.ambientes ?? []),
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

  // El backend no expone un conteo de no leídos por hilo, así que en la
  // bandeja (vista chat) se pide una vez el contenido de cada conversación
  // ya existente para contarlos -- son como máximo tantas como
  // instructores le dicten a la ficha, nunca un catálogo grande.
  const [noLeidosBase, setNoLeidosBase] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!vistaChat || !perfil || conversaciones.length === 0) return
    let cancelado = false

    Promise.all(
      conversaciones.map((c) =>
        apiGet<Mensaje[]>(`/mensajeria/conversaciones/${c.idConversacion}/mensajes`)
          .then(
            (lista) => [c.idInstructor, lista.filter((m) => m.idRemitente !== perfil.idUsuario && !m.leido).length] as const,
          )
          .catch(() => [c.idInstructor, 0] as const),
      ),
    ).then((pares) => {
      if (!cancelado) setNoLeidosBase(Object.fromEntries(pares))
    })

    return () => {
      cancelado = true
    }
  }, [vistaChat, conversaciones, perfil])

  // El de la conversación abierta se recalcula sobre el hilo ya cargado
  // (no sobre `noLeidosBase`, que queda desactualizado en cuanto se marcan
  // como leídos): así su badge baja a 0 apenas se abre, sin esperar a que
  // se vuelva a pedir la bandeja entera.
  const noLeidosPorInstructor = useMemo(() => {
    const mapa = { ...noLeidosBase }
    if (elegido && perfil && hiloCargado) {
      mapa[elegido.idInstructor] = mensajes.filter((m) => m.idRemitente !== perfil.idUsuario && !m.leido).length
    }
    return mapa
  }, [noLeidosBase, elegido, perfil, hiloCargado, mensajes])

  // Si se llega a la bandeja desde la tarjeta de un instructor (botón
  // "Escribir" del directorio), ese es el que se abre -- sin esto, la
  // bandeja siempre aterrizaría vacía y habría que elegir de nuevo.
  useEffect(() => {
    if (!vistaChat || elegido) return
    const idDesdeDirectorio = (location.state as { idInstructor?: string } | null)?.idInstructor
    if (!idDesdeDirectorio) return
    const encontrado = instructores.find((i) => i.idInstructor === idDesdeDirectorio)
    if (encontrado) setElegido(encontrado)
  }, [vistaChat, elegido, location.state, instructores])

  async function copiarCorreo(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      setCorreoCopiado(email)
      window.setTimeout(() => setCorreoCopiado((actual) => (actual === email ? null : actual)), 1500)
    } catch {
      // Sin permiso del portapapeles (poco común): el correo sigue ahí
      // como link de mailto, así que no es una falla bloqueante.
    }
  }

  return (
    <AppShell activo={vistaChat ? 'Mensajes' : 'Mis instructores'}>
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Autoservicio del aprendiz</p>
        <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">
          {vistaChat ? 'Mensajes' : 'Mis instructores'}
        </h1>
        <p className="mb-3 text-sm text-on-surface-variant dark:text-slate-400">
          {vistaChat
            ? 'Escríbele a quien te dicta clase esta ficha y revisa lo que ya han hablado.'
            : 'Quiénes te dictan clase esta ficha, qué materia y cómo escribirles por correo.'}
        </p>

        {!vistaChat && !cargando && !error && (
          <p className="mb-6 flex items-start gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined shrink-0 text-[18px] text-primary" aria-hidden="true">
              forum
            </span>
            {puedeEscribir ? (
              <span>
                <strong className="text-on-surface">Mensajes:</strong> como vocero de tu ficha, puedes escribirle a
                un instructor con el botón "Escribir" de su tarjeta, o desde la pestaña "Mensajes" de arriba.
              </span>
            ) : (
              <span>
                <strong className="text-on-surface">Mensajes:</strong> por ahora solo el vocero o subvocero de la
                ficha puede escribirle directamente a un instructor. Si necesitas contactarlo, usa su correo.
              </span>
            )}
          </p>
        )}

        {vistaChat && !cargando && !error && !puedeEscribir && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800">
            <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-on-surface-variant">
              lock
            </span>
            <p className="mt-2 text-sm font-semibold text-on-surface dark:text-slate-100">
              Esta bandeja es solo para el vocero o subvocero de tu ficha
            </p>
            <Link to="/mensajes" className="mt-1 inline-block text-sm font-semibold text-primary hover:underline">
              Ir al directorio de instructores
            </Link>
          </div>
        )}

        {cargando && <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando tus mensajes…</p>}

        {error && (
          <p className="rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {!cargando && !error && instructores.length === 0 && !(vistaChat && !puedeEscribir) && (
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

        {!vistaChat && !cargando && !error && instructores.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {instructores.map((instructor) => {
              return (
                <div
                  key={instructor.idInstructor}
                  className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                      {iniciales(instructor.nombre)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-on-surface dark:text-slate-100">
                        {instructor.nombre}
                      </p>
                      <p
                        title={instructor.temas.join(', ')}
                        className="line-clamp-2 text-xs leading-snug text-on-surface-variant dark:text-slate-400"
                      >
                        Dicta: {instructor.temas[0] ?? 'Sin materia registrada'}
                      </p>
                    </div>
                  </div>

                  {instructor.email && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2 dark:bg-slate-700">
                      <a
                        href={`mailto:${instructor.email}`}
                        title={instructor.email}
                        className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        <span className="material-symbols-outlined shrink-0 text-[16px]" aria-hidden="true">mail</span>
                        <span className="truncate">{instructor.email}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => void copiarCorreo(instructor.email!)}
                        title="Copiar correo"
                        aria-label={`Copiar correo de ${instructor.nombre}`}
                        className="shrink-0 rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                          {correoCopiado === instructor.email ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant dark:text-slate-400">
                    <span className="truncate">{instructor.ambientes.join(', ') || '—'}</span>
                    {puedeEscribir && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/mensajes/chat', { state: { idInstructor: instructor.idInstructor } })
                        }
                        className="shrink-0 font-semibold text-primary hover:underline"
                      >
                        Escribir
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {vistaChat && !cargando && !error && puedeEscribir && instructores.length > 0 && (
          <div className="flex min-h-[26rem] gap-4">
            <div className="w-full max-w-[16rem] shrink-0 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800">
              <ul>
                {instructores.map((instructor) => {
                  const activo = elegido?.idInstructor === instructor.idInstructor
                  const noLeidos = noLeidosPorInstructor[instructor.idInstructor] ?? 0

                  return (
                    <li key={instructor.idInstructor}>
                      <button
                        type="button"
                        onClick={() => setElegido(instructor)}
                        aria-current={activo || undefined}
                        className={`flex w-full items-center gap-2.5 border-b border-outline-variant px-3 py-2.5 text-left last:border-b-0 dark:border-slate-700 ${
                          activo ? 'bg-primary-container' : 'hover:bg-surface-container-high'
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                          {iniciales(instructor.nombre)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-on-surface dark:text-slate-100">
                            {instructor.nombre}
                          </p>
                          <p className="truncate text-xs text-on-surface-variant dark:text-slate-400">
                            {instructor.temas[0] ?? 'Sin materia registrada'}
                          </p>
                        </span>
                        {noLeidos > 0 && (
                          <span className="shrink-0 rounded-full bg-error px-1.5 text-xs font-bold text-white">
                            {noLeidos}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800">
              {!elegido && (
                <p className="m-auto max-w-xs text-center text-sm text-on-surface-variant dark:text-slate-400">
                  Elige un instructor de la lista para escribirle o leer lo que ya han hablado.
                </p>
              )}

              {elegido && (
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
