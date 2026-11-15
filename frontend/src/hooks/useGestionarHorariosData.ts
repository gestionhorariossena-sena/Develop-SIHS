import { useEffect, useState } from 'react'
import { apiGet, ApiError } from '../services/api'
import type { Ambiente, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../types/api'

interface GestionarHorariosData { horarios: Horario[]; fichas: Ficha[]; instructores: Usuario[]; ambientes: Ambiente[]; sedes: Sede[]; trimestres: Trimestre[]; diasSemana: DiaSemana[]; cargando: boolean; error: string | null; erroresCatalogos: string[]; actualizarHorario: (horario: Horario) => void }
const VACIO: GestionarHorariosData = { horarios: [], fichas: [], instructores: [], ambientes: [], sedes: [], trimestres: [], diasSemana: [], cargando: true, error: null, erroresCatalogos: [], actualizarHorario: () => {} }

/** Carga en paralelo los recursos independientes de la vista global. */
export function useGestionarHorariosData(): GestionarHorariosData {
  const [datos, setDatos] = useState<GestionarHorariosData>(VACIO)
  useEffect(() => {
    let activo = true
    const recursos = [['horarios', apiGet<Horario[]>('/horarios/')], ['fichas', apiGet<Ficha[]>('/fichas/')], ['instructores', apiGet<Usuario[]>('/usuarios/')], ['ambientes', apiGet<Ambiente[]>('/ambientes')], ['sedes', apiGet<Sede[]>('/sedes')], ['períodos académicos', apiGet<Trimestre[]>('/trimestres/')], ['días de semana', apiGet<DiaSemana[]>('/dias-semana/')]] as const
    const solicitudes = recursos.map(([, solicitud]) => solicitud)
    Promise.allSettled(solicitudes).then((resultados) => {
      if (!activo) return
      const [horarios, fichas, instructores, ambientes, sedes, trimestres, diasSemana] = resultados.map((resultado) => resultado.status === 'fulfilled' ? resultado.value : []) as [Horario[], Ficha[], Usuario[], Ambiente[], Sede[], Trimestre[], DiaSemana[]]
      const fallo = resultados[0]
      const erroresCatalogos = resultados.slice(1).flatMap((resultado, indice) => resultado.status === 'rejected' ? [recursos[indice + 1][0]] : [])
      setDatos({ horarios, fichas, instructores, ambientes, sedes, trimestres, diasSemana, cargando: false, error: fallo.status === 'rejected' ? (fallo.reason instanceof ApiError ? fallo.reason.message : 'No se pudo cargar el listado de horarios.') : null, erroresCatalogos, actualizarHorario: () => {} })
    })
    return () => { activo = false }
  }, [])
  return { ...datos, actualizarHorario: (actualizado) => setDatos((anterior) => ({ ...anterior, horarios: anterior.horarios.map((horario) => horario.idHorario === actualizado.idHorario ? actualizado : horario) })) }
}
