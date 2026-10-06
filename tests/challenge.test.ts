import { afterEach, describe, expect, it } from 'vitest'
import { decode } from 'xrpl'
import { challenge } from '../server/challenges.js'
import { SIMULATED_LABEL } from '../shared/contracts/index.js'
import { ChallengeResultSchema, type Challenge } from '../shared/contracts/publisher.js'
import { simulatedPayerWallet } from '../shared/xrpl.js'
import { alphaLeakArticle, honestArticle, payPath, plant } from './fixtures/pay-path.js'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const fn of cleanups.splice(0)) await fn() })
async function setup(options?: Parameters<typeof payPath>[0]) { const h = await payPath(options); cleanups.push(h.close); return h }
async function failedProof(h: Awaited<ReturnType<typeof setup>>, intentId = 'leak') {
  const run = h.store.createRun('question', 200)
  const intent = await h.manager.purchase({ runId: run.runId, candidate: await h.candidate(), intentId })
  expect(intent.status).toBe('CLAIM_FAILED')
  return { run, intent }
}
const post = (base: string, slug: string, body: Challenge) => fetch(`${base}/w/${slug}/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
/** The challenge body the buyer would send for a claim, built from the publisher's own delivery. */
function challengeFor(h: Awaited<ReturnType<typeof setup>>, intentId: string, claimId: string): Challenge {
  const manifest = h.store.getManifest(intentId)!, delivery = h.store.getDelivery(intentId)!
  const claim = manifest.claims.find(c => c.id === claimId)!, index = manifest.leaves.indexOf(claim.leaf)
  return { intentId, txHash: h.store.getIntent(intentId)!.txHash!, claimId, leaf: claim.leaf, salt: delivery.salts[index], passageId: delivery.content.spans[index].id, passageText: delivery.content.spans[index].text }
}

describe('POST /w/:slug/challenge and refund (#132)', () => {
  it('gate-3: AlphaLeak is REFUNDED exactly once under parallel and repeated challenges', async () => {
    const h = await setup()
    const { run, intent } = await failedProof(h)
    const results = await Promise.all([challenge(h.manager, 'leak'), challenge(h.manager, 'leak'), challenge(h.manager, 'leak')])
    expect(results.map(r => r.status)).toEqual(['REFUNDED', 'REFUNDED', 'REFUNDED'])
    const refund = h.journal.refundByTx(intent.txHash!)!
    expect(results[0].refund).toEqual({ txHash: refund.txHash, amountMinor: alphaLeakArticle.priceMinor })
    // Repeated and parallel challenges straight at the publisher, even under another intent id, return the one stored refund.
    const body = challengeFor(h, 'leak', plant.manifestClaim.id)
    const direct = await Promise.all([body, body, { ...body, intentId: 'other' }].map(async b => ChallengeResultSchema.parse(await (await post(h.base, 'alphaleak', b)).json())))
    expect(direct.map(r => r.refundTxHash)).toEqual([refund.txHash, refund.txHash, refund.txHash])
    expect((await challenge(h.manager, 'leak')).refund).toEqual(results[0].refund)
    // The refund pays the full amount back to the payer, with InvoiceID = the original tx hash.
    const tx = decode(refund.txBlob) as Record<string, unknown>
    expect(tx).toMatchObject({ TransactionType: 'Payment', Account: (await h.candidate()).wallet, Destination: simulatedPayerWallet().classicAddress, Amount: String(alphaLeakArticle.priceMinor * 1000), InvoiceID: intent.txHash })
    const snapshot = h.store.getRun(run.runId)
    expect(snapshot).toMatchObject({ spentMinor: alphaLeakArticle.priceMinor, refundedMinor: alphaLeakArticle.priceMinor })
    expect(snapshot.events.filter(e => e.type === 'REFUND')).toHaveLength(1)
    expect(snapshot.contents).toEqual([]) // a refund never un-quarantines
  })

  it('gate-3: a restart after the challenge was sent challenges again and still refunds once', async () => {
    const h = await setup()
    const { intent } = await failedProof(h)
    h.store.markChallenged('leak') // crashed after CHALLENGED, before the outcome
    expect((await challenge(h.manager, 'leak')).status).toBe('REFUNDED')
    const first = h.journal.refundByTx(intent.txHash!)!
    expect((await challenge(h.manager, 'leak')).refund!.txHash).toBe(first.txHash)
    expect(() => h.store.recordChallengeOutcome('leak', 'CHALLENGE_REFUSED')).not.toThrow()
    expect(h.store.getIntent('leak')!.status).toBe('REFUNDED') // write-once
  })

  it('an honest publisher answers REJECTED when its claim holds', async () => {
    const h = await setup()
    const run = h.store.createRun('question', 200)
    expect((await h.manager.purchase({ runId: run.runId, candidate: await h.candidate(honestArticle), intentId: 'honest' })).status).toBe('VERIFIED')
    const claim = h.store.getManifest('honest')!.claims[0]
    expect(claim).toBeDefined()
    const result = ChallengeResultSchema.parse(await (await post(h.base, honestArticle.publisherSlug, challengeFor(h, 'honest', claim.id))).json())
    expect(result).toEqual({ status: 'REJECTED' })
    expect(h.journal.refundByTx(h.store.getIntent('honest')!.txHash!)).toBeUndefined()
    // AlphaLeak's other, true claims are rejected too: only the planted one is broken.
    const leak = await failedProof(h, 'leak')
    const holds = h.store.getManifest('leak')!.claims.find(c => c.id !== plant.manifestClaim.id)
    if (holds) expect(ChallengeResultSchema.parse(await (await post(h.base, 'alphaleak', challengeFor(h, 'leak', holds.id))).json()).status).toBe('REJECTED')
    expect(h.journal.refundByTx(leak.intent.txHash!)).toBeUndefined()
  })

  it('the buyer records CHALLENGE_REJECTED when the writer says the claim holds', async () => {
    const h = await setup()
    await failedProof(h)
    h.manager.client.challenge = async () => ({ status: 'REJECTED' })
    const intent = await challenge(h.manager, 'leak')
    expect(intent.status).toBe('CHALLENGE_REJECTED')
    expect(intent.refund).toBeUndefined()
    expect(h.store.getRun(intent.runId).refundedMinor).toBe(0)
  })

  it('a refusing publisher (test toggle) or a timeout is CHALLENGE_REFUSED, with no refund', async () => {
    const h = await setup({ refuseChallenges: true })
    const { run } = await failedProof(h)
    const intent = await challenge(h.manager, 'leak')
    expect(intent.status).toBe('CHALLENGE_REFUSED')
    expect(h.store.getRun(run.runId)).toMatchObject({ refundedMinor: 0, spentMinor: alphaLeakArticle.priceMinor })
    expect(h.store.getRun(run.runId).events.some(e => e.type === 'WIRE' && e.label.endsWith('→ 503'))).toBe(true)
    const slow = await setup()
    await failedProof(slow)
    slow.manager.client.challenge = () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), 5))
    expect((await challenge(slow.manager, 'leak', { timeoutMs: 1 })).status).toBe('CHALLENGE_REFUSED')
  })

  it('gate-5: the simulated rail, keyword-only search, SYNTHETIC writers and refunds are labelled', async () => {
    const h = await setup()
    const { run } = await failedProof(h)
    await challenge(h.manager, 'leak')
    const snapshot = h.store.getRun(run.runId)
    expect(snapshot.receipts[0].label).toBe(SIMULATED_LABEL)
    expect(snapshot.events.find(e => e.type === 'REFUND')).toMatchObject({ label: expect.stringContaining('SIMULATED'), data: { label: SIMULATED_LABEL } })
    expect(snapshot.events.filter(e => e.type === 'CHALLENGE').every(e => e.data?.label === SIMULATED_LABEL)).toBe(true)
    const discovery = await (await fetch(`${h.base}/w/alphaleak/.well-known/agent-publisher.json`)).json() as { label: string }
    expect(discovery.label).toBe('SYNTHETIC')
    const hits = await (await fetch(`${h.base}/w/alphaleak/search?q=Penang`)).json() as { searchMode: string }[]
    expect(hits.every(hit => hit.searchMode === 'keyword')).toBe(true)
    const result = await (await post(h.base, 'alphaleak', challengeFor(h, 'leak', plant.manifestClaim.id))).json() as { label: string }
    expect(result.label).toBe(SIMULATED_LABEL)
  })
})
