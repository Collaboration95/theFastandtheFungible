// Bundled in place of '@playwright/test' (esbuild --alias): the api image runs Alpine's
// system Chromium through playwright-core, because Playwright's bundled build needs glibc.
import { chromium as core } from 'playwright-core'
export const chromium = { launch: (options = {}) => core.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, ...options }) }
