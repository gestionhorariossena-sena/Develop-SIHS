import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { apiGet, ApiError } from '../services/api'
import type { Ficha, Programa } from '../types/api'

interface ProgramaAgrupado {
  programa: Programa
  fichas: Ficha[]
}

export function Programas() {
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [seleccionado, setSeleccionado] = useState<ProgramaAgrupado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Ficha[]>('/fichas/')
      .then(setFichas)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de programas.')
      })
      .finally(() => setCargando(false))
  }, [])

  const programas = useMemo<ProgramaAgrupado[]>(() => {
    const agrupados = new Map<number, ProgramaAgrupado>()

    for (const ficha of fichas) {
      const existente = agrupados.get(ficha.idPrograma)

      if (existente) {
        existente.fichas.push(ficha)
      } else {
        agrupados.set(ficha.idPrograma, {
          programa: ficha.programa,
          fichas: [ficha],
        })
      }
    }

    return [...agrupados.values()].sort((a, b) =>
      a.programa.nombrePrograma.localeCompare(b.programa.nombrePrograma, 'es-CO'),
    )
  }, [fichas])

  return (
    <AppShell activo="Programas">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Programas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Programas de formación agrupados con sus fichas y trimestre.
          </p>
        </div>

        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {programas.length} programas
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          Cargando programas...
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Programa</th>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3">Fichas</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {programas.map((item) => (
                  <tr
                    key={item.programa.idPrograma}
                    onClick={() => setSeleccionado(item)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {item.programa.codigoPrograma}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {item.programa.nombrePrograma}
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-full bg-sena-50 px-2.5 py-1 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">
                        {item.programa.nivelFormacion || 'Sin definir'}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {item.fichas.length}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          item.programa.activo
                            ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }
                      >
                        {item.programa.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {programas.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No hay programas asociados a fichas.
            </p>
          )}
        </div>
      )}

      {seleccionado && (
        <DrawerRelacionados
          iniciales={seleccionado.programa.codigoPrograma.slice(0, 2).toUpperCase()}
          titulo={seleccionado.programa.nombrePrograma}
          subtitulo={seleccionado.programa.codigoPrograma}
          onCerrar={() => setSeleccionado(null)}
        >
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Código del programa</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {seleccionado.programa.codigoPrograma}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 dark:text-slate-400">Nivel de formación</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {seleccionado.programa.nivelFormacion || 'Sin definir'}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 dark:text-slate-400">Estado</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {seleccionado.programa.activo ? 'Activo' : 'Inactivo'}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 dark:text-slate-400">Fichas asociadas</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {seleccionado.fichas.length}
              </dd>
            </div>
          </dl>

          <SeccionDrawer titulo="Fichas y trimestres">
            <div className="space-y-3">
              {seleccionado.fichas.map((ficha) => (
                <div
                  key={ficha.idFicha}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {ficha.codigoFicha}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Trimestre: {ficha.trimestre.nombre}
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {ficha.trimestre.estado}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SeccionDrawer>
        </DrawerRelacionados>
      )}
    </AppShell>
  )
}