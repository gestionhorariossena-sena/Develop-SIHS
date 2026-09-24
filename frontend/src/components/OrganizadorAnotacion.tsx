import { useState } from 'react'
import { apiDelete, apiPost, apiPut, ApiError } from '../services/api'
import type { AnotacionHorario, EtiquetaAnotacion } from '../types/api'

const ETIQUETAS: { valor: EtiquetaAnotacion; etiqueta: string; punto: string }[] = [
  { valor: 'Examen', etiqueta: 'Examen', punto: 'bg-red-500' },
  { valor: 'Entrega', etiqueta: 'Entrega', punto: 'bg-amber-500' },
  { valor: 'Importante', etiqueta: 'Importante', punto: 'bg-violet-500' },
  { valor: 'Normal', etiqueta: 'Normal', punto: 'bg-slate-400' },
]

interface OrganizadorAnotacionProps {
  idHorario: number
  /** Para que se vea sobre qué clase se está anotando. */
  descripcionClase: string
  /** La anotación que ya existía para ese bloque, si la hay. */
  anotacion: AnotacionHorario | null
  onCerrar: () => void
  onGuardada: (anotacion: AnotacionHorario) => void
  onEliminada: (idAnotacion: number) => void
}

/**
 * "Organizador personal" del mockup `mi_horario_rol_aprendiz_sihs_sena`:
 * el aprendiz anota algo sobre una de sus clases, le pone una etiqueta y
 * marca si quiere recordarlo. Backend: `/anotaciones-horario` (solo rol
 * Aprendiz, solo sobre bloques propios).
 *
 * El mockup habla de "recordatorios de 30 min", y eso **no existe**: el
 * backend guarda `recordatorioActivo` como preferencia y nadie envía
 * nada (está en el docstring del modelo). Acá se ofrece como marca
 * personal y el texto lo dice, en vez de prometer una alarma que nunca
 * va a sonar.
 */
export function OrganizadorAnotacion({
  idHorario,
  descripcionClase,
  anotacion,
  onCerrar,
  onGuardada,
  onEliminada,
}: OrganizadorAnotacionProps) {
  const [nota, setNota] = useState(anotacion?.nota ?? '')
  const [etiqueta, setEtiqueta] = useState<EtiquetaAnotacion>(anotacion?.etiqueta ?? 'Normal')
  const [recordatorioActivo, setRecordatorioActivo] = useState(anotacion?.recordatorioActivo ?? false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault()

    if (!nota.trim() || guardando) return

    setGuardando(true)
    setError(null)

    try {
      const cuerpo = { nota: nota.trim(), etiqueta, recordatorioActivo }

      const guardada = anotacion
        ? await apiPut<AnotacionHorario>(`/anotaciones-horario/${anotacion.idAnotacion}`, cuerpo)
        : await apiPost<AnotacionHorario>('/anotaciones-horario/', { idHorario, ...cuerpo })

      onGuardada(guardada)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar tu anotación.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!anotacion || guardando) return

    setGuardando(true)
    setError(null)

    try {
      await apiDelete(`/anotaciones-horario/${anotacion.idAnotacion}`)
      onEliminada(anotacion.idAnotacion)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar tu anotación.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-organizador"
        className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800"
      >
        <h2 id="titulo-organizador" className="text-lg font-bold text-on-surface dark:text-slate-100">
          Mi nota para esta clase
        </h2>
        <p className="mb-4 mt-1 text-sm text-on-surface-variant dark:text-slate-400">{descripcionClase}</p>

        <form onSubmit={guardar}>
          <label
            htmlFor="nota-anotacion"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400"
          >
            Nota personal
          </label>
          <textarea
            id="nota-anotacion"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ej. Traer el modelo entidad-relación normalizado en la memoria USB."
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />

          <fieldset className="mt-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">
              Etiqueta
            </legend>

            <div className="flex flex-wrap gap-2">
              {ETIQUETAS.map((opcion) => (
                <label
                  key={opcion.valor}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    etiqueta === opcion.valor
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-outline-variant text-on-surface-variant dark:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="etiqueta"
                    value={opcion.valor}
                    checked={etiqueta === opcion.valor}
                    onChange={() => setEtiqueta(opcion.valor)}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${opcion.punto}`} />
                  {opcion.etiqueta}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={recordatorioActivo}
              onChange={(e) => setRecordatorioActivo(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-semibold text-on-surface dark:text-slate-100">
                Marcarla como pendiente
              </span>
              <span className="block text-xs text-on-surface-variant dark:text-slate-400">
                Se resalta en tu horario. El sistema todavía no envía recordatorios por correo ni al
                celular.
              </span>
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between gap-2">
            {anotacion ? (
              <button
                type="button"
                onClick={() => void eliminar()}
                disabled={guardando}
                className="h-10 rounded-xl px-3 text-sm font-semibold text-error hover:bg-error-container disabled:opacity-50"
              >
                Eliminar
              </button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCerrar}
                className="h-10 rounded-xl px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container dark:text-slate-300"
              >
                Descartar
              </button>
              <button
                type="submit"
                disabled={!nota.trim() || guardando}
                className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : 'Guardar anotación'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
