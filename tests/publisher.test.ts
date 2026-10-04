import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createPublisherApp, serializeEnvelope } from '../publisher/routes.js'
import { PublisherJournal } from '../publisher/journal.js'
import { loadCorpus } from '../publisher/corpus.js'
vi.mock('../publisher/corpus.js', () => ({ loadCorpus: vi.fn() }))
import { exampleCandidate, exampleContent } from '../shared/contracts/examples.js'
import { QuoteSchema, SettlementSchema, type Quote } from '../shared/contracts/publisher.js'
import type { CorpusResource } from '../shared/contracts/corpus.js'

const secret = 'test-private-secret'
const canary = 'PAID_CANARY_do_not_discover_🧪'
const free: CorpusResource = { ...exampleCandidate, ...exampleContent }
const paid: CorpusResource = {
  ...free, resourceId: 'paid', tier: 'PAID', price: { amountMinor: 80, currency: 'SGD' },
  body: `${canary}\nExact quoted evidence.`, spans: [{ id: 's1', text: canary }],
}
const corpus = [free, paid, { ...paid, profileId: 'another', resourceId: 'other' }]
const request = { profileId: paid.profileId, resourceId: paid.resourceId, version: paid.version, runId: 'run-a', intentId: 'intent-a' }
const contentPath = (resource = paid) => `/v1/profiles/${resource.profileId}/resources/${resource.resourceId}/versions/${resource.version}/content`
const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })
function temporaryDirectory() {
  const dir = mkdtempSync(join(tmpdir(), 'publisher-test-'))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}
async function serve(options: { faults?: boolean; resources?: CorpusResource[]; journal?: string } = {}) {
  const journal = new PublisherJournal(options.journal ?? ':memory:')
  const app = createPublisherApp({ corpus: options.resources ?? corpus, journal, secret, faults: options.faults ?? false })
  await app.locals.ready
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as { port: number }
  cleanups.push(async () => { await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); journal.close() })
  return `http://127.0.0.1:${address.port}`
}
async function post(base: string, path: string, body: unknown, authenticated = false) {
  return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${secret}` } : {}) }, body: JSON.stringify(body) })
}
async function quote(base: string, input = request): Promise<Quote> {
  const response = await post(base, '/v1/quotes', input)
  expect(response.status).toBe(200)
  return QuoteSchema.parse(await response.json())
}
async function settle(base: string, q: Quote) {
  const response = await post(base, '/v1/settlements', q, true)
  expect(response.status).toBe(200)
  return SettlementSchema.parse(await response.json())
}

/** A separate node process exercises the actual HTTP boundary and SQLite locks. */
async function processServer(dir: string) {
  const driver = join(dir, 'serve.mjs')
  writeFileSync(join(dir, 'corpus.json'), JSON.stringify(corpus))
  writeFileSync(driver, `import { readFileSync } from 'node:fs';
import { createPublisherApp } from ${JSON.stringify(resolve('publisher/routes.ts'))};
const app = createPublisherApp({corpus: JSON.parse(readFileSync(${JSON.stringify(join(dir, 'corpus.json'))}, 'utf8')), journal: ${JSON.stringify(join(dir, 'journal.db'))}, secret: ${JSON.stringify(secret)}});
await app.locals.ready;
const server = app.listen(0, '127.0.0.1');
server.once('listening', () => console.log('PORT=' + server.address().port));
process.once('SIGTERM', () => server.close(() => { app.locals.journal.close(); process.exit(0); }));`)
  const child = spawn(process.execPath, ['--import', 'tsx', driver], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] })
  let errors = ''
  child.stderr!.on('data', data => { errors += String(data) })
  const base = await new Promise<string>((done, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Publisher process startup timed out: ' + errors)) }, 10_000)
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Publisher process failed: ' + errors)) })
    child.stdout!.on('data', data => {
      const match = String(data).match(/PORT=(\d+)/)
      if (match) { clearTimeout(timer); done(`http://127.0.0.1:${match[1]}`) }
    })
  })
  let stopped = false
  const stop = async () => {
    if (stopped) return
    stopped = true
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    await exited
  }
  cleanups.push(stop)
  return { base, stop, child }
}

// Assert raw discovery bytes, rather than relying on the test's schema to strip leaks.
describe('publisher HTTP protocol', () => {
  it('loads the default CORPUS module while preserving the synchronous factory', async () => {
    vi.mocked(loadCorpus).mockResolvedValue(corpus)
    const journal = new PublisherJournal(':memory:')
    cleanups.push(() => journal.close())
    const app = createPublisherApp({ journal, secret, faults: false })
    expect(app).toBeTypeOf('function')
    await app.locals.ready
    expect(loadCorpus).toHaveBeenCalledOnce()
  })
  it('rejects expired unsettled quotes but preserves already settled retries', () => {
    const journal = new PublisherJournal(':memory:')
    cleanups.push(() => journal.close())
    const q = journal.quote(request, 80, serializeEnvelope(paid))
    const s = journal.settle(q)
    const pending = journal.quote({ ...request, intentId: 'pending' }, 80, serializeEnvelope(paid))
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(q.expiresAt) + 60_000)
    try {
      expect(journal.settle(q)).toEqual(s)
      expect(() => journal.settle(pending)).toThrow('Quote expired')
      expect(journal.existingQuote(request)).toEqual(q)
      expect(journal.settlement('pending')).toEqual({ status: 'NOT_FOUND' })
    } finally { clock.mockRestore() }
  })
  it('strips premium bodies/spans and extra private properties from search and metadata', async () => {
    const base = await serve({ resources: corpus.map(item => ({ ...item, privateToken: secret } as CorpusResource)) })
    for (const path of [`/v1/profiles/${paid.profileId}/search?q=${canary}`, `/v1/profiles/${paid.profileId}/resources/paid`, '/v1/profiles', '/health']) {
      const response = await fetch(base + path)
      expect(response.status).toBe(200)
      const bytes = await response.text()
      expect(bytes).not.toContain(canary)
      expect(bytes).not.toContain(secret)
      expect(bytes).not.toContain('"body"')
      expect(bytes).not.toContain('"spans"')
    }
    const response = await fetch(base + contentPath())
    expect(response.status).toBe(402)
    const bytes = await response.text()
    expect(bytes).toContain('simulated-sgd')
    expect(bytes).not.toContain(canary)
  })
  it('delivers free bytes directly and exact quoted paid bytes only with a settled opaque token', async () => {
    const base = await serve()
    const publicResponse = await fetch(base + contentPath(free))
    expect(publicResponse.status).toBe(200)
    expect(await publicResponse.json()).toMatchObject({ body: free.body })
    const q = await quote(base)
    const s = await settle(base, q)
    const response = await fetch(base + contentPath(), { headers: { 'X-Delivery-Token': s.deliveryToken! } })
    expect(response.status).toBe(200)
    const bytes = await response.text()
    expect(bytes).toBe(serializeEnvelope(paid))
    const digest = createHash('sha256').update(bytes).digest('hex')
    expect(digest).toBe(q.contentDigest)
    expect(response.headers.get('digest')).toBe(`sha-256=${digest}`)
    expect(Object.keys(JSON.parse(bytes))).toEqual(['profileId', 'resourceId', 'version', 'title', 'publisher', 'body', 'spans'])
    expect(s.deliveryToken).not.toContain('run-a')
    for (const resource of [{ ...paid, version: 'v2' }, corpus[2]]) {
      const denied = await fetch(base + contentPath(resource), { headers: { 'X-Delivery-Token': s.deliveryToken! } })
      expect([402, 404]).toContain(denied.status)
      expect(await denied.text()).not.toContain(canary)
    }
    expect((await fetch(base + contentPath(), { headers: { 'X-Delivery-Token': 'forged' } })).status).toBe(402)
  })
  it('requires the same secret for settlement, reconciliation and enabled faults', async () => {
    const base = await serve({ faults: true })
    const q = await quote(base)
    expect((await post(base, '/v1/settlements', q)).status).toBe(401)
    expect((await fetch(base + '/v1/settlements/intent-a')).status).toBe(401)
    expect((await fetch(base + '/v1/settlements/intent-a', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401)
    expect((await post(base, '/__faults', { failNextDelivery: true })).status).toBe(401)
    const missing = await fetch(base + '/v1/settlements/missing', { headers: { Authorization: `Bearer ${secret}` } })
    expect(await missing.json()).toEqual({ status: 'NOT_FOUND' })
    const s = await settle(base, q)
    const status = await fetch(base + '/v1/settlements/intent-a', { headers: { Authorization: `Bearer ${secret}` } })
    expect(await status.json()).toEqual(s)
    const discovery = await (await fetch(base + `/v1/profiles/${paid.profileId}/search`)).text()
    expect(discovery).not.toContain(s.deliveryToken!)
    expect(discovery).not.toContain(s.receiptId!)
  })
  it('makes quotes immutable per intent, rejects rebinding and mismatched settlements', async () => {
    const base = await serve()
    const quotes = await Promise.all(Array.from({ length: 12 }, () => quote(base)))
    expect(new Set(quotes.map(q => JSON.stringify(q))).size).toBe(1)
    for (const change of [{ runId: 'other' }, { resourceId: 'other' }, { version: 'v2' }, { profileId: 'another' }]) {
      expect((await post(base, '/v1/quotes', { ...request, ...change })).status).toBe(409)
    }
    const q = quotes[0]
    expect((await post(base, '/v1/settlements', { ...q, quoteHash: 'tampered' }, true)).status).toBe(409)
    expect((await post(base, '/v1/settlements', { ...q, quoteId: 'other' }, true)).status).toBe(409)
    const settlements = await Promise.all(Array.from({ length: 12 }, () => settle(base, q)))
    expect(new Set(settlements.map(s => JSON.stringify(s))).size).toBe(1)
    const next = await settle(base, await quote(base, { ...request, intentId: 'intent-b', runId: 'run-b' }))
    expect(next.deliveryToken).not.toBe(settlements[0].deliveryToken)
  })
  it('enables faults only explicitly and retries delivery without charging again', async () => {
    const disabled = await serve()
    expect((await post(disabled, '/__faults', { failNextDelivery: true }, true)).status).toBe(404)
    const base = await serve({ faults: true })
    const q = await quote(base)
    const s = await settle(base, q)
    expect((await post(base, '/__faults', { failNextDelivery: true }, true)).status).toBe(200)
    // Unauthorized attempts cannot consume the scheduled paid-delivery fault.
    expect((await fetch(base + contentPath())).status).toBe(402)
    const read = () => fetch(base + contentPath(), { headers: { 'X-Delivery-Token': s.deliveryToken! } })
    const failed = await read()
    expect(failed.status).toBe(503)
    expect(await failed.text()).not.toContain(canary)
    expect((await read()).status).toBe(200)
    expect(await settle(base, q)).toEqual(s)
  })
  it('recovers immutable quotes, receipts, tokens and quoted bytes after corpus changes', async () => {
    const db = join(temporaryDirectory(), 'journal.db')
    const first = await serve({ journal: db })
    const q = await quote(first)
    const s = await settle(first, q)
    const restarted = await serve({ journal: db, resources: [] })
    expect(await quote(restarted)).toEqual(q)
    expect(await settle(restarted, q)).toEqual(s)
    const response = await fetch(restarted + contentPath(), { headers: { 'X-Delivery-Token': s.deliveryToken! } })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(serializeEnvelope(paid))
  })
  it('serializes parallel settlements across real publisher processes and survives a process restart', async () => {
    const dir = temporaryDirectory()
    const first = await processServer(dir)
    const second = await processServer(dir)
    expect((await fetch(first.base + contentPath())).status).toBe(402)
    const [q1, q2] = await Promise.all([quote(first.base), quote(second.base)])
    expect(q1).toEqual(q2)
    await first.stop()
    const replacement = await processServer(dir)
    expect(await quote(replacement.base)).toEqual(q1)
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => settle(i % 2 ? replacement.base : second.base, q1)))
    expect(new Set(results.map(s => JSON.stringify(s))).size).toBe(1)
    await replacement.stop()
    await second.stop()
    const restarted = await processServer(dir)
    expect(await settle(restarted.base, q1)).toEqual(results[0])
    const response = await fetch(restarted.base + contentPath(), { headers: { 'X-Delivery-Token': results[0].deliveryToken! } })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(serializeEnvelope(paid))
    expect(await (await fetch(restarted.base + `/v1/profiles/${paid.profileId}/search`)).text()).not.toContain(canary)
  }, 20_000)
  it('rejects malformed input without reflecting secrets or premium data', async () => {
    const base = await serve()
    const response = await fetch(base + '/v1/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' + canary })
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain(canary)
    expect((await post(base, '/v1/quotes', { ...request, runId: '' })).status).toBe(400)
    expect((await post(base, '/v1/quotes', { ...request, resourceId: free.resourceId })).status).toBe(400)
  })
})
