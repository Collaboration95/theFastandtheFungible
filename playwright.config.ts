import 'dotenv/config'
import { defineConfig } from '@playwright/test'
import { allocateDemoPorts } from './scripts/demo-ports.mjs'
// Playwright evaluates this module again in workers; inherit the runner's allocation.
const ports = JSON.parse(process.env.PLAYWRIGHT_DEMO_PORTS ??= JSON.stringify(await allocateDemoPorts()))
const web = `http://127.0.0.1:${ports.web}`
export default defineConfig({
  testDir: './tests', testMatch: ['e2e.spec.ts', 'a11y.spec.ts', 'foundation.spec.ts', 'perf.spec.ts', 'ux.spec.ts'], timeout: 60000, workers: 1, fullyParallel: false,
  use: { baseURL: web, headless: true, viewport: { width: 1280, height: 720 } },
  webServer: { command: 'npm run build && node scripts/prepare-e2e-store.mjs && npm run demo', url: web, reuseExistingServer: false, timeout: 45000,
    env: { DEMO_WEB_PORT: String(ports.web), DEMO_API_PORT: String(ports.api), DEMO_PUBLISHER_PORT: String(ports.pub),
      PUBLISHER_URL: `http://127.0.0.1:${ports.pub}`, DOTENV_CONFIG_PATH: '.playwright/no-env',
      DEMO_PREVIEW: '1', SETTLEMENT_RAIL: 'simulated', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0',
      APP_DB: '.playwright/app.db', PUBLISHER_DB: '.playwright/publisher.db', REPORT_DIR: '.playwright/reports' } },
})
