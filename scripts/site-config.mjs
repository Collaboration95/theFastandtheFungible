import { readFileSync } from 'node:fs'
// Single source for the hosted destination; generated HTML is committed for static hosting.
export const HOSTED_APP_URL = JSON.parse(readFileSync(new URL('../shared/links.json', import.meta.url), 'utf8')).hostedApp
export const LIVE_WINDOW = 'live 13–19 Nov'
