import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: /(?:e2e|a11y)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', permissions: ['clipboard-read', 'clipboard-write'] },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173/demo', reuseExistingServer: true, timeout: 30_000 },
})
