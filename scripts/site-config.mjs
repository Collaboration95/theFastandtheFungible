import { readFileSync } from 'node:fs'
// Single source for the hosted destination; generated HTML is committed for static hosting.
export const HOSTED_APP_URL = JSON.parse(readFileSync(new URL('../shared/links.json', import.meta.url), 'utf8')).hostedApp
export const LIVE_WINDOW = 'live 13–19 Nov'
// The default /demo/ recording and its date in Singapore time ("11 Nov 2026"); every "Replay · <date>" label reads it.
export const REPLAY_TRACE = 'demo/traces/UC3-key-reveal.json'
export const replayDate = () => new Date(JSON.parse(readFileSync(new URL(`../${REPLAY_TRACE}`, import.meta.url), 'utf8')).run.events[0].at)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
