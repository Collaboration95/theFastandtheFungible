// Workers AI start-up probe (owner, 9 Oct): fixtures only, no network.
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, no declarations
import { IP_HINT, probeWorkersAi } from '../scripts/cf-probe.mjs'

const env = { CLOUDFLARE_API_TOKEN: 'test-only', CLOUDFLARE_ACCOUNT_ID: 'acct' }
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
/** A fake Cloudflare: `embed` answers the Workers AI call, `record` answers the token-record lookup. */
const cloudflare = (embed: Response, record: unknown = { success: true, result: {} }) => {
  const paths: string[] = []
  const call = async (url: string) => {
    const path = url.replace('https://api.cloudflare.com/client/v4', '')
    paths.push(path)
    if (path.includes('/ai/run/')) return embed.clone()
    if (path.endsWith('/tokens/verify')) return reply(200, { success: true, result: { id: 'tok1', status: 'active' } })
    if (path.endsWith('/tokens/tok1')) return reply(200, record)
    return reply(404, {})
  }
  return { call, paths }
}

describe('Workers AI probe', () => {
  it('passes when one embedding comes back, without reading the token record', async () => {
    const { call, paths } = cloudflare(reply(200, { result: { data: [[0.1]] } }))
    expect(await probeWorkersAi(env, call)).toMatchObject({ ok: true, line: expect.stringMatching(/^Workers AI embedding answered in \d+ ms$/) })
    expect(paths).toEqual(['/accounts/acct/ai/run/@cf/baai/bge-base-en-v1.5'])
  })
  it('an IP-filtered token fails with Cloudflare\'s own location message and the fix', async () => {
    const message = 'Cannot use the access token from location: 203.0.113.7'
    const { call } = cloudflare(reply(401, { errors: [{ code: 10000, message: 'Authentication error' }] }), { success: false, errors: [{ code: 9109, message }] })
    expect(await probeWorkersAi(env, call)).toEqual({ ok: false, line: message, hint: IP_HINT })
  })
  it('the daily quota and other refusals fail with their reason', async () => {
    const quota = cloudflare(reply(429, { errors: [{ code: 4006, message: 'Daily free allocation exhausted' }] }))
    expect(await probeWorkersAi(env, quota.call)).toMatchObject({ ok: false, line: expect.stringContaining('daily free quota exhausted'), hint: expect.stringContaining('CF_BACKUP=1') })
    const other = cloudflare(reply(401, { errors: [{ code: 10000, message: 'Authentication error' }] }))
    expect(await probeWorkersAi(env, other.call)).toEqual({ ok: false, line: 'Workers AI embedding failed (HTTP 401: Authentication error)' })
  })
  it('no token and a network error fail without throwing', async () => {
    expect(await probeWorkersAi({}, async () => { throw new Error('unused') })).toEqual({ ok: false, line: 'CLOUDFLARE_API_TOKEN not set' })
    expect(await probeWorkersAi(env, async () => { throw new TypeError('fetch failed') })).toEqual({ ok: false, line: 'Workers AI did not answer (fetch failed)' })
  })
})
