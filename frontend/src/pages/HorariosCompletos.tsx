import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { nombresDias } from '../components/relacionados/formatoBloque'
import { BLOQUES } from './horario/tipos'
import type { Jornada } from './horario/tipos'
import { colorParaBloque } from './horario/gridLogic'
import { apiGet, ApiError } from '../services/api'
import type { Ambiente, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../types/api'

type FiltroJornada = 'todas' | Jornada
const POR_PAGINA = 10

function jornadaDeHorario(horario: Horario): Jornada | null {
  return BLOQUES.find((bloque) => bloque.horaInicio24 === horario.horaInicio)?.jornada ?? null
}

function formatoHora(hora: string) {
  return hora.slice(0, 5)
}

/**
 * "Horarios completos" — a diferencia de Fichas/Instructores/Ambientes
 * (cada una centrada en UNA entidad y todo lo que tiene alrededor), acá el
 * horario mismo es la fila: cada `GET /horarios/` es un renglón, con la
 * ficha/instructor/ambiente/resultado/trimestre que le corresponden
 * combinados en un mismo lugar — la vista que "unifica" lo que las otras
 * tres muestran por separado. Enlazada desde el drawer del día en
 * CalendarioGeneral.tsx ("Ver horario completo") y desde acá se puede
 * saltar a la ficha/instructor/ambiente completos (?id=), mismo patrón de
 * ida y vuelta que el resto del sistema.
 */
export function HorariosCompletos() {
  const [searchParams] = useSearchParams()
  const idDesdeUrl = searchParams.get('id')
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [instructores, setInstructores] = useState<Usuario[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [trimestres, setTrimestres] = useState<Trimestre[]>([])
  const [diasSemana, setDiasSemana] = useState<DiaSemana[]>([])

  const [busqueda, setBusqueda] = useState('')
  const [filtroJornada, setFiltroJornada] = useState<FiltroJornada>('todas')
  const [filtroTrimestre, setFiltroTrimestre] = useState('todos')
  const [paginaActual, setPaginaActual] = useState(1)
  const [seleccionado, setSeleccionado] = useState<Horario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Horario[]>('/horarios/')
      .then((datos) => {
        setHorarios(datos)

        // Deep link desde el drawer del día en CalendarioGeneral.tsx
        // ("Ver horario completo" → /horarios/completos?id=...) — dentro
        // del .then, no en un efecto reactivo aparte, mismo patrón que
        // Fichas.tsx/Instructores.tsx/Ambientes.tsx.
        if (idDesdeUrl) {
          const encontrado = datos.find((horario) => horario.idHorario === Number(idDesdeUrl))
          if (encontrado) setSeleccionado(encontrado)
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de horarios.'))
      .finally(() => setCargando(false))

    apiGet<Ficha[]>('/fichas/').then(setFichas).catch(() => {})
    apiGet<Usuario[]>('/usuarios/').then(setInstructores).catch(() => {})
    apiGet<Ambiente[]>('/ambientes').then(setAmbientes).catch(() => {})
    apiGet<Sede[]>('/sedes').then(setSedes).catch(() => {})
    apiGet<Trimestre[]>('/trimestres/').then(setTrimestres).catch(() => {})
    apiGet<DiaSemana[]>('/dias-semana/').then(setDiasSemana).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idDesdeUrl no cambia en la vida del componente.
  }, [])

  const fichaPorId = new Map(fichas.map((ficha) => [ficha.idFicha, ficha]))
  const instructorPorId = new Map(instructores.map((usuario) => [usuario.idUsuario, usuario]))
  const ambientePorId = new Map(ambientes.map((ambiente) => [ambiente.idAmbiente, ambiente]))
  const sedePorId = new Map(sedes.map((sede) => [sede.idSede, sede.nombreSede]))
  const trimestrePorId = new Map(trimestres.map((trimestre) => [trimestre.idTrimestre, trimestre]))
  const diasPorId = Object.fromEntries(diasSemana.map((dia) => [dia.idDia, dia.nombreDia]))

  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos = Number(Boolean(busqueda.trim())) + Number(filtroJornada !== 'todas') + Number(filtroTrimestre !== 'todos')
  const visibles = horarios.filter((horario) => {
    const programa = fichaPorId.get(horario.idFicha)?.programa.nombrePrograma ?? ''
    const coincideTexto =
      !texto ||
      `${horario.fichaCodigo} ${programa} ${horario.instructorNombre} ${horario.ambienteNombre}`.toLocaleLowerCase('es-CO').includes(texto)
    const coincideJornada = filtroJornada === 'todas' || jornadaDeHorario(horario) === filtroJornada
    const coincideTrimestre = filtroTrimestre === 'todos' || horario.idTrimestre === Number(filtroTrimestre)
    return coincideTexto && coincideJornada && coincideTrimestre
  })

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicioPagina = (paginaSegura - 1) * POR_PAGINA
  const visiblesPagina = visibles.slice(inicioPagina, inicioPagina + POR_PAGINA)

  const { bloques: bloquesGrid, grid } = convertirHorariosAGrid(seleccionado ? [seleccionado] : [])
  const fichaSeleccionada = seleccionado ? fichaPorId.get(seleccionado.idFicha) : undefined
  const instructorSeleccionado = seleccionado ? instructorPorId.get(seleccionado.idInstructor) : undefined
  const ambienteSeleccionado = seleccionado ? ambientePorId.get(seleccionado.idAmbiente) : undefined
  const trimestreSeleccionado = seleccionado ? trimestrePorId.get(seleccionado.idTrimestre) : undefined
  const jornadaSeleccionada = seleccionado ? jornadaDeHorario(seleccionado) : null
  const colorSeleccionado = seleccionado ? colorParaBloque(String(seleccionado.idHorario)) : null

  return (
    <AppShell activo="Horarios completos">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Horarios completos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cada horario con su ficha, instructor, ambiente y tema en un solo lugar.</p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {horarios.length} horarios</p>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de horarios">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filtrar horarios</p>
            {filtrosActivos > 0 && <span className="rounded-full bg-sena-50 px-2 py-0.5 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
            {filtrosActivos > 0 && (
              <button type="button" onClick={() => { setBusqueda(''); setFiltroJornada('todas'); setFiltroTrimestre('todos') }} className="text-sm font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Horarios</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{horarios.length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Fichas</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{new Set(horarios.map((h) => h.idFicha)).size}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Instructores</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{new Set(horarios.map((h) => h.idInstructor)).size}</p></div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="buscar-horario" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar</label>
            <input id="buscar-horario" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Ficha, programa, instructor o ambiente" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <div>
            <label htmlFor="filtro-jornada-horario" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Jornada</label>
            <select id="filtro-jornada-horario" value={filtroJornada} onChange={(evento) => setFiltroJornada(evento.target.value as FiltroJornada)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todas">Todas</option>
              <option value="Mañana">Mañana</option>
              <option value="Tarde">Tarde</option>
              <option value="Noche">Noche</option>
            </select>
          </div>
          <div>
            <label htmlFor="filtro-trimestre-horario" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Trimestre</label>
            <select id="filtro-trimestre-horario" value={filtroTrimestre} onChange={(evento) => setFiltroTrimestre(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              {trimestres.map((trimestre) => <option key={trimestre.idTrimestre} value={trimestre.idTrimestre}>{trimestre.nombre}</option>)}
            </select>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando horarios...</p> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Ficha</th><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Ambiente</th><th className="px-4 py-3">Jornada</th><th className="px-4 py-3">Días</th><th className="px-4 py-3">Hora</th><th className="px-4 py-3">Trimestre</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{visiblesPagina.map((horario) => {
        const color = colorParaBloque(String(horario.idHorario))
        return (
          <tr key={horario.idHorario} onClick={() => setSeleccionado(horario)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60">
            <td className={`border-l-4 px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 ${color.borde}`}>{horario.fichaCodigo}</td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{horario.instructorNombre ?? 'Sin definir'}</td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{horario.ambienteNombre ?? 'Sin definir'}</td>
            <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color.fondo} ${color.texto}`}>{jornadaDeHorario(horario) ?? 'Sin definir'}</span></td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{nombresDias(horario.dias, diasPorId)}</td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatoHora(horario.horaInicio)}-{formatoHora(horario.horaFin)}</td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{trimestrePorId.get(horario.idTrimestre)?.nombre ?? 'Sin definir'}</td>
          </tr>
        )
      })}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No hay horarios que coincidan con los filtros.</p>}

        {visibles.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Página {paginaSegura} de {totalPaginas}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaginaActual((pagina) => Math.max(1, pagina - 1))}
                disabled={paginaSegura === 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPaginaActual((pagina) => Math.min(totalPaginas, pagina + 1))}
                disabled={paginaSegura === totalPaginas}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>}

      {seleccionado && colorSeleccionado && (
        <DrawerRelacionados
          iniciales={String(seleccionado.idHorario)}
          titulo={`Horario #${seleccionado.idHorario}`}
          subtitulo={seleccionado.fichaCodigo ?? undefined}
          etiquetas={[jornadaSeleccionada ?? 'Sin jornada', trimestreSeleccionado?.nombre ?? 'Sin trimestre']}
          onCerrar={() => setSeleccionado(null)}
        >
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Ficha</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {seleccionado.fichaCodigo}{fichaSeleccionada ? ` — ${fichaSeleccionada.programa.nombrePrograma}` : ''}
              </dd>
              <Link to={`/fichas?id=${seleccionado.idFicha}`} className="text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Ver ficha →</Link>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Instructor</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {seleccionado.instructorNombre ?? 'Sin definir'}{instructorSeleccionado?.tipoContrato ? ` — ${instructorSeleccionado.tipoContrato}` : ''}
              </dd>
              <Link to={`/instructores?id=${seleccionado.idInstructor}`} className="text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Ver instructor →</Link>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Ambiente</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {seleccionado.ambienteNombre ?? 'Sin definir'}
                {ambienteSeleccionado ? ` — ${sedePorId.get(ambienteSeleccionado.idSede) ?? 'Sede sin definir'}` : ''}
              </dd>
              <Link to={`/ambientes?id=${seleccionado.idAmbiente}`} className="text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Ver ambiente →</Link>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Tema</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {[seleccionado.resultadoCodigo, seleccionado.resultadoDescripcion].filter(Boolean).join(' — ') || 'Sin definir'}
              </dd>
            </div>
          </dl>

          <SeccionDrawer titulo="Horario semanal">
            <div className="text-[10px]">
              <GridHorario bloques={bloquesGrid} grid={grid} hayBloqueActivo={false} soloLectura ocultarFilasVacias />
            </div>
          </SeccionDrawer>
        </DrawerRelacionados>
      )}
    </AppShell>
  )
}
