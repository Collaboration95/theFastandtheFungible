import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { LINKS_FILE, cleanLinks, type HostedLinkFile } from '../../docker/hosted/links.mjs'
import type { Config } from '../config.js'
export const hostedLinksPath = (config: Config) => join(dirname(config.HOSTED_CONTROL_PATH || 'data/hosted-control.json'), LINKS_FILE)
/**
 * Links the operator set on the state disk (H7): `video` and `proof`. Read fresh like the control file, so a change shows on the
 * next status call. A missing, unreadable or malformed file, or a value that is not a plain https URL, is ignored.
 */
export function readHostedLinks(config: Config): HostedLinkFile {
  try { return cleanLinks(JSON.parse(readFileSync(hostedLinksPath(config), 'utf8'))) } catch { return {} }
}
