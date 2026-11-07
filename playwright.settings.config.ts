import { defineConfig } from '@playwright/test'
import base from './playwright.config'
// Build explicitly before this evidence run so build time does not consume the
// unchanged 45-second server-start gate on a busy shared workstation.
export default defineConfig({ ...base, testMatch: ['settings.spec.ts'], webServer: { ...(base.webServer as object), command: 'node scripts/prepare-e2e-store.mjs && npm run demo' } })
