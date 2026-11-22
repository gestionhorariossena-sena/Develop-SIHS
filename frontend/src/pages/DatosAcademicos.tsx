import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'

interface AccesoDatos {
  titulo: string
  descripcion: string
  ruta: string
  icono: string
}

const FORMACION: AccesoDatos[] = [
  { titulo: 'Programas', descripcion: 'Oferta formativa y niveles de formación', ruta: '/programas', icono: 'account_tree' },
  { titulo: 'Temáticas', descripcion: 'Competencias y resultados de aprendizaje', ruta: '/tematicas', icono: 'menu_book' },
  { titulo: 'Fichas', descripcion: 'Grupos de formación y su período académico', ruta: '/fichas', icono: 'groups' },
  { titulo: 'Aprendices', descripcion: 'Vinculación de aprendices con cada ficha', ruta: '/aprendices', icono: 'school' },
]

const RECURSOS: AccesoDatos[] = [
  { titulo: 'Instructores', descripcion: 'Perfil, contrato y asignaciones docentes', ruta: '/instructores', icono: 'badge' },
  { titulo: 'Ambientes', descripcion: 'Aulas, talleres y disponibilidad', ruta: '/ambientes', icono: 'meeting_room' },
  { titulo: 'Sedes', descripcion: 'Ubicación y organización de los ambientes', ruta: '/sedes', icono: 'location_city' },
]

/** Entrada única para los catálogos que sostienen la programación académica. */
export function DatosAcademicos() {
  return <AppShell activo="Datos académicos">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Coordinación académica</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">Datos académicos</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">Administra la información que da contexto a fichas, clases y horarios desde un único punto de entrada.</p>
      </div>
      <Link to="/horarios/completos" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-outline px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">calendar_month</span>
        Gestionar horarios
      </Link>
    </header>

    <section aria-label="Mapa académico" className="mb-8 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
      <div className="grid gap-px bg-outline-variant md:grid-cols-[minmax(0,1fr)_minmax(240px,0.72fr)]">
        <div className="bg-surface-container-lowest p-5 sm:p-6">
          <p className="text-sm font-medium text-on-surface">El recorrido de la formación</p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <PasoMapa etiqueta="Programa" icono="account_tree" />
            <Flecha />
            <PasoMapa etiqueta="Ficha" icono="groups" />
            <Flecha />
            <PasoMapa etiqueta="Aprendiz" icono="school" />
          </div>
          <p className="mt-4 text-sm leading-6 text-on-surface-variant">Define primero el programa y sus temáticas. Luego organiza las fichas y vincula a sus aprendices.</p>
        </div>
        <div className="bg-surface-container-low p-5 sm:p-6">
          <p className="text-sm font-medium text-on-surface">Recursos para programar</p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <PasoMapa etiqueta="Sede" icono="location_city" />
            <Flecha />
            <PasoMapa etiqueta="Ambiente" icono="meeting_room" />
            <Flecha />
            <PasoMapa etiqueta="Instructor" icono="badge" />
          </div>
          <p className="mt-4 text-sm leading-6 text-on-surface-variant">Estos datos permiten asignar espacios e instructores al crear cada bloque de horario.</p>
        </div>
      </div>
    </section>

    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <GrupoDatos titulo="Formación" descripcion="La estructura académica y las personas en proceso de formación" accesos={FORMACION} />
      <GrupoDatos titulo="Recursos" descripcion="Las personas y espacios disponibles para impartir la formación" accesos={RECURSOS} compacto />
    </div>
  </AppShell>
}

function PasoMapa({ etiqueta, icono }: { etiqueta: string; icono: string }) {
  return <span className="inline-flex h-9 items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 font-medium text-on-surface"><span aria-hidden="true" className="material-symbols-outlined text-[17px] text-on-surface-variant">{icono}</span>{etiqueta}</span>
}

function Flecha() {
  return <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">arrow_forward</span>
}

function GrupoDatos({ titulo, descripcion, accesos, compacto = false }: { titulo: string; descripcion: string; accesos: AccesoDatos[]; compacto?: boolean }) {
  return <section aria-labelledby={`grupo-${titulo.toLowerCase()}`}>
    <div className="mb-4"><h2 id={`grupo-${titulo.toLowerCase()}`} className="text-lg font-semibold text-on-surface">{titulo}</h2><p className="mt-1 text-sm text-on-surface-variant">{descripcion}</p></div>
    <div className={`grid gap-3 ${compacto ? 'sm:grid-cols-3 xl:grid-cols-1' : 'sm:grid-cols-2'}`}>
      {accesos.map((acceso) => <Link key={acceso.ruta} to={acceso.ruta} className="group flex min-h-24 items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 transition-colors hover:border-outline hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-container text-on-surface-variant group-hover:text-primary"><span className="material-symbols-outlined text-[19px]">{acceso.icono}</span></span>
        <span className="min-w-0"><span className="flex items-center justify-between gap-2 font-medium text-on-surface">{acceso.titulo}<span aria-hidden="true" className="material-symbols-outlined text-[17px] text-on-surface-variant transition-transform group-hover:translate-x-0.5">arrow_forward</span></span><span className="mt-1 block text-sm leading-5 text-on-surface-variant">{acceso.descripcion}</span></span>
      </Link>)}
    </div>
  </section>
}
