import type { Horario, Usuario } from '../types/api'

/** Datos de la carga docente visibles en el directorio de instructores.
 * Las horas se calculan usando las sesiones asignadas a cada instructor,
 * no una distribución ficticia de actividades complementarias.
 */
export function horasDeHorario(horario: Pick<Horario, 'horaInicio' | 'horaFin' | 'dias'>): number {
  const [inicioHora, inicioMinuto] = horario.horaInicio.split(':').map(Number)
  const [finHora, finMinuto] = horario.horaFin.split(':').map(Number)
  const minutos = finHora * 60 + finMinuto - (inicioHora * 60 + inicioMinuto)
  return minutos > 0 ? minutos / 60 * horario.dias.length : 0
}

export function horasDeInstructor(idInstructor: string, horarios: Horario[]): number {
  return horarios.reduce((total, h) => total + (h.idInstructor === idInstructor ? horasDeHorario(h) : 0), 0)
}

export function limiteInstructor(instructor: Usuario): number {
  return instructor.tipoContrato?.trim().toLocaleLowerCase('es-CO') === 'planta' ? 32 : 40
}

function celdaCsv(valor: string | number): string {
  // Previene la interpretación de fórmulas si se abre en Excel o Calc.
  const texto = String(valor)
  const seguro = /^[\s\t\r\n]*[=+\-@]/.test(texto) ? "'" + texto : texto
  return '"' + seguro.replaceAll('"', '""') + '"'
}

export function construirCsvCargaDocente(instructores: Usuario[], horarios: Horario[]): string {
  const columnas = [
    'Instructor', 'Correo', 'Especialidades', 'Contrato',
    'Horas contratadas por semana', 'Horas asignadas por semana',
    'Límite semanal', 'Horas disponibles', 'Porcentaje de ocupación', 'Estado',
  ]
  const filas = instructores.map(instructor => {
    const asignadas = horasDeInstructor(instructor.idUsuario, horarios)
    const limite = limiteInstructor(instructor)
    return [
      instructor.nombre, instructor.email,
      instructor.especialidades.map(item => item.nombre).join(', '),
      instructor.tipoContrato || 'Sin definir', instructor.horasContratadasSemana ?? '',
      Number(asignadas.toFixed(2)), limite, Number((limite - asignadas).toFixed(2)),
      Math.round(asignadas / limite * 100) + '%', instructor.estado,
    ]
  })
  // BOM UTF-8 para que Excel en Windows reconozca tildes y eñes.
  return '\uFEFF' + [columnas, ...filas].map(fila => fila.map(valor => celdaCsv(valor)).join(';')).join('\r\n') + '\r\n'
}

export function descargarCsvCargaDocente(instructores: Usuario[], horarios: Horario[]): void {
  const contenido = construirCsvCargaDocente(instructores, horarios)
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  try {
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'sihs-carga-docente.csv'
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
