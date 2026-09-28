import { useState } from 'react'

interface SelectorFechaHoraProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function mesInicial(value: string): Date {
  const fecha = value.slice(0, 10)
  const [anio, mes] = fecha.split('-').map(Number)
  return anio && mes && mes >= 1 && mes <= 12 ? new Date(anio, mes - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
}

function fechaISO(anio: number, mes: number, dia: number) {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Calendario propio: no depende de showPicker() ni de los selectores nativos del navegador. */
export function SelectorFechaHora({ value, onChange, disabled = false }: SelectorFechaHoraProps) {
  const [abierto, setAbierto] = useState(false)
  const [mesVisible, setMesVisible] = useState(() => mesInicial(value))
  const fecha = value.slice(0, 10)
  const hora = value.includes('T') ? value.split('T')[1].slice(0, 5) : ''
  const anio = mesVisible.getFullYear()
  const mes = mesVisible.getMonth()
  const desplazamiento = (new Date(anio, mes, 1).getDay() + 6) % 7
  const cantidadDias = new Date(anio, mes + 1, 0).getDate()
  const celdas = Array.from({ length: desplazamiento + cantidadDias }, (_, i) => i < desplazamiento ? null : i - desplazamiento + 1)

  function elegirFecha(nuevaFecha: string) {
    onChange(`${nuevaFecha}T${hora || '09:00'}`)
    setAbierto(false)
  }

  function elegirHora(nuevaHora: string) {
    if (fecha) onChange(`${fecha}T${nuevaHora}`)
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(112px,0.6fr)]">
        <div>
          <label htmlFor="fecha-publicacion" className="mb-1 block text-xs font-medium text-on-surface-variant">Fecha</label>
          <div className="flex items-stretch overflow-hidden rounded-xl border border-outline bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/30 dark:border-slate-600 dark:bg-slate-900">
            <input
              id="fecha-publicacion"
              type="date"
              value={fecha}
              onChange={(evento) => evento.target.value ? elegirFecha(evento.target.value) : onChange('')}
              disabled={disabled}
              className="min-w-0 w-full bg-transparent px-3 py-2.5 text-sm text-on-surface outline-none dark:text-slate-100"
            />
            <button
              type="button"
              aria-label="Abrir calendario"
              aria-expanded={abierto}
              aria-controls="calendario-publicacion"
              onClick={() => { setMesVisible(mesInicial(value)); setAbierto((actual) => !actual) }}
              disabled={disabled}
              className="flex shrink-0 items-center justify-center border-l border-outline px-3 text-primary hover:bg-primary-container disabled:opacity-50 dark:border-slate-600"
            >
              <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="hora-publicacion" className="mb-1 block text-xs font-medium text-on-surface-variant">Hora</label>
          <input
            id="hora-publicacion"
            type="time"
            value={hora}
            onChange={(evento) => elegirHora(evento.target.value)}
            disabled={disabled || !fecha}
            className="min-w-0 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      {abierto && !disabled && (
        <div id="calendario-publicacion" role="group" aria-label="Calendario para fecha de publicación" className="w-full max-w-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-lg dark:border-slate-600 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" aria-label="Mes anterior" onClick={() => setMesVisible(new Date(anio, mes - 1, 1))} className="rounded-lg px-3 py-1.5 text-sm hover:bg-surface-container dark:hover:bg-slate-700">‹</button>
            <span className="text-sm font-semibold capitalize text-on-surface dark:text-slate-100">{MESES[mes]} {anio}</span>
            <button type="button" aria-label="Mes siguiente" onClick={() => setMesVisible(new Date(anio, mes + 1, 1))} className="rounded-lg px-3 py-1.5 text-sm hover:bg-surface-container dark:hover:bg-slate-700">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DIAS.map((dia) => <span key={dia} className="py-1 text-xs font-semibold text-on-surface-variant">{dia}</span>)}
            {celdas.map((dia, indice) => dia === null
              ? <span key={`vacio-${indice}`} aria-hidden="true" />
              : <button
                  key={dia}
                  type="button"
                  aria-label={`Elegir ${dia} de ${MESES[mes]} de ${anio}`}
                  aria-pressed={fecha === fechaISO(anio, mes, dia)}
                  onClick={() => elegirFecha(fechaISO(anio, mes, dia))}
                  className={`rounded-lg py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${fecha === fechaISO(anio, mes, dia) ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-primary-container dark:text-slate-100 dark:hover:bg-slate-700'}`}
                >{dia}</button>
            )}
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">La fecha se interpreta en hora de Colombia.</p>
        </div>
      )}
      <p className="text-xs text-on-surface-variant">Zona horaria: Bogotá (UTC−5). Puedes abrir el calendario con el botón <span className="material-symbols-outlined align-middle text-[15px]" aria-hidden="true">calendar_month</span>.</p>
    </div>
  )
}
