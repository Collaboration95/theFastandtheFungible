import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, no declarations
import { alphaLeakQuarantined, checkRun, countCalls, coverageCounts, detectFallbacks, parseArgs, REPEAT_SKIPPED, summarise, UC4_FREE } from '../scripts/live-smoke.mjs'

const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8'))
const uc = (id: string) => bible.useCases.find((u: { id: string }) => u.id === id)
const labels = { research: 'DeepSeek · deepseek-flash', decision: 'Cloudflare · clef', plan: 'DeepSeek · deepseek-flash', settlement: 'XRPL TESTNET · no real value', search: 'hybrid' }
const intent = (resourceId: string, status = 'VERIFIED', extra = {}) => ({ resourceId, status, txHash: `TX${resourceId}`, amountMinor: 30, ...extra })
const cov = (version: number, statuses: string[]) => ({ answerVersion: version, judge: 'OpenAI Decisions · gpt-6-luna', entries: statuses.map((status, i) => ({ requirementId: `r${i + 1}`, status })) })
const run = (over = {}) => ({ runId: 'r', phase: 'DONE', labels, spentMinor: 0, answers: [{ provider: 'deepseek', version: 1 }], decisions: [{ round: 1, provider: 'cloudflare', rows: [] }], intents: [], events: [], ...over })

describe('live smoke pure parts (#158), fake snapshots, no network', () => {
  it('parses flags and refuses the main demo ports', () => {
    expect(parseArgs([], {})).toMatchObject({ only: null, probe: false, offset: 300 })
    expect(parseArgs(['--only', 'UC2'], { DEMO_PORT_OFFSET: '100' })).toMatchObject({ only: 'UC2', offset: 100 })
    expect(parseArgs(['--only', 'UC4'], {}).only).toBe('UC4')
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
  it('accepts the configured decision provider label only (DECISION_PROVIDER openai or cloudflare)', () => {
    const openai = run({ labels: { ...labels, decision: 'OpenAI Decisions · gpt-6-luna' }, decisions: [{ round: 1, provider: 'openai', rows: [] }] })
    expect(detectFallbacks(openai, 'DeepSeek', 'openai')).toEqual([])
    expect(checkRun('UC1', openai, bible, 'DeepSeek', 'openai')).toEqual([])
    // A mismatch with the configured provider fails, label and rounds alike.
    expect(detectFallbacks(openai, 'DeepSeek', 'cloudflare')).toEqual(['decision label: OpenAI Decisions · gpt-6-luna (DECISION_PROVIDER=cloudflare expects "Cloudflare · …")', 'decision round 1 by openai, configured cloudflare'])
    expect(detectFallbacks(run(), 'DeepSeek', 'openai').join()).toMatch(/decision label: Cloudflare · clef .*openai/)
    // A fixture label fails whichever provider is configured.
    for (const provider of ['openai', 'cloudflare']) expect(detectFallbacks(run({ labels: { ...labels, decision: 'fixture · metadata-fixture' } }), 'DeepSeek', provider).join()).toMatch(/decision label: fixture/)
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
  it('UC2 must buy the bible article, and its requested facts go from open (v1) to all answered after the purchase (#208)', () => {
    const pick = uc('UC2').expectedPicks.round1
    const progressed = { checkpoint: { coverage: [cov(2, ['supported', 'supported']), cov(1, ['supported', 'missing'])] } }
    expect(checkRun('UC2', run({ spentMinor: 90, intents: [intent(pick)], ...progressed }), bible, 'DeepSeek')).toEqual([])
    expect(checkRun('UC2', run({ intents: [intent('other')], ...progressed }), bible, 'DeepSeek')[0]).toMatch(/must buy/)
    expect(checkRun('UC2', run({ spentMinor: 90, intents: [intent(pick)] }), bible, 'DeepSeek')).toEqual(['UC2 recorded no requested-facts coverage'])
    expect(checkRun('UC2', run({ spentMinor: 90, intents: [intent(pick)], checkpoint: { coverage: [cov(1, ['supported', 'supported'])] } }), bible, 'DeepSeek').join()).toMatch(/v1 must leave a requested fact open/)
    expect(checkRun('UC2', run({ spentMinor: 90, intents: [intent(pick)], checkpoint: { coverage: [cov(1, ['supported', 'missing']), cov(2, ['supported', 'partial'])] } }), bible, 'DeepSeek').join()).toMatch(/1 of 2 \(v2\)/)
    expect(coverageCounts(run(progressed))).toEqual([{ version: 1, answered: 1, total: 2 }, { version: 2, answered: 2, total: 2 }])
  })
  it('UC4: nothing bought, every requested fact answered, the follow-up read the free article, the deep-dive not bought (#211)', () => {
    const deepDive = uc('UC4').expectedPicks.wouldHaveBought
    const good = run({ answers: [{ provider: 'deepseek', version: 1 }, { provider: 'deepseek', version: 2 }], contents: [{ resourceId: UC4_FREE }], events: [{ type: 'FOLLOW_UP' }, { type: 'FOLLOW_UP' }],
      checkpoint: { stopReason: 'complete', coverage: [cov(1, ['supported', 'supported', 'missing']), cov(2, ['supported', 'supported', 'supported'])], followUp: { requirementId: 'r3', query: 'q', status: 'done', added: [`${UC4_FREE}@v1`], freeRead: 3, helped: ['r3'], reanswered: true } } })
    expect(checkRun('UC4', good, bible, 'DeepSeek')).toEqual([])
    expect(summarise('UC4', good, {})).toMatchObject({ stopReason: 'complete', coverage: [{ version: 1, answered: 2, total: 3 }, { version: 2, answered: 3, total: 3 }] })
    const fails = checkRun('UC4', run({ spentMinor: 60, intents: [intent(deepDive)], checkpoint: { coverage: [cov(1, ['supported', 'supported', 'missing'])] } }), bible, 'DeepSeek')
    expect(fails).toEqual([`UC4 must spend S$0, spent 60 minor, bought [${deepDive}]`, `UC4 bought the paid deep-dive ${deepDive}`, 'UC4 must answer every requested fact, has 2 of 3', 'UC4 has no FOLLOW_UP event', `UC4's follow-up search must read ${UC4_FREE}, read []`])
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
  it('runs the UC3 re-ask only when UC3 refunded or quarantined AlphaLeak', () => {
    const { round1 } = uc('UC3').expectedPicks
    expect(alphaLeakQuarantined(run({ intents: [intent(round1, 'REFUNDED', { refund: { txHash: 'RF' } })] }), bible)).toBe(true)
    expect(alphaLeakQuarantined(run({ intents: [intent(round1, 'REFUNDED')] }), bible)).toBe(false)
    expect(alphaLeakQuarantined(run({ intents: [intent(round1)] }), bible, [{ slug: 'alphaleak', status: 'active' }])).toBe(false)
    expect(alphaLeakQuarantined(run(), bible, [{ slug: 'alphaleak', status: 'quarantined' }])).toBe(true)
    expect(REPEAT_SKIPPED).toBe('skipped: precondition not met (AlphaLeak not quarantined)')
  })
  it('counts estimated calls for the budget guard', () => {
    expect(countCalls(run({ decisions: [{ rows: [1, 2, 3] }, { rows: [1] }] }))).toEqual({ deepseek: 3, decision: 6 })
    // OpenAI Decisions: one batched request per round, split past 6 candidates.
    expect(countCalls(run({ decisions: [{ rows: [1, 2, 3] }, { rows: [] }, { rows: [1, 2, 3, 4, 5, 6, 7, 8] }] }), 'openai')).toEqual({ deepseek: 3, decision: 4 })
    // #208/#210: one coverage request per graded version plus one for the follow-up's free passages; an empty-gap round
    // and a requested fact's gap question make no call.
    expect(countCalls(run({ decisions: [{ gap: '', rows: [1, 2] }, { gap: 'fact', gapMaterialSource: 'requirement', rows: [1, 2] }], checkpoint: { coverage: [cov(1, ['missing']), cov(2, ['supported'])], followUp: { freeRead: 2 } } }))).toEqual({ deepseek: 3, decision: 5 })
  })
})
