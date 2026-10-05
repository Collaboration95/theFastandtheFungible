import 'dotenv/config'
import { defineConfig } from '@playwright/test'
const web = `http://127.0.0.1:${5100 + Number(process.env.DEMO_PORT_OFFSET || 0)}` // see scripts/demo.mjs
export default defineConfig({
  testDir: './tests', testMatch: ['e2e.spec.ts', 'a11y.spec.ts'], timeout: 60000, workers: 1, fullyParallel: false,
  use: { baseURL: web, headless: true, viewport: { width: 1280, height: 720 } },
  webServer: { command: 'node scripts/prepare-e2e-store.mjs && npm run demo', url: web, reuseExistingServer: false, timeout: 45000,
    env: { APP_DB: '.playwright/app.db', PUBLISHER_DB: '.playwright/publisher.db', REPORT_DIR: '.playwright/reports' } },
})
