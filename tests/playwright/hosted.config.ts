// Hosted judge UI in hosted mode (HOSTED=1), locally: fixture models, the simulated rail, ephemeral ports.
// The stack (tests/helpers/hosted-stack.ts) serves the production build behind a throwaway HTTPS origin.
for (const key of Object.keys(process.env)) {
  if (/(?:API_KEY|TOKEN|SEED|SECRET)$/.test(key)) delete process.env[key]
}
import { resolve } from 'node:path'
import { defineConfig } from '@playwright/test'
import { allocateDemoPorts } from '../../scripts/demo-ports.mjs'
import { outputDir, root } from './paths'
// Workers evaluate this module again; inherit the runner's ports and state directory.
const ports = JSON.parse(process.env.PLAYWRIGHT_HOSTED_PORTS ??= JSON.stringify(await allocateDemoPorts()))
process.env.HOSTED_STACK_DIR ??= resolve('.playwright', `hosted-ui-${ports.web}`)
const web = `https://localhost:${ports.web}`
export default defineConfig({
  testDir: '..', outputDir, testMatch: ['hosted-ui.spec.ts', 'proof-of-refusal.spec.ts', 'judges-corner.spec.ts'], timeout: 90000, workers: 1, fullyParallel: false,
  use: { baseURL: web, ignoreHTTPSErrors: true, headless: true, browserName: 'chromium', trace: 'off', screenshot: 'only-on-failure', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'npm run build && node --import tsx tests/helpers/hosted-stack.ts', cwd: root, url: web + '/livez', ignoreHTTPSErrors: true, reuseExistingServer: false, timeout: 240000, gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    env: { HOSTED_WEB_PORT: String(ports.web), HOSTED_API_PORT: String(ports.api), HOSTED_PUBLISHER_PORT: String(ports.pub), HOSTED_STACK_DIR: process.env.HOSTED_STACK_DIR, DOTENV_CONFIG_PATH: '.playwright/no-env' } },
})
