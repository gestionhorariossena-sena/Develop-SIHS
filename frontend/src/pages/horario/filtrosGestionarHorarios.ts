import type { Horario } from '../../types/api'
import type { GestionarHorariosQuery, JornadaQuery } from './gestionarHorariosQuery'

export function jornadaDeHorario(horario: Horario): JornadaQuery {
  const hora = Number(horario.horaInicio.split(':')[0])
  if (hora < 12) return 'manana'
  if (hora < 18) return 'tarde'
  return 'noche'
}

export function filtrarHorarios(horarios: Horario[], query: GestionarHorariosQuery, programaPorFicha: Map<number, string>): Horario[] {
  const texto = query.q?.toLocaleLowerCase('es-CO') ?? ''
  return horarios.filter((horario) => {
    const programa = programaPorFicha.get(horario.idFicha) ?? ''
    return (!texto || `${horario.fichaCodigo} ${programa} ${horario.instructorNombre} ${horario.ambienteNombre}`.toLocaleLowerCase('es-CO').includes(texto))
      && (!query.jornada || jornadaDeHorario(horario) === query.jornada)
      && (!query.idTrimestre || horario.idTrimestre === Number(query.idTrimestre))
      && (!query.estado || (query.estado === 'publicado' ? horario.publicado : !horario.publicado))
      && (!query.idFicha || horario.idFicha === Number(query.idFicha))
      && (!query.idInstructor || horario.idInstructor === query.idInstructor)
      && (!query.idAmbiente || horario.idAmbiente === Number(query.idAmbiente))
  })
}
