// Story-bible UC1–UC3 (D16, #157) end to end: separate API and publisher processes, the v2 writer
// corpus, fixture LLM/Clef/scope, the SIMULATED rail and ephemeral ports. Expectations come from
// data/corpus/v2/story-bible.json (tests/scenarios/use-cases.ts). Every gate assertion the earlier
// SC-* scenarios carried is kept here, ported to the v2 corpus (D18).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertNoLeaks, canary, INJECTION, OVER_CAP, scenarioCorpus, startScenario, type Observation } from './harness.js'
import { USE_CASES } from './use-cases.js'
import type { RunSnapshot } from '../../shared/contracts/index.js'

type Harness = Awaited<ReturnType<typeof startScenario>>
const UC2 = USE_CASES.UC2, UC3 = USE_CASES.UC3
const verdicts = (run: RunSnapshot, round = 1) => Object.fromEntries(run.decisions.find(d => d.round === round)!.rows.map(r => [r.candidate.resourceId, r.verdict]))
const cited = (run: RunSnapshot) => run.answers.flatMap(a => a.claims.flatMap(c => c.citations.map(ref => ref.resourceId)))
const bought = (run: RunSnapshot) => run.intents.map(i => `${i.resourceId}:${i.status}`)

/** Invariants every finished scenario run must hold (gates 2–5). */
function verify(run: RunSnapshot) {
  expect(run.phase).toBe('DONE')
  expect(run.error).toBeUndefined()
  expect(run.answers.length).toBeGreaterThan(0)
  expect(run.spentMinor + run.reservedMinor).toBeLessThanOrEqual(run.budgetMinor)
  expect(run.reservedMinor).toBe(0)
  expect(run.labels.settlement).toBe('SIMULATED SGD · no real funds')
  expect(run.labels.publisher).toBe('local')
  expect(run.labels.research).toContain('fixture')
  expect(run.labels.search).toBe('keyword only (embeddings unavailable)')
  expect(new Set(run.receipts.map(r => r.intentId)).size).toBe(run.receipts.length)
  expect(new Set(run.intents.map(i => i.intentId)).size).toBe(run.intents.length)
  for (const intent of run.intents) expect(intent.amountMinor).toBeLessThanOrEqual(run.perSourceCapMinor)
  for (const answer of run.answers) {
    expect(answer.claims.length).toBeGreaterThan(0)
    for (const claim of answer.claims) {
      expect(claim.citations.length).toBeGreaterThan(0)
      for (const ref of claim.citations) {
        const content = run.contents.find(c => c.resourceId === ref.resourceId && c.version === ref.version)
        const span = content?.spans.find(s => s.id === ref.spanId)
        expect(span).toBeDefined()
        expect(content!.body).toContain(span!.text)
        const candidate = run.candidates.find(c => c.resourceId === ref.resourceId && c.version === ref.version)!
        if (candidate.tier === 'PAID') {
          // Gate 4: a paid citation needs a VERIFIED purchase in this run; a quarantined source is never cited.
          expect(answer.version).toBeGreaterThan(1)
          expect(run.intents.some(i => i.resourceId === ref.resourceId && i.version === ref.version && i.status === 'VERIFIED')).toBe(true)
          expect(run.grants.some(g => g.runId === run.runId && g.resourceId === ref.resourceId && g.version === ref.version)).toBe(true)
        }
      }
    }
  }
}
/** UC2's expected run: one clarify answer, NotFT bought once, the digest skipped as a rewrite, the decoy over cap. */
function uc2Bought(run: RunSnapshot) {
  verify(run)
  expect(bought(run)).toEqual([`${UC2.expected.round1}:VERIFIED`])
  expect(run.spentMinor).toBe(run.intents[0].amountMinor)
  expect(run.grants).toHaveLength(1)
  expect(run.receipts).toHaveLength(1)
  expect(run.answers.map(a => a.version)).toEqual([1, 2])
  expect(run.answers[0].openGaps[0].text).toMatch(/pricing and margins/)
  expect(cited(run)).toContain(UC2.expected.round1)
  expect(run.impact?.classification).toMatch(/^(QUALIFIES|STRENGTHENS)$/)
  expect(verdicts(run)[UC2.expected.skippedRewrite]).toBe('SKIP_REWRITE')
  expect(verdicts(run)[OVER_CAP.articleId]).toBe('SKIP_OVER_CAP')
  expect(run.perSourceCapMinor).toBe(100)
  expect(run.events.find(e => e.type === 'CLARIFY')?.data).toEqual({ answers: UC2.answers })
}

describe('UC1–UC3 scenarios: separate API and publisher processes', () => {
  let h: Harness
  let uc2Baseline: RunSnapshot
  beforeAll(async () => { h = await startScenario() }, 30_000)
  afterAll(async () => { await h?.stop() })

  it('UC1: free sources suffice: a cited answer, no gap, S$0 spent despite S$2 authorised', async () => {
    const run = await h.until(await h.ask('UC1'))
    verify(run)
    expect(run.spentMinor).toBe(0)
    expect(run.intents).toEqual([])
    expect(run.grants).toEqual([])
    expect(run.answers).toHaveLength(1)
    expect(run.answers[0].openGaps).toEqual([])
    expect(verdicts(run)[USE_CASES.UC1.expected.skippedRewrite]).toBe('SKIP_REWRITE')
    expect(run.decisions[0].rows.every(r => r.verdict === 'SKIP_NO_GAP' || r.verdict === 'SKIP_REWRITE')).toBe(true)
    assertNoLeaks(h.observations, h.corpus)
  }, 30_000)

  it('UC2: one clarifying question; the chosen angle buys NotFT once, the rewrite and the over-cap decoy are rejected', async () => {
    const scope = await h.scope('UC2')
    expect(scope.questions).toHaveLength(1)
    expect(scope.questions[0]).toMatchObject({ text: UC2.clarify!.text, options: UC2.clarify!.options })
    const run = await h.until(await h.ask('UC2'))
    uc2Bought(run)
    expect(run.events.some(e => e.type === 'READ_PAID')).toBe(true)
    expect(h.observations.some(o => o.kind === 'SSE')).toBe(true)
    assertNoLeaks(h.observations, h.corpus)
    uc2Baseline = run
  }, 30_000)

  it('S$0: spends nothing but marks the expected article as would-buy', async () => {
    const run = await h.until(await h.ask('UC2', 0))
    verify(run)
    expect(run).toMatchObject({ spentMinor: 0, intents: [], receipts: [], grants: [] })
    expect(run.answers).toHaveLength(1)
    expect(run.decisions[0].rows.find(r => r.candidate.resourceId === UC2.expected.round1)).toMatchObject({ wouldBuy: true, verdict: 'SKIP_OVER_BUDGET' })
    expect(run.events.some(e => ['BUY', 'READ_PAID'].includes(e.type))).toBe(false)
    assertNoLeaks(h.observations, h.corpus)
  }, 30_000)

  it('an instruction in a free article changes no verdict, purchase, budget or cap', async () => {
    const injected = await startScenario({ injection: true })
    try {
      const run = await injected.until(await injected.ask('UC2'))
      uc2Bought(run)
      expect(injected.corpus.articles.find(a => a.articleId === INJECTION.articleId)!.body).toContain(INJECTION.text)
      const decisions = (r: RunSnapshot) => r.decisions.map(d => ({ selected: d.selectedResourceId, rows: d.rows.map(row => ({ id: row.candidate.resourceId, verdict: row.verdict, judgment: row.judgment, value: row.value })).sort((a, b) => a.id.localeCompare(b.id)) }))
      expect(decisions(run)).toEqual(decisions(uc2Baseline))
      expect(run).toMatchObject({ spentMinor: uc2Baseline.spentMinor, budgetMinor: uc2Baseline.budgetMinor, perSourceCapMinor: uc2Baseline.perSourceCapMinor })
      expect(run.impact?.classification).toBe(uc2Baseline.impact?.classification)
      expect(run.answers.flatMap(a => a.claims).some(c => c.text.includes(INJECTION.text))).toBe(false)
      assertNoLeaks(injected.observations, injected.corpus)
    } finally { await injected.stop() }
  }, 30_000)
})

describe('UC3: a bad actor is caught, refunded and quarantined', () => {
  let h: Harness
  beforeAll(async () => { h = await startScenario() }, 30_000)
  afterAll(async () => { await h?.stop() })

  it('AlphaLeak is bought → CLAIM_FAILED → REFUNDED once → H 0.80→0.40 quarantined → round 2 buys The Fab Floor; a re-ask shows SKIP_LOW_TRUST', async () => {
    const { round1, round2, refund } = UC3.expected
    const run = await h.until(await h.ask('UC3'))
    verify(run)
    expect(run.decisions[0].selectedResourceId).toBe(round1)
    expect(bought(run)).toEqual([`${round1}:REFUNDED`, `${round2}:VERIFIED`])
    expect(run.events.filter(e => e.type === 'REFUND')).toHaveLength(1)
    expect(run.events.find(e => e.type === 'PROOF' && e.data?.ok === false)).toBeDefined()
    expect(run.refundedMinor).toBe(run.intents[0].amountMinor)
    expect(run.spentMinor).toBe(run.intents[0].amountMinor + run.intents[1].amountMinor)
    expect(verdicts(run, 2)[round1!]).toBe('SKIP_LOW_TRUST')
    expect(cited(run)).not.toContain(round1)
    expect(cited(run)).toContain(round2)
    const reputation = await (await fetch(`${h.base}/api/reputation`)).json() as { publishers: { publisherSlug: string; H: number; refunds: number; status: string }[] }
    expect(reputation.publishers.find(p => p.publisherSlug === 'alphaleak')).toMatchObject({ H: refund!.honestyAfter, refunds: 1, status: refund!.status })
    expect(refund!.honestyBefore).toBe(0.8)

    const again = await h.until(await h.ask('UC3'))
    verify(again)
    expect(verdicts(again)[round1!]).toBe('SKIP_LOW_TRUST')
    expect(bought(again)).toEqual([`${round2}:VERIFIED`])
    assertNoLeaks(h.observations, h.corpus)
  }, 30_000)
})

describe('leak gate and Stop: audited Clef and LLM requests', () => {
  let h: Harness
  beforeAll(async () => { h = await startScenario({ audited: true }) }, 30_000)
  afterAll(async () => { await h?.stop() })
  const requests = (filter: (a: { runId: string }) => boolean = () => true): Observation[] => h.audits().filter(filter).map(a => ({ kind: a.kind, raw: JSON.stringify(a.body), grants: a.grants, runId: a.runId }))

  it('every API/SSE snapshot, Clef and LLM request respects run/version grants', async () => {
    const run = await h.until(await h.ask('UC2'))
    uc2Bought(run)
    expect(run.decisions.every(d => d.provider === 'cloudflare' && !d.fallbackReason)).toBe(true)
    const audits = h.audits()
    // One plan request (the server plans; no client plan) plus two answer generations.
    const isAnswer = (a: { body: unknown }) => JSON.stringify(a.body).includes('Write a cited answer')
    expect(audits.filter(a => a.kind === 'groq')).toHaveLength(3)
    expect(audits.filter(a => a.kind === 'groq' && isAnswer(a))).toHaveLength(2)
    expect(audits.filter(a => a.kind === 'groq' && !isAnswer(a)).every(a => JSON.stringify(a.body).includes('You plan a search'))).toBe(true)
    expect(audits.filter(a => a.kind === 'clef').length).toBeGreaterThanOrEqual(5)
    expect(audits.some(a => a.kind === 'clef' && a.grants.length === 0)).toBe(true)
    expect(audits.some(a => a.kind === 'groq' && a.grants.length === 1)).toBe(true)
    assertNoLeaks([...h.observations, ...requests()], h.corpus)
    // Clef may see a granted answer, but candidate metadata never carries private fields.
    for (const a of audits.filter(a => a.kind === 'clef')) {
      const state = (a.body as { state: { candidate?: object; readSources?: object[] } }).state
      for (const value of [state.candidate, ...state.readSources ?? []].filter(Boolean)) {
        expect(value).not.toHaveProperty('body')
        expect(value).not.toHaveProperty('spans')
        expect(value).not.toHaveProperty('passages')
      }
    }
    const paid = h.corpus.articles.find(a => a.articleId === UC2.expected.round1)!
    const unique = paid.passages.map(p => p.text).find(text => !h.corpus.articles.some(o => o !== paid && o.body.includes(text)))!
    const answers = audits.filter(a => a.kind === 'groq' && isAnswer(a)).map(a => JSON.stringify(a.body))
    expect(answers[0]).not.toContain(unique)
    expect(answers[1]).toContain(unique)
    expect(run.contents.some(c => c.resourceId === paid.articleId)).toBe(true)
    // Logs have no legitimate reason to print premium evidence, even after a grant.
    assertNoLeaks([{ kind: 'process logs', raw: h.logs.join(''), grants: [] }], h.corpus)
    // S$0 in the same processes: another run's grant cannot authorise its requests.
    const zero = await h.until(await h.ask('UC2', 0))
    verify(zero)
    expect(zero.grants).toEqual([])
    const zeroRequests = requests(a => a.runId === zero.runId)
    expect(zeroRequests.some(a => a.kind === 'groq')).toBe(true)
    assertNoLeaks([...h.observations, ...zeroRequests], h.corpus)
  }, 30_000)

  it('Stop during scoring prevents any purchase and preserves the free answer', async () => {
    const id = await h.ask('UC2')
    await h.until(id, run => run.phase === 'DECIDE')
    const stopped = await h.request(`/runs/${id}/stop`, {})
    expect(stopped.phase).toBe('STOPPED')
    // A persisted decision proves scoring finished; a Stop response alone could miss a late purchase.
    const final = await h.until(id, run => run.decisions.length > 0)
    expect(final.stopped).toBe(true)
    expect(final.answers).toHaveLength(1)
    expect(final).toMatchObject({ intents: [], spentMinor: 0, reservedMinor: 0, grants: [] })
    assertNoLeaks(h.observations, h.corpus)
  }, 30_000)
})

// Poisoned observations prove the oracle rejects real leaks; passing runs alone cannot show that.
describe('premium leak oracle', () => {
  let corpus: Awaited<ReturnType<typeof scenarioCorpus>>
  beforeAll(async () => { corpus = await scenarioCorpus() })
  it('gate-1: rejects raw and JSON-escaped canaries and unique paid passages without a grant', () => {
    for (const article of corpus.articles.filter(a => a.tier === 'PAID')) {
      expect(() => assertNoLeaks([{ kind: 'poisoned', runId: 'run-a', raw: JSON.stringify({ leaked: canary(article.articleId) }), grants: [] }], corpus)).toThrow(`leaked ${article.articleId}`)
    }
    const paid = corpus.articles.find(a => a.articleId === UC2.expected.round1)!
    expect(() => assertNoLeaks([{ kind: 'poisoned', runId: 'run-a', raw: JSON.stringify(paid.passages[0].text), grants: [] }], corpus)).toThrow(`leaked ${paid.articleId}`)
  })
  it('requires the grant to match the observation run, article and version', () => {
    const paid = corpus.articles.find(a => a.articleId === UC2.expected.round1)!
    const grant = { runId: 'run-a', resourceId: paid.articleId, version: paid.version, intentId: 'i', contentDigest: 'd', grantedAt: new Date().toISOString() }
    const observation: Observation = { kind: 'granted', runId: 'run-a', raw: canary(paid.articleId), grants: [grant] }
    expect(() => assertNoLeaks([observation], corpus)).not.toThrow()
    for (const change of [{ runId: 'run-b' }, { resourceId: UC3.expected.round2! }, { version: 'not-this-version' }]) {
      expect(() => assertNoLeaks([{ ...observation, grants: [{ ...grant, ...change }] }], corpus)).toThrow(`leaked ${paid.articleId}`)
    }
  })
  it('catches a short paid passage and a partial (8-word) leak of a long one', () => {
    const paid = corpus.articles.find(a => a.articleId === UC2.expected.round1)!
    const long = paid.passages.find(p => p.text.split(/\s+/).length > 12)!.text
    const partial = long.split(/\s+/).slice(2, 11).join(' ')
    expect(() => assertNoLeaks([{ kind: 'partial', runId: 'run-a', raw: JSON.stringify({ x: partial }), grants: [] }], corpus)).toThrow(`leaked ${paid.articleId}`)
    const shortCorpus = { ...corpus, articles: corpus.articles.map(a => a === paid ? { ...a, passages: [...a.passages, { id: 'p-short', text: 'Margin guidance: 51.7% (private).' }] } : a) }
    expect(() => assertNoLeaks([{ kind: 'short', runId: 'run-a', raw: 'Margin guidance: 51.7% (private).', grants: [] }], shortCorpus)).toThrow(`leaked ${paid.articleId}`)
  })
  it('allows text a free article publishes too', () => {
    const free = corpus.articles.find(a => a.tier === 'FREE')!
    expect(() => assertNoLeaks([{ kind: 'free evidence', raw: free.body, grants: [] }], corpus)).not.toThrow()
  })
})
