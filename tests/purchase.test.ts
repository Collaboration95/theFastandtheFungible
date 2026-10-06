import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { RunSnapshotSchema, type ContentEnvelope, type PublicCandidate, type Quote, type PurchaseIntent } from '../shared/contracts/index.js'
import { exampleAnswer, exampleCandidate, exampleContent } from '../shared/contracts/examples.js'

const candidate: PublicCandidate = { ...exampleCandidate, profileId: 'grid-research', resourceId: 'paid-canary', tier: 'PAID', price: { amountMinor: 80, currency: 'SGD' } }
const content: ContentEnvelope = { ...exampleContent, profileId: candidate.profileId, resourceId: candidate.resourceId, body: 'PAID_CANARY: exact grid evidence é.', spans: [{ id: 'paid-span', text: 'exact grid evidence é.' }] }
const bytes = JSON.stringify(content)
const hash = createHash('sha256').update(bytes).digest('hex')
function quote(runId: string, intentId: string, resourceId = candidate.resourceId): Quote {
  return { runId, intentId, profileId: candidate.profileId, resourceId, version: 'v1', quoteId: `q-${intentId}`, quoteHash: 'quote-hash', amountMinor: 80, currency: 'SGD', expiresAt: new Date(Date.now() + 60000).toISOString(), contentDigest: hash }
}
function intent(runId: string, intentId: string, resourceId = candidate.resourceId): PurchaseIntent {
  return { runId, intentId, profileId: candidate.profileId, resourceId, version: 'v1', amountMinor: 80, status: 'QUOTED', quote: quote(runId, intentId, resourceId) }
}
const cleanup: (() => void | Promise<void>)[] = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn() })
function store(path = ':memory:') { const s = new Store(path); cleanup.push(() => s.close()); return s }
function dbPath() { const dir = mkdtempSync(join(tmpdir(), 'ledger-test-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true })); return join(dir, 'app.db') }

async function publisher() {
  const state = { charges: 0, posts: 0, failDelivery: false, loseSettlementResponse: false, price: 80, deliveryBytes: bytes, digest: `sha-256=${hash}`, statusAvailable: true, statusAuth: false }
  const quotes = new Map<string, Quote>()
  const settled = new Map<string, { status: 'SETTLED'; receiptId: string; deliveryToken: string }>()
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://fixture')
    const send = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
    if (url.pathname === '/v1/profiles') return send(200, [{ id: 'grid-research', name: 'Fixture publisher', tier: 'PAID' }])
    if (url.pathname.endsWith('/search')) return send(200, [candidate])
    if (url.pathname.endsWith('/content')) {
      if (!req.headers['x-delivery-token']) return send(402, { network: 'simulated-sgd', amount: state.price, preview: candidate.preview })
      if (req.headers['x-delivery-token'] !== 'PRIVATE_DELIVERY_TOKEN') return send(403, {})
      if (state.failDelivery) { state.failDelivery = false; return send(503, { body: 'PAID_CANARY error trap' }) }
      res.writeHead(200, { 'Content-Type': 'application/json', Digest: state.digest }); return res.end(state.deliveryBytes)
    }
    if (req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk
      const input = JSON.parse(body)
      if (url.pathname === '/v1/quotes') {
        const q = { ...quote(input.runId, input.intentId, input.resourceId), amountMinor: state.price }; quotes.set(q.quoteId, q); return send(200, q)
      }
      if (url.pathname === '/v1/settlements') {
        if (req.headers.authorization !== 'Bearer fixture-secret') return send(401, {})
        state.posts++
        const q = quotes.get(input.quoteId)!
        if (!settled.has(q.intentId)) { state.charges++; settled.set(q.intentId, { status: 'SETTLED', receiptId: `receipt-${q.intentId}`, deliveryToken: 'PRIVATE_DELIVERY_TOKEN' }) }
        if (state.loseSettlementResponse) { state.loseSettlementResponse = false; req.socket.destroy(); return }
        const { receiptId, deliveryToken } = settled.get(q.intentId)!
        return send(200, { receiptId, deliveryToken })
      }
    }
    if (url.pathname.startsWith('/v1/settlements/')) {
      state.statusAuth = req.headers.authorization === 'Bearer fixture-secret'
      if (!state.statusAuth) return send(401, {})
      if (!state.statusAvailable) return send(503, {})
      return send(200, settled.get(decodeURIComponent(url.pathname.split('/').at(-1)!)) ?? { status: 'NOT_FOUND' })
    }
    send(404, {})
  })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  cleanup.push(() => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()) }))
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing ephemeral address')
  const wires: unknown[] = []
  const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${address.port}`, secret: 'fixture-secret', onWire: wire => wires.push(wire) })
  return { state, client, wires }
}

describe('atomic ledger and verified purchase flow', () => {
  it('parallel same-intent requests submit once, parse snapshots, and persist safe wires', async () => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher()
    const manager = new PurchaseManager(s, p.client)
    const results = await Promise.all(Array.from({ length: 8 }, () => manager.purchase({ runId: run.runId, candidate, intentId: 'same' })))
    expect(results.every(i => i.status === 'VERIFIED')).toBe(true)
    expect(p.state.charges).toBe(1); expect(p.state.posts).toBe(1)
    const snapshot = s.getRun(run.runId)
    expect(RunSnapshotSchema.safeParse(snapshot).success).toBe(true)
    expect(snapshot.spentMinor).toBe(80); expect(snapshot.reservedMinor).toBe(0)
    expect(snapshot.contents).toEqual([content])
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_DELIVERY_TOKEN')
    expect(p.wires).toMatchObject([{ status: 402 }, { status: 200 }, { status: 200 }, { status: 200 }])
    expect(JSON.stringify(p.wires)).not.toContain('PAID_CANARY')
    expect(snapshot.events.filter(e => e.type === 'WIRE')).toHaveLength(4)
    await expect(manager.purchase({ runId: run.runId, candidate: { ...candidate, version: 'v2' }, intentId: 'same' })).rejects.toThrow('identity')
  })
  it('independent managers share the durable submission claim', async () => {
    const path = dbPath(); const a = store(path); const b = store(path); const run = a.createRun('question', 200); const p = await publisher()
    await Promise.all([new PurchaseManager(a, p.client), new PurchaseManager(b, p.client)].map(m => m.purchase({ runId: run.runId, candidate, intentId: 'same' })))
    expect(p.state.charges).toBe(1); expect(p.state.posts).toBe(1)
    expect(a.getIntent('same')?.status).toBe('VERIFIED')
  })
  it('two intents compete for one budget under separate SQLite connections', async () => {
    const path = dbPath(); const a = store(path); const b = store(path); const run = a.createRun('question', 100); const p = await publisher()
    const results = await Promise.all([new PurchaseManager(a, p.client).purchase({ runId: run.runId, candidate, intentId: 'a' }), new PurchaseManager(b, p.client).purchase({ runId: run.runId, candidate: { ...candidate, resourceId: 'other' }, intentId: 'b' })])
    expect(results.filter(i => i.status === 'SKIPPED')).toHaveLength(1)
    expect(results.filter(i => ['VERIFIED', 'DELIVERY_FAILED'].includes(i.status))).toHaveLength(1)
    expect(p.state.charges).toBe(1); expect(a.getRun(run.runId).spentMinor).toBe(80)
  })
  it.each([0, 200])('S$0 / stopped run (%i) produces no settlement', async budget => {
    const s = store(); const run = s.createRun('question', budget); if (budget) s.updateRun(run.runId, { stopped: true })
    const p = await publisher(); const result = await new PurchaseManager(s, p.client).purchase({ runId: run.runId, candidate, intentId: 'zero' })
    expect(result.status).toBe('SKIPPED'); expect(p.state.posts).toBe(0); expect(s.getRun(run.runId).reservedMinor).toBe(0)
    expect(s.getRun(run.runId).contents).toEqual([])
  })
  it('enforces cap, durable quote, immutable accounting and stopped reservation', () => {
    const s = store(); const run = s.createRun('question', 500)
    const over = intent(run.runId, 'over'); over.amountMinor = 140; over.quote!.amountMinor = 140
    expect(s.reserveIntent(over).status).toBe('SKIPPED')
    const reserved = s.reserveIntent(intent(run.runId, 'reserved')); expect(reserved.quote).toBeDefined()
    expect(s.getRun(run.runId).reservedMinor).toBe(80)
    s.updateRun(run.runId, { stopped: true })
    expect(s.claimSubmitting('reserved')).toBe(false)
    expect(s.getRun(run.runId).reservedMinor).toBe(0)
    expect(() => s.updateRun(run.runId, { budgetMinor: 1000 })).toThrow('Protected')
    expect(() => s.updateRun(run.runId, { stopped: false })).toThrow('stopped')
    expect(() => s.updateIntent('reserved', { amountMinor: 0 })).toThrow('immutable')
  })
  it('price mismatch skips without charging', async () => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher(); p.state.price = 81
    const result = await new PurchaseManager(s, p.client).purchase({ runId: run.runId, candidate, intentId: 'price' })
    expect(result.status).toBe('SKIPPED'); expect(p.state.posts).toBe(0); expect(s.getRun(run.runId).spentMinor).toBe(0)
  })
  it('ambiguous settlement survives restart and reconciles with secret auth, one charge', async () => {
    const path = dbPath(); const first = new Store(path); const run = first.createRun('question', 100); const p = await publisher(); p.state.loseSettlementResponse = true
    const result = await new PurchaseManager(first, p.client).purchase({ runId: run.runId, candidate, intentId: 'restart' })
    expect(result.status).toBe('SUBMITTING'); expect(first.getRun(run.runId).reservedMinor).toBe(80); expect(first.getRun(run.runId).contents).toEqual([])
    expect(() => first.updateIntent('restart', { status: 'FAILED_NOT_SETTLED' })).toThrow('Unsafe')
    first.close()
    const second = store(path); const manager = new PurchaseManager(second, p.client)
    await manager.reconcile()
    expect(p.state.statusAuth).toBe(true); expect(second.getIntent('restart')?.status).toBe('VERIFIED')
    expect(second.getRun(run.runId).spentMinor).toBe(80); expect(p.state.charges).toBe(1); expect(p.state.posts).toBe(1)
    await manager.purchase({ runId: run.runId, candidate, intentId: 'restart' }); expect(p.state.posts).toBe(1)
  })
  it('NOT_FOUND or unavailable status retains possible-charge reservation', async () => {
    const s = store(); const run = s.createRun('question', 100); const p = await publisher()
    s.reserveIntent(intent(run.runId, 'uncertain')); s.claimSubmitting('uncertain')
    const manager = new PurchaseManager(s, p.client); await manager.reconcile()
    p.state.statusAvailable = false; await manager.reconcile()
    expect(s.getIntent('uncertain')?.status).toBe('SUBMITTING'); expect(s.getRun(run.runId).reservedMinor).toBe(80); expect(p.state.posts).toBe(0)
  })
  it('fault after payment retries GET delivery, never a new charge', async () => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher(); p.state.failDelivery = true
    const manager = new PurchaseManager(s, p.client)
    expect((await manager.purchase({ runId: run.runId, candidate, intentId: 'fault' })).status).toBe('DELIVERY_FAILED')
    expect(s.getRun(run.runId).spentMinor).toBe(80); expect(s.getRun(run.runId).contents).toEqual([])
    expect(JSON.stringify(s.getRun(run.runId))).not.toContain('PAID_CANARY')
    expect((await manager.retryDelivery('fault')).status).toBe('VERIFIED')
    expect(p.state.charges).toBe(1); expect(p.state.posts).toBe(1)
  })
  it.each(['header', 'quoted-digest', 'profile', 'resource', 'version', 'span', 'bytes'])('rejects %s mismatch without exposing premium bytes', async fault => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher()
    if (fault === 'header') p.state.digest = 'sha-256=bad'
    if (fault === 'quoted-digest') { p.state.deliveryBytes = JSON.stringify({ ...content, body: content.body + 'changed' }); p.state.digest = `sha-256=${createHash('sha256').update(p.state.deliveryBytes).digest('hex')}` }
    if (['profile', 'resource', 'version'].includes(fault)) p.state.deliveryBytes = JSON.stringify({ ...content, [`${fault}${fault === 'version' ? '' : 'Id'}`]: 'wrong' })
    if (fault === 'span') p.state.deliveryBytes = JSON.stringify({ ...content, spans: [{ id: 'bad', text: 'absent text' }] })
    if (fault === 'bytes') p.state.deliveryBytes = bytes + ' '
    const result = await new PurchaseManager(s, p.client).purchase({ runId: run.runId, candidate, intentId: fault })
    expect(result.status).toBe('DELIVERY_FAILED'); expect(s.getRun(run.runId).contents).toEqual([]); expect(s.getRun(run.runId).grants).toEqual([])
    expect(s.getRun(run.runId).spentMinor).toBe(80); expect(JSON.stringify(p.wires)).not.toContain('PAID_CANARY')
  })
  it('generic writes cannot grant content, and answer versions remain immutable', () => {
    const s = store(); const run = s.createRun('question', 200)
    s.updateRun(run.runId, { candidates: [candidate, exampleCandidate] })
    expect(() => s.addContent(run.runId, content)).toThrow('grant')
    expect(() => s.updateRun(run.runId, { contents: [content] })).toThrow('Protected')
    expect(() => s.updateRun(run.runId, { grants: [] })).toThrow('Protected')
    expect(() => s.updateRun(run.runId, { checkpoint: { contents: [content] } })).toThrow('Private')
    expect(() => s.appendEvent(run.runId, { type: 'WIRE', label: 'unsafe', data: { deliveryToken: 'PRIVATE_DELIVERY_TOKEN' } })).toThrow('Private')
    expect(() => s.updateRun(run.runId, { candidates: [] })).toThrow('registered')
    expect(() => s.updateRun(run.runId, { candidates: [{ ...candidate, tier: 'FREE' }] })).toThrow('immutable')
    expect(() => s.addGrant({ runId: run.runId, resourceId: candidate.resourceId, version: 'v1', intentId: 'missing', contentDigest: hash, grantedAt: new Date().toISOString() }, content)).toThrow('bytes')
    s.addContent(run.runId, exampleContent); s.addAnswer(run.runId, exampleAnswer)
    expect(() => s.addAnswer(run.runId, { ...exampleAnswer, conclusion: 'overwrite' })).toThrow()
    expect(s.getRun(run.runId).answers[0]).toEqual(exampleAnswer)
    expect(() => s.addAnswer(run.runId, { ...exampleAnswer, version: 2, claims: [{ ...exampleAnswer.claims[0], citations: [{ resourceId: candidate.resourceId, version: 'v1', spanId: 'paid-span' }] }] })).toThrow('inaccessible')
  })
  it('callbacks see persisted events; subscriber failure does not undo persistence', () => {
    const path = dbPath(); const reader = store(path)
    const writer = new Store(path, event => { expect(reader.getRun(event.runId).events).toContainEqual(event); throw new Error('subscriber failure') }); cleanup.push(() => writer.close())
    const run = writer.createRun('question', 0); writer.appendEvent(run.runId, { type: 'CHECKPOINT', label: 'durable' })
    expect(reader.getRun(run.runId).events).toHaveLength(1)
  })
  it('does not coalesce conflicting identities before the quote is durable', async () => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher()
    const manager = new PurchaseManager(s, p.client)
    const pending = manager.purchase({ runId: run.runId, candidate, intentId: 'identity' })
    await expect(manager.purchase({ runId: run.runId, candidate: { ...candidate, resourceId: 'other' }, intentId: 'identity' })).rejects.toThrow('identity')
    await pending
    expect(p.state.posts).toBe(1)
  })
  it('retains one charge across independent concurrent delivery retries', async () => {
    const path = dbPath(); const a = store(path); const b = store(path); const run = a.createRun('question', 200); const p = await publisher(); p.state.failDelivery = true
    const first = new PurchaseManager(a, p.client); const second = new PurchaseManager(b, p.client)
    await first.purchase({ runId: run.runId, candidate, intentId: 'retry-race' })
    const results = await Promise.all([first.retryDelivery('retry-race'), second.retryDelivery('retry-race')])
    expect(results.every(i => i.status === 'VERIFIED')).toBe(true)
    expect(a.getRun(run.runId).grants).toHaveLength(1); expect(a.getRun(run.runId).receipts).toHaveLength(1)
    expect(p.state.posts).toBe(1)
  })

  it('lists past runs, pins them, and hides a deleted run without touching its ledger rows', () => {
    const s = store(); const a = s.createRun('first', 100); const b = s.createRun('second', 200)
    expect(s.listPastRuns().map(run => run.runId)).toEqual([b.runId, a.runId])
    s.setRunMeta(a.runId, { pinned: true })
    expect(s.listPastRuns().find(run => run.runId === a.runId)?.pinned).toBe(true)
    s.setRunMeta(b.runId, { hidden: true })
    expect(s.listPastRuns().map(run => run.runId)).toEqual([a.runId])
    expect(s.getRun(b.runId).question).toBe('second')
  })
})
