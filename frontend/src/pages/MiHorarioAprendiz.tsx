import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { celdasDesdeHorarios, GridAsistente } from '../components/horario/GridAsistente'
import { apiGet, ApiError } from '../services/api'
import type { Ficha, Horario } from '../types/api'

/**
 * "Mi Horario" del Aprendiz -- autoservicio de solo lectura, mismo
 * espíritu que MiHorario.tsx (instructor): la ficha se vincula una vez
 * (POST /ficha-usuario/vincular, ya existente en el backend, sin UI
 * propia todavía) y desde ahí el aprendiz solo consulta.
 *
 * Reusa GridAsistente (construido para el Asistente de Programación y
 * "Horarios completos") en vez del GridHorario viejo -- es el que
 * soporta CUALQUIER franja horaria real (institucional o del generador
 * CP-SAT) sin descartar bloques en silencio, ver su docstring.
 *
 * Backend ya existente y sin tocar: GET /ficha-usuario/mi-ficha,
 * GET /ficha-usuario/mi-horario (ambos exigen rol Aprendiz).
 */
export function MiHorarioAprendiz() {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([apiGet<Ficha>('/ficha-usuario/mi-ficha'), apiGet<Horario[]>('/ficha-usuario/mi-horario')])
      .then(([fichaRes, horariosRes]) => {
        setFicha(fichaRes)
        setHorarios(horariosRes.filter((h) => h.publicado))
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setFicha(null)
          return
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu horario.')
      })
      .finally(() => setCargando(false))
  }, [])

  return (
    <AppShell activo="Mi horario">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Autoservicio del aprendiz</p>
        <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Mi horario</h1>
        <p className="mb-6 text-sm text-on-surface-variant dark:text-slate-400">
          Solo se muestran los bloques que tu coordinador ya publicó.
        </p>

        {cargando && <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando tu horario…</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {!cargando && !error && !ficha && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Todavía no tienes una ficha vinculada. Habla con tu coordinador para que te la asigne.
          </p>
        )}

        {!cargando && !error && ficha && (
          <>
            <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm font-semibold text-on-surface dark:text-slate-100">Ficha {ficha.codigoFicha}</p>
              <p className="text-sm text-on-surface-variant dark:text-slate-400">
                {ficha.programa.nombrePrograma} · {ficha.trimestre.nombre}
              </p>
            </div>

            {horarios.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Tu ficha todavía no tiene horarios publicados.
              </p>
            ) : (
              <GridAsistente celdas={celdasDesdeHorarios(horarios)} />
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
