import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, '../frontend')
const BASE_URL = 'http://localhost:5173'

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
    command: 'pnpm dev',
    cwd: FRONTEND_DIR,
    url: BASE_URL,
    env: process.env.E2E_API_URL ? { VITE_API_URL: process.env.E2E_API_URL } : {},
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
