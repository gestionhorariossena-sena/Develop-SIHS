import { useState } from 'react'
import { apiPost, ApiError } from '../services/api'
import type { SolicitudCambioHorario, TipoSolicitudCambio } from '../types/api'

const TIPOS: { valor: TipoSolicitudCambio; etiqueta: string; ayuda: string }[] = [
  {
    valor: 'novedad',
    etiqueta: 'Novedad',
    ayuda: 'Algo pasó con esta franja y coordinación debería saberlo.',
  },
  {
    valor: 'permuta',
    etiqueta: 'Permuta',
    ayuda: 'Pides intercambiar esta franja con otro instructor.',
  },
  {
    valor: 'cambio-ambiente',
    etiqueta: 'Cambio de ambiente',
    ayuda: 'El ambiente asignado no sirve para esta sesión.',
  },
]

interface ModalReportarNovedadProps {
  idHorario: number
  /** Para que la persona confirme sobre qué bloque está reportando. */
  descripcionFranja: string
  onCerrar: () => void
  onEnviada: (solicitud: SolicitudCambioHorario) => void
}

/**
 * H-4: hasta el 2026-09-24 un instructor que veía un problema en un bloque
 * suyo no tenía dónde decirlo — el backend existía entero
 * (`POST /solicitudes-cambio-horario/`) y ninguna pantalla lo llamaba.
 *
 * El motivo es obligatorio y se pide explícito: al otro lado hay una
 * persona que tiene que decidir con lo que se escriba acá, y "novedad" a
 * secas no le alcanza para nada.
 */
export function ModalReportarNovedad({
  idHorario,
  descripcionFranja,
  onCerrar,
  onEnviada,
}: ModalReportarNovedadProps) {
  const [tipo, setTipo] = useState<TipoSolicitudCambio>('novedad')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()

    if (!motivo.trim() || enviando) return

    setEnviando(true)
    setError(null)

    try {
      const solicitud = await apiPost<SolicitudCambioHorario>('/solicitudes-cambio-horario/', {
        idHorarioOrigen: idHorario,
        tipo,
        motivo: motivo.trim(),
      })
      onEnviada(solicitud)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo enviar tu reporte. Inténtalo de nuevo en unos segundos.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-reportar-novedad"
        className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800"
      >
        <h2 id="titulo-reportar-novedad" className="text-lg font-bold text-on-surface dark:text-slate-100">
          Reportar novedad
        </h2>
        <p className="mb-4 mt-1 text-sm text-on-surface-variant dark:text-slate-400">{descripcionFranja}</p>

        <form onSubmit={enviar}>
          <fieldset className="mb-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">
              Tipo de solicitud
            </legend>

            <div className="flex flex-col gap-2">
              {TIPOS.map((opcion) => (
                <label
                  key={opcion.valor}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                    tipo === opcion.valor
                      ? 'border-primary bg-primary-container/40'
                      : 'border-outline-variant dark:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={opcion.valor}
                    checked={tipo === opcion.valor}
                    onChange={() => setTipo(opcion.valor)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-on-surface dark:text-slate-100">
                      {opcion.etiqueta}
                    </span>
                    <span className="block text-xs text-on-surface-variant dark:text-slate-400">{opcion.ayuda}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label
            htmlFor="motivo-novedad"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400"
          >
            ¿Qué pasó?
          </label>
          <textarea
            id="motivo-novedad"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            placeholder="Ej. El videobeam del ambiente no enciende desde el lunes y la sesión es práctica."
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className="h-10 rounded-xl px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!motivo.trim() || enviando}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? 'Enviando…' : 'Enviar a coordinación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
