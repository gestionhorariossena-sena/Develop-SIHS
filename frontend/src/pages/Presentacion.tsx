import { Link } from 'react-router-dom'
import senaLogo from '../assets/sena-logo.jpeg'
import { ThemeSelector } from '../components/ThemeSelector'

const FUNCIONALIDADES = [
  {
    titulo: 'Crear horarios',
    descripcion: 'Organiza los bloques de una ficha y valida la disponibilidad de instructores y ambientes antes de publicar.',
  },
  {
    titulo: 'Revisar conflictos',
    descripcion: 'Consulta los cruces de ficha, instructor o ambiente en los horarios guardados.',
  },
  {
    titulo: 'Consultar la programación',
    descripcion: 'Cambia entre la lista de bloques, el calendario general y las vistas por ficha, instructor o ambiente.',
  },
  {
    titulo: 'Ver mi horario',
    descripcion: 'Consulta tus clases publicadas. Si eres instructor, puedes descargar tu horario y solicitar cambios.',
  },
]

export function Presentacion() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <img src={senaLogo} alt="SENA" className="h-9 w-9 rounded-lg object-cover" />
            <div className="leading-tight">
              <p className="font-display font-semibold">SIHS</p>
              <p className="hidden text-xs text-on-surface-variant sm:block">Sistema Institucional de Horarios</p>
            </div>
          </div>

          <nav aria-label="Acceso" className="flex flex-wrap items-center gap-3">
            <ThemeSelector />
            <Link to="/login" className="rounded-lg px-2 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)] lg:gap-12">
          <div>
            <p className="mb-4 text-sm font-medium text-tertiary dark:text-tertiary">SENA · CGMLTI Calle 52</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Horarios de formación del CGMLTI</h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-on-surface-variant">
              Organiza fichas, instructores y ambientes. Consulta las clases publicadas y revisa los cruces de programación.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/login" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary transition-[filter] hover:brightness-90">
                Iniciar sesión
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
              </Link>
              <Link to="/registro" className="inline-flex min-h-11 items-center rounded-lg border border-outline px-4 text-sm font-medium hover:bg-surface-container">
                Registrarse
              </Link>
            </div>
          </div>

          <figure className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest">
            <figcaption className="flex flex-wrap justify-between gap-2 border-b border-outline-variant px-4 py-3 sm:px-5">
              <span className="text-sm font-medium">Horario semanal</span>
              <span className="text-xs text-on-surface-variant">Ficha de ejemplo</span>
            </figcaption>
            <div className="px-4 py-5 sm:px-5">
              <p className="text-sm font-semibold">Análisis y Desarrollo de Software</p>
              <p className="mt-1 text-xs font-mono text-on-surface-variant">DEMO-2874521</p>
              <div className="mt-4 divide-y divide-outline-variant border-y border-outline-variant">
                {['Lunes', 'Miércoles'].map((dia) => (
                  <div key={dia} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{dia}</p>
                      <p className="mt-1 text-xs tabular-nums text-on-surface-variant">08:00–10:00</p>
                    </div>
                    <div className="border-l-2 border-primary bg-primary-container/50 px-3 py-1.5">
                      <p className="text-sm font-medium">Laboratorio de Software</p>
                      <p className="text-xs text-on-surface-variant">Instructor Demo</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </figure>
        </section>

        <section id="funcionalidades" className="border-y border-outline-variant bg-surface-container-lowest">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <h2 className="mb-5 text-2xl font-semibold tracking-tight">Qué puedes hacer en SIHS</h2>
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {FUNCIONALIDADES.map(({ titulo, descripcion }) => (
                <div key={titulo} className="border-t border-outline-variant pt-3">
                  <h3 className="font-semibold">{titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-4 py-8 sm:px-6">
          <div>
            <h2 className="font-semibold">Servicio Nacional de Aprendizaje — SENA</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Centro de Gestión de Mercados, Logística y Tecnologías de la Información</p>
            <p className="mt-1 text-sm text-on-surface-variant">Calle 52 No. 13-65 · Bogotá D.C.</p>
          </div>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">Ingresar a SIHS</Link>
        </section>
      </main>

      <footer className="border-t border-outline-variant">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-on-surface-variant sm:px-6">
          <span>CGMLTI Calle 52 · Regional Distrito Capital</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a href="https://historico.sena.edu.co/es-co/transparencia/Paginas/mecanismosContacto.aspx" target="_blank" rel="noopener noreferrer" className="hover:text-on-surface hover:underline">Canales de atención del SENA</a>
            <a href="https://historico.sena.edu.co/es-co/transparencia/Paginas/habeas_data.aspx" target="_blank" rel="noopener noreferrer" className="hover:text-on-surface hover:underline">Política de datos personales</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
