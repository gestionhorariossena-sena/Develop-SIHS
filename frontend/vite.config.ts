/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    pool: 'threads',
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 76.73,
        branches: 64.89,
        functions: 73.89,
        lines: 79.59,
      },
    },
  },
})
