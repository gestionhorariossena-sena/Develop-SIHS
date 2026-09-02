import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// `globals: false` en vite.config.ts (ver ESTRUCTURA.md) evita que
// @testing-library/react enganche su auto-cleanup vía el `afterEach` global —
// se registra a mano acá para que cada test empiece con el DOM limpio.
afterEach(cleanup)

// ThemeProvider (modo oscuro, SCRUM-23) usa localStorage y matchMedia —
// jsdom no trae ninguno de los dos por defecto en esta versión de Node,
// así que cualquier test que renderice <AppShell> (que usa ThemeProvider
// indirecto vía <ThemeSelector>) revienta sin esto.
if (typeof window.localStorage === 'undefined' || !window.localStorage) {
  const almacen = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (clave: string) => almacen.get(clave) ?? null,
      setItem: (clave: string, valor: string) => void almacen.set(clave, valor),
      removeItem: (clave: string) => void almacen.delete(clave),
      clear: () => almacen.clear(),
    },
    writable: true,
  })
}

if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
