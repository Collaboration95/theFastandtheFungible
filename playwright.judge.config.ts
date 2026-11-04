import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests', testMatch: 'judge-path.spec.ts', workers: 1, timeout: 240000, use: { headless: true } })
