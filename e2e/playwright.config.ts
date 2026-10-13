import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.VITE_SUPABASE_URL ??= 'https://e2e-project.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY ??= 'e2e-only-public-key'
process.env.VITE_API_URL ??= 'http://127.0.0.1:8000/api/v1'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, '../frontend')
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const BASE_PORT = new URL(BASE_URL).port || '5173'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm dev --host 127.0.0.1 --port ${BASE_PORT} --strictPort`,
    cwd: FRONTEND_DIR,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI && !process.env.E2E_FORCE_SERVER,
    timeout: 60_000,
  },
})
