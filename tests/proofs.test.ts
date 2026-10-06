import { afterEach, describe, expect, it } from 'vitest'
import { RunLoop } from '../server/agents/loop.js'
import { retrieve } from '../server/agents/research.js'
import type { DecisionProvider } from '../server/agents/decision.js'
import type { Answer, ContentEnvelope } from '../shared/contracts/index.js'
import { alphaLeakArticle, honestArticle, payPath, plant } from './fixtures/pay-path.js'
import { alphaLeakCorpus } from './fixtures/corpus-mini/index.js'
import type { Manifests } from '../publisher/manifest.js'
import type { TraceEvent } from '../shared/contracts/index.js'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const fn of cleanups.splice(0)) await fn() })
async function setup(options?: Parameters<typeof payPath>[0]) { const h = await payPath(options); cleanups.push(h.close); return h }
function loopFor(h: Awaited<ReturnType<typeof payPath>>) {
  const inputs: ContentEnvelope[][] = [], clefInputs: string[] = [], events: TraceEvent[] = []
  const provider: DecisionProvider = {
    name: 'fixture', model: 'pay-path-double',
    judgeRound: async () => ({ gapMaterial: 0.9 }),
    judgeCandidate: async input => { clefInputs.push(JSON.stringify(input)); return { addressesGap: input.candidate.profileId === 'alphaleak' ? 1 : 0, originality: { original: 0.9, rewrite: 0.05, overlap: 0.05 }, credibility: 1 } },
  }
  const loop = new RunLoop(h.store, h.client, h.manager, event => events.push(event), {
    provider, threshold: 0.01,
    // Real federated retrieval; only AlphaLeak's PAID hit goes to the decision.
    retrieve: async (client, question, plan) => { const r = await retrieve(client, question, plan); return { ...r, candidates: r.candidates.filter(c => c.tier === 'FREE' || c.profileId === 'alphaleak') } },
    writeAnswer: async input => { inputs.push(structuredClone(input.contents)); return { answer: answer(input.version) } },
  })
  return { loop, inputs, clefInputs, events }
}
const answer = (version: number, claims: Answer['claims'] = []): Answer => ({ conclusion: 'Lead times are unclear.', claims, openGaps: version === 1 ? [{ text: 'Dated Penang lead-time figures' }] : [], version, provider: 'fixture', model: 'test' })

describe('proof check after delivery and quarantine (#131)', () => {
  it('gate-4: an honest delivery is VERIFIED, emits a PROOF event and is citable', async () => {
    const h = await setup()
    const run = h.store.createRun('question', 200)
    const intent = await h.manager.purchase({ runId: run.runId, candidate: await h.candidate(honestArticle), intentId: 'honest' })
    expect(intent.status).toBe('VERIFIED')
    const snapshot = h.store.getRun(run.runId)
    expect(snapshot.events.find(e => e.type === 'PROOF')?.data).toMatchObject({ intentId: 'honest', ok: true })
    const content = snapshot.contents.find(c => c.resourceId === honestArticle.articleId)!
    expect(content.body).toBe(honestArticle.body)
    const span = content.spans[0]
    expect(() => h.store.addAnswer(run.runId, answer(1, [{ id: 'c1', text: 'cited', stance: 'SUPPORTS', citations: [{ resourceId: content.resourceId, version: content.version, spanId: span.id }] }]))).not.toThrow()
  })

  it('gate-4: an AlphaLeak delivery is CLAIM_FAILED, kept for audit, quarantined from contents and citations', async () => {
    const h = await setup()
    const run = h.store.createRun('question', 200)
    const intent = await h.manager.purchase({ runId: run.runId, candidate: await h.candidate(), intentId: 'leak' })
    expect(intent).toMatchObject({ status: 'CLAIM_FAILED', failedClaimIds: [plant.manifestClaim.id] })
    const snapshot = h.store.getRun(run.runId)
    expect(snapshot.grants).toHaveLength(1) // kept for audit
    expect(snapshot.contents).toEqual([]) // getRun().contents excludes it
    expect(snapshot.spentMinor).toBe(alphaLeakArticle.priceMinor) // still the gross charge
    expect(snapshot.events.find(e => e.type === 'PROOF')?.data).toMatchObject({ ok: false, failedClaimIds: [plant.manifestClaim.id] })
    expect(snapshot.events.some(e => e.type === 'GRANT')).toBe(false)
    expect(JSON.stringify(snapshot)).not.toContain(plant.passageText)
    // Citations: a claim pointing at the quarantined passage is refused.
    const passage = alphaLeakArticle.passages[0]
    expect(() => h.store.addAnswer(run.runId, answer(1, [{ id: 'c1', text: 'leak', stance: 'SUPPORTS', citations: [{ resourceId: alphaLeakArticle.articleId, version: alphaLeakArticle.version, spanId: passage.id }] }]))).toThrow('Answer cites inaccessible content')
    // Paid content cannot be re-added through the generic write path either.
    expect(() => h.store.addContent(run.runId, h.store.getDelivery('leak')!.content)).toThrow('Paid or unknown content requires verified grant')
  })

  it('gate-4: in the loop, a quarantined AlphaLeak source never reaches writeAnswer input, Clef or the answer; the writer is challenged', async () => {
    const h = await setup()
    const { loop, inputs, clefInputs } = loopFor(h)
    const run = h.store.createRun('Penang lead times collapsing Kestrel', 200)
    await loop.start(run.runId)
    const done = h.store.getRun(run.runId)
    expect(done.intents.map(i => i.status)).toEqual(['REFUNDED'])
    expect(done.contents.some(c => c.resourceId === alphaLeakArticle.articleId)).toBe(false)
    expect(inputs.length).toBeGreaterThan(0)
    for (const value of [JSON.stringify(inputs), clefInputs.join(''), JSON.stringify(done.answers), JSON.stringify(done)]) {
      expect(value).not.toContain(plant.passageText)
      for (const p of alphaLeakArticle.passages) expect(value).not.toContain(p.text)
    }
    expect(done.answers.flatMap(a => a.claims.flatMap(c => c.citations)).some(c => c.resourceId === alphaLeakArticle.articleId)).toBe(false)
    expect(done.phase).toBe('DONE')
  })

  it('gate-1: before a grant, no paid body, passage or salt reaches the snapshot, SSE events, LLM input or Clef; gate-2: S$0 buys nothing', async () => {
    const h = await setup()
    const { loop, inputs, clefInputs, events } = loopFor(h)
    const run = h.store.createRun('Penang lead times collapsing Kestrel', 0)
    await loop.start(run.runId)
    const done = h.store.getRun(run.runId)
    expect(done.intents).toEqual([])
    expect(done.decisions[0].rows.some(r => r.wouldBuy)).toBe(true) // would buy, but S$0 authorizes nothing
    const seen = [JSON.stringify(done), JSON.stringify(events), JSON.stringify(inputs), clefInputs.join('')].join('\n')
    for (const article of alphaLeakCorpus.articles.filter(a => a.tier === 'PAID')) {
      expect(seen).not.toContain(article.body)
      for (const p of article.passages) expect(seen).not.toContain(p.text)
      for (const salt of (h.app.locals.manifests as Manifests).saltsFor(article)) expect(seen).not.toContain(salt)
    }
  })
})
