import { Navigate, Route, Routes } from 'react-router-dom'
import { Presentacion } from '../pages/Presentacion'
import { Login } from '../pages/Login'
import { Registro } from '../pages/Registro'
import { RecuperarContrasena } from '../pages/RecuperarContrasena'
import { RestablecerContrasena } from '../pages/RestablecerContrasena'
import { DashboardRouter } from '../pages/DashboardRouter'
import { NuevoHorario } from '../pages/NuevoHorario'
import { AsistenteHorarios } from '../pages/AsistenteHorarios'
import { HistorialHorarios } from '../pages/HistorialHorarios'
import { CalendarioGeneral } from '../pages/CalendarioGeneral'
import { HorariosCompletos } from '../pages/HorariosCompletos'
import { AuditoriaCruces } from '../pages/AuditoriaCruces'
import { Ambientes } from '../pages/Ambientes'
import { Sedes } from '../pages/Sedes'
import { Instructores } from '../pages/Instructores'
import { VistaInstructores } from '../pages/VistaInstructores'
import { Fichas } from '../pages/Fichas'
import { VistaFichas } from '../pages/VistaFichas'
import { VistaAmbientes } from '../pages/VistaAmbientes'
import { MiHorario } from '../pages/MiHorario'
import { MiHorarioAprendiz } from '../pages/MiHorarioAprendiz'
import { DetalleFranjaAmbiente } from '../pages/DetalleFranjaAmbiente'
import { Usuarios } from '../pages/Usuarios'
import { CodigoInstructor } from '../pages/CodigoInstructor'
import { Roles } from '../pages/Roles'
import { AprobarlicitarSolicitudes } from '../pages/AprobarlicitarSolicitudes'
import { PanelAdministracion } from '../pages/PanelAdministracion'
import { ProtectedRoute } from './ProtectedRoute'
import { Programas } from '../pages/Programas'
import { CambiosHorario } from '../pages/CambiosHorario'
import { Avisos } from '../pages/Avisos'
import { MensajesAprendiz } from '../pages/MensajesAprendiz'
import { CambiarClaveObligatorio } from '../pages/CambiarClaveObligatorio'
import { Notificaciones } from '../pages/Notificaciones'

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
      <Route
        path="/mensajes"
        element={
          <ProtectedRoute roles={APRENDIZ}>
            <MensajesAprendiz />
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
        path="/codigo-instructor"
        element={
          <ProtectedRoute roles={GESTION}>
            <CodigoInstructor />
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
