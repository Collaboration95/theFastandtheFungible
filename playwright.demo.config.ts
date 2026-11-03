import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', testMatch: 'browser-demo.spec.ts', timeout: 60000,
  use: { headless: true, viewport: { width: 1440, height: 900 } },
})
