import { describe, expect, it } from 'vitest'
import { escribirGestionarHorariosQuery, leerGestionarHorariosQuery, normalizarRutaHorarioLegada } from '../../../../src/pages/horario/gestionarHorariosQuery'

describe('contrato de query params de Gestionar horarios', () => {
  it('usa Bloques/Lista y página 1 como contrato predeterminado', () => {
    expect(leerGestionarHorariosQuery(new URLSearchParams())).toEqual({
      perspectiva: 'bloques', vista: 'lista', pagina: 1,
    })
  })

  it('lee filtros canónicos y descarta enums o páginas inválidos', () => {
    const query = leerGestionarHorariosQuery(new URLSearchParams('perspectiva=instructor&vista=calendario&idInstructor=u-1&idHorario=9&q= Carlos%20Mendoza &jornada=noche&idTrimestre=3&estado=publicado&pagina=2'))
    expect(query).toEqual({
      perspectiva: 'instructor', vista: 'calendario', idInstructor: 'u-1', idHorario: '9', q: 'Carlos Mendoza', jornada: 'noche', idTrimestre: '3', estado: 'publicado', pagina: 2,
    })

    expect(leerGestionarHorariosQuery(new URLSearchParams('perspectiva=otra&vista=mapa&jornada=medianoche&estado=activo&pagina=0'))).toEqual({
      perspectiva: 'bloques', vista: 'lista', pagina: 1,
    })
  })

  it('serializa sin defaults y conserva todos los filtros significativos', () => {
    const params = escribirGestionarHorariosQuery({
      perspectiva: 'ambiente', vista: 'conflictos', idHorario: '44', idAmbiente: '8', q: 'Laboratorio 2', jornada: 'tarde', idTrimestre: '5', estado: 'borrador', pagina: 3,
    })
    expect(params.toString()).toBe('perspectiva=ambiente&vista=conflictos&idHorario=44&idAmbiente=8&q=Laboratorio+2&jornada=tarde&idTrimestre=5&estado=borrador&pagina=3')
  })
})

describe('caracterización de deep links legados de horarios', () => {
  it.each([
    ['/horarios/completos', '7', { perspectiva: 'bloques', vista: 'lista', idHorario: '7', pagina: 1 }],
    ['/vista-fichas', '12', { perspectiva: 'ficha', vista: 'calendario', idFicha: '12', pagina: 1 }],
    ['/vista-instructores', 'u-1', { perspectiva: 'instructor', vista: 'calendario', idInstructor: 'u-1', pagina: 1 }],
    ['/vista-ambientes', '8', { perspectiva: 'ambiente', vista: 'calendario', idAmbiente: '8', pagina: 1 }],
  ])('traduce %s?id=%s sin mantener el id ambiguo', (pathname, id, esperado) => {
    expect(normalizarRutaHorarioLegada(pathname, new URLSearchParams(`id=${id}`))).toEqual(esperado)
  })

  it('preserva filtros canónicos y deja que un ID explícito prevalezca sobre el legado', () => {
    const query = normalizarRutaHorarioLegada('/vista-fichas', new URLSearchParams('id=12&idFicha=99&idTrimestre=3&q=ADSO'))
    expect(query).toEqual({
      perspectiva: 'ficha', vista: 'calendario', idFicha: '99', idTrimestre: '3', q: 'ADSO', pagina: 1,
    })
  })

  it('no intenta normalizar rutas ajenas al módulo', () => {
    expect(normalizarRutaHorarioLegada('/fichas', new URLSearchParams('id=12'))).toBeNull()
  })
})
