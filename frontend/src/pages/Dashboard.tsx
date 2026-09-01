import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'

type Turno = 'manana' | 'tarde'
type Estado = 'Confirmado' | 'Cruce' | 'Por confirmar'

interface FilaHorario {
  hora: string
  turno: Turno
  ficha: string
  programa: string
  instructor: string
  ambiente: string
  estado: Estado
}

// Réplica fiel de _Docs/Diseño/mockups-institucionales/03-dashboard.png.
// El módulo "Horarios" real (backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md)
// todavía no existe, así que TODO lo de esta pantalla (los 3 KPIs y la
// tabla) es el mismo dato de ejemplo que trae el mockup — no viene de
// ningún endpoint. Reemplazar por fetches reales (GET /horarios, etc.)
// en cuanto existan, siguiendo el patrón de apiGet documentado en
// frontend/ESTRUCTURA.md.
const HORARIO_HOY: FilaHorario[] = [
  { hora: '06:00', turno: 'manana', ficha: '2758431', programa: 'Análisis y Desarrollo de Software', instructor: 'Óscar Bermúdez', ambiente: 'Lab 204', estado: 'Confirmado' },
  { hora: '08:00', turno: 'manana', ficha: '2691205', programa: 'Gestión Logística', instructor: 'Marcela Ávila', ambiente: 'Aula 108', estado: 'Confirmado' },
  { hora: '10:00', turno: 'manana', ficha: '2744019', programa: 'Técnico en Programación de Software', instructor: 'Óscar Bermúdez', ambiente: 'Lab 204', estado: 'Cruce' },
  { hora: '13:00', turno: 'tarde', ficha: '2803577', programa: 'Gestión de Mercados', instructor: 'Julián Torres', ambiente: 'Aula 212', estado: 'Confirmado' },
  { hora: '15:00', turno: 'tarde', ficha: '2712880', programa: 'Tecnólogo en Gestión de Redes de Datos', instructor: 'Sandra Peña', ambiente: 'Lab 301', estado: 'Por confirmar' },
  { hora: '18:00', turno: 'tarde', ficha: '2766142', programa: 'Contabilización de Operaciones', instructor: 'Diego Salcedo', ambiente: 'Aula 115', estado: 'Confirmado' },
]

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'manana', etiqueta: 'Mañana' },
  { id: 'tarde', etiqueta: 'Tarde' },
] as const

const badgeEstado: Record<Estado, string> = {
  Confirmado: 'bg-emerald-50 text-emerald-700',
  Cruce: 'bg-orange-50 text-orange-700',
  'Por confirmar': 'bg-slate-100 text-slate-600',
}

const fechaHoy = (() => {
  const texto = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
})()

export function Dashboard() {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['id']>('todos')

  const filas = filtro === 'todos' ? HORARIO_HOY : HORARIO_HOY.filter((f) => f.turno === filtro)

  return (
    <AppShell activo="Inicio">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">Panel de programación</h1>
          <p className="text-sm text-slate-500">
            Centro de Gestión de Mercados, Logística y TI · {fechaHoy}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled
            title="Aún no implementado en el backend"
            className="cursor-not-allowed rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Exportar
          </button>
          <Link
            to="/horarios/nuevo"
            className="rounded-lg bg-sena-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-800"
          >
            Nuevo horario
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Horarios activos
            </p>
            <span className="h-6 w-6 rounded-md bg-emerald-50" />
          </div>
          <p className="text-3xl font-bold text-slate-900">128</p>
          <p className="mt-1 text-sm font-medium text-emerald-600">
            +6 respecto al trimestre anterior
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Cruces detectados
            </p>
            <span className="h-6 w-6 rounded-md bg-orange-50" />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-slate-900">7</p>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
              Requiere revisión
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">4 por instructor · 3 por ambiente</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Ambientes disponibles
            </p>
            <span className="h-6 w-6 rounded-md bg-slate-100" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            19 <span className="text-lg font-medium text-slate-500">/ 34</span>
          </p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-sena-600" style={{ width: '56%' }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">Horario de hoy</p>
            <p className="text-sm text-slate-500">
              {HORARIO_HOY.length} sesiones programadas · jornada mixta
            </p>
          </div>

          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  filtro === f.id
                    ? 'bg-sena-50 text-sena-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th scope="col" className="py-2 pr-4 font-medium">Hora</th>
                <th scope="col" className="py-2 pr-4 font-medium">Ficha</th>
                <th scope="col" className="py-2 pr-4 font-medium">Programa</th>
                <th scope="col" className="py-2 pr-4 font-medium">Instructor</th>
                <th scope="col" className="py-2 pr-4 font-medium">Ambiente</th>
                <th scope="col" className="py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr
                  key={fila.hora}
                  className={`border-b border-slate-100 last:border-0 ${
                    fila.estado === 'Cruce' ? 'bg-orange-50/40' : ''
                  }`}
                >
                  <td className="py-3 pr-4 font-semibold text-slate-900">{fila.hora}</td>
                  <td className="py-3 pr-4 text-slate-700">{fila.ficha}</td>
                  <td className="py-3 pr-4 text-slate-700">{fila.programa}</td>
                  <td className="py-3 pr-4 text-slate-700">{fila.instructor}</td>
                  <td className="py-3 pr-4 text-slate-700">{fila.ambiente}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeEstado[fila.estado]}`}
                    >
                      {fila.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
