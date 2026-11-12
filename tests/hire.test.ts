import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
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
import { verifyHireChain } from '../mcp/try-hire.js'
import { verifyOnTestnet } from '../server/audit.js'

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
  return { api, chain, corpus, url, opts, options, headers, body, caller, wallet }
}
it('settles one caller intent, buys, pays every cited writer including free, returns change; replay and restart do not pay again', async () => {
  const s = await setup()
  const [first, concurrent] = await Promise.all([payAndFetch(s.url, s.opts), payAndFetch(s.url, s.opts)])
  const result = await first.response.json()
  expect(await concurrent.response.json()).toEqual(result)
  expect(result.phase).toBe('DONE')
  await verifyHireChain(result, s.chain.ledger)
  await expect(verifyHireChain({ ...result, moneyChain: { ...result.moneyChain, retainedDrops: '1' } }, s.chain.ledger)).rejects.toThrow('does not balance')
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
  // #288: the inbound payment, the purchase, every royalty and the change are in the hash chain exactly once, despite the concurrent call, replay and restart.
  const store = s.api.store, payouts = result.moneyChain.payments as { kind: string; txHash: string; amountDrops: string; payTo: string }[]
  expect(store.auditVerify()).toMatchObject({ ok: true, failures: [], coverage: { inbound: 1, payouts: payouts.length, receipts: 1 } })
  const kinds = store.auditEntries().map(e => e.kind)
  expect(kinds.filter(k => k === 'inbound')).toHaveLength(1)
  expect(kinds.filter(k => k === 'payout-reserve')).toHaveLength(1)
  expect(kinds.filter(k => k === 'payout-sign')).toHaveLength(payouts.length)
  expect(kinds.filter(k => k === 'payout-settle')).toHaveLength(payouts.length)
  expect(store.auditEntries().find(e => e.kind === 'admission')).toMatchObject({ surface: 'x402', principal: result.moneyChain.inbound.payer, data: { hireReserveMinor: 20, requestedMinor: 200, admittedMinor: 200 } })
  const rows = store.receiptRows()
  expect(rows.map(r => r.kind).sort()).toEqual(['change', 'inbound', 'purchase', ...royalties.map(() => 'royalty')].sort())
  expect(rows.find(r => r.kind === 'inbound')).toMatchObject({ txHash: result.moneyChain.inbound.txHash, amountDrops: result.moneyChain.inbound.amountDrops, payer: result.moneyChain.inbound.payer, payee: result.moneyChain.inbound.payTo })
  for (const p of payouts) expect(rows.find(r => r.txHash === p.txHash)).toMatchObject({ kind: p.kind, amountDrops: p.amountDrops, payee: p.payTo, status: 'CONFIRMED', amountMinor: '' })
  // The same rows re-check against the (fake) ledger: destination, delivered amount and InvoiceID of all of them.
  // (The synthetic ledger reports a moving ledger index per lookup, so the index comparison is left out here.)
  expect((await verifyOnTestnet(rows.map(r => ({ ...r, ledgerIndex: '' as const })), s.chain.ledger)).map(c => c.status)).toEqual(rows.map(() => 'ok'))
  expect(auditHireRecords([run], [{ ...hires[0], result: { ...result, moneyChain: { ...result.moneyChain, royaltyDrops: '1' } } }])).toMatchObject([{ rule: 'money_chain_reconciliation' }])
  const bad = structuredClone(result); bad.moneyChain.payments.find((p: { kind: string }) => p.kind === 'royalty').payTo = Wallet.generate().classicAddress
  expect(auditHireRecords([run], [{ ...hires[0], result: bad }]).some(v => v.rule === 'royalty_policy')).toBe(true)
  // Rewriting a payout amount in the money table no longer matches the signed entry in the chain.
  const raw = new DatabaseSync(s.options.dbPath), tampered = (payouts[0] as unknown as { id: string }).id
  raw.prepare('UPDATE policy_payments SET json=replace(json, ?, ?) WHERE id=?').run(`"amountDrops":"${payouts[0].amountDrops}"`, '"amountDrops":"1"', tampered); raw.close()
  expect(store.auditVerify().failures.map(f => f.reason)).toEqual([expect.stringContaining('differs from its payout-sign entry')])
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

it('recovers a payout timeout with the original signed blob and pays a generic article seller', async () => {
  const s = await setup()
  const request = s.chain.ledger.request.bind(s.chain.ledger)
  let dropped = false
  s.chain.ledger.request = async r => {
    const response = await request(r)
    // The fake ledger applied it but the submit response was lost, after durable signing.
    if (r.command === 'submit' && s.chain.txs.size === 3 && !dropped) { dropped = true; throw new Error('Ambiguous payout timeout') }
    return response
  }
  const first = await payAndFetch(s.url, s.opts)
  expect(first.response.status).toBe(500)
  expect(s.api.store.walletStatus().reservedMinor).toBeGreaterThan(0)
  const paid = await payAndFetch(s.url, s.opts)
  const result = await paid.response.json()
  expect(result.phase).toBe('DONE')
  expect(s.chain.txs.size).toBe(5)
  expect(s.chain.submits).toBe(5)
  expect(s.api.store.walletStatus().reservedMinor).toBe(0)
  const article = s.corpus.articles.find(a => a.tier === 'PAID')!
  const generic = await payAndFetch(`${s.options.publisherUrl}/w/${article.publisherSlug}/articles/${article.articleId}`, {
    wallet: s.caller, ledger: s.chain.ledger, maxDrops: '100000', idempotencyKey: 'generic-article', journal: s.opts.journal,
  })
  expect(generic.response.ok).toBe(true)
  expect((await generic.response.json()).articleId).toBe(article.articleId)
}, 30_000)

it('refuses a payout to a denylisted payee before signing it, and the audit log keeps the listed reason (#288)', async () => {
  const s = await setup()
  const list = join(mkdtempSync(join(tmpdir(), 'hire-deny-')), 'deny.json'); clean.push(() => rmSync(join(list, '..'), { recursive: true, force: true }))
  writeFileSync(list, JSON.stringify([{ address: s.caller.classicAddress, reason: 'Operator list: test entry' }]))
  vi.stubEnv('PAYEE_DENYLIST_FILE', list)
  const response = (await payAndFetch(s.url, s.opts)).response
  expect(response.status).toBe(500)
  const store = s.api.store, entries = store.auditEntries()
  expect(entries.find(e => e.kind === 'refusal' && e.data.stage === 'payout')).toMatchObject({ surface: 'x402', data: { paymentKind: 'change', payTo: s.caller.classicAddress, listReason: 'Operator list: test entry', reason: 'Payee is on the operator denylist; nothing was charged' } })
  expect(entries.filter(e => e.kind === 'inbound')).toHaveLength(1)
  expect(entries.some(e => e.kind === 'payout-sign')).toBe(false)
  expect(store.listRuns().flatMap(run => store.policyPayments(run.runId)).every(p => !p.submission)).toBe(true)
  expect(store.auditVerify().ok).toBe(true)
}, 30_000)

it.each(['purchase', 'royalty'] as const)('refunds unspent %s after denylist refusal; replay/restart never charge again (#310)', async kind => {
  const s = await setup()
  const registry = await (await fetch(`${s.options.publisherUrl}/registry`)).json()
  const payee = registry.publishers.find((p: { slug: string }) => p.slug === (kind === 'purchase' ? 'notfinancialtimes' : 'open-records')).wallet
  expect(payee).toBeTruthy()
  const dir = mkdtempSync(join(tmpdir(), 'hire-refund-')); clean.push(() => rmSync(dir, { recursive: true, force: true }))
  const list = join(dir, 'deny.json'); writeFileSync(list, JSON.stringify([{ address: payee, reason: `chaos ${kind} refusal` }]))
  vi.stubEnv('PAYEE_DENYLIST_FILE', list)
  const first = await payAndFetch(s.url, s.opts), result = await first.response.json()
  expect(first.response.status).toBe(200)
  expect(s.api.store.walletStatus().reservedMinor).toBe(0)
  expect(s.api.store.auditVerify().ok).toBe(true)
  const run = s.api.store.getRun(result.run_id)
  expect(auditRuns([run], s.corpus, [], [{ runId: run.runId, budgetMinor: 200, result }]).total).toBe(0)
  if (kind === 'purchase') {
    expect(run.intents.map(i => ({ profile: i.profileId, status: i.status, error: i.error }))).toContainEqual(expect.objectContaining({ status: 'FAILED_NOT_SETTLED', error: expect.stringContaining('denylist') }))
    expect(Number(result.moneyChain.changeDrops)).toBe(200000 - run.spentMinor * 1000)
  } else {
    expect(result.moneyChain.cancelledRoyalties.length).toBeGreaterThan(0)
    expect(s.api.store.auditEntries().some(e => e.kind === 'payout-cancel')).toBe(true)
    const returned = result.moneyChain.cancelledRoyalties.reduce((sum: number, p: { amountDrops: string }) => sum + Number(p.amountDrops), 0)
    expect(Number(result.moneyChain.changeDrops)).toBe(200000 - run.spentMinor * 1000 + returned)
  }
  expect(result.moneyChain.payments.every((p: { payTo: string }) => p.payTo !== payee)).toBe(true)
  const submits = s.chain.submits
  // Removal of the denylist cannot revive a cancelled payment, even across restart.
  writeFileSync(list, '[]')
  const restarted = await createApiApp(s.options); clean.push(() => restarted.close())
  const server = restarted.app.listen(0, '127.0.0.1'); await new Promise(done => server.once('listening', done))
  clean.push(() => { server.closeAllConnections(); return new Promise(done => server.close(done)) })
  const replay = await payAndFetch(s.url, { ...s.opts, fetch: (url, init) => fetch(String(url).replace(new URL(s.url).origin, `http://127.0.0.1:${(server.address() as AddressInfo).port}`), init) })
  expect(await replay.response.json()).toEqual(result); expect(s.chain.submits).toBe(submits)
}, 30000)


it('scopes hired callers to agent keys, counts fees beneath caps and attributes every money row', async () => {
  const s = await setup()
  const a = s.api.store.addAgent({ name: 'Hire A', maxMinor: 220, dailyMinor: 220 })
  const b = s.api.store.addAgent({ name: 'Hire B', maxMinor: 220, dailyMinor: 220 })
  const opts = { ...s.opts, headers: { ...s.opts.headers, Authorization: `Bearer ${a.token}` } }
  const first = await payAndFetch(s.url, opts)
  const result = await first.response.json()
  expect(result.phase).toBe('DONE')
  expect(s.api.store.runPrincipal(result.run_id)).toMatchObject({ surface: 'agent', principal: a.id })
  const rows = s.api.store.receiptRows({ principal: a.id })
  expect(rows.map(r => r.kind)).toEqual(expect.arrayContaining(['inbound', 'purchase', 'royalty', 'change']))
  expect(rows.every(r => r.principal === a.id)).toBe(true)
  expect(s.api.store.agentStatus(a.id).spentMinor).toBeLessThanOrEqual(220)
  expect(s.api.store.agentStatus(b.id)).toMatchObject({ spentMinor: 0, reservedMinor: 0 })
  const quote = await fetch(s.url, { method: 'POST', headers: { ...s.headers, Authorization: `Bearer ${b.token}`, 'Idempotency-Key': 'hire-test' }, body: s.body })
  expect(quote.status).toBe(402) // same user key, distinct agent-bound invoice
  const cap = s.api.store.addAgent({ name: 'Too small', maxMinor: 200, dailyMinor: 200 })
  const before = s.chain.submits
  let refusalStatus = 0
  await expect(payAndFetch(s.url, { ...s.opts, idempotencyKey: 'under-cap', headers: { ...s.headers, Authorization: `Bearer ${cap.token}` }, fetch: async (url, init) => { const r = await fetch(url, init); refusalStatus = r.status; return r } })).rejects.toThrow('x402 payment refused (HTTP 409); retain this intent for recovery')
  expect(refusalStatus).toBe(409)
  expect(s.chain.submits).toBe(before) // the service fee fits under per-call authority too
  s.api.store.setAgentPaused(a.id, true, true)
  const revoked = await fetch(s.url, { method: 'POST', headers: { ...opts.headers, 'Idempotency-Key': 'new' }, body: s.body })
  expect(revoked.status).toBe(401)
})

it('resolves federated hire recipients through the approved roster and canonical identities', async () => {
  const s=await setup()
  s.api.purchases.client.options.baseUrls=[s.options.publisherUrl]
  const response=await payAndFetch(s.url,s.opts)
  const result=await response.response.json()
  expect(result.phase).toBe('DONE')
  expect(result.citations.every((c:{source?:unknown})=>!!c.source)).toBe(true)
  expect(Object.keys(result.moneyChain.writerAddresses).every(k=>k.startsWith('['))).toBe(true)
  expect(result.moneyChain.payments.filter((p:{kind:string})=>p.kind === 'royalty').reduce((n:number,p:{amountDrops:string})=>n+Number(p.amountDrops),0)).toBe(5000)
  expect(auditRuns([s.api.store.getRun(result.run_id)],s.corpus,[],[{runId:result.run_id,budgetMinor:200,result}]).total).toBe(0)
})
it('labels an unresolved royalty recipient and authorizes no royalty payout', async()=>{
  const s=await setup(), start=s.api.loop.start.bind(s.api.loop)
  vi.spyOn(s.api.loop,'start').mockImplementation(async id=>{await start(id);vi.spyOn(s.api.purchases.client,'registry').mockResolvedValue([])})
  const response=await payAndFetch(s.url,s.opts)
  expect(response.response.ok).toBe(false)
  const run=s.api.store.getRun(s.api.store.listRuns()[0].runId)
  expect(run.events.some(e=>e.type === 'ROYALTY_UNRESOLVED')).toBe(true)
  expect(s.api.store.policyPayments(run.runId).filter(p=>p.kind === 'royalty')).toEqual([])
})

it.each(['unsigned', 'validated-response-lost', 'expired', 'ambiguous'] as const)('recovers %s payouts after restart without caller replay or double payment', async fault => {
  const s = await setup()
  const request = s.chain.ledger.request.bind(s.chain.ledger)
  let faulted = false, failedBlob = '', allow = false
  const pay = s.options.payer.pay.bind(s.options.payer)
  if (fault === 'unsigned') vi.spyOn(s.options.payer, 'pay').mockImplementation((terms, persist, send) => {
    if (terms.memo) { faulted = true; return Promise.reject(Error('Crash before payout signing')) }
    return pay(terms, persist, send)
  })
  s.chain.ledger.request = async r => {
    if (r.command === 'submit') {
      const tx = (await import('xrpl')).decode(String(r.tx_blob))
      if (tx.Memos && !faulted) {
        faulted = true; failedBlob = String(r.tx_blob)
        if (fault === 'validated-response-lost') await request(r)
        throw Error('Injected crash at payout submission')
      }
      if (faulted && !allow && tx.Memos) throw Error('Offline until restart')
    }
    return request(r)
  }
  const first = await payAndFetch(s.url, s.opts)
  expect(first.response.status).toBe(500)
  const run = s.api.store.listRuns()[0]
  const inboundHash = s.api.store.auditEntries().find(e => e.kind === 'inbound')!.data.txHash
  const saved = s.api.store.policyPayments(run.runId).find(p => p.submission) ?? s.api.store.policyPayments(run.runId)[0]
  if (fault === 'unsigned') expect(s.api.store.policyPayments(run.runId).every(p => !p.submission)).toBe(true)
  else expect(saved.submission!.txBlob).toBe(failedBlob)
  await s.api.close()
  let provedExpired = false
  s.chain.ledger.request = async r => {
    if (fault === 'expired' && r.command === 'ledger_current') return { result: { ledger_current_index: saved.submission!.lastLedgerSequence + 1 } }
    if (fault === 'expired' && r.command === 'ledger') return { result: { ledger_index: saved.submission!.lastLedgerSequence + 1 } }
    if (fault === 'expired' && r.command === 'account_info' && typeof r.ledger_index === 'number') {
      provedExpired = true
      const tx = (await import('xrpl')).decode(saved.submission!.txBlob)
      return { result: { account_data: { Sequence: tx.Sequence } } }
    }
    return request(r)
  }
  // A missing hash before expiry is ambiguous: retain the original signature, never replace it.
  allow = true
  const restarted = await createApiApp({ ...s.options, payer: new XrplPayer(s.chain.ledger, s.wallet, { pollMs: 1, timeoutMs: 100 }) })
  clean.push(() => restarted.close())
  await Promise.all([restarted.reconcileOnce(), restarted.reconcileOnce()])
  const payments = restarted.store.policyPayments(run.runId)
  expect(payments.every(p => p.confirmedAt)).toBe(true)
  expect(restarted.store.walletStatus().reservedMinor).toBe(0)
  expect(restarted.store.auditEntries().filter(e => e.kind === 'inbound')).toHaveLength(1)
  expect([...s.chain.txs.keys()].filter(hash => hash === inboundHash)).toHaveLength(1)
  const newPayment = payments.find(p => p.id === saved.id)!
  if (fault === 'expired') {
    expect(provedExpired).toBe(true)
    expect(newPayment.retiredSubmissions).toEqual([saved.submission])
    expect(newPayment.submission!.txHash).not.toBe(saved.submission!.txHash)
    expect(s.chain.txs.has(saved.submission!.txHash)).toBe(false)
  } else if (fault !== 'unsigned') expect(newPayment.submission).toEqual(saved.submission)
  expect(restarted.store.auditVerify().ok).toBe(true)
  const before = s.chain.submits
  await restarted.reconcileOnce()
  expect(s.chain.submits).toBe(before)
  expect(s.chain.txs.size).toBe(5)
}, 30_000)

it('resumes a settled hire after crashing before research, with no caller replay', async () => {
  const s = await setup()
  const record = s.api.store.recordAudit.bind(s.api.store)
  const crash = vi.spyOn(s.api.store, 'recordAudit').mockImplementation((input, identity) => {
    if (input.kind === 'inbound') throw Error('Crash after inbound settlement, before research')
    return record(input, identity)
  })
  const response = await payAndFetch(s.url, s.opts)
  expect(response.response.status).toBe(500)
  expect(s.chain.txs.size).toBe(1)
  crash.mockRestore()
  const restarted = await createApiApp({ ...s.options, payer: new XrplPayer(s.chain.ledger, s.wallet, { pollMs: 1, timeoutMs: 100 }) })
  clean.push(() => restarted.close())
  const run = restarted.store.listRuns()[0]
  expect(run.phase).toBe('DONE')
  expect(restarted.store.policyPayments(run.runId).every(p => p.confirmedAt)).toBe(true)
  expect(s.chain.txs.size).toBe(5)
  expect(restarted.store.auditEntries().filter(e => e.kind === 'inbound')).toHaveLength(1)
  const before = s.chain.submits
  await restarted.reconcileOnce()
  expect(s.chain.submits).toBe(before)
}, 30_000)

it.each(['pending', 'expired'] as const)('does not submit an unpaid %s inbound during background recovery', async state => {
  const s = await setup(), key = `unpaid-${state}`
  const challenge = await fetch(s.url, { method: 'POST', headers: { ...s.headers, 'Idempotency-Key': key }, body: s.body })
  const terms = decodeHeader('PAYMENT-REQUIRED', challenge.headers.get('PAYMENT-REQUIRED')).accepts[0]
  const signed = signFor(terms, { LastLedgerSequence: 120, Sequence: 1 }, s.caller)
  const { HireJournal } = await import('../server/hire/journal.js')
  const hires = new HireJournal(s.options.dbPath)
  try {
    const hire = hires.get(key)!
    const admitted = s.api.store.admit({ surface: 'x402', principal: s.caller.classicAddress, question: hire.question, requestedMinor: hire.budgetMinor, idempotencyKey: hire.quote.invoiceId, maxMinor: 500, reserveMinor: 20 })
    hires.patch(key, { signature: signed.header, runId: admitted.run.runId })
    const request = s.chain.ledger.request.bind(s.chain.ledger)
    s.chain.ledger.request = async r => {
      if (r.command === 'ledger') return { result: { ledger_index: state === 'expired' ? 121 : 100 } }
      if (r.command === 'account_info' && typeof r.ledger_index === 'number') return { result: { account_data: { Sequence: 1 } } }
      return request(r)
    }
    await s.api.reconcileOnce()
    expect(s.chain.submits).toBe(0)
    expect(s.api.store.policyPayments(admitted.run.runId)).toEqual([])
    expect(hires.due()).toHaveLength(state === 'expired' ? 0 : 1)
    if (state === 'expired') expect(s.api.store.walletStatus().reservedMinor).toBe(0)
  } finally { hires.close() }
}, 30_000)

it('regulated mode returns unsigned royalties for uncredentialed writers and records each refusal',async()=>{
  const s=await setup(),credentials=await import('../server/writer-credentials.js')
  vi.stubEnv('REGULATED_MODE','on');vi.stubEnv('WRITER_CREDENTIAL_DOMAIN','A'.repeat(64))
  const observed=vi.spyOn(credentials,'acceptedCredential').mockResolvedValue({status:'unverified'})
  try{
    const paid=await payAndFetch(s.url,s.opts),result=await paid.response.json()
    expect(result.phase).toBe('DONE')
    const run=s.api.store.getRun(result.run_id),audit=s.api.store.auditEntries()
    expect(run.spentMinor).toBe(0)
    expect(audit.some(e=>e.kind==='refusal'&&e.data.screen==='credential-domain')).toBe(true)
    expect(audit.some(e=>e.kind==='payout-sign'&&e.data.paymentKind==='royalty')).toBe(false)
    expect(s.api.store.auditVerify().ok).toBe(true)
  }finally{observed.mockRestore()}
})

it('returns royalties revoked between payout planning and signing, without losing the new refund',async()=>{
 const s=await setup(),credentials=await import('../server/writer-credentials.js')
 vi.stubEnv('REGULATED_MODE','on');vi.stubEnv('WRITER_CREDENTIAL_DOMAIN','A'.repeat(64))
 let revoked=false,planned=0
 const payments=s.api.store.policyPayments.bind(s.api.store)
 const observed=vi.spyOn(credentials,'acceptedCredential').mockImplementation(async()=>revoked?{status:'unverified'}:{status:'verified',issuerLabel:'Operator',issuer:s.wallet.classicAddress,credentialType:'AA',domainId:'A'.repeat(64),credentialId:'C'.repeat(64),ledgerIndex:1,checkedAt:new Date().toISOString()})
 const paymentSpy=vi.spyOn(s.api.store,'policyPayments').mockImplementation(runId=>{const values=payments(runId);if(values.some(p=>p.kind==='royalty')&&++planned===2)revoked=true;return values})
 try{
  const paid=await payAndFetch(s.url,s.opts),result=await paid.response.json()
  expect(paid.response.status).toBe(200);expect(result.phase).toBe('DONE')
  expect(revoked).toBe(true);expect(result.moneyChain.cancelledRoyalties.length).toBeGreaterThan(0)
  expect(result.moneyChain.cancelledRoyalties.every((p:{reason:string})=>p.reason.includes('accepted credential'))).toBe(true)
  expect(result.moneyChain.payments.every((p:{kind:string})=>p.kind!=='royalty')).toBe(true)
  expect(s.api.store.auditVerify().ok).toBe(true)
  await verifyHireChain(result,s.chain.ledger)
  const submits=s.chain.submits;expect(await (await payAndFetch(s.url,s.opts)).response.json()).toEqual(result);expect(s.chain.submits).toBe(submits)
 }finally{paymentSpy.mockRestore();observed.mockRestore()}
})

it('returns an OFAC-blocked royalty with the exact refusal and sanctions audit attribution',async()=>{
 const s=await setup(),credentials=await import('../server/writer-credentials.js'),screen=await import('../server/payee-screening.js')
 const registry=await(await fetch(`${s.options.publisherUrl}/registry`)).json(),payee=registry.publishers.find((p:{slug:string})=>p.slug==='open-records').wallet
 vi.stubEnv('REGULATED_MODE','on');vi.stubEnv('WRITER_CREDENTIAL_DOMAIN','A'.repeat(64))
 const observed=vi.spyOn(credentials,'acceptedCredential').mockResolvedValue({status:'verified',issuerLabel:'Operator',issuer:s.wallet.classicAddress,credentialType:'AA',domainId:'A'.repeat(64),credentialId:'C'.repeat(64),ledgerIndex:1,checkedAt:new Date().toISOString()})
 const refusal='Payee is on the OFAC XRP address list; nothing was charged'
 const screened=vi.spyOn(screen,'screenPayee').mockImplementation(address=>address===payee?{refusal,address,list:'ofac-sdn-xrp'}:undefined)
 try{
  const paid=await payAndFetch(s.url,s.opts),result=await paid.response.json()
  expect(paid.response.status).toBe(200);expect(result.phase).toBe('DONE')
  expect(result.moneyChain.cancelledRoyalties).toContainEqual(expect.objectContaining({payTo:payee,reason:refusal}))
  expect(result.moneyChain.payments.every((p:{payTo:string})=>p.payTo!==payee)).toBe(true)
  expect(observed.mock.calls.every(([address])=>address!==payee)).toBe(true)
  expect(s.api.store.auditEntries()).toContainEqual(expect.objectContaining({kind:'refusal',data:expect.objectContaining({payTo:payee,screen:'ofac-sdn-xrp',reason:refusal})}))
  expect(s.api.store.auditVerify().ok).toBe(true);await verifyHireChain(result,s.chain.ledger)
 }finally{screened.mockRestore();observed.mockRestore()}
})
