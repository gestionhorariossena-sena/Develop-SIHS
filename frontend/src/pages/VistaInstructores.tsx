import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { apiGet, ApiError } from '../services/api'
import type { Horario, Usuario } from '../types/api'

function iniciales(nombre: string) {
  return nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte.charAt(0).toUpperCase()).join('')
}

/**
 * "Vista por instructores" (backlog sidebar.png, grupo Programación) —
 * filtra por UN instructor y muestra su horario semanal completo, para
 * que el coordinador no tenga que buscarlo a mano en cada ficha/ambiente.
 * El detalle (tipo de contrato, especialidades, carga semanal) sigue
 * viviendo en Instructores.tsx — acá solo hay un link "Ver info" que
 * lleva para allá y abre su drawer directo (vía ?id=), sin duplicar esa
 * información en dos pantallas.
 */
export function VistaInstructores() {
  const [instructores, setInstructores] = useState<Usuario[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [horarios, setHorarios] = useState<{ idUsuario: string; datos: Horario[] } | null>(null)
  const [errorHorariosPara, setErrorHorariosPara] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Usuario[]>('/usuarios/')
      .then((usuarios) => setInstructores(usuarios.filter((usuario) => usuario.roles.some((rol) => rol.nombre === 'Instructor'))))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de instructores.'))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!seleccionado) return

    apiGet<Horario[]>(`/usuarios/${seleccionado.idUsuario}/horarios`)
      .then((datos) => setHorarios({ idUsuario: seleccionado.idUsuario, datos }))
      .catch(() => setErrorHorariosPara(seleccionado.idUsuario))
  }, [seleccionado])

  const horariosVigentes = seleccionado && horarios?.idUsuario === seleccionado.idUsuario ? horarios.datos : null
  const errorHorarios = seleccionado?.idUsuario === errorHorariosPara
  const cargandoHorarios = Boolean(seleccionado) && horariosVigentes === null && !errorHorarios
  const { bloques, grid } = convertirHorariosAGrid(horariosVigentes ?? [])

  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const visibles = instructores.filter((instructor) => {
    if (!texto) return true
    return [instructor.nombre, instructor.email, ...instructor.especialidades.map((item) => item.nombre)]
      .join(' ')
      .toLocaleLowerCase('es-CO')
      .includes(texto)
  })

  return (
    <AppShell activo="Vista por instructores">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Vista por instructores</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Filtra por un instructor y mira su horario semanal completo, sin tener que revisarlo ficha por ficha.
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtro de instructores">
          <label htmlFor="buscar-instructor-vista" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Buscar instructor
          </label>
          <input
            id="buscar-instructor-vista"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Nombre, correo o especialidad"
            className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          {cargando ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Cargando instructores…</p>
          ) : (
            <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
              {visibles.map((instructor) => {
                const esActivo = instructor.idUsuario === seleccionado?.idUsuario
                return (
                  <li key={instructor.idUsuario}>
                    <button
                      type="button"
                      onClick={() => setSeleccionado(instructor)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                        esActivo
                          ? 'bg-sena-50 text-sena-700 dark:bg-sena-950/50 dark:text-sena-300'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sena-100 text-xs font-bold text-sena-700 dark:bg-sena-950/50">
                        {iniciales(instructor.nombre)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{instructor.nombre}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {instructor.especialidades[0]?.nombre ?? 'Sin especialidad'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
              {visibles.length === 0 && (
                <p className="px-2.5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Sin resultados.</p>
              )}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          {!seleccionado ? (
            <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              Elige un instructor de la lista para ver su horario.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sena-100 font-bold text-sena-700 dark:bg-sena-950/50">
                    {iniciales(seleccionado.nombre)}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{seleccionado.nombre}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{seleccionado.email}</p>
                  </div>
                </div>
                <Link
                  to={`/instructores?id=${seleccionado.idUsuario}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Ver info →
                </Link>
              </div>

              {cargandoHorarios ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Cargando horario…</p>
              ) : errorHorarios ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No se pudo cargar el horario de este instructor.</p>
              ) : bloques.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Sin horario asignado en el trimestre actual.</p>
              ) : (
                <GridHorario bloques={bloques} grid={grid} hayBloqueActivo={false} soloLectura />
              )}
            </>
          )}
        </section>
      </div>
    </AppShell>
  )
}
