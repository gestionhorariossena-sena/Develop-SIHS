import { Link, useSearchParams } from 'react-router-dom'
import {
  escribirGestionarHorariosQuery,
  normalizarRutaHorarioLegada,
  type VistaHorario,
} from '../../pages/horario/gestionarHorariosQuery'

const VISTAS = [
  { vista: 'lista', etiqueta: 'Lista', ruta: '/horarios/completos', icono: 'format_list_bulleted' },
  { vista: 'calendario', etiqueta: 'Calendario', ruta: '/calendario', icono: 'calendar_month' },
  { vista: 'conflictos', etiqueta: 'Conflictos', ruta: '/horarios/auditoria', icono: 'rule' },
] as const

export function CabeceraGestionHorarios({ vista, descripcion }: { vista: VistaHorario; descripcion: string }) {
  const [params] = useSearchParams()
  const queryLista = normalizarRutaHorarioLegada('/horarios/completos', params)
  // Conserva el contexto al volver a la lista. Cada vista tiene sus propios filtros.

  return (
    <div className="mb-6 border-b border-outline-variant">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">Gestionar horarios</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{descripcion}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/horarios/publicaciones-programadas" className="rounded-lg border border-outline px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container">
            Publicaciones programadas
          </Link>
          <Link to="/horarios/nuevo" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-on-primary-container">
            Crear horario
          </Link>
        </div>
      </div>
      <nav aria-label="Cambiar vista de horarios" className="flex flex-wrap gap-x-2">
        {VISTAS.map((item) => {
          const activa = item.vista === vista
          const filtrosLista = queryLista ? escribirGestionarHorariosQuery({ ...queryLista, vista: item.vista }).toString() : ''
          return (
            <Link
              key={item.vista}
              to={{ pathname: item.ruta, search: filtrosLista ? `?${filtrosLista}` : '' }}
              aria-current={activa ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center gap-1.5 border-b-2 px-2 text-sm font-medium transition-colors sm:px-3 ${
                activa ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{item.icono}</span>
              {item.etiqueta}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
