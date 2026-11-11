import { defineConfig } from '@playwright/test'
import { allocateDemoPorts } from '../../scripts/demo-ports.mjs'
import { root, outputDir } from './paths'
const ports = JSON.parse(process.env.L12R_PORTS ??= JSON.stringify(await allocateDemoPorts()))
export default defineConfig({
  testDir: '..', testMatch: 'one-product.spec.ts', outputDir, workers: 1, timeout: 60000,
  use: { baseURL: `http://127.0.0.1:${ports.web}`, headless: true, reducedMotion: 'reduce' },
  webServer: { command: `npx vite preview --host 127.0.0.1 --port ${ports.web} --strictPort`, cwd: root, url: `http://127.0.0.1:${ports.web}`, reuseExistingServer: false },
})
