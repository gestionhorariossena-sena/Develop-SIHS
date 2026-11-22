import { Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { AppRouter } from './routes/AppRouter'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div role="status" className="grid min-h-screen place-items-center bg-surface text-sm text-on-surface-variant">Cargando vista…</div>}>
            <AppRouter />
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
