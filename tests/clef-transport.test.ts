// #195: Clef resilience on stage, with a mock transport only (no network).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClefDecisionProvider, ClefUnavailableError, clefTimeoutMs, cloudflareErrorCodes, isDailyQuotaExhausted } from '../server/agents/clef.js'

const roundResponse = { success: true, result: { answers: { gap_material: { type: 'noul', noul: 0.8 } } } }
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init })
const quotaBody = { success: false, errors: [{ code: 4006, message: 'AiError: Daily free allocation of 10000 neurons exhausted' }], messages: [], result: null }
const judge = (provider: ClefDecisionProvider) => provider.judgeRound({ question: 'q', conclusion: 'c', gap: 'g' })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('Clef transport resilience (#195)', () => {
  it('(a) a rejected account lookup is not cached: the next call rediscovers and reaches the model', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '')
    let lookups = 0
    const transport = vi.fn<typeof fetch>(async url => {
      if (String(url).endsWith('/accounts')) return ++lookups === 1 ? new Response('', { status: 403 }) : json({ success: true, result: [{ id: 'acct' }] })
      return json(roundResponse)
    })
    const provider = new ClefDecisionProvider({ token: 'mock', fetch: transport })
    await expect(provider.resolveAccount()).rejects.toBeInstanceOf(ClefUnavailableError)
    expect(await judge(provider)).toEqual({ gapMaterial: 0.8 })
    expect(lookups).toBe(2)
    expect(String(transport.mock.calls.at(-1)?.[0])).toContain('/accounts/acct/ai/run/')
    // A successful lookup stays cached for parallel and later calls.
    await judge(provider)
    expect(lookups).toBe(2)
  })
  it('(b) a 429 with Cloudflare code 4006 (daily quota) makes one request, never sleeps, and fails at once', async () => {
    vi.useFakeTimers()
    const transport = vi.fn<typeof fetch>(async () => json(quotaBody, { status: 429, headers: { 'Retry-After': '60' } }))
    const provider = new ClefDecisionProvider({ token: 'mock', accountId: 'acct', fetch: transport })
    const error = await judge(provider).then(() => undefined, (e: unknown) => e)
    expect(error).toBeInstanceOf(ClefUnavailableError)
    expect(error).toMatchObject({ status: 'daily quota' })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('(c) any other 429 pauses at most ~2 s even with Retry-After: 60', async () => {
    vi.useFakeTimers()
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ success: false, errors: [{ code: 3040, message: 'capacity' }] }, { status: 429, headers: { 'Retry-After': '60' } })).mockResolvedValueOnce(json(roundResponse))
    const result = judge(new ClefDecisionProvider({ token: 'mock', accountId: 'acct', fetch: transport }))
    await vi.advanceTimersByTimeAsync(1999)
    expect(transport).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(transport).toHaveBeenCalledTimes(2)
    expect(await result).toEqual({ gapMaterial: 0.8 })
  })
  it('(d) honours CLEF_TIMEOUT_MS per attempt, two attempts, and an explicit timeoutMs option', async () => {
    vi.useFakeTimers()
    vi.stubEnv('CLEF_TIMEOUT_MS', '1500')
    const transport = vi.fn<typeof fetch>(() => new Promise(() => {}))
    const failed = expect(judge(new ClefDecisionProvider({ token: 'mock', accountId: 'acct', fetch: transport }))).rejects.toMatchObject({ status: 'timeout' })
    await vi.advanceTimersByTimeAsync(1499)
    expect(transport).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(transport).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1500)
    await failed
    const explicit = vi.fn<typeof fetch>(() => new Promise(() => {}))
    const fast = expect(judge(new ClefDecisionProvider({ token: 'mock', accountId: 'acct', fetch: explicit, timeoutMs: 100 }))).rejects.toMatchObject({ status: 'timeout' })
    await vi.advanceTimersByTimeAsync(200)
    await fast
  })
  it('defaults the live timeout to 5 s and ignores unusable values', () => {
    expect(clefTimeoutMs(undefined)).toBe(5000)
    expect(clefTimeoutMs('')).toBe(5000)
    expect(clefTimeoutMs('abc')).toBe(5000)
    expect(clefTimeoutMs('0')).toBe(5000)
    expect(clefTimeoutMs('2500')).toBe(2500)
  })
  it('reads Cloudflare error codes from a JSON string or object, and only a 429 with 4006 is the daily quota', () => {
    expect(cloudflareErrorCodes(JSON.stringify(quotaBody))).toEqual([4006])
    expect(cloudflareErrorCodes(quotaBody)).toEqual([4006])
    expect(cloudflareErrorCodes('not json')).toEqual([])
    expect(cloudflareErrorCodes({ errors: 'nope' })).toEqual([])
    expect(isDailyQuotaExhausted(429, quotaBody)).toBe(true)
    expect(isDailyQuotaExhausted(500, quotaBody)).toBe(false)
    expect(isDailyQuotaExhausted(429, { errors: [{ code: 3040 }] })).toBe(false)
  })
})
