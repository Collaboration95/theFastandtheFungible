import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Wallet } from 'xrpl'
import type { AddressInfo } from 'node:net'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { createPublisherApp } from '../publisher/routes.js'
import { seedEnvName } from '../publisher/registry.js'
import { createApiApp } from '../server/routes.js'
import { XrplPayer } from '../server/xrpl.js'
import { payAndFetch } from '../sdk/x402.js'
import { openPaymentJournal } from '../sdk/x402-journal.js'
import { decodeHeader } from '../shared/x402.js'
import { hireLedger } from './fixtures/hire-ledger.js'
import { signFor } from './fixtures/x402-payer.js'
import { USE_CASES } from './scenarios/use-cases.js'
import { auditRuns, readRuns } from '../scripts/gate-audit.js'
import { auditHireRecords } from '../server/hire/audit.js'
import { royaltyPlan } from '../server/hire/policy.js'

const clean: (() => unknown)[] = []
afterEach(async () => { for (const fn of clean.splice(0).reverse()) await fn(); vi.unstubAllEnvs() })
async function setup() {
  vi.stubEnv('LLM_PROVIDER', 'fixture'); vi.stubEnv('DECISION_PROVIDER', 'fixture'); vi.stubEnv('SEARCH_EMBEDDINGS', 'off')
  vi.stubEnv('RA_API_TOKEN', 'hire-test-token'); vi.stubEnv('WALLET_DAILY_CAP_MINOR', '1000')
  const dir = mkdtempSync(join(tmpdir(), 'hire-')); clean.push(() => rmSync(dir, { recursive: true, force: true }))
  const chain = hireLedger(), wallet = Wallet.generate(), caller = Wallet.generate()
  const corpus = await loadWriterCorpus()
  const env = Object.fromEntries(corpus.publishers.map(p => [seedEnvName(p.slug), Wallet.generate().seed]))
  const pub = createPublisherApp({ writers: corpus, rail: 'xrpl-testnet', ledger: chain.ledger, journal: join(dir, 'publisher.db'), env })
  await pub.locals.ready; clean.push(() => pub.locals.journal.close())
  async function listen(app: ReturnType<typeof createPublisherApp>) {
    const server = app.listen(0, '127.0.0.1'); await new Promise(done => server.once('listening', done))
    clean.push(() => { server.closeAllConnections(); return new Promise(done => server.close(done)) })
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }
  const publisherUrl = await listen(pub)
  const options = { payer: new XrplPayer(chain.ledger, wallet, { pollMs: 1, timeoutMs: 100 }), dbPath: join(dir, 'app.db'), publisherUrl }
  const api = await createApiApp(options); clean.push(() => api.close())
  const url = await listen(api.app) + '/v1/ask'
  const journal = openPaymentJournal(join(dir, 'caller.db')); clean.push(() => journal.close())
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer hire-test-token' }
  const body = JSON.stringify({ question: USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?'), budgetMinor: 200 })
  const opts = { wallet: caller, maxDrops: '220000', journal, ledger: chain.ledger, headers, body, method: 'POST', idempotencyKey: 'hire-test' }
  return { api, chain, corpus, url, opts, options, headers, body, caller }
}
it('settles one caller intent, buys, pays every cited writer including free, returns change; replay and restart do not pay again', async () => {
  const s = await setup()
  const [first, concurrent] = await Promise.all([payAndFetch(s.url, s.opts), payAndFetch(s.url, s.opts)])
  const result = await first.response.json()
  expect(await concurrent.response.json()).toEqual(result)
  expect(result.phase).toBe('DONE')
  expect(result.purchases.filter((p: { verified: boolean }) => p.verified)).toHaveLength(1)
  expect(result.citations.some((c: { grantIntentId: string | null }) => !c.grantIntentId)).toBe(true)
  const run = s.api.store.getRun(result.run_id)
  const royalties = result.moneyChain.payments.filter((p: { kind: string }) => p.kind === 'royalty')
  expect(royalties.length).toBe(new Set(run.contents.filter(c => result.citations.some((x: { resourceId: string }) => x.resourceId === c.resourceId)).map(c => c.profileId)).size)
  const hires = [{ runId: run.runId, budgetMinor: 200, result }]
  expect(auditRuns([run], s.corpus, [], hires).total).toBe(0)
  expect(auditRuns(readRuns(s.options.dbPath), s.corpus, [], hires).total).toBe(0)
  expect(royalties.reduce((sum: number, p: { amountDrops: string }) => sum + Number(p.amountDrops), 0)).toBe(5000)
  expect(s.api.store.walletStatus()).toMatchObject({ reservedMinor: 0, spentMinor: 205 })
  const submits = s.chain.submits
  // New service connection against the same durable DB, with the same payer and ledger.
  const restarted = await createApiApp(s.options); clean.push(() => restarted.close())
  const server = restarted.app.listen(0, '127.0.0.1'); await new Promise(done => server.once('listening', done))
  clean.push(() => { server.closeAllConnections(); return new Promise(done => server.close(done)) })
  // Forward the saved signature to the restarted process while keeping the caller journal identity stable.
  const replay = await payAndFetch(s.url, { ...s.opts, fetch: (url, init) => fetch(String(url).replace(new URL(s.url).origin, `http://127.0.0.1:${(server.address() as AddressInfo).port}`), init) })
  expect(await replay.response.json()).toEqual(result)
  expect(s.chain.submits).toBe(submits)
  expect(auditHireRecords([run], [{ ...hires[0], result: { ...result, moneyChain: { ...result.moneyChain, royaltyDrops: '1' } } }])).toMatchObject([{ rule: 'money_chain_reconciliation' }])
  const bad = structuredClone(result); bad.moneyChain.payments.find((p: { kind: string }) => p.kind === 'royalty').payTo = Wallet.generate().classicAddress
  expect(auditHireRecords([run], [{ ...hires[0], result: bad }]).some(v => v.rule === 'royalty_policy')).toBe(true)
}, 30_000)

it('refuses unauthenticated calls, paused/capped admission, changed requests and a second blob on a paid invoice', async () => {
  const s = await setup()
  expect((await fetch(s.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: s.body })).status).toBe(401)
  const paid = await payAndFetch(s.url, s.opts); await paid.response.body?.cancel()
  const submits = s.chain.submits
  const challenge = await fetch(s.url, { method: 'POST', headers: { ...s.headers, 'Idempotency-Key': 'hire-test' }, body: s.body })
  const terms = decodeHeader('PAYMENT-REQUIRED', challenge.headers.get('PAYMENT-REQUIRED')).accepts[0]
  const other = signFor(terms, { Sequence: 999 }, s.caller)
  expect((await fetch(s.url, { method: 'POST', headers: { ...s.headers, 'Idempotency-Key': 'hire-test', 'PAYMENT-SIGNATURE': other.header }, body: s.body })).status).toBe(500)
  expect(s.chain.submits).toBe(submits)
  expect((await fetch(s.url, { method: 'POST', headers: { ...s.headers, 'Idempotency-Key': 'hire-test' }, body: JSON.stringify({ question: 'Changed', budgetMinor: 200 }) })).status).toBe(409)
  s.api.store.setPaused(true)
  await expect(payAndFetch(s.url, { ...s.opts, idempotencyKey: 'paused' })).rejects.toThrow()
  expect(s.chain.submits).toBe(submits)
  s.api.store.setPaused(false); vi.stubEnv('WALLET_DAILY_CAP_MINOR', '210')
  await expect(payAndFetch(s.url, { ...s.opts, idempotencyKey: 'capped' })).rejects.toThrow()
  expect(s.chain.submits).toBe(submits)
}, 30_000)

it('rejects Mainnet, overspend and resource substitution before signing', async () => {
  const s = await setup()
  let signs = 0; const sign = s.caller.sign.bind(s.caller); s.caller.sign = (...args) => { signs++; return sign(...args) }
  for (const mutate of [
    (r: any) => { r.accepts[0].network = 'xrpl:0' }, // eslint-disable-line @typescript-eslint/no-explicit-any
    (r: any) => { r.accepts[0].amount = '9999999' }, // eslint-disable-line @typescript-eslint/no-explicit-any
    (r: any) => { r.resource.url = '/other' }, // eslint-disable-line @typescript-eslint/no-explicit-any
  ]) {
    await expect(payAndFetch(s.url, { ...s.opts, fetch: async (url, init) => {
      const response = await fetch(url, init)
      const required = decodeHeader('PAYMENT-REQUIRED', response.headers.get('PAYMENT-REQUIRED')); mutate(required)
      return new Response('', { status: 402, headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(required)).toString('base64') } })
    } })).rejects.toThrow()
  }
  expect(signs).toBe(0); expect(s.chain.submits).toBe(0)
  // Pin equal shares, duplicate-citation de-duplication and slug-sorted remainder.
  const cite = (id: string) => ({ resourceId: id, version: '1', spanId: 'p' })
  const run = { runId: 'r', answers: [{ claims: [{ citations: [cite('b'), cite('a'), cite('c'), cite('a')] }] }], contents: ['a','b','c'].map(profileId => ({ profileId, resourceId: profileId, version: '1', spans: [{ id: 'p' }] })) }
  const royalty = royaltyPlan(run as never, { a: 'A', b: 'B', c: 'C' })
  expect(royalty.map(p => p.amountDrops)).toEqual(['1667', '1667', '1666'])
})
