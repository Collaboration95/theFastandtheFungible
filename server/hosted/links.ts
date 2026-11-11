import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Config } from '../config.js'
// Keep runtime API code self-contained: desktop compilation stages server/, but not deployment helpers under docker/.
// The operator CLI's equivalent validation lives in docker/hosted/links.mjs; hosted-h7 pins parity across the two builds.
export type HostedLinkFile = { video?: string; proof?: string }
export function cleanLinks(doc: unknown): HostedLinkFile {
  const out: HostedLinkFile = {}
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return out
  for (const key of ['video', 'proof'] as const) {
    const value = (doc as Record<string, unknown>)[key]
    if (typeof value !== 'string' || value.length > 300 || !/^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:[/?#][^\s"'<>\\`]*)?$/.test(value)) continue
    try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.')) out[key] = value } catch { /* invalid URL */ }
  }
  return out
}
const LINKS_FILE = 'links.json'
export const hostedLinksPath = (config: Config) => join(dirname(config.HOSTED_CONTROL_PATH || 'data/hosted-control.json'), LINKS_FILE)
/**
 * Links the operator set on the state disk (H7): `video` and `proof`. Read fresh like the control file, so a change shows on the
 * next status call. A missing, unreadable or malformed file, or a value that is not a plain https URL, is ignored.
 */
export function readHostedLinks(config: Config): HostedLinkFile {
  try { return cleanLinks(JSON.parse(readFileSync(hostedLinksPath(config), 'utf8'))) } catch { return {} }
}
