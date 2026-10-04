import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', testMatch: ['e2e.spec.ts', 'a11y.spec.ts'], timeout: 60000, workers: 1, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5100', headless: true, viewport: { width: 1280, height: 720 } },
  webServer: { command: 'node scripts/prepare-e2e-store.mjs && npm run demo', url: 'http://127.0.0.1:5100', reuseExistingServer: false, timeout: 45000,
    env: { APP_DB: '.playwright/app.db', PUBLISHER_DB: '.playwright/publisher.db', REPORT_DIR: '.playwright/reports' } },
})
