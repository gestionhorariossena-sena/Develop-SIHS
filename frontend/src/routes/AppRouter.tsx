import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from '../pages/Login'
import { Registro } from '../pages/Registro'
import { RecuperarContrasena } from '../pages/RecuperarContrasena'
import { RestablecerContrasena } from '../pages/RestablecerContrasena'
import { Dashboard } from '../pages/Dashboard'
import { NuevoHorario } from '../pages/NuevoHorario'
import { HistorialHorarios } from '../pages/HistorialHorarios'
import { CalendarioGeneral } from '../pages/CalendarioGeneral'
import { HorariosCompletos } from '../pages/HorariosCompletos'
import { Ambientes } from '../pages/Ambientes'
import { Instructores } from '../pages/Instructores'
import { VistaInstructores } from '../pages/VistaInstructores'
import { Fichas } from '../pages/Fichas'
import { VistaFichas } from '../pages/VistaFichas'
import { VistaAmbientes } from '../pages/VistaAmbientes'
import { MiHorario } from '../pages/MiHorario'
import { Usuarios } from '../pages/Usuarios'
import { Roles } from '../pages/Roles'
import { AprobarlicitarSolicitudes } from '../pages/AprobarlicitarSolicitudes'
import { ProtectedRoute } from './ProtectedRoute'

const GESTION = ['Administrador', 'Coordinador']
const ADMIN = ['Administrador']
const INSTRUCTOR = ['Instructor']

/**
 * Todas las rutas de la app viven acá. Para agregar una página nueva:
 *   1. Crear el componente en src/pages/.
 *   2. Importarlo arriba.
 *   3. Agregar un <Route> envuelto en <ProtectedRoute> y asignar los roles
 *      que pueden abrirla cuando no sea una pantalla común a toda sesión.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
      <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
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
        path="/horarios/nuevo"
        element={
          <ProtectedRoute roles={GESTION}>
            <NuevoHorario />
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
        path="/ambientes"
        element={
          <ProtectedRoute roles={GESTION}>
            <Ambientes />
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
        path="/vista-ambientes"
        element={
          <ProtectedRoute roles={GESTION}>
            <VistaAmbientes />
          </ProtectedRoute>
        }
      />
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
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
