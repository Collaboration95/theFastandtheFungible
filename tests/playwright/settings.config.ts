import { defineConfig } from '@playwright/test'
import base from '../../playwright.config'
import { outputDir, root } from './paths'
// Build explicitly before this evidence run so build time does not consume the
// unchanged 45-second server-start gate on a busy shared workstation.
export default defineConfig({ ...base, testDir: '..', outputDir, testMatch: ['settings.spec.ts'], webServer: { ...(base.webServer as object), cwd: root, command: 'node scripts/prepare-e2e-store.mjs && npm run demo' } })
