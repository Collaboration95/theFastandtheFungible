import { defineConfig } from '@playwright/test'

const fixtureWebServerCommand = process.platform === 'win32'
  ? 'set "XRPL_MODE=fixture" && set "LLM_PROVIDER=fixture" && npm run dev'
  : 'XRPL_MODE=fixture LLM_PROVIDER=fixture npm run dev'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 20_000,
  use: { baseURL: 'http://localhost:5173', headless: true },
  webServer: { command: fixtureWebServerCommand, url: 'http://localhost:5173', reuseExistingServer: false, timeout: 30_000 },
})
