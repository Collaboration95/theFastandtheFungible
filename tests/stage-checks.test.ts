// #196: the `make preflight` parsers, with fixtures only (no network, no store).
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, no declarations
import { applyBackupPair, backupPairCheck, decisionRoundCheck, errorCodes, isDailyQuota, QUOTA_LINE, reputationCheck, unfinishedRunsCheck } from '../scripts/stage-checks.mjs'

const prior = { publisherSlug: 'notft', wallet: 'rA', r: 0, s: 0, passes: 0, fails: 0, refunds: 0, refusals: 0, brierSum: 0, n: 0, H: 0.8, C: 1, T: 0.8, status: 'active', updatedAt: '2026-10-08T00:00:00.000Z' }
const quotaBody = JSON.stringify({ success: false, errors: [{ code: 4006, message: 'AiError: Daily free allocation of 10000 neurons exhausted' }] })

describe('preflight: reputation', () => {
  it('passes with no records or only records at the prior', () => {
    expect(reputationCheck([])).toMatchObject({ ok: true })
    expect(reputationCheck([prior])).toMatchObject({ ok: true, line: 'reputation clean (1 at prior)' })
  })
  it('fails on a quarantined or delisted publisher left over from a rehearsal', () => {
    const quarantined = { ...prior, publisherSlug: 'alphaleak', s: 5, fails: 1, refunds: 1, H: 0.4, T: 0.4, status: 'quarantined' }
    const delisted = { ...prior, publisherSlug: 'kopi', refusals: 1, status: 'delisted' }
    const result = reputationCheck([prior, quarantined, delisted])
    expect(result.ok).toBe(false)
    expect(result.line).toContain('alphaleak quarantined')
    expect(result.line).toContain('kopi delisted')
  })
  it('fails when an active publisher has moved off the prior', () => {
    expect(reputationCheck([{ ...prior, r: 1, passes: 1, H: 0.83 }])).toMatchObject({ ok: false })
    expect(reputationCheck([{ ...prior, n: 1, brierSum: 0.2, C: 0.8 }]).line).toContain('notft')
  })
})

describe('preflight: runs', () => {
  it('counts unfinished runs and passes when every run is terminal', () => {
    expect(unfinishedRunsCheck([{ runId: 'a', phase: 'DONE' }, { runId: 'b', phase: 'FAILED' }, { runId: 'c', phase: 'STOPPED' }])).toMatchObject({ ok: true, line: 'no unfinished runs (3 in the store)' })
    const open = unfinishedRunsCheck([{ runId: 'abcdef123456', phase: 'DECIDE' }, { runId: 'b', phase: 'DONE' }])
    expect(open.ok).toBe(false)
    expect(open.line).toContain('1 unfinished run(s)')
    expect(open.line).toContain('abcdef12 DECIDE')
  })
})

describe('preflight: quota and the decision round', () => {
  it('recognises the daily quota only on a 429 with code 4006', () => {
    expect(errorCodes(quotaBody)).toEqual([4006])
    expect(errorCodes('<html>')).toEqual([])
    expect(isDailyQuota(429, quotaBody)).toBe(true)
    expect(isDailyQuota(429, JSON.stringify({ errors: [{ code: 3040 }] }))).toBe(false)
    expect(isDailyQuota(500, quotaBody)).toBe(false)
  })
  it('reports the slowest call, failures, and the quota in plain words', () => {
    const fine = Array.from({ length: 9 }, (_, i) => ({ ms: 400 + i * 100 }))
    expect(decisionRoundCheck(fine, 5000)).toEqual({ ok: true, line: 'decision round: 9 parallel calls answered; slowest 1200 ms (timeout 5000 ms)' })
    const slow = [...fine.slice(1), { ms: 10012, error: { status: 'timeout' } }]
    expect(decisionRoundCheck(slow, 5000)).toMatchObject({ ok: false, line: 'decision round: 1/9 calls failed (timeout); slowest 10012 ms at a 5000 ms timeout' })
    const quota = [{ ms: 90, error: { status: 'daily quota' } }, ...fine.slice(1)]
    expect(decisionRoundCheck(quota, 5000).line).toContain(QUOTA_LINE)
    expect(QUOTA_LINE).toBe('daily free quota exhausted (resets 00:00 UTC = 08:00 SGT)')
  })
})

describe('preflight: backup pair', () => {
  it('reports a missing pair, the quota, a failure and a pass', () => {
    expect(backupPairCheck({ missing: 'CLOUDFLARE_API_TOKEN_2' })).toMatchObject({ ok: false, line: 'backup pair: CLOUDFLARE_API_TOKEN_2 not set' })
    expect(backupPairCheck({ status: 429, body: quotaBody, error: 'error' }).line).toContain(QUOTA_LINE)
    expect(backupPairCheck({ status: 401, body: '', error: 'error' })).toMatchObject({ ok: false, line: 'backup pair: embedding call failed (HTTP 401)' })
    expect(backupPairCheck({ ms: 321 })).toEqual({ ok: true, line: 'backup pair answered one embedding in 321 ms' })
  })
  it('CF_BACKUP maps the _2 pair onto the primary variables and returns names, never values', () => {
    const env: Record<string, string> = { CLOUDFLARE_API_TOKEN: 'primary-token', CLOUDFLARE_ACCOUNT_ID: 'primary-acct', CLOUDFLARE_API_TOKEN_2: 'backup-token', CLOUDFLARE_ACCOUNT_ID_2: 'backup-acct' }
    const names = applyBackupPair(env)
    expect(names).toEqual(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'])
    expect(JSON.stringify(names)).not.toContain('backup-')
    expect(env).toMatchObject({ CLOUDFLARE_API_TOKEN: 'backup-token', CLOUDFLARE_ACCOUNT_ID: 'backup-acct' })
  })
  it('CF_BACKUP refuses a half-set pair without touching the primary variables or printing values', () => {
    const env: Record<string, string> = { CLOUDFLARE_API_TOKEN: 'primary-token', CLOUDFLARE_API_TOKEN_2: 'backup-token' }
    expect(() => applyBackupPair(env)).toThrow('CF_BACKUP=1 needs CLOUDFLARE_ACCOUNT_ID_2 in .env')
    expect(env.CLOUDFLARE_API_TOKEN).toBe('primary-token')
  })
})
