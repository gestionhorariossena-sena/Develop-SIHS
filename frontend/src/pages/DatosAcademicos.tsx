import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'

interface AccesoDatos {
  titulo: string
  descripcion: string
  ruta: string
  icono: string
}

const FORMACION: AccesoDatos[] = [
  { titulo: 'Programas', descripcion: 'Define la oferta de formación', ruta: '/programas', icono: 'account_tree' },
  { titulo: 'Temáticas', descripcion: 'Organiza competencias y resultados por programa', ruta: '/tematicas', icono: 'menu_book' },
  { titulo: 'Fichas', descripcion: 'Asocia cada grupo a un programa y período', ruta: '/fichas', icono: 'groups' },
  { titulo: 'Aprendices', descripcion: 'Consulta y carga integrantes de cada ficha', ruta: '/aprendices', icono: 'school' },
]

const RECURSOS: AccesoDatos[] = [
  { titulo: 'Sedes', descripcion: 'Ubica los espacios de formación', ruta: '/sedes', icono: 'location_city' },
  { titulo: 'Ambientes', descripcion: 'Administra aulas y talleres por sede', ruta: '/ambientes', icono: 'meeting_room' },
  { titulo: 'Instructores', descripcion: 'Consulta perfiles y carga docente', ruta: '/instructores', icono: 'badge' },
]

/** Entrada única para los catálogos que sostienen la programación académica. */
export function DatosAcademicos() {
  return <AppShell activo="Datos académicos">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-5">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Coordinación académica</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">Datos académicos</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">Prepara la formación y los recursos que utilizarás al construir los horarios.</p>
      </div>
      <Link to="/horarios/completos" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-outline px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">calendar_month</span>
        Gestionar horarios
      </Link>
    </header>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.85fr)]">
      <GrupoDatos titulo="Recorrido de formación" descripcion="Empieza por el programa; sus temáticas pueden completarse antes de programar los bloques." accesos={FORMACION} numerado />
      <GrupoDatos titulo="Recursos para programar" descripcion="Espacios e instructores que podrás asignar a los horarios." accesos={RECURSOS} />
    </div>
  </AppShell>
}

function GrupoDatos({ titulo, descripcion, accesos, numerado = false }: { titulo: string; descripcion: string; accesos: AccesoDatos[]; numerado?: boolean }) {
  return <section aria-label={titulo} className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
    <div className="border-b border-outline-variant px-5 py-5 sm:px-6"><h2 className="text-lg font-semibold text-on-surface">{titulo}</h2><p className="mt-1 text-sm leading-5 text-on-surface-variant">{descripcion}</p></div>
    <div className="divide-y divide-outline-variant px-2 sm:px-3">
      {accesos.map((acceso, indice) => <Link key={acceso.ruta} to={acceso.ruta} className="group flex min-h-20 items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span aria-hidden="true" className="w-6 shrink-0 font-mono text-xs tabular-nums text-on-surface-variant">{numerado ? String(indice + 1).padStart(2, '0') : <span className="material-symbols-outlined text-[19px]">{acceso.icono}</span>}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-on-surface">{acceso.titulo}</span><span className="mt-1 block text-sm leading-5 text-on-surface-variant">{acceso.descripcion}</span></span>
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary">arrow_forward</span>
      </Link>)}
    </div>
  </section>
}
