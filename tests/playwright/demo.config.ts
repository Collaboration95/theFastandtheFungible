import { defineConfig } from '@playwright/test'
import { outputDir } from './paths'
export default defineConfig({
  testDir: '..', outputDir, testMatch: 'browser-demo.spec.ts', timeout: 60000, fullyParallel: true, workers: 4,
  use: { headless: true, viewport: { width: 1440, height: 900 } },
})
