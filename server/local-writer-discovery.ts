import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { localWriterRoot } from '../publisher/local-writers.js'

/** Private operator registrations only; content and signing keys never enter discovery. */
export function localWriterRegistrations() {
  const root = localWriterRoot()
  let names: string[]
  try { names = readdirSync(root) } catch { return [] }
  return names.sort().flatMap(slug => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return []
    try {
      const entry = JSON.parse(readFileSync(join(root, slug, 'registry.json'), 'utf8'))
      const url = new URL(entry.origin)
      if (entry.slug !== slug || entry.rail !== 'xrpl-testnet' || !Number.isInteger(entry.pid) || entry.pid <= 0 || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.port === '8790' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) return []
      process.kill(entry.pid, 0)
      return [{ slug, origin: url.origin, label: 'Writers · local · Testnet' }]
    } catch { return [] }
  })
}
