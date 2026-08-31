import { useState } from 'react'
import { AppShell } from '../components/AppShell'

interface FilaFicha {
  codigo: string
  programa: string
  nivel: 'Tecnólogo' | 'Técnico'
  trimestre: number
  jornada: string
  aprendices: number
}

/**
 * Datos de ejemplo — el código y el programa de la primera fila son los
 * mismos que ya usa `NuevoHorario.tsx` (ficha 3228973 B, Análisis y
 * Desarrollo de Software) para que el demo sea consistente. La mayoría de
 * programas sale de los 14 que mencionó el coordinador de Teleinformática
 * (8 tecnólogos + 6 técnicos); la ficha 3068356 es la que usó como ejemplo
 * el coordinador de Logística (6° trimestre, tarde, Coordinación de
 * Procesos Logísticos — programa con 18 guías y 91 resultados de
 * aprendizaje en 7 trimestres). Backend: `coordinaciones` → `programas` →
 * `trimestres` → `fichas` todavía no existe en código (siguiente paso
 * desbloqueado del roadmap) — ver
 * `_Docs/Documentación general/REGLAS_DE_NEGOCIO_CONOCIDAS.md`.
 */
const FICHAS: FilaFicha[] = [
  { codigo: '3228973 B', programa: 'Análisis y Desarrollo de Software', nivel: 'Tecnólogo', trimestre: 3, jornada: 'Mañana', aprendices: 30 },
  { codigo: '2758431', programa: 'Análisis y Desarrollo de Software', nivel: 'Tecnólogo', trimestre: 3, jornada: 'Noche', aprendices: 32 },
  { codigo: '2691205', programa: 'Gestión de Redes de Datos', nivel: 'Tecnólogo', trimestre: 2, jornada: 'Tarde', aprendices: 28 },
  { codigo: '2744309', programa: 'Implementación de Infraestructura', nivel: 'Tecnólogo', trimestre: 4, jornada: 'Mañana', aprendices: 30 },
  { codigo: '2803577', programa: 'Técnico en Programación de Software', nivel: 'Técnico', trimestre: 1, jornada: 'Tarde', aprendices: 35 },
  { codigo: '2712880', programa: 'Técnico en Sistemas Teleinformáticos', nivel: 'Técnico', trimestre: 2, jornada: 'Noche', aprendices: 30 },
  { codigo: '2766142', programa: 'Seguridad Digital', nivel: 'Técnico', trimestre: 1, jornada: 'Noche', aprendices: 30 },
  { codigo: '3068356', programa: 'Tecnología en Coordinación de Procesos Logísticos', nivel: 'Tecnólogo', trimestre: 6, jornada: 'Tarde', aprendices: 30 },
  { codigo: '2799412', programa: 'Técnico en Cocina', nivel: 'Técnico', trimestre: 2, jornada: 'Mañana', aprendices: 25 },
  { codigo: '2831190', programa: 'Gestión Logística', nivel: 'Tecnólogo', trimestre: 5, jornada: 'Tarde', aprendices: 30 },
  { codigo: '2745560', programa: 'Análisis y Desarrollo de Software', nivel: 'Tecnólogo', trimestre: 1, jornada: 'Mañana', aprendices: 33 },
  { codigo: '2718904', programa: 'Contabilización de Operaciones Comerciales', nivel: 'Técnico', trimestre: 3, jornada: 'Noche', aprendices: 28 },
]

const estiloNivel: Record<FilaFicha['nivel'], string> = {
  Tecnólogo: 'bg-sena-50 text-sena-700',
  Técnico: 'bg-sky-50 text-sky-700',
}

const FICHAS_POR_PAGINA = 10

export function Fichas() {
  const [pagina, setPagina] = useState(1)
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const totalPaginas = Math.max(1, Math.ceil(FICHAS.length / FICHAS_POR_PAGINA))
  const inicio = (pagina - 1) * FICHAS_POR_PAGINA
  const fichasPagina = FICHAS.slice(inicio, inicio + FICHAS_POR_PAGINA)

  function alternarExpandida(codigo: string) {
    setExpandidas((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(codigo)) siguiente.delete(codigo)
      else siguiente.add(codigo)
      return siguiente
    })
  }

  return (
    <AppShell activo="Fichas">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Fichas</h1>
        <p className="text-sm text-slate-500">
          Datos de ejemplo — pendiente el listado real por trimestre. Ver{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">
            _Docs/Documentación general/REGLAS_DE_NEGOCIO_CONOCIDAS.md
          </code>
          .
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 md:grid-cols-5">
          {fichasPagina.map((f) => {
            const expandida = expandidas.has(f.codigo)
            return (
              <button
                key={f.codigo}
                type="button"
                onClick={() => alternarExpandida(f.codigo)}
                className={`flex flex-col rounded-xl border p-3 text-left transition hover:border-sena-300 hover:shadow-sm ${
                  expandida ? 'border-sena-300 shadow-sm' : 'aspect-square justify-between border-slate-200'
                }`}
              >
                <div className="mb-1.5">
                  <p className="truncate text-sm font-bold leading-tight text-slate-900">{f.codigo}</p>
                  <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${estiloNivel[f.nivel]}`}>
                    {f.nivel}
                  </span>
                </div>
                <p className={`text-xs text-slate-600 ${expandida ? '' : 'line-clamp-2'}`}>{f.programa}</p>

                {expandida && (
                  <div className="mt-2 grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 text-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{f.trimestre}°</p>
                      <p className="text-[10px] uppercase text-slate-400">Trim.</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{f.jornada}</p>
                      <p className="text-[10px] uppercase text-slate-400">Jornada</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{f.aprendices}</p>
                      <p className="text-[10px] uppercase text-slate-400">Aprend.</p>
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {totalPaginas > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
            <p className="text-slate-500">
              Página {pagina} de {totalPaginas} · {FICHAS.length} fichas
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
