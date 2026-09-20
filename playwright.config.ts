import { defineConfig } from '@playwright/test'

const fixtureWebServerCommand = process.platform === 'win32'
  ? 'node scripts/prepare-e2e-store.mjs && set "XRPL_MODE=fixture" && set "LLM_PROVIDER=fixture" && set "RESEARCH_RUNS_FILE=.playwright/runs.json" && npm run dev'
  : 'node scripts/prepare-e2e-store.mjs && XRPL_MODE=fixture LLM_PROVIDER=fixture RESEARCH_RUNS_FILE=.playwright/runs.json npm run dev'
const clientUrl = 'http://localhost:5100'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 20_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: clientUrl, headless: true },
  webServer: { command: fixtureWebServerCommand, url: clientUrl, reuseExistingServer: false, timeout: 30_000 },
})
