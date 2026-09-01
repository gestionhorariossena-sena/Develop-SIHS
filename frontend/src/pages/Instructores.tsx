import { AppShell } from '../components/AppShell'

interface FilaInstructor {
  nombre: string
  sigla: string
  especialidad: string
  jornada: string
  tipo: 'Planta' | 'Contratista' | 'Vacante'
}

/**
 * Datos de ejemplo, con los mismos nombres/temáticas usados en el grid de
 * `NuevoHorario.tsx` (para que el demo se vea consistente en toda la app),
 * más un par de Logística tomados de esa entrevista. La sigla es el
 * patrón que describieron ambos coordinadores ("este instructor, allá lo
 * conocen como UA" / "David Camelo es DC") — no son códigos reales.
 * La fila "Vacante" reproduce el patrón que describió Logística: un cupo
 * sin contratar todavía se programa con un placeholder que se renombra
 * después sin perder lo ya programado (ver `PLAN_INTEGRACION_LOGICA_Y_BD.md`
 * §2.3). Backend: `especialidades`/`usuario_especialidad` ya existen
 * (`backend/app/api/v1/especialidades.py`), falta el listado real de
 * instructores — ver
 * `_Docs/Documentación general/REGLAS_DE_NEGOCIO_CONOCIDAS.md`.
 */
const INSTRUCTORES: FilaInstructor[] = [
  { nombre: 'Claudia Pinzón', sigla: 'CP', especialidad: 'Comunicación · Investigación', jornada: 'Mañana', tipo: 'Contratista' },
  { nombre: 'Sergio Garzón', sigla: 'SG', especialidad: 'Diseño de software', jornada: 'Noche', tipo: 'Contratista' },
  { nombre: 'Erick Granados', sigla: 'EG', especialidad: 'Análisis · Verificación', jornada: 'Noche', tipo: 'Planta' },
  { nombre: 'Fredy Ardila', sigla: 'FA', especialidad: 'Bases de datos', jornada: 'Noche', tipo: 'Contratista' },
  { nombre: 'Vanessa Gualaco', sigla: 'VG', especialidad: 'Medio Ambiente y SST', jornada: 'Noche', tipo: 'Planta' },
  { nombre: 'David Camelo', sigla: 'DC', especialidad: 'Logística general', jornada: 'Tarde', tipo: 'Planta' },
  { nombre: 'Vacante Logística #7', sigla: '—', especialidad: 'Comercio exterior', jornada: 'Noche', tipo: 'Vacante' },
]

const estiloTipo: Record<FilaInstructor['tipo'], string> = {
  Planta: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  Contratista: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  Vacante: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
}

export function Instructores() {
  return (
    <AppShell activo="Instructores">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Instructores</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Datos de ejemplo — pendiente el listado real (nombre, especialidad, sigla, planta o
          contratista) de la coordinación. Ver{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800 dark:text-slate-300">
            _Docs/Documentación general/REGLAS_DE_NEGOCIO_CONOCIDAS.md
          </code>
          .
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Instructor</th>
              <th className="px-4 py-3">Sigla</th>
              <th className="px-4 py-3">Especialidad</th>
              <th className="px-4 py-3">Jornada habitual</th>
              <th className="px-4 py-3">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {INSTRUCTORES.map((i) => (
              <tr key={i.sigla + i.nombre} className="hover:bg-slate-50 dark:hover:bg-slate-700/60">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{i.nombre}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-sena-50 px-2 py-0.5 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">
                    {i.sigla}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{i.especialidad}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{i.jornada}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estiloTipo[i.tipo]}`}>
                    {i.tipo}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
