import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import { Wallet, decode, hashes } from 'xrpl'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { createPublisherApp } from '../publisher/routes.js'
import { RunSnapshotSchema, SIMULATED_LABEL, type ContentEnvelope, type PublicCandidate, type Quote, type PurchaseIntent } from '../shared/contracts/index.js'
import { SearchHitSchema, type Manifest } from '../shared/contracts/manifest.js'
import { exampleAnswer, exampleCandidate, exampleContent } from '../shared/contracts/examples.js'
import { leafHash, manifestRoot, signManifest } from '../shared/manifest.js'
import { deriveAddress, deriveKeypair, generateSeed } from 'ripple-keypairs'
import { encodeHeader, invoiceIdFor, ledgerInvoiceId } from '../shared/x402.js'
import { simulatedLedgerIndex } from '../shared/xrpl.js'
import { miniCorpus } from './fixtures/corpus-mini/index.js'

const KEYS = deriveKeypair(generateSeed({ algorithm: 'ed25519' }))
const WALLET = deriveAddress(KEYS.publicKey)
const candidate: PublicCandidate = { ...exampleCandidate, profileId: 'grid-research', resourceId: 'paid-canary', tier: 'PAID', price: { amountMinor: 80, currency: 'SGD' }, wallet: WALLET }
const content: ContentEnvelope = { ...exampleContent, profileId: candidate.profileId, resourceId: candidate.resourceId, body: 'PAID_CANARY: exact grid evidence é.', spans: [{ id: 'paid-span', text: 'exact grid evidence é.' }] }
const SALTS = ['5a17']
const ROOT = manifestRoot(content.spans.map((s, i) => leafHash(SALTS[i], i, s.id, s.text)))
/** The candidate's verified search manifest: purchase() signs nothing without one. */
const manifestFor = (articleId = candidate.resourceId, root = ROOT): Manifest => signManifest({ publisherSlug: candidate.profileId, articleId, version: 'v1', wallet: WALLET, pubKey: KEYS.publicKey, priceMinor: 80, leaves: [leafHash(SALTS[0], 0, content.spans[0].id, content.spans[0].text)], root, claims: [], wordCount: 6, publishedAt: '2026-10-01', relevance: 1 }, KEYS.privateKey)
const MANIFEST = manifestFor()
function quote(runId: string, intentId: string, resourceId = candidate.resourceId): Quote {
  return { runId, intentId, profileId: candidate.profileId, resourceId, version: 'v1', quoteId: `q-${intentId}`, quoteHash: 'quote-hash', amountMinor: 80, currency: 'SGD', expiresAt: new Date(Date.now() + 60000).toISOString(), contentDigest: ROOT }
}
function intent(runId: string, intentId: string, resourceId = candidate.resourceId): PurchaseIntent {
  return { runId, intentId, profileId: candidate.profileId, resourceId, version: 'v1', amountMinor: 80, status: 'QUOTED', quote: quote(runId, intentId, resourceId) }
}
const cleanup: (() => void | Promise<void>)[] = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn() })
function store(path = ':memory:') { const s = new Store(path); cleanup.push(() => s.close()); return s }
function dbPath() { const dir = mkdtempSync(join(tmpdir(), 'ledger-test-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true })); return join(dir, 'app.db') }

/** A fixture x402 v2 publisher on the SIMULATED rail: charges once per tx hash, with switchable faults. */
async function publisher() {
  const state = { charges: 0, paidGets: 0, failDelivery: false, loseSettlementResponse: false, unavailable: false, refuse: '', price: 80, payTo: WALLET, root: ROOT, articleId: '', delivery: { version: 'v1', title: content.title, publisher: content.publisher, body: content.body, passages: content.spans, salts: SALTS } as Record<string, unknown> }
  const quotes = new Map<string, string>() // ledger InvoiceID → invoiceId
  const settled = new Set<string>()
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://fixture')
    const send = (status: number, value: unknown, headers: Record<string, string> = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(value)) }
    if (!/^\/w\/[^/]+\/articles\/[^/]+$/.test(url.pathname)) return send(404, {})
    const signature = req.headers['payment-signature']
    if (!signature) {
      const amount = String(state.price * 1000)
      const invoiceId = invoiceIdFor({ quoteId: `q${quotes.size}`, articleId: state.articleId || decodeURIComponent(url.pathname.split('/').at(-1)!), version: 'v1', manifestRoot: state.root, amount, payTo: state.payTo })
      quotes.set(ledgerInvoiceId(invoiceId), invoiceId)
      return send(402, { error: 'Payment required' }, { 'PAYMENT-REQUIRED': encodeHeader('PAYMENT-REQUIRED', { x402Version: 2, resource: { url: url.pathname, description: SIMULATED_LABEL }, accepts: [{ scheme: 'exact', network: 'xrpl:1', amount, asset: 'XRP', payTo: state.payTo, maxTimeoutSeconds: 60, extra: { invoiceId, areFeesSponsored: false } }] }) })
    }
    state.paidGets++
    if (state.unavailable) return send(503, {})
    const blob = JSON.parse(Buffer.from(String(signature), 'base64').toString()).payload.signedTxBlob as string
    const tx = decode(blob) as { InvoiceID: string; Account: string }
    const hash = hashes.hashSignedTx(blob).toUpperCase()
    const response = (success: boolean, errorReason?: string) => ({ 'PAYMENT-RESPONSE': encodeHeader('PAYMENT-RESPONSE', success ? { success, transaction: hash, payer: tx.Account, network: 'xrpl:1' } : { success, errorReason, transaction: '', network: 'xrpl:1' }) })
    if (state.refuse || !quotes.has(tx.InvoiceID)) return send(402, { error: 'refused' }, response(false, state.refuse || 'InvoiceID matches no quote'))
    if (!settled.has(hash)) { settled.add(hash); state.charges++ }
    if (state.loseSettlementResponse) { state.loseSettlementResponse = false; req.socket.destroy(); return }
    if (state.failDelivery) { state.failDelivery = false; return send(503, { body: 'PAID_CANARY error trap' }, response(true)) }
    send(200, { ...state.delivery, articleId: state.delivery.articleId ?? decodeURIComponent(url.pathname.split('/').at(-1)!) }, response(true))
  })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  cleanup.push(() => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()) }))
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing ephemeral address')
  const wires: unknown[] = []
  const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${address.port}`, onWire: wire => wires.push(wire) })
  return { state, client, wires }
}

describe('atomic ledger and verified purchase flow', () => {
  it('gate-3: parallel duplicate pays (same intent) submit once, parse snapshots, and persist safe wires', async () => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher()
    const manager = new PurchaseManager(s, p.client)
    const results = await Promise.all(Array.from({ length: 8 }, () => manager.purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'same' })))
    expect(results.every(i => i.status === 'VERIFIED')).toBe(true)
    expect(p.state.charges).toBe(1); expect(p.state.paidGets).toBe(1)
    const snapshot = s.getRun(run.runId)
    expect(RunSnapshotSchema.safeParse(snapshot).success).toBe(true)
    expect(snapshot.spentMinor).toBe(80); expect(snapshot.reservedMinor).toBe(0)
    expect(snapshot.contents).toEqual([content])
    expect(snapshot.receipts[0]).toMatchObject({ label: SIMULATED_LABEL })
    expect(snapshot.receipts[0].xrpl).toBeUndefined()
    expect(snapshot.events.some(e => e.type === 'XRPL' && e.label.includes('SIMULATED'))).toBe(true)
    expect(p.wires).toMatchObject([{ status: 402 }, { status: 200 }])
    expect(JSON.stringify(p.wires)).not.toContain('PAID_CANARY')
    expect(snapshot.events.filter(e => e.type === 'WIRE')).toHaveLength(2)
    await expect(manager.purchase({ runId: run.runId, candidate: { ...candidate, version: 'v2' }, manifest: MANIFEST, intentId: 'same' })).rejects.toThrow('identity')
  })
  it('gate-3: independent managers share the durable submission claim', async () => {
    const path = dbPath(); const a = store(path); const b = store(path); const run = a.createRun('question', 200); const p = await publisher()
    await Promise.all([new PurchaseManager(a, p.client), new PurchaseManager(b, p.client)].map(m => m.purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'same' })))
    expect(p.state.charges).toBe(1); expect(p.state.paidGets).toBe(1)
    expect(a.getIntent('same')?.status).toBe('VERIFIED')
  })
  it('two intents compete for one budget under separate SQLite connections', async () => {
    const path = dbPath(); const a = store(path); const b = store(path); const run = a.createRun('question', 100); const p = await publisher()
    const results = await Promise.all([new PurchaseManager(a, p.client).purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'a' }), new PurchaseManager(b, p.client).purchase({ runId: run.runId, candidate: { ...candidate, resourceId: 'other' }, manifest: manifestFor('other'), intentId: 'b' })])
    expect(results.filter(i => i.status === 'SKIPPED')).toHaveLength(1)
    expect(results.filter(i => ['VERIFIED', 'DELIVERY_FAILED'].includes(i.status))).toHaveLength(1)
    expect(p.state.charges).toBe(1); expect(a.getRun(run.runId).spentMinor).toBe(80)
  })
  it.each([0, 200])('gate-2: S$0 budget / Stop (%i) produces no settlement', async budget => {
    const s = store(); const run = s.createRun('question', budget); if (budget) s.updateRun(run.runId, { stopped: true })
    const p = await publisher(); const result = await new PurchaseManager(s, p.client).purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'zero' })
    expect(result.status).toBe('SKIPPED'); expect(p.state.paidGets).toBe(0); expect(s.getRun(run.runId).reservedMinor).toBe(0)
    expect(s.getRun(run.runId).contents).toEqual([])
  })
  it('gate-2: enforces the over-cap refusal, durable quote, immutable accounting and stopped reservation', () => {
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
    const result = await new PurchaseManager(s, p.client).purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'price' })
    expect(result.status).toBe('SKIPPED'); expect(p.state.paidGets).toBe(0); expect(s.getRun(run.runId).spentMinor).toBe(0)
  })
  it.each([
    ['payee', (p: Awaited<ReturnType<typeof publisher>>) => { p.state.payTo = Wallet.generate().classicAddress }, 'payee differs'],
    ['invoice article', (p: Awaited<ReturnType<typeof publisher>>) => { p.state.articleId = 'another-article' }, 'does not bind this purchase'],
  ])('%s mismatch fails before signing, nothing charged', async (_name, tamper, message) => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher(); tamper(p)
    const result = await new PurchaseManager(s, p.client).purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'mismatch' })
    expect(result).toMatchObject({ status: 'FAILED_NOT_SETTLED', error: expect.stringContaining(message) })
    expect(p.state.paidGets).toBe(0); expect(s.getRun(run.runId).reservedMinor).toBe(0); expect(s.getSubmission('mismatch')).toBeUndefined()
  })
  it.each([
    ['missing', undefined, 'No verified manifest'],
    ['root mismatch', manifestFor(candidate.resourceId, 'f'.repeat(64)), 'signed manifest'],
    ['bad signature', { ...MANIFEST, relevance: 0.5 }, 'signed manifest'],
  ])('refuses before signing when the search manifest is %s', async (_name, manifest, message) => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher()
    const result = await new PurchaseManager(s, p.client).purchase({ runId: run.runId, candidate, intentId: 'manifest', manifest })
    expect(result).toMatchObject({ status: 'FAILED_NOT_SETTLED', error: expect.stringContaining(message) })
    expect(p.state.paidGets).toBe(0); expect(s.getSubmission('manifest')).toBeUndefined(); expect(s.getRun(run.runId).reservedMinor).toBe(0)
  })
  it('a SIMULATED refusal of the signed blob is proof of no charge and releases the reservation', async () => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher(); p.state.refuse = 'LastLedgerSequence has passed'
    const result = await new PurchaseManager(s, p.client).purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'refused' })
    expect(result).toMatchObject({ status: 'FAILED_NOT_SETTLED', error: expect.stringContaining('LastLedgerSequence') })
    expect(s.getRun(run.runId)).toMatchObject({ reservedMinor: 0, spentMinor: 0 }); expect(p.state.charges).toBe(0)
  })
  it('gate-3: a restart mid-submit (ambiguous settlement) survives and reconciles by resending the same blob, one charge', async () => {
    const path = dbPath(); const first = new Store(path); const run = first.createRun('question', 100); const p = await publisher(); p.state.loseSettlementResponse = true
    const result = await new PurchaseManager(first, p.client).purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'restart' })
    expect(result.status).toBe('SUBMITTING'); expect(first.getRun(run.runId).reservedMinor).toBe(80); expect(first.getRun(run.runId).contents).toEqual([])
    expect(() => first.updateIntent('restart', { status: 'FAILED_NOT_SETTLED' })).toThrow('Unsafe')
    first.close()
    const second = store(path); const manager = new PurchaseManager(second, p.client)
    await manager.reconcile()
    expect(second.getIntent('restart')?.status).toBe('VERIFIED')
    expect(second.getRun(run.runId).spentMinor).toBe(80); expect(p.state.charges).toBe(1); expect(p.state.paidGets).toBe(2)
    await manager.purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'restart' }); expect(p.state.paidGets).toBe(2)
  })
  it('an unavailable publisher retains the possible-charge reservation; an unsigned one is released', async () => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher(); p.state.loseSettlementResponse = true
    const manager = new PurchaseManager(s, p.client)
    expect((await manager.purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'uncertain' })).status).toBe('SUBMITTING')
    p.state.unavailable = true; await manager.reconcile()
    expect(s.getIntent('uncertain')?.status).toBe('SUBMITTING'); expect(s.getRun(run.runId).reservedMinor).toBe(80)
    s.reserveIntent(intent(run.runId, 'unsigned', 'other')); s.claimSubmitting('unsigned'); await manager.reconcile()
    expect(s.getIntent('unsigned')?.status).toBe('FAILED_NOT_SETTLED'); expect(p.state.charges).toBe(1)
  })
  it('gate-3: fault after payment retries GET delivery, never a new charge', async () => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher(); p.state.failDelivery = true
    const manager = new PurchaseManager(s, p.client)
    expect((await manager.purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'fault' })).status).toBe('DELIVERY_FAILED')
    expect(s.getRun(run.runId).spentMinor).toBe(80); expect(s.getRun(run.runId).contents).toEqual([])
    expect(JSON.stringify(s.getRun(run.runId))).not.toContain('PAID_CANARY')
    expect((await manager.retryDelivery('fault')).status).toBe('VERIFIED')
    expect(p.state.charges).toBe(1)
  })
  it.each(['salt', 'passage', 'article', 'version', 'span', 'shape'])('rejects %s mismatch without exposing premium bytes', async fault => {
    const s = store(); const run = s.createRun('question', 200); const p = await publisher()
    const d = p.state.delivery
    if (fault === 'salt') d.salts = ['bad']
    if (fault === 'passage') d.passages = [{ id: 'paid-span', text: 'exact grid' }]
    if (fault === 'article') d.articleId = 'wrong'
    if (fault === 'version') d.version = 'wrong'
    if (fault === 'span') { d.passages = [{ id: 'paid-span', text: 'absent text' }] }
    if (fault === 'shape') delete d.body
    const result = await new PurchaseManager(s, p.client).purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: fault })
    // #131: wrong salts or passage bytes are a root mismatch = a failed proof (kept for audit, quarantined); the rest never form a grant.
    const quarantined = fault === 'salt' || fault === 'passage'
    expect(result.status).toBe(quarantined ? 'CLAIM_FAILED' : 'DELIVERY_FAILED'); expect(s.getRun(run.runId).contents).toEqual([]); expect(s.getRun(run.runId).grants).toHaveLength(quarantined ? 1 : 0)
    expect(JSON.stringify(s.getRun(run.runId))).not.toContain('PAID_CANARY')
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
    expect(() => s.addGrant({ runId: run.runId, resourceId: candidate.resourceId, version: 'v1', intentId: 'missing', contentDigest: ROOT, grantedAt: new Date().toISOString() }, content)).toThrow('bytes')
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
    const pending = manager.purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'identity' })
    await expect(manager.purchase({ runId: run.runId, candidate: { ...candidate, resourceId: 'other' }, manifest: manifestFor('other'), intentId: 'identity' })).rejects.toThrow('identity')
    await pending
    expect(p.state.charges).toBe(1)
  })
  it('retains one charge across independent concurrent delivery retries', async () => {
    const path = dbPath(); const a = store(path); const b = store(path); const run = a.createRun('question', 200); const p = await publisher(); p.state.failDelivery = true
    const first = new PurchaseManager(a, p.client); const second = new PurchaseManager(b, p.client)
    await first.purchase({ runId: run.runId, candidate, manifest: MANIFEST, intentId: 'retry-race' })
    const results = await Promise.all([first.retryDelivery('retry-race'), second.retryDelivery('retry-race')])
    expect(results.every(i => i.status === 'VERIFIED')).toBe(true)
    expect(a.getRun(run.runId).grants).toHaveLength(1); expect(a.getRun(run.runId).receipts).toHaveLength(1)
    expect(p.state.charges).toBe(1)
  })
  it('end to end on the SIMULATED rail: buyer pays the real publisher once and verifies the manifest root', async () => {
    const app = createPublisherApp({ journal: ':memory:', rail: 'simulated', writers: miniCorpus, env: {} })
    await app.locals.ready; await app.locals.writersReady
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    cleanup.push(() => new Promise<void>(resolve => server.close(() => { app.locals.journal.close(); resolve() })))
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const article = miniCorpus.articles.find(a => a.tier === 'PAID')!
    const hit = SearchHitSchema.array().parse(await (await fetch(`${base}/w/${article.publisherSlug}/search?q=${encodeURIComponent(article.title)}`)).json()).find(h => h.articleId === article.articleId)!
    const paid: PublicCandidate = { ...candidate, profileId: hit.publisherSlug, resourceId: hit.articleId, version: hit.version, url: hit.url, wallet: hit.manifest!.wallet, price: { amountMinor: hit.priceMinor, currency: 'SGD' } }
    const s = store(); const run = s.createRun('question', 200)
    const manager = new PurchaseManager(s, new PublisherClient({ baseUrl: base }))
    const results = await Promise.all([0, 1, 2].map(() => manager.purchase({ runId: run.runId, candidate: paid, intentId: 'e2e', manifest: hit.manifest })))
    expect(results.map(r => r.status)).toEqual(['VERIFIED', 'VERIFIED', 'VERIFIED'])
    const snapshot = s.getRun(run.runId)
    expect(snapshot.contents[0]).toMatchObject({ resourceId: article.articleId, body: article.body })
    expect(snapshot.grants[0].contentDigest).toBe(hit.manifest!.root)
    expect(snapshot).toMatchObject({ spentMinor: hit.priceMinor, receipts: [{ label: SIMULATED_LABEL }] })
    expect(app.locals.journal.settlementByTx(s.getIntent('e2e')!.txHash!)).toBeDefined()
    expect(simulatedLedgerIndex()).toBeGreaterThan(0)
  })

  it('lists past runs, pins them, and hides a deleted run without touching its ledger rows', () => {
    const s = store(); const a = s.createRun('first', 100); const b = s.createRun('second', 200)
    expect(s.listPastRuns().map(run => run.runId)).toEqual([b.runId, a.runId])
    s.setRunMeta(a.runId, { pinned: true })
    expect(s.listPastRuns().find(run => run.runId === a.runId)?.pinned).toBe(true)
    s.setRunMeta(b.runId, { hidden: true })
    expect(s.listPastRuns().map(run => run.runId)).toEqual([a.runId])
    expect(s.getRun(b.runId).question).toBe('second')
    // Only the 4 latest unpinned runs are listed; a pinned run stays however old it is.
    const later = ['c', 'd', 'e', 'f', 'g'].map(q => s.createRun(q, 100).runId)
    expect(s.listPastRuns().map(run => run.runId)).toEqual([...later.slice(1).reverse(), a.runId])
    expect(s.listPastRuns().filter(run => !run.pinned)).toHaveLength(4)
  })
})
