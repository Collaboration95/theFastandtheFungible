import { defineConfig } from '@playwright/test'
import { allocateDemoPorts } from '../../scripts/demo-ports.mjs'
import { root, outputDir } from './paths'
const ports = JSON.parse(process.env.DECLUTTER_PORTS ??= JSON.stringify(await allocateDemoPorts()))
export default defineConfig({
  testDir: '..', testMatch: 'declutter.spec.ts', outputDir, workers: 1, timeout: 60000,
  use: { baseURL: `http://127.0.0.1:${ports.web}`, viewport: { width: 1280, height: 800 }, headless: true },
  webServer: { command: `npx vite preview ${process.env.DECLUTTER_DIST ? `--outDir ${process.env.DECLUTTER_DIST}` : ''} --host 127.0.0.1 --port ${ports.web} --strictPort`, cwd: root, url: `http://127.0.0.1:${ports.web}`, reuseExistingServer: false },
})
