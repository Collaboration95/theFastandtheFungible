import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, no declarations
import { checkRun, countCalls, detectFallbacks, parseArgs } from '../scripts/live-smoke.mjs'

const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8'))
const uc = (id: string) => bible.useCases.find((u: { id: string }) => u.id === id)
const labels = { research: 'DeepSeek · deepseek-flash', decision: 'Cloudflare · clef', plan: 'DeepSeek · deepseek-flash', settlement: 'XRPL TESTNET · no real value', search: 'hybrid' }
const intent = (resourceId: string, status = 'VERIFIED', extra = {}) => ({ resourceId, status, txHash: `TX${resourceId}`, amountMinor: 30, ...extra })
const run = (over = {}) => ({ runId: 'r', phase: 'DONE', labels, spentMinor: 0, answers: [{ provider: 'deepseek', version: 1 }], decisions: [{ round: 1, provider: 'cloudflare', rows: [] }], intents: [], events: [], ...over })

describe('live smoke pure parts (#158), fake snapshots, no network', () => {
  it('parses flags and refuses the main demo ports', () => {
    expect(parseArgs([], {})).toMatchObject({ only: null, probe: false, offset: 300 })
    expect(parseArgs(['--only', 'UC2'], { DEMO_PORT_OFFSET: '100' })).toMatchObject({ only: 'UC2', offset: 100 })
    expect(parseArgs(['--probe'], {}).probe).toBe(true)
    expect(() => parseArgs(['--only', 'UC9'], {})).toThrow()
    expect(() => parseArgs([], { DEMO_PORT_OFFSET: '0' })).toThrow(/main demo ports/)
    expect(() => parseArgs(['--probe', '--only', 'UC1'], {})).toThrow()
  })
  it('detects every kind of fixture fallback', () => {
    expect(detectFallbacks(run(), 'DeepSeek · deepseek-flash')).toEqual([])
    const bad = detectFallbacks(run({ labels: { ...labels, research: 'fixture · extractive-fixture', decision: 'fixture · metadata-fixture', search: 'keyword only (embeddings unavailable)', settlement: 'SIMULATED SGD · no real funds' }, answers: [{ provider: 'fixture', version: 1 }], decisions: [{ round: 1, provider: 'cloudflare', fallbackReason: 'x', rows: [] }] }), 'fixture · scope-fixture')
    expect(bad.length).toBe(7)
  })
  it('counts a failed live decision (DECISION_UNAVAILABLE, no fallback since #216) as not fully live', () => {
    const failed = run({ phase: 'FAILED', decisions: [], events: [{ type: 'DECISION_UNAVAILABLE', label: 'Decision provider timed out; nothing bought.', data: { status: 'timeout' } }] })
    expect(detectFallbacks(failed, 'DeepSeek · deepseek-flash')).toEqual(['decision unavailable: Decision provider timed out; nothing bought.'])
    const fails = checkRun('UC2', failed, bible, 'DeepSeek')
    expect(fails).toContain('decision unavailable: Decision provider timed out; nothing bought.')
    expect(fails).toContain('run ended FAILED')
  })
  it('UC1 must spend nothing', () => {
    expect(checkRun('UC1', run(), bible, 'DeepSeek')).toEqual([])
    expect(checkRun('UC1', run({ spentMinor: 90, intents: [intent('x')] }), bible, 'DeepSeek')[0]).toMatch(/S\$0/)
  })
  it('UC2 must buy the bible article', () => {
    const pick = uc('UC2').expectedPicks.round1
    expect(checkRun('UC2', run({ spentMinor: 90, intents: [intent(pick)] }), bible, 'DeepSeek')).toEqual([])
    expect(checkRun('UC2', run({ intents: [intent('other')] }), bible, 'DeepSeek')[0]).toMatch(/must buy/)
  })
  it('UC3 buys AlphaLeak first (refunded), then The Fab Floor; the re-ask skips it', () => {
    const { round1, round2 } = uc('UC3').expectedPicks
    const good = run({ intents: [intent(round1, 'REFUNDED', { refund: { txHash: 'RF', amountMinor: 30 } }), intent(round2)], events: [{ type: 'REFUND' }] })
    expect(checkRun('UC3', good, bible, 'DeepSeek')).toEqual([])
    const wrongOrder = run({ intents: [intent(round2), intent(round1, 'REFUNDED', { refund: { txHash: 'RF', amountMinor: 30 } })], events: [{ type: 'REFUND' }] })
    expect(checkRun('UC3', wrongOrder, bible, 'DeepSeek').join()).toMatch(/first/)
    expect(checkRun('UC3', run({ intents: [intent(round1), intent(round2)] }), bible, 'DeepSeek').join()).toMatch(/REFUNDED/)
    const row = { candidate: { publisherSlug: 'alphaleak' }, verdict: 'SKIP_LOW_TRUST' }
    expect(checkRun('UC3-repeat', run({ decisions: [{ round: 1, provider: 'cloudflare', rows: [row] }], intents: [intent(round2)] }), bible, 'DeepSeek')).toEqual([])
    expect(checkRun('UC3-repeat', run({ intents: [intent(round1)] }), bible, 'DeepSeek').length).toBe(2)
  })
  it('counts estimated calls for the budget guard', () => {
    expect(countCalls(run({ decisions: [{ rows: [1, 2, 3] }, { rows: [1] }] }))).toEqual({ deepseek: 3, clef: 6 })
  })
})
