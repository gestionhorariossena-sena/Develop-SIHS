import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { PanelAdministracion } from './PanelAdministracion'
import { ApiError } from '../services/api'
import type { Rol, SolicitudAcceso } from '../types/api'

const ROLES: Rol[] = [
  { idRol: 1, nombre: 'Coordinador' },
  { idRol: 2, nombre: 'Instructor' },
]

const SOLICITUD_PENDIENTE: SolicitudAcceso = {
  idSolicitud: 142,
  nombre: 'Maritza Benítez Cardona',
  email: 'mbenitez@sena.edu.co',
  numeroDocumento: '52849120',
  idRolSolicitado: 1,
  rolSolicitado: { idRol: 1, nombre: 'Coordinador' },
  motivo: 'Asumí funciones de coordinación académica.',
  estado: 'pendiente',
  motivoRechazo: null,
  fechaSolicitud: '2026-09-01T08:35:00Z',
  fechaResolucion: null,
  idAdminResolvio: null,
}

const SOLICITUD_APROBADA: SolicitudAcceso = {
  idSolicitud: 100,
  nombre: 'Carlos Morales',
  email: 'cmorales@sena.edu.co',
  numeroDocumento: '1000',
  idRolSolicitado: 2,
  rolSolicitado: { idRol: 2, nombre: 'Instructor' },
  motivo: 'Contrato de prestación de servicios.',
  estado: 'aprobada',
  motivoRechazo: null,
  fechaSolicitud: '2026-08-01T08:00:00Z',
  // Deliberadamente relativa al reloj real (no fija) para que "Aprobadas
  // Este Mes" siga siendo del mes en curso sin necesitar fake timers.
  fechaResolucion: new Date().toISOString(),
  idAdminResolvio: 'admin-1',
}

const SOLICITUD_RECHAZADA: SolicitudAcceso = {
  idSolicitud: 90,
  nombre: 'Mauricio R.',
  email: 'mauricio@gmail.com',
  numeroDocumento: '2000',
  idRolSolicitado: 2,
  rolSolicitado: { idRol: 2, nombre: 'Instructor' },
  motivo: 'Quiero acceso.',
  estado: 'rechazada',
  motivoRechazo: 'Correo Gmail no corporativo',
  fechaSolicitud: '2026-08-01T08:00:00Z',
  fechaResolucion: '2026-08-10T10:00:00Z',
  idAdminResolvio: 'admin-1',
}

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

function mockeaCatalogos(solicitudes: SolicitudAcceso[]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/solicitudes-acceso/') return Promise.resolve(solicitudes)
    if (path === '/roles/') return Promise.resolve(ROLES)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('PanelAdministracion', () => {
  afterEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
  })

  it('un usuario sin permisos de Administrador ve "Acceso denegado"', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/solicitudes-acceso/') return Promise.reject(new ApiError(403, 'No autorizado'))
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<PanelAdministracion />)

    expect(await screen.findByText('Acceso denegado')).toBeInTheDocument()
  })

  it('tab Pendientes: desglose por rol real y "Sede y jornada autorizada" deshabilitado', async () => {
    mockeaCatalogos([SOLICITUD_PENDIENTE])
    renderConProviders(<PanelAdministracion />)

    expect(await screen.findByText('Maritza Benítez Cardona')).toBeInTheDocument()
    expect(screen.getByText('Solicita: Coordinador')).toBeInTheDocument()
    expect(screen.getByText('Coordinador (1)')).toBeInTheDocument()
    expect(screen.getByTitle('Aún no implementado en el backend')).toBeDisabled()
  })

  it('aprobadas del mes en curso se calculan sobre fechaResolucion real, no un dato inventado', async () => {
    mockeaCatalogos([SOLICITUD_PENDIENTE, SOLICITUD_APROBADA, SOLICITUD_RECHAZADA])
    renderConProviders(<PanelAdministracion />)

    expect(await screen.findByText('Maritza Benítez Cardona')).toBeInTheDocument()
    // SOLICITUD_APROBADA se resolvió "ahora" (mismo mes) — cuenta como
    // "Aprobadas Este Mes"; SOLICITUD_RECHAZADA no cuenta acá.
    const tarjetaAprobadas = screen.getByText('Aprobadas Este Mes').closest('div')!.parentElement!
    expect(within(tarjetaAprobadas).getByText('1')).toBeInTheDocument()
  })

  it('Aprobar y Enviar Credencial: llama a POST /solicitudes-acceso/{id}/aprobar con el rol elegido (no el solicitado por defecto)', async () => {
    mockeaCatalogos([SOLICITUD_PENDIENTE])
    apiPostMock.mockResolvedValue({})
    const usuario = userEvent.setup()
    renderConProviders(<PanelAdministracion />)

    await screen.findByText('Maritza Benítez Cardona')
    await usuario.selectOptions(screen.getByLabelText('Rol a otorgar en sistema:'), 'Instructor')
    await usuario.click(screen.getByRole('button', { name: /Aprobar y Enviar Credencial/ }))

    expect(apiPostMock).toHaveBeenCalledWith('/solicitudes-acceso/142/aprobar', { idRol: 2 })
    expect(await screen.findByText(/Solicitud de Maritza Benítez Cardona aprobada/)).toBeInTheDocument()
  })

  it('Rechazar: arma motivoRechazo desde el select + observación y llama a POST /rechazar', async () => {
    mockeaCatalogos([SOLICITUD_PENDIENTE])
    apiPostMock.mockResolvedValue({})
    const usuario = userEvent.setup()
    renderConProviders(<PanelAdministracion />)

    await screen.findByText('Maritza Benítez Cardona')
    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }))
    await usuario.type(screen.getByPlaceholderText(/Observación adicional/), 'Falta el soporte firmado.')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar Rechazo' }))

    expect(apiPostMock).toHaveBeenCalledWith('/solicitudes-acceso/142/rechazar', {
      motivoRechazo: 'Correo electrónico no coincide con dominio institucional @sena.edu.co — Falta el soporte firmado.',
    })
    expect(await screen.findByText(/Solicitud de Maritza Benítez Cardona rechazada/)).toBeInTheDocument()
  })

  it('rechazo con "Otro motivo personalizado" exige texto libre (no manda un motivo vacío)', async () => {
    mockeaCatalogos([SOLICITUD_PENDIENTE])
    apiPostMock.mockResolvedValue({})
    const usuario = userEvent.setup()
    renderConProviders(<PanelAdministracion />)

    await screen.findByText('Maritza Benítez Cardona')
    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }))
    await usuario.selectOptions(screen.getByDisplayValue(/Correo electrónico no coincide/), 'Otro motivo personalizado')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar Rechazo' }))

    expect(apiPostMock).not.toHaveBeenCalled()
    expect(await screen.findByText('Ingresa el motivo del rechazo.')).toBeInTheDocument()
  })

  it('tabs: Pendientes/Aprobadas/Rechazadas/Historial Completo filtran la lista visible', async () => {
    mockeaCatalogos([SOLICITUD_PENDIENTE, SOLICITUD_APROBADA, SOLICITUD_RECHAZADA])
    const usuario = userEvent.setup()
    renderConProviders(<PanelAdministracion />)

    // "Carlos Morales"/"Mauricio R." pueden aparecer en la barra lateral
    // "Últimas Evaluadas" (siempre visible) — lo que varía por tab es la
    // tarjeta principal (heading) de cada solicitud.
    await screen.findByRole('heading', { name: 'Maritza Benítez Cardona' })
    expect(screen.queryByRole('heading', { name: 'Carlos Morales' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /Aprobadas/ }))
    expect(await screen.findByRole('heading', { name: 'Carlos Morales' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Maritza Benítez Cardona' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Historial Completo' }))
    expect(await screen.findByRole('heading', { name: 'Maritza Benítez Cardona' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Carlos Morales' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mauricio R.' })).toBeInTheDocument()
  })

  it('filtro secundario por rol solicitado', async () => {
    mockeaCatalogos([SOLICITUD_PENDIENTE])
    const usuario = userEvent.setup()
    renderConProviders(<PanelAdministracion />)

    await screen.findByText('Maritza Benítez Cardona')
    await usuario.selectOptions(screen.getByDisplayValue('Todos los roles solicitados'), 'Rol: Instructor')

    expect(screen.queryByText('Maritza Benítez Cardona')).not.toBeInTheDocument()
  })

  it('Sincronizar Cola vuelve a pedir /solicitudes-acceso/', async () => {
    mockeaCatalogos([SOLICITUD_PENDIENTE])
    const usuario = userEvent.setup()
    renderConProviders(<PanelAdministracion />)

    await screen.findByText('Maritza Benítez Cardona')
    const llamadasAntes = apiGetMock.mock.calls.filter((c) => c[0] === '/solicitudes-acceso/').length

    await usuario.click(screen.getByRole('button', { name: /Sincronizar Cola/ }))

    expect(apiGetMock.mock.calls.filter((c) => c[0] === '/solicitudes-acceso/').length).toBeGreaterThan(llamadasAntes)
  })
})
