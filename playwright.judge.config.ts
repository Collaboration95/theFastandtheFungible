import { defineConfig } from '@playwright/test'
// First-touch judge path (tests/judge-path.spec.ts). `npm run test:judge` builds the demo first.
export default defineConfig({ testDir: './tests', testMatch: 'judge-path.spec.ts', workers: 1, use: { headless: true, viewport: { width: 1440, height: 900 } } })
