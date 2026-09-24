import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { celdasDesdeHorarios, GridAsistente } from '../components/horario/GridAsistente'
import type { CeldaAsistente, MarcaDeCelda } from '../components/horario/GridAsistente'
import { OrganizadorAnotacion } from '../components/OrganizadorAnotacion'
import { apiGet, apiPost, ApiError } from '../services/api'
import type { AnotacionHorario, Ficha, Horario } from '../types/api'

/** El backend responde "No existe una ficha con ese código" y "Ya tienes
 * una ficha vinculada": correcto como contrato, inútil como instrucción.
 * Acá se dice qué hacer a continuación. */
function mensajeDeVinculo(err: unknown, codigo: string): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return `No encontramos la ficha ${codigo}. Revisa que esté completa (son 7 dígitos) y, si el código es el correcto, pídele a tu coordinador que registre la ficha.`
    }
    if (err.status === 400) {
      return 'Ya tienes una ficha vinculada. Si no es la tuya, tu coordinador puede corregirla.'
    }
    return err.message
  }

  return 'No se pudo vincular tu ficha. Inténtalo de nuevo en unos segundos.'
}

/**
 * "Mi Horario" del Aprendiz -- autoservicio de solo lectura, mismo
 * espíritu que MiHorario.tsx (instructor): la ficha se vincula una vez
 * (POST /ficha-usuario/vincular) y desde ahí el aprendiz solo consulta.
 *
 * Esa vinculación se hace DESDE ACÁ (H-1, 2026-09-24). Antes el endpoint
 * existía sin ninguna pantalla que lo llamara, así que un aprendiz recién
 * registrado caía en esta pantalla, leía "habla con tu coordinador" y no
 * tenía forma de avanzar: el rol entero era inservible salvo que alguien
 * tocara la base de datos a mano.
 *
 * Reusa GridAsistente (construido para el Asistente de Programación y
 * "Horarios completos") en vez del GridHorario viejo -- es el que
 * soporta CUALQUIER franja horaria real (institucional o del generador
 * CP-SAT) sin descartar bloques en silencio, ver su docstring.
 *
 * Backend, todo ya existente: GET /ficha-usuario/mi-ficha,
 * GET /ficha-usuario/mi-horario, POST /ficha-usuario/vincular (los tres
 * exigen rol Aprendiz).
 */
export function MiHorarioAprendiz() {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [anotaciones, setAnotaciones] = useState<AnotacionHorario[]>([])
  const [bloqueElegido, setBloqueElegido] = useState<{ idHorario: number; descripcion: string } | null>(null)

  const [codigoFicha, setCodigoFicha] = useState('')
  const [vinculando, setVinculando] = useState(false)
  const [errorVinculo, setErrorVinculo] = useState<string | null>(null)

  // No pone `cargando` en true: el estado inicial ya lo es, y quien la
  // vuelve a llamar (vincular) lo hace fuera de un efecto.
  const cargarHorario = useCallback(() => {
    // Las anotaciones van aparte del Promise.all: que el aprendiz no
    // tenga ninguna, o que ese endpoint falle, no debe dejarlo sin ver su
    // horario -- es una capa encima, no el contenido.
    apiGet<AnotacionHorario[]>('/anotaciones-horario/mias')
      .then(setAnotaciones)
      .catch(() => setAnotaciones([]))

    return Promise.all([
      apiGet<Ficha>('/ficha-usuario/mi-ficha'),
      apiGet<Horario[]>('/ficha-usuario/mi-horario'),
    ])
      .then(([fichaRes, horariosRes]) => {
        setFicha(fichaRes)
        setHorarios(horariosRes.filter((h) => h.publicado))
        setError(null)
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

  useEffect(() => {
    cargarHorario()
  }, [cargarHorario])

  // El grid indexa por `CeldaAsistente.id`, que para un horario guardado
  // es "existente-<idHorario>" (ver celdasDesdeHorarios).
  const marcas = useMemo(() => {
    const porCelda: Record<string, MarcaDeCelda> = {}
    for (const anotacion of anotaciones) {
      porCelda[`existente-${anotacion.idHorario}`] = {
        etiqueta: anotacion.etiqueta,
        nota: anotacion.nota,
        recordatorioActivo: anotacion.recordatorioActivo,
      }
    }
    return porCelda
  }, [anotaciones])

  const anotacionDelBloque = bloqueElegido
    ? (anotaciones.find((a) => a.idHorario === bloqueElegido.idHorario) ?? null)
    : null

  function elegirCelda(celda: CeldaAsistente) {
    const idHorario = Number(celda.id.replace('existente-', ''))
    if (!Number.isFinite(idHorario)) return

    setBloqueElegido({
      idHorario,
      descripcion: `${celda.resultadoDescripcion ?? 'Clase'} · ${celda.instructorNombre} · ${celda.ambienteNombre}`,
    })
  }

  async function vincular(evento: React.FormEvent) {
    evento.preventDefault()

    const codigo = codigoFicha.trim()
    if (!codigo || vinculando) return

    setVinculando(true)
    setErrorVinculo(null)

    try {
      await apiPost<Ficha>('/ficha-usuario/vincular', { codigoFicha: codigo })
      setCodigoFicha('')
      // Se recarga en la misma pantalla: el horario aparece abajo sin que
      // la persona tenga que navegar ni recargar el navegador.
      setCargando(true)
      await cargarHorario()
    } catch (err: unknown) {
      setErrorVinculo(mensajeDeVinculo(err, codigo))
    } finally {
      setVinculando(false)
    }
  }

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
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-base font-semibold text-on-surface dark:text-slate-100">
              Vincula tu ficha para ver tu horario
            </h2>
            <p className="mb-4 mt-1 text-sm text-on-surface-variant dark:text-slate-400">
              Escribe el código de la ficha en la que estás matriculado. Lo encuentras en tu
              carta de aceptación o se lo puedes pedir a tu coordinador.
            </p>

            <form onSubmit={vincular} className="flex flex-wrap items-start gap-3">
              <div className="min-w-[14rem] flex-1">
                <label
                  htmlFor="codigo-ficha"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400"
                >
                  Código de ficha
                </label>
                <input
                  id="codigo-ficha"
                  name="codigoFicha"
                  value={codigoFicha}
                  onChange={(e) => setCodigoFicha(e.target.value)}
                  placeholder="Ej. 3171618"
                  autoComplete="off"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={!codigoFicha.trim() || vinculando}
                className="mt-[1.4rem] rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {vinculando ? 'Vinculando…' : 'Vincular ficha'}
              </button>
            </form>

            {errorVinculo && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {errorVinculo}
              </p>
            )}
          </div>
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
              <>
                <p className="mb-2 text-xs text-on-surface-variant dark:text-slate-400">
                  Pulsa cualquier clase para dejarte una nota, marcarla como examen o entrega, y verla
                  acá mismo la próxima vez.
                </p>
                <GridAsistente
                  celdas={celdasDesdeHorarios(horarios)}
                  marcas={marcas}
                  onElegirCelda={elegirCelda}
                />
              </>
            )}
          </>
        )}
      </div>

      {bloqueElegido && (
        <OrganizadorAnotacion
          idHorario={bloqueElegido.idHorario}
          descripcionClase={bloqueElegido.descripcion}
          anotacion={anotacionDelBloque}
          onCerrar={() => setBloqueElegido(null)}
          onGuardada={(guardada) => {
            setAnotaciones((previas) => [
              ...previas.filter((a) => a.idAnotacion !== guardada.idAnotacion && a.idHorario !== guardada.idHorario),
              guardada,
            ])
            setBloqueElegido(null)
          }}
          onEliminada={(idAnotacion) => {
            setAnotaciones((previas) => previas.filter((a) => a.idAnotacion !== idAnotacion))
            setBloqueElegido(null)
          }}
        />
      )}
    </AppShell>
  )
}
