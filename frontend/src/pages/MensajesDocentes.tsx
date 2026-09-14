import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPatch, apiPost, ApiError } from '../services/api'
import type { Conversacion, Horario, Mensaje, Usuario } from '../types/api'

interface ContactoInstructor {
  idInstructor: string
  nombre: string
  tema: string
  ambiente: string
}

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('')
}

/**
 * Mensajería Aprendiz <-> Instructor — GET/POST /mensajeria/conversaciones,
 * GET/POST /mensajeria/conversaciones/{id}/mensajes (backend ya existía
 * completo en la rama `main`, portado tal cual en este ticket, ver la
 * migración a96796ac4682).
 *
 * El "directorio" de instructores con los que se puede iniciar
 * conversación sale de GET /ficha-usuario/mi-horario (los mismos
 * instructores que le dictan clase a la ficha del Aprendiz — es
 * exactamente la regla que valida el backend al crear una conversación),
 * mismo patrón que "Mis Instructores" en MiHorarioAprendiz.tsx. No hay
 * vista previa del último mensaje por contacto en la lista: no existe un
 * endpoint "último mensaje por conversación" y pedirlo por separado por
 * cada conversación sería N+1 solo para una vista previa de texto.
 */
export function MensajesDocentes() {
  const [miId, setMiId] = useState<string | null>(null)
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [conversaciones, setConversaciones] = useState<Conversacion[] | null>(null)
  const [sinFicha, setSinFicha] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [conversacionActivaId, setConversacionActivaId] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null)
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [errorMensajes, setErrorMensajes] = useState<string | null>(null)
  const [textoNuevo, setTextoNuevo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [iniciandoCon, setIniciandoCon] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([apiGet<Usuario>('/usuarios/me'), apiGet<Conversacion[]>('/mensajeria/conversaciones')])
      .then(([perfil, listaConversaciones]) => {
        setMiId(perfil.idUsuario)
        setConversaciones(listaConversaciones)
        return apiGet<Horario[]>('/ficha-usuario/mi-horario')
      })
      .then(setHorarios)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setSinFicha(true)
          return
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la mensajería.')
      })
      .finally(() => setCargando(false))
  }, [])

  const directorio = useMemo(() => {
    const mapa = new Map<string, ContactoInstructor>()
    for (const h of horarios ?? []) {
      const tema = [h.resultadoCodigo, h.resultadoDescripcion].filter(Boolean).join(' — ') || 'Clase'
      const existente = mapa.get(h.idInstructor)
      if (existente) {
        if (!existente.tema.includes(tema)) existente.tema = `${existente.tema}, ${tema}`
      } else {
        mapa.set(h.idInstructor, {
          idInstructor: h.idInstructor,
          nombre: h.instructorNombre ?? 'Instructor',
          tema,
          ambiente: h.ambienteNombre ?? '—',
        })
      }
    }
    return mapa
  }, [horarios])

  const contactos = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es-CO')
    return [...directorio.values()]
      .filter((c) => !texto || `${c.nombre} ${c.tema}`.toLocaleLowerCase('es-CO').includes(texto))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-CO'))
  }, [directorio, busqueda])

  const conversacionPorInstructor = useMemo(() => {
    const mapa = new Map<string, Conversacion>()
    for (const c of conversaciones ?? []) mapa.set(c.idInstructor, c)
    return mapa
  }, [conversaciones])

  const contactoActivo = useMemo(() => {
    const conversacionActiva = conversaciones?.find((c) => c.idConversacion === conversacionActivaId)
    return conversacionActiva ? directorio.get(conversacionActiva.idInstructor) : undefined
  }, [conversaciones, conversacionActivaId, directorio])

  async function cargarMensajes(idConversacion: number, idInstructorActivo: string) {
    setCargandoMensajes(true)
    setErrorMensajes(null)
    try {
      const lista = await apiGet<Mensaje[]>(`/mensajeria/conversaciones/${idConversacion}/mensajes`)
      setMensajes(lista)

      const pendientes = lista.filter((m) => !m.leido && m.idRemitente === idInstructorActivo)
      if (pendientes.length > 0) {
        await Promise.all(pendientes.map((m) => apiPatch(`/mensajeria/mensajes/${m.idMensaje}/leido`)))
        setMensajes((anterior) =>
          anterior?.map((m) => (pendientes.some((p) => p.idMensaje === m.idMensaje) ? { ...m, leido: true } : m)) ?? anterior,
        )
      }
    } catch (err) {
      setErrorMensajes(err instanceof ApiError ? err.message : 'No se pudieron cargar los mensajes.')
    } finally {
      setCargandoMensajes(false)
    }
  }

  async function seleccionarContacto(contacto: ContactoInstructor) {
    setErrorMensajes(null)
    let conversacion = conversacionPorInstructor.get(contacto.idInstructor)

    if (!conversacion) {
      setIniciandoCon(contacto.idInstructor)
      try {
        conversacion = await apiPost<Conversacion>('/mensajeria/conversaciones', { idInstructor: contacto.idInstructor })
        setConversaciones((anterior) => [...(anterior ?? []), conversacion as Conversacion])
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo iniciar la conversación.')
        setIniciandoCon(null)
        return
      }
      setIniciandoCon(null)
    }

    setConversacionActivaId(conversacion.idConversacion)
    setMensajes(null)
    void cargarMensajes(conversacion.idConversacion, contacto.idInstructor)
  }

  async function enviarMensaje(event: FormEvent) {
    event.preventDefault()
    const contenido = textoNuevo.trim()
    if (!conversacionActivaId || !contenido) return

    setEnviando(true)
    try {
      const nuevo = await apiPost<Mensaje>(`/mensajeria/conversaciones/${conversacionActivaId}/mensajes`, { contenido })
      setMensajes((anterior) => [...(anterior ?? []), nuevo])
      setTextoNuevo('')
    } catch (err) {
      setErrorMensajes(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AppShell activo="Mensajes Docentes">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Mensajes Docentes</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Consulta directa con los instructores que dictan clase a tu ficha.
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {cargando ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando mensajería...</p>
      ) : sinFicha ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Todavía no tienes una ficha vinculada — vincúlala desde tu perfil para escribirle a tus instructores.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" style={{ minHeight: '32rem' }}>
          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="space-y-2 border-b border-slate-100 p-3 dark:border-slate-700">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar instructor o materia..."
                aria-label="Buscar instructor o materia"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-900">
                <span className="rounded-md bg-white px-2 py-1.5 text-center text-sena-700 shadow-sm dark:bg-slate-700 dark:text-sena-400">
                  Mis Instructores
                </span>
                <button
                  type="button"
                  disabled
                  title="Canal Ficha: contenido de mockup (Stitch) — pendiente de conectar a un dato real del backend (v1 solo soporta conversaciones 1 a 1)"
                  className="cursor-not-allowed rounded-md px-2 py-1.5 text-center text-slate-400 dark:text-slate-500"
                >
                  Canal Ficha
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {contactos.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No hay instructores que coincidan con la búsqueda.
                </p>
              )}
              {contactos.map((contacto) => {
                const conversacion = conversacionPorInstructor.get(contacto.idInstructor)
                const activo = conversacion?.idConversacion === conversacionActivaId
                return (
                  <button
                    key={contacto.idInstructor}
                    type="button"
                    onClick={() => void seleccionarContacto(contacto)}
                    disabled={iniciandoCon === contacto.idInstructor}
                    className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition ${
                      activo ? 'bg-sena-50 dark:bg-sena-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sena-100 text-xs font-bold text-sena-700 dark:bg-sena-950/50 dark:text-sena-400">
                      {iniciales(contacto.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-1">
                        <span className={`truncate text-sm font-semibold ${activo ? 'text-sena-700 dark:text-sena-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {contacto.nombre}
                        </span>
                        {iniciandoCon === contacto.idInstructor && <span className="shrink-0 text-xs text-slate-400">Abriendo…</span>}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{contacto.tema}</span>
                      {!conversacion && (
                        <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          Sin conversación aún
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8 dark:border-slate-700 dark:bg-slate-800">
            {!contactoActivo ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Elige un instructor de la lista para ver o iniciar la conversación.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sena-100 text-sm font-bold text-sena-700 dark:bg-sena-950/50 dark:text-sena-400">
                      {iniciales(contactoActivo.nombre)}
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{contactoActivo.nombre}</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {contactoActivo.tema} · {contactoActivo.ambiente}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    title="Contenido de mockup (Stitch) — pendiente de conectar a un dato real del backend"
                    className="cursor-not-allowed self-start rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 sm:self-center dark:border-slate-700 dark:text-slate-300"
                  >
                    Ver sus horarios
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {errorMensajes && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMensajes}</p>
                  )}

                  {cargandoMensajes ? (
                    <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Cargando mensajes...</p>
                  ) : mensajes && mensajes.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Todavía no hay mensajes — escribe el primero.
                    </p>
                  ) : (
                    mensajes?.map((mensaje, indice) => {
                      const esMio = mensaje.idRemitente === miId
                      const cambioDeDia = indice === 0 || formatearFecha(mensaje.fechaEnvio) !== formatearFecha(mensajes[indice - 1].fechaEnvio)
                      return (
                        <div key={mensaje.idMensaje}>
                          {cambioDeDia && (
                            <div className="mb-3 flex justify-center">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                {formatearFecha(mensaje.fechaEnvio)}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                              esMio
                                ? 'rounded-tr-none bg-sena-600 text-white'
                                : 'rounded-tl-none bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                            }`}>
                              <p className="whitespace-pre-wrap">{mensaje.contenido}</p>
                              <p className={`mt-1 text-right text-[11px] ${esMio ? 'text-white/70' : 'text-slate-400'}`}>
                                {formatearHora(mensaje.fechaEnvio)}
                                {esMio && (mensaje.leido ? ' · Leído' : ' · Entregado')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <form onSubmit={enviarMensaje} className="flex items-end gap-2 border-t border-slate-100 p-3 dark:border-slate-700">
                  <textarea
                    value={textoNuevo}
                    onChange={(e) => setTextoNuevo(e.target.value)}
                    placeholder={`Escribe tu consulta para ${contactoActivo.nombre}...`}
                    rows={2}
                    className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={enviando || !textoNuevo.trim()}
                    className="rounded-lg bg-sena-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sena-700 disabled:opacity-60"
                  >
                    {enviando ? 'Enviando…' : 'Enviar'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        Mensajería académica institucional — no reemplaza la plataforma oficial (ZAJUNA) para calificaciones o entrega de evidencias.
      </p>
    </AppShell>
  )
}
