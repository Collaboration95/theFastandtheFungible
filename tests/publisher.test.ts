import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createPublisherApp } from '../publisher/routes.js'
import { paymentResponse, required, signFor } from './fixtures/x402-payer.js'
import { PublisherJournal } from '../publisher/journal.js'
import { loadCorpus } from '../publisher/corpus.js'
vi.mock('../publisher/corpus.js', () => ({ loadCorpus: vi.fn(), loadWriterCorpus: vi.fn(async () => (await import('./fixtures/corpus-mini/index.js')).miniCorpus) }))
import { exampleCandidate, exampleContent } from '../shared/contracts/examples.js'
import type { CorpusResource } from '../shared/contracts/corpus.js'

const secret = 'test-private-secret'
const canary = 'PAID_CANARY_do_not_discover_🧪'
const free: CorpusResource = { ...exampleCandidate, ...exampleContent }
const paid: CorpusResource = {
  ...free, resourceId: 'paid', tier: 'PAID', price: { amountMinor: 80, currency: 'SGD' },
  body: `${canary}\nExact quoted evidence.`, spans: [{ id: 's1', text: canary }],
}
const corpus = [free, paid, { ...paid, profileId: 'another', resourceId: 'other' }]
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
  it('gate-1: strips premium bodies/spans and extra private properties from search and metadata', async () => {
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
    expect(required(response).accepts[0]).toMatchObject({ network: 'xrpl:1', amount: '80000' })
    const bytes = await response.text()
    expect(bytes).not.toContain(canary)
  })
  it('gate-3: sells paid bytes only for a settled signed payment, with salts; a duplicate blob resends the same delivery, never a new charge', async () => {
    const base = await serve({ faults: true })
    expect((await fetch(base + contentPath(free))).status).toBe(200)
    const { header, hash } = signFor(required(await fetch(base + contentPath())).accepts[0])
    expect((await post(base, '/__faults', { failNextDelivery: true }, true)).status).toBe(200)
    // The fault fires after settlement: 503 with PAYMENT-RESPONSE, and no premium bytes.
    const failed = await fetch(base + contentPath(), { headers: { 'PAYMENT-SIGNATURE': header } })
    expect(failed.status).toBe(503)
    expect(paymentResponse(failed)).toMatchObject({ success: true, transaction: hash })
    expect(await failed.text()).not.toContain(canary)
    const delivered = await fetch(base + contentPath(), { headers: { 'PAYMENT-SIGNATURE': header } })
    expect(delivered.status).toBe(200)
    const body = await delivered.json() as { body: string; passages: unknown[]; salts: string[] }
    expect(body.body).toContain(canary)
    expect(body.salts).toHaveLength(body.passages.length)
  })
  it('enables faults only explicitly, behind the secret', async () => {
    expect((await post(await serve(), '/__faults', { failNextDelivery: true }, true)).status).toBe(404)
    expect((await post(await serve({ faults: true }), '/__faults', { failNextDelivery: true })).status).toBe(401)
  })
  it('settles once across real publisher processes sharing a journal, and survives a restart', async () => {
    const dir = temporaryDirectory()
    const first = await processServer(dir)
    const second = await processServer(dir)
    const { header, hash } = signFor(required(await fetch(first.base + contentPath())).accepts[0])
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => fetch((i % 2 ? first : second).base + contentPath(), { headers: { 'PAYMENT-SIGNATURE': header } })))
    expect(results.map(r => r.status)).toEqual(Array(10).fill(200))
    expect(new Set(results.map(r => paymentResponse(r).transaction))).toEqual(new Set([hash]))
    await first.stop(); await second.stop()
    const restarted = await processServer(dir)
    const again = await fetch(restarted.base + contentPath(), { headers: { 'PAYMENT-SIGNATURE': header } })
    expect(again.status).toBe(200)
    expect(paymentResponse(again).transaction).toBe(hash)
    const journal = new PublisherJournal(join(dir, 'journal.db'))
    cleanups.push(() => journal.close())
    expect(journal.settlementByTx(hash)).toBeDefined()
  }, 20_000)
  it('rejects a malformed PAYMENT-SIGNATURE without reflecting it, and the old endpoints are gone', async () => {
    const base = await serve()
    const response = await fetch(base + contentPath(), { headers: { 'PAYMENT-SIGNATURE': 'not-base64!' + 'x' } })
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('not-base64')
    for (const path of ['/v1/quotes', '/v1/settlements']) expect((await post(base, path, {})).status).toBe(404)
    expect((await fetch(base + '/v1/settlements/intent-a')).status).toBe(404)
  })
})
