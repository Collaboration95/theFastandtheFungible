// Explicit selection only: a local recording never probes hosted; hosted never falls back.
import { HOSTED_URL } from '../config.mjs'
import { probeHosted } from './stack.mjs'

export async function resolveRecordingTarget(mode, { startLocal, probe = probeHosted } = {}) {
  if (mode === 'local') return { kind: 'local', base: (await startLocal()).url }
  if (mode !== 'hosted') throw new Error('Use --target local or --target hosted')
  const status = await probe(HOSTED_URL)
  if (!status.reachable || status.state !== 'ready') throw new Error(`Hosted capture unavailable: ${status.state}`)
  return { kind: 'hosted', base: HOSTED_URL, status }
}
