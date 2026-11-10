// Shared constants for the demo-video kit (scripts/video/*). Nothing here reads a key or a seed.
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
/** Large media lives here (gitignored with /scratch/). Override with VIDEO_DIR. */
export const SCRATCH = resolve(process.env.VIDEO_DIR ?? join(ROOT, 'scratch/video'))
export const CLIPS = join(SCRATCH, 'clips')
export const VOICE = join(SCRATCH, 'voice')
export const OUT = join(SCRATCH, 'out')
export const KIT_DOCS = join(ROOT, 'docs/submission/video')

export const HOSTED_URL = (process.env.HOSTED_URL ?? 'https://ra-front-651013803640.asia-southeast1.run.app').replace(/\/$/, '')
export const SITE = 'https://collaboration95.github.io/theFastandtheFungible'
export const REPO = 'https://github.com/Collaboration95/theFastandtheFungible'
export const RELEASE = `${REPO}/releases/download/v1.1.0`
export const TGZ = `${RELEASE}/researchagent-mcp-1.1.0.tgz`
export const WHEEL = `${RELEASE}/researchagent-1.1.0-py3-none-any.whl`
export const RECEIPTS = 'https://raw.githubusercontent.com/Collaboration95/theFastandtheFungible/v1.1.0/docs/evidence/lane-b3/UC3.receipts.json'

export const VIEWPORT = { width: 1920, height: 1080 }
export const FPS = 30
/** Page background of the app and the site; cards and fades use it so cuts stay calm. */
export const PAPER = '#FAF8F3'

/** The hosted questions. The first buys from the team-authored writers; the second is declined. */
export const QUESTIONS = {
  buy: 'Can an XRPL escrow hold RLUSD today, and what must the issuer enable before a buyer can lock it?',
  decline: 'Which Singapore banks are piloting RLUSD settlement in 2026?',
  // The local fixture stack only buys for the fictional-writer examples; the hosted demo's examples are the XRPL notes.
  localBuy: 'Are Kestrel Semiconductor\'s advanced-packaging lead times in Malaysia getting shorter?',
}
/** A recording pass asks the hosted app at most this many questions (the brief caps it at 4). */
export const MAX_LIVE_QUESTIONS = Math.min(4, Number(process.env.VIDEO_MAX_LIVE_QUESTIONS ?? 4))

export const sleep = ms => new Promise(done => setTimeout(done, ms))

/**
 * A private working folder inside the kit's own gitignored scratch (not the system temp directory): terminal sessions,
 * the local stack and render frames live here, and each caller removes its folder when done.
 */
export function scratchDir(prefix) {
  const dir = join(SCRATCH, 'tmp', `${prefix}${randomUUID().slice(0, 8)}`)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}
