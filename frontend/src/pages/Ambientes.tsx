import { AppShell } from '../components/AppShell'

interface FilaAmbiente {
  codigo: string
  sede: string
  coordinacion: string
  estado: 'Disponible' | 'Ocupado ahora'
}

/**
 * Datos de ejemplo — el módulo `ambientes` ya existe en el backend
 * (`backend/app/api/v1/ambientes.py`, ver commit "Incorporar CRUD de sedes
 * y ambientes del PR #6"), pero esta pantalla todavía no está conectada a
 * él a propósito: ver
 * `_Docs/Documentación general/REGLAS_DE_NEGOCIO_CONOCIDAS.md` — falta el
 * listado real de ambientes por sede/coordinación antes de reemplazar
 * estas filas por datos reales.
 */
const AMBIENTES: FilaAmbiente[] = [
  { codigo: '607_Torre 1_Unigermana', sede: 'Sede Unigermana', coordinacion: 'Teleinformática', estado: 'Ocupado ahora' },
  { codigo: '601_Torre 1_Unigermana', sede: 'Sede Unigermana', coordinacion: 'Teleinformática', estado: 'Disponible' },
  { codigo: '412 Av.Caracas_con_52', sede: 'Sede principal', coordinacion: 'Teleinformática', estado: 'Ocupado ahora' },
  { codigo: '211 Av.Caracas_con_52', sede: 'Sede principal', coordinacion: 'Teleinformática', estado: 'Disponible' },
  { codigo: '509', sede: 'Sede principal', coordinacion: 'Teleinformática', estado: 'Disponible' },
  { codigo: '303', sede: 'Sede principal', coordinacion: 'Logística', estado: 'Ocupado ahora' },
  { codigo: '402', sede: 'Sede Fontibón', coordinacion: 'Teleinformática', estado: 'Disponible' },
  { codigo: '108', sede: 'Sede Fontibón', coordinacion: 'Logística', estado: 'Disponible' },
]

const estiloEstado: Record<FilaAmbiente['estado'], string> = {
  Disponible: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  'Ocupado ahora': 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
}

export function Ambientes() {
  return (
    <AppShell activo="Ambientes">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Ambientes</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Datos de ejemplo — pendiente conectar al listado real por sede/coordinación (ver{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800 dark:text-slate-300">
            _Docs/Documentación general/REGLAS_DE_NEGOCIO_CONOCIDAS.md
          </code>
          ).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Ambiente</th>
              <th className="px-4 py-3">Sede</th>
              <th className="px-4 py-3">Coordinación</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {AMBIENTES.map((a) => (
              <tr key={a.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-700/60">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{a.codigo}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{a.sede}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{a.coordinacion}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estiloEstado[a.estado]}`}>
                    {a.estado}
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
