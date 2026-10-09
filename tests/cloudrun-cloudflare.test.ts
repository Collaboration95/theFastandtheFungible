// Cloud Run start-up pair choice (owner, 10 Oct): primary, then _2, _3, _4. Fixtures only, no network.
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, no declarations
import { pickCloudflarePair, withCloudflarePair } from '../docker/cloudrun/cloudflare.mjs'

type Probe = { CLOUDFLARE_API_TOKEN: string, CLOUDFLARE_ACCOUNT_ID?: string }
const env = { CLOUDFLARE_API_TOKEN: 'tok-1', CLOUDFLARE_ACCOUNT_ID: 'acct-1', CLOUDFLARE_API_TOKEN_2: 'tok-2', CLOUDFLARE_ACCOUNT_ID_2: 'acct-2',
  CLOUDFLARE_API_TOKEN_3: 'tok-3', CLOUDFLARE_ACCOUNT_ID_3: '', CLOUDFLARE_API_TOKEN_4: 'tok-4', OTHER: 'kept' }
/** A probe that answers only for the given tokens and records what it was asked. */
const probeAnswering = (...working: string[]) => {
  const seen: Probe[] = []
  const probe = async (pair: Probe) => { seen.push(pair); return working.includes(pair.CLOUDFLARE_API_TOKEN) ? { ok: true, line: 'answered' } : { ok: false, line: 'Cannot use the access token from location: 203.0.113.7' } }
  return { probe, seen }
}

describe('Cloud Run Cloudflare pair', () => {
  it('keeps the primary when it answers, even if later pairs answer too', async () => {
    const { chosen } = await pickCloudflarePair(env, probeAnswering('tok-1', 'tok-2').probe)
    expect(chosen.name).toBe('CLOUDFLARE_API_TOKEN')
  })
  it('falls through primary and _2 to _3, resolving an empty account ID from the token', async () => {
    const { probe, seen } = probeAnswering('tok-3', 'tok-4')
    const { chosen, lines } = await pickCloudflarePair(env, probe)
    expect(chosen.name).toBe('CLOUDFLARE_API_TOKEN_3')
    expect(seen.find(pair => pair.CLOUDFLARE_API_TOKEN === 'tok-3')).toEqual({ CLOUDFLARE_API_TOKEN: 'tok-3' })
    expect(lines.map((line: string) => line.split(' · ')[0])).toEqual(['CLOUDFLARE_API_TOKEN: FAILED', 'CLOUDFLARE_API_TOKEN_2: FAILED', 'CLOUDFLARE_API_TOKEN_3: ok', 'CLOUDFLARE_API_TOKEN_4: ok'])
    expect(lines.join('\n')).not.toMatch(/tok-/)
    const child = withCloudflarePair(env, chosen)
    expect(child).toEqual({ CLOUDFLARE_API_TOKEN: 'tok-3', OTHER: 'kept' })
  })
  it('keeps the primary pair for the app when nothing answers, so search falls back to keyword only (labelled)', async () => {
    const { chosen } = await pickCloudflarePair(env, probeAnswering().probe)
    expect(chosen).toBeUndefined()
    expect(withCloudflarePair(env, chosen)).toEqual({ CLOUDFLARE_API_TOKEN: 'tok-1', CLOUDFLARE_ACCOUNT_ID: 'acct-1', OTHER: 'kept' })
  })
})
