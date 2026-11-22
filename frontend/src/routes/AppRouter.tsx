import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Presentacion } from '../pages/Presentacion'
import { Login } from '../pages/Login'
import { ProtectedRoute } from './ProtectedRoute'

const Registro = lazy(() => import('../pages/Registro').then((modulo) => ({ default: modulo.Registro })))
const RecuperarContrasena = lazy(() => import('../pages/RecuperarContrasena').then((modulo) => ({ default: modulo.RecuperarContrasena })))
const RestablecerContrasena = lazy(() => import('../pages/RestablecerContrasena').then((modulo) => ({ default: modulo.RestablecerContrasena })))
const DashboardRouter = lazy(() => import('../pages/DashboardRouter').then((modulo) => ({ default: modulo.DashboardRouter })))
const NuevoHorario = lazy(() => import('../pages/NuevoHorario').then((modulo) => ({ default: modulo.NuevoHorario })))
const CrearHorario = lazy(() => import('../pages/CrearHorario').then((modulo) => ({ default: modulo.CrearHorario })))
const AsistenteHorarios = lazy(() => import('../pages/AsistenteHorarios').then((modulo) => ({ default: modulo.AsistenteHorarios })))
const HistorialHorarios = lazy(() => import('../pages/HistorialHorarios').then((modulo) => ({ default: modulo.HistorialHorarios })))
const CalendarioGeneral = lazy(() => import('../pages/CalendarioGeneral').then((modulo) => ({ default: modulo.CalendarioGeneral })))
const HorariosCompletos = lazy(() => import('../pages/HorariosCompletos').then((modulo) => ({ default: modulo.HorariosCompletos })))
const AuditoriaCruces = lazy(() => import('../pages/AuditoriaCruces').then((modulo) => ({ default: modulo.AuditoriaCruces })))
const Ambientes = lazy(() => import('../pages/Ambientes').then((modulo) => ({ default: modulo.Ambientes })))
const Sedes = lazy(() => import('../pages/Sedes').then((modulo) => ({ default: modulo.Sedes })))
const Instructores = lazy(() => import('../pages/Instructores').then((modulo) => ({ default: modulo.Instructores })))
const VistaInstructores = lazy(() => import('../pages/VistaInstructores').then((modulo) => ({ default: modulo.VistaInstructores })))
const Fichas = lazy(() => import('../pages/Fichas').then((modulo) => ({ default: modulo.Fichas })))
const VistaFichas = lazy(() => import('../pages/VistaFichas').then((modulo) => ({ default: modulo.VistaFichas })))
const VistaAmbientes = lazy(() => import('../pages/VistaAmbientes').then((modulo) => ({ default: modulo.VistaAmbientes })))
const MiHorario = lazy(() => import('../pages/MiHorario').then((modulo) => ({ default: modulo.MiHorario })))
const MiHorarioAprendiz = lazy(() => import('../pages/MiHorarioAprendiz').then((modulo) => ({ default: modulo.MiHorarioAprendiz })))
const DetalleFranjaAmbiente = lazy(() => import('../pages/DetalleFranjaAmbiente').then((modulo) => ({ default: modulo.DetalleFranjaAmbiente })))
const Usuarios = lazy(() => import('../pages/Usuarios').then((modulo) => ({ default: modulo.Usuarios })))
const Roles = lazy(() => import('../pages/Roles').then((modulo) => ({ default: modulo.Roles })))
const AprobarlicitarSolicitudes = lazy(() => import('../pages/AprobarlicitarSolicitudes').then((modulo) => ({ default: modulo.AprobarlicitarSolicitudes })))
const PanelAdministracion = lazy(() => import('../pages/PanelAdministracion').then((modulo) => ({ default: modulo.PanelAdministracion })))
const Programas = lazy(() => import('../pages/Programas').then((modulo) => ({ default: modulo.Programas })))
const Tematicas = lazy(() => import('../pages/Tematicas').then((modulo) => ({ default: modulo.Tematicas })))
const CambiosHorario = lazy(() => import('../pages/CambiosHorario').then((modulo) => ({ default: modulo.CambiosHorario })))
const Avisos = lazy(() => import('../pages/Avisos').then((modulo) => ({ default: modulo.Avisos })))
const MensajesAprendiz = lazy(() => import('../pages/MensajesAprendiz').then((modulo) => ({ default: modulo.MensajesAprendiz })))
const AsistenciaInstructor = lazy(() => import('../pages/AsistenciaInstructor').then((modulo) => ({ default: modulo.AsistenciaInstructor })))
const MiAsistencia = lazy(() => import('../pages/MiAsistencia').then((modulo) => ({ default: modulo.MiAsistencia })))
const CambiarClaveObligatorio = lazy(() => import('../pages/CambiarClaveObligatorio').then((modulo) => ({ default: modulo.CambiarClaveObligatorio })))
const Notificaciones = lazy(() => import('../pages/Notificaciones').then((modulo) => ({ default: modulo.Notificaciones })))
const PublicacionesProgramadas = lazy(() => import('../pages/PublicacionesProgramadas').then((modulo) => ({ default: modulo.PublicacionesProgramadas })))
const MisSolicitudesCambioHorario = lazy(() => import('../pages/MisSolicitudesCambioHorario').then((modulo) => ({ default: modulo.MisSolicitudesCambioHorario })))

/**
 * Quién puede abrir cada pantalla. Mismo criterio que usa el navbar para
 * decidir qué ítems muestra (`AppShell.tsx`): GESTION es su `soloGestion`,
 * ADMIN su `soloAdmin`. Están acá arriba y no repetidos ruta por ruta para
 * que cambiar la regla de un grupo entero sea un solo renglón.
 */
const GESTION = ['Administrador', 'Coordinador']
const ADMIN = ['Administrador']
const INSTRUCTOR = ['Instructor']
const APRENDIZ = ['Aprendiz']

/**
 * Todas las rutas de la app viven acá. Para agregar una página nueva:
 *   1. Crear el componente en src/pages/.
 *   2. Importarlo arriba.
 *   3. Agregar un <Route> envuelto en <ProtectedRoute roles={...}> con los
 *      roles que pueden abrirla. Solo se deja sin `roles` lo que de verdad
 *      sirve a cualquier rol (`/dashboard`, que reparte por rol adentro).
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
      <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />
      {/* Quien entra con una clave temporal (solicitud de acceso aprobada)
          no puede navegar a otra cosa hasta cambiarla — lo impone
          ProtectedRoute mirando `debeCambiarClave`. */}
      <Route
        path="/cambiar-clave-obligatorio"
        element={
          <ProtectedRoute>
            <CambiarClaveObligatorio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendario"
        element={
          <ProtectedRoute roles={GESTION}>
            <CalendarioGeneral />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mi-horario"
        element={
          <ProtectedRoute roles={INSTRUCTOR}>
            <MiHorario />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mi-horario-aprendiz"
        element={
          <ProtectedRoute roles={APRENDIZ}>
            <MiHorarioAprendiz />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mi-horario/detalle-franja"
        element={
          <ProtectedRoute roles={INSTRUCTOR}>
            <DetalleFranjaAmbiente />
          </ProtectedRoute>
        }
      />
      <Route
        path="/horarios/crear"
        element={
          <ProtectedRoute roles={GESTION}>
            <CrearHorario />
          </ProtectedRoute>
        }
      />
      <Route
        path="/horarios/nuevo"
        element={
          <ProtectedRoute roles={GESTION}>
            <NuevoHorario />
          </ProtectedRoute>
        }
      />
      <Route
        path="/horarios/asistente-ia"
        element={
          <ProtectedRoute roles={GESTION}>
            <AsistenteHorarios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/horarios/completos"
        element={
          <ProtectedRoute roles={GESTION}>
            <HorariosCompletos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/horarios/publicaciones-programadas"
        element={
          <ProtectedRoute roles={GESTION}>
            <PublicacionesProgramadas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/horarios/historial"
        element={
          <ProtectedRoute roles={GESTION}>
            <HistorialHorarios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/horarios/auditoria"
        element={
          <ProtectedRoute roles={GESTION}>
            <AuditoriaCruces />
          </ProtectedRoute>
        }
      />
      {/* Pasar lista es del Instructor; el Aprendiz solo lee la suya. */}
      <Route
        path="/asistencia"
        element={
          <ProtectedRoute roles={INSTRUCTOR}>
            <AsistenciaInstructor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mi-asistencia"
        element={
          <ProtectedRoute roles={APRENDIZ}>
            <MiAsistencia />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mensajes"
        element={
          <ProtectedRoute roles={APRENDIZ}>
            <MensajesAprendiz />
          </ProtectedRoute>
        }
      />
      {/* Mismo componente, otra vista: la lista de conversaciones con
        * contador de no leídos en vez del directorio de solo lectura.
        * Solo el vocero/subvocero la ve en el subnav (AppShell.tsx), pero
        * la ruta en sí no es más permisiva -- MensajesAprendiz.tsx ya
        * esconde "Escribir" si no puede, y el backend lo exige igual. */}
      <Route
        path="/mensajes/chat"
        element={
          <ProtectedRoute roles={APRENDIZ}>
            <MensajesAprendiz />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mis-solicitudes-cambio"
        element={
          <ProtectedRoute roles={INSTRUCTOR}>
            <MisSolicitudesCambioHorario />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notificaciones"
        element={
          <ProtectedRoute>
            <Notificaciones />
          </ProtectedRoute>
        }
      />
      {/* El tablón de comunicados lo lee cualquier sesión: sin `roles`. */}
      <Route
        path="/avisos"
        element={
          <ProtectedRoute>
            <Avisos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cambios"
        element={
          <ProtectedRoute roles={GESTION}>
            <CambiosHorario />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ambientes"
        element={
          <ProtectedRoute roles={GESTION}>
            <Ambientes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sedes"
        element={
          <ProtectedRoute roles={GESTION}>
            <Sedes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructores"
        element={
          <ProtectedRoute roles={GESTION}>
            <Instructores />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vista-instructores"
        element={
          <ProtectedRoute roles={GESTION}>
            <VistaInstructores />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fichas"
        element={
          <ProtectedRoute roles={GESTION}>
            <Fichas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vista-fichas"
        element={
          <ProtectedRoute roles={GESTION}>
            <VistaFichas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/programas"
        element={
          <ProtectedRoute roles={GESTION}>
            <Programas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tematicas"
        element={
          <ProtectedRoute roles={GESTION}>
            <Tematicas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vista-ambientes"
        element={
          <ProtectedRoute roles={GESTION}>
            <VistaAmbientes />
          </ProtectedRoute>
        }
      />
      {/* H-6: asignar/quitar rol es solo de Administrador en el backend,
          así que estas dos no son de gestión sino de administración. */}
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute roles={ADMIN}>
            <Usuarios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute roles={ADMIN}>
            <Roles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aprobar-solicitudes"
        element={
          <ProtectedRoute roles={ADMIN}>
            <AprobarlicitarSolicitudes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel-administracion"
        element={
          <ProtectedRoute roles={ADMIN}>
            <PanelAdministracion />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Presentacion />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
