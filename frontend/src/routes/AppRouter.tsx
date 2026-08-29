import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from '../pages/Login'
import { Registro } from '../pages/Registro'
import { RecuperarContrasena } from '../pages/RecuperarContrasena'
import { RestablecerContrasena } from '../pages/RestablecerContrasena'
import { Dashboard } from '../pages/Dashboard'
import { NuevoHorario } from '../pages/NuevoHorario'
import { HistorialHorarios } from '../pages/HistorialHorarios'
import { Ambientes } from '../pages/Ambientes'
import { Instructores } from '../pages/Instructores'
import { Fichas } from '../pages/Fichas'
import { Usuarios } from '../pages/Usuarios'
import { ProtectedRoute } from './ProtectedRoute'

/**
 * Todas las rutas de la app viven acá. Para agregar una página nueva:
 *   1. Crear el componente en src/pages/.
 *   2. Importarlo arriba.
 *   3. Agregar un <Route> — si necesita sesión iniciada, envolverlo en
 *      <ProtectedRoute> como está Dashboard.
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
        path="/horarios/nuevo"
        element={
          <ProtectedRoute>
            <NuevoHorario />
          </ProtectedRoute>
        }
      />
      <Route
        path="/horarios/historial"
        element={
          <ProtectedRoute>
            <HistorialHorarios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ambientes"
        element={
          <ProtectedRoute>
            <Ambientes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructores"
        element={
          <ProtectedRoute>
            <Instructores />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fichas"
        element={
          <ProtectedRoute>
            <Fichas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <Usuarios />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
