// These configs live in tests/playwright/ but run from the repository root.
// Playwright resolves webServer.cwd and outputDir against the config file, so pin both to the root.
import { fileURLToPath } from 'node:url'
export const root = fileURLToPath(new URL('../..', import.meta.url))
export const outputDir = fileURLToPath(new URL('../../test-results', import.meta.url))
