import { useState } from 'react'
import type { FormEvent } from 'react'
import type { BloqueClase } from '../../pages/horario/tipos'
import type { Ambiente, Ficha, ResultadoAprendizaje, Usuario } from '../../types/api'

export interface DatosBloque {
  tematica: string
  instructor: string
  ficha: string
  ambiente: string
  idResultado?: number
  idInstructor?: string
  idFicha?: number
  idTrimestre?: number
  idAmbiente?: number
}

/** Catálogos reales para armar el select — si no se pasan, el modal cae en
 * modo texto libre (usado por el demo/tests de `HorarioEditor`). */
export interface CatalogosBloque {
  fichas: Ficha[]
  ambientes: Ambiente[]
  instructores: Usuario[]
  resultados: ResultadoAprendizaje[]
}

interface ModalBloqueProps {
  /** Si viene un bloque existente, el modal edita sus datos; si no, crea uno nuevo. */
  bloqueInicial?: BloqueClase
  catalogos?: CatalogosBloque
  onGuardar: (datos: DatosBloque) => void
  onCancelar: () => void
}

function datosVacios(bloque?: BloqueClase): DatosBloque {
  return {
    tematica: bloque?.tematica ?? '',
    instructor: bloque?.instructor ?? '',
    ficha: bloque?.ficha ?? '',
    ambiente: bloque?.ambiente ?? '',
    idResultado: bloque?.idResultado,
    idInstructor: bloque?.idInstructor,
    idFicha: bloque?.idFicha,
    idTrimestre: bloque?.idTrimestre,
    idAmbiente: bloque?.idAmbiente,
  }
}

function etiquetaAmbiente(a: Ambiente): string {
  return a.tipoAmbiente === 'especial' ? a.nombreAmbiente : `Ambiente ${a.numeroAmbiente}`
}

function etiquetaResultado(r: ResultadoAprendizaje): string {
  return r.codigo ? `${r.codigo} — ${r.descripcion}` : r.descripcion
}

/**
 * Formulario modal para crear o editar un bloque de clase. Como los bloques
 * son reutilizables (una definición, muchas celdas asignadas), este es el
 * único lugar donde se eligen resultado/instructor/ficha/ambiente — ver
 * `frontend/ESTRUCTURA.md#pantalla-de-horarios` para el flujo completo.
 *
 * Con `catalogos` (lo pasa `NuevoHorario.tsx`, ya conectado al backend real)
 * los 4 campos son selects contra datos reales. Sin `catalogos` (el demo de
 * `HorarioEditor` y sus tests) caen en texto libre, sin llamar al backend.
 */
export function ModalBloque({ bloqueInicial, catalogos, onGuardar, onCancelar }: ModalBloqueProps) {
  const [datos, setDatos] = useState<DatosBloque>(() => datosVacios(bloqueInicial))
  const esEdicion = bloqueInicial !== undefined

  function actualizarCampo(campo: keyof DatosBloque, valor: string) {
    setDatos((anterior) => ({ ...anterior, [campo]: valor }))
  }

  function elegirResultado(idResultado: number) {
    const resultado = catalogos?.resultados.find((r) => r.idResultado === idResultado)
    if (!resultado) return
    setDatos((anterior) => ({ ...anterior, idResultado, tematica: etiquetaResultado(resultado) }))
  }

  function elegirInstructor(idInstructor: string) {
    const instructor = catalogos?.instructores.find((u) => u.idUsuario === idInstructor)
    if (!instructor) return
    setDatos((anterior) => ({ ...anterior, idInstructor, instructor: instructor.nombre }))
  }

  function elegirFicha(idFicha: number) {
    const ficha = catalogos?.fichas.find((f) => f.idFicha === idFicha)
    if (!ficha) return
    setDatos((anterior) => ({ ...anterior, idFicha, idTrimestre: ficha.idTrimestre, ficha: ficha.codigoFicha }))
  }

  function elegirAmbiente(idAmbiente: number) {
    const ambiente = catalogos?.ambientes.find((a) => a.idAmbiente === idAmbiente)
    if (!ambiente) return
    setDatos((anterior) => ({ ...anterior, idAmbiente, ambiente: etiquetaAmbiente(ambiente) }))
  }

  function manejarSubmit(evento: FormEvent) {
    evento.preventDefault()
    onGuardar(datos)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-bloque-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 id="modal-bloque-titulo" className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          {esEdicion ? 'Editar bloque de clase' : 'Nuevo bloque de clase'}
        </h2>

        <form onSubmit={manejarSubmit}>
          {catalogos ? (
            <>
              <CampoModal etiqueta="Resultado de aprendizaje" htmlFor="bloque-resultado">
                <select
                  id="bloque-resultado"
                  value={datos.idResultado ?? ''}
                  onChange={(e) => elegirResultado(Number(e.target.value))}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="" disabled>
                    Selecciona un resultado…
                  </option>
                  {catalogos.resultados.map((r) => (
                    <option key={r.idResultado} value={r.idResultado}>
                      {etiquetaResultado(r)}
                    </option>
                  ))}
                </select>
              </CampoModal>
              <CampoModal etiqueta="Instructor" htmlFor="bloque-instructor">
                <select
                  id="bloque-instructor"
                  value={datos.idInstructor ?? ''}
                  onChange={(e) => elegirInstructor(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="" disabled>
                    Selecciona un instructor…
                  </option>
                  {catalogos.instructores.map((u) => (
                    <option key={u.idUsuario} value={u.idUsuario}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </CampoModal>
              <CampoModal etiqueta="Ficha" htmlFor="bloque-ficha">
                <select
                  id="bloque-ficha"
                  value={datos.idFicha ?? ''}
                  onChange={(e) => elegirFicha(Number(e.target.value))}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="" disabled>
                    Selecciona una ficha…
                  </option>
                  {catalogos.fichas.map((f) => (
                    <option key={f.idFicha} value={f.idFicha}>
                      {f.codigoFicha}
                    </option>
                  ))}
                </select>
              </CampoModal>
              <CampoModal etiqueta="Ambiente" htmlFor="bloque-ambiente">
                <select
                  id="bloque-ambiente"
                  value={datos.idAmbiente ?? ''}
                  onChange={(e) => elegirAmbiente(Number(e.target.value))}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="" disabled>
                    Selecciona un ambiente…
                  </option>
                  {catalogos.ambientes.map((a) => (
                    <option key={a.idAmbiente} value={a.idAmbiente}>
                      {etiquetaAmbiente(a)}
                    </option>
                  ))}
                </select>
              </CampoModal>
            </>
          ) : (
            <>
              <CampoModal etiqueta="Temática" htmlFor="bloque-tematica">
                <input
                  id="bloque-tematica"
                  value={datos.tematica}
                  onChange={(e) => actualizarCampo('tematica', e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </CampoModal>
              <CampoModal etiqueta="Instructor" htmlFor="bloque-instructor">
                <input
                  id="bloque-instructor"
                  value={datos.instructor}
                  onChange={(e) => actualizarCampo('instructor', e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </CampoModal>
              <CampoModal etiqueta="Ficha" htmlFor="bloque-ficha">
                <input
                  id="bloque-ficha"
                  value={datos.ficha}
                  onChange={(e) => actualizarCampo('ficha', e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </CampoModal>
              <CampoModal etiqueta="Ambiente" htmlFor="bloque-ambiente">
                <input
                  id="bloque-ambiente"
                  value={datos.ambiente}
                  onChange={(e) => actualizarCampo('ambiente', e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </CampoModal>
            </>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700"
            >
              Guardar bloque
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CampoModal({
  etiqueta,
  htmlFor,
  children,
}: {
  etiqueta: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-400">
        {etiqueta}
      </label>
      {children}
    </div>
  )
}
