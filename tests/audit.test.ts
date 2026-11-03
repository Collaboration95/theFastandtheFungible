// #288: the hash-chained audit log, receipt export, payee denylist and retention, on the SIMULATED rail with
// the real Store, PurchaseManager and a real publisher app (tests/fixtures/pay-path.ts). Ephemeral ports only.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { challenge } from '../server/challenges.js'
import { admit } from '../server/spend-policy.js'
import { assertSafe, verifyChain, verifyOnTestnet, toCsv, toJsonl, receiptRows, RECEIPT_COLUMNS, type ReceiptRow } from '../server/audit.js'
import { parseWindow, PRUNED_QUESTION } from '../server/retention.js'
import { screenPayee } from '../server/payee-screening.js'
import { Store } from '../server/store.js'
import { SIMULATED_LABEL, XRPL_LABEL } from '../shared/contracts/index.js'
import { honestArticle, payPath } from './fixtures/pay-path.js'

const cleanups: (() => unknown)[] = []
afterEach(async () => { for (const fn of cleanups.splice(0).reverse()) await fn(); vi.unstubAllEnvs() })
const tmp = () => { const dir = mkdtempSync(join(tmpdir(), 'audit-')); cleanups.push(() => rmSync(dir, { recursive: true, force: true })); return dir }
const QUESTION = 'PRIVATE_QUESTION_TEXT_7731 how long are TSMC lead times'

/** An admitted run that buys the honest article (VERIFIED) and AlphaLeak (CLAIM_FAILED → REFUNDED): the UC3 money path. */
async function uc3Like() {
  const dir = tmp(), dbPath = join(dir, 'app.db')
  const h = await payPath({ storePath: dbPath })
  cleanups.push(h.close)
  const { run } = admit(h.store, { surface: 'web', principal: 'operator', question: QUESTION, requestedMinor: 500, idempotencyKey: 'k1', maxMinor: 500 })
  h.store.addDecision(run.runId, { round: 1, gap: 'lead times', gapMaterial: 1, provider: 'fixture', model: 'metadata-fixture', promptVersion: 'p1', threshold: 0.6, rows: [], selectedResourceId: honestArticle.articleId })
  const honest = await h.manager.purchase({ runId: run.runId, candidate: await h.candidate(honestArticle), intentId: 'honest' })
  const leak = await h.manager.purchase({ runId: run.runId, candidate: await h.candidate(), intentId: 'leak' })
  expect([honest.status, leak.status]).toEqual(['VERIFIED', 'CLAIM_FAILED'])
  expect((await challenge(h.manager, 'leak')).status).toBe('REFUNDED')
  h.store.updateRun(run.runId, { phase: 'DONE' })
  return { ...h, dir, dbPath, run }
}
/** Tamper with the file the way an attacker with disk access would: drop the append-only triggers first. */
function tamper(dbPath: string, sql: string) {
  const raw = new DatabaseSync(dbPath)
  raw.exec('DROP TRIGGER audit_log_no_update; DROP TRIGGER audit_log_no_delete;')
  raw.exec(sql); raw.close()
}
const reopen = (dbPath: string) => new DatabaseSync(dbPath, { readOnly: true })
const verifyFile = (dbPath: string, options?: { expectHead?: string }) => { const db = reopen(dbPath); try { return verifyChain(db, options) } finally { db.close() } }

describe('audit chain (#288)', () => {
  it('records admission, decision, reserve, sign, settle, deliver, proof, challenge and refund, and verifies', async () => {
    const h = await uc3Like()
    const result = h.store.auditVerify()
    expect(result).toMatchObject({ ok: true, failures: [], coverage: { receipts: 2, signed: 2, refunds: 1 } })
    const entries = h.store.auditEntries()
    expect(entries.map(e => e.kind)).toEqual(expect.arrayContaining(['baseline', 'policy', 'admission', 'decision', 'reserve', 'sign', 'settle', 'deliver', 'proof', 'challenge', 'refund']))
    entries.forEach((e, i) => { expect(e.seq).toBe(i + 1); expect(e.prevHash).toBe(i ? entries[i - 1].hash : '0'.repeat(64)) })
    const admission = entries.find(e => e.kind === 'admission')!
    expect(admission).toMatchObject({ surface: 'web', principal: 'operator', runId: h.run.runId, data: { requestedMinor: 500, admittedMinor: 500, maxMinor: 500, policyVersion: 'wallet-v1', paused: false } })
    expect(typeof admission.data.walletDailyMinor).toBe('number')
    expect(entries.find(e => e.kind === 'decision')!.data).toMatchObject({ provider: 'fixture', model: 'metadata-fixture', promptVersion: 'p1', threshold: 0.6, selectedResourceId: honestArticle.articleId })
    expect(entries.find(e => e.kind === 'policy')!.data).toMatchObject({ policyVersion: 'wallet-v1' })
    // The refund entry carries the refund tx and the original payment's hash.
    const leak = h.store.getIntent('leak')!
    expect(entries.find(e => e.kind === 'refund')!.data).toMatchObject({ txHash: leak.refund!.txHash, amountMinor: leak.amountMinor, originalTxHash: leak.txHash })
  })

  it('never contains the question, premium bytes, delivery tokens or signed blobs', async () => {
    const h = await uc3Like()
    const raw = JSON.stringify(h.store.auditEntries())
    const delivery = h.store.getDelivery('honest')!
    expect(raw).not.toContain('PRIVATE_QUESTION_TEXT_7731')
    expect(raw).not.toContain(delivery.content.body.slice(0, 40))
    for (const span of delivery.content.spans) expect(raw).not.toContain(span.text)
    for (const salt of delivery.salts) expect(raw).not.toContain(salt)
    expect(raw).not.toContain(h.store.getSubmission('honest')!.txBlob)
    const admission = h.store.auditEntries().find(e => e.kind === 'admission')!
    expect(admission.data.questionCommitment).toMatch(/^[0-9a-f]{64}$/)
  })

  it('rejects entries that could carry a secret or a payload', () => {
    expect(() => assertSafe({ body: 'x' })).toThrow('cannot carry')
    expect(() => assertSafe({ nested: { Token: 'x' } })).toThrow('cannot carry')
    expect(() => assertSafe({ txBlob: 'AB' })).toThrow('cannot carry')
    expect(() => assertSafe({ note: 'sEdTM1uX8pu2do5XvTnutH6HsouMaM2' })).toThrow('secret')
    expect(() => assertSafe({ note: 'Authorization: Bearer abc.def' })).toThrow('secret')
    expect(() => assertSafe({ note: 'x'.repeat(601) })).toThrow('payload')
    expect(() => assertSafe({ txHash: 'A'.repeat(64), payTo: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe', reason: 'Budget or per-source cap exceeded' })).not.toThrow()
  })

  it('is append-only in SQL, and an audit failure rolls back the state change', async () => {
    const h = await uc3Like()
    const raw = new DatabaseSync(h.dbPath)
    expect(() => raw.exec("UPDATE audit_log SET kind='x' WHERE seq=1")).toThrow('append-only')
    expect(() => raw.exec('DELETE FROM audit_log')).toThrow('append-only')
    raw.close()
    const before = h.store.auditEntries().length
    expect(() => h.store.recordAudit({ kind: 'bad', data: { seed: 'x' } })).toThrow('cannot carry')
    expect(h.store.auditEntries()).toHaveLength(before)
  })

  describe('tampering is detected', () => {
    it('a modified entry fails at that seq', async () => {
      const h = await uc3Like()
      const target = h.store.auditEntries().find(e => e.kind === 'settle')!
      expect(verifyFile(h.dbPath).ok).toBe(true)
      tamper(h.dbPath, `UPDATE audit_log SET data = replace(data, '"amountMinor":', '"amountMinor":9') WHERE seq=${target.seq}`)
      const result = verifyFile(h.dbPath)
      expect(result.ok).toBe(false)
      expect(result.failures[0]).toMatchObject({ seq: target.seq, reason: expect.stringContaining('edited') })
    })
    it('a deleted entry fails at the gap', async () => {
      const h = await uc3Like()
      const target = h.store.auditEntries().find(e => e.kind === 'sign')!
      tamper(h.dbPath, `DELETE FROM audit_log WHERE seq=${target.seq}`)
      const result = verifyFile(h.dbPath)
      expect(result.ok).toBe(false)
      expect(result.failures[0]).toMatchObject({ seq: target.seq + 1, reason: expect.stringContaining('not contiguous') })
    })
    it('reordered entries fail', async () => {
      const h = await uc3Like()
      const [a, b] = h.store.auditEntries().filter(e => e.kind === 'reserve')
      tamper(h.dbPath, `UPDATE audit_log SET seq=-1 WHERE seq=${a.seq}; UPDATE audit_log SET seq=${a.seq} WHERE seq=${b.seq}; UPDATE audit_log SET seq=${b.seq} WHERE seq=-1;`)
      const result = verifyFile(h.dbPath)
      expect(result.ok).toBe(false)
      expect(result.failures[0].seq).toBe(a.seq)
    })
    it('a recomputed row still fails because the next entry commits to the old hash', async () => {
      const h = await uc3Like()
      const target = h.store.auditEntries().find(e => e.kind === 'reserve')!
      tamper(h.dbPath, `UPDATE audit_log SET hash='${'a'.repeat(64)}' WHERE seq=${target.seq}`)
      expect(verifyFile(h.dbPath).failures[0].seq).toBe(target.seq)
    })
    it('truncating the tail is caught by the sequence counter and by a pinned head', async () => {
      const h = await uc3Like()
      const head = h.store.auditVerify().head!
      tamper(h.dbPath, `DELETE FROM audit_log WHERE seq=${head.seq}`)
      const result = verifyFile(h.dbPath)
      expect(result.ok).toBe(false)
      expect(result.failures.map(f => f.reason).join(' ')).toContain('were removed')
      expect(verifyFile(h.dbPath, { expectHead: head.hash }).failures.map(f => f.reason).join(' ')).toContain('tail truncated')
    })
    it('editing a receipt, a signed payment or a refund in the money tables no longer matches the log', async () => {
      const h = await uc3Like()
      const raw = new DatabaseSync(h.dbPath)
      const row = raw.prepare("SELECT json FROM receipts WHERE intent_id='honest'").get() as { json: string }
      raw.prepare("UPDATE receipts SET json=? WHERE intent_id='honest'").run(row.json.replace(/"amountMinor":\d+/, '"amountMinor":1'))
      raw.close()
      const result = verifyFile(h.dbPath)
      expect(result.ok).toBe(false)
      expect(result.failures[0].reason).toContain('differs from its settle entry')
    })
  })

  it('an upgraded database pins its pre-existing intents in a baseline instead of failing', async () => {
    const dir = tmp(), path = join(dir, 'legacy.db')
    new Store(path).close()
    const raw = new DatabaseSync(path)
    raw.exec('DROP TRIGGER audit_log_no_update; DROP TRIGGER audit_log_no_delete; DROP TABLE audit_log; DROP TABLE audit_salts')
    raw.close()
    const store = new Store(path); cleanups.push(() => store.close())
    expect(store.auditEntries().map(e => e.kind)).toEqual(['baseline', 'policy'])
    expect(store.auditVerify().ok).toBe(true)
  })

  it('records pause and refuses to admit while paused, both in the chain', () => {
    const store = new Store(':memory:'); cleanups.push(() => store.close())
    store.setPaused(true, { surface: 'operator', principal: 'api-token' })
    const { run } = admit(store, { surface: 'mcp', principal: 'operator', question: 'q', requestedMinor: 100, idempotencyKey: 'p', maxMinor: 500, dailyMinor: 1000 })
    expect(run.budgetMinor).toBe(0)
    const kinds = store.auditEntries().map(e => [e.kind, e.surface, e.data.paused ?? e.data.reason])
    expect(kinds).toEqual(expect.arrayContaining([['pause', 'operator', true], ['admission', 'mcp', true], ['refusal', 'mcp', 'Spending paused by the operator; nothing was charged']]))
    expect(store.auditVerify().ok).toBe(true)
  })

  it('records a cap change between boots as a policy entry', () => {
    const dir = tmp(), path = join(dir, 'caps.db')
    vi.stubEnv('WALLET_DAILY_CAP_MINOR', '2000')
    new Store(path).close()
    new Store(path).close() // same caps: no second entry
    vi.stubEnv('WALLET_DAILY_CAP_MINOR', '500')
    const store = new Store(path); cleanups.push(() => store.close())
    expect(store.auditEntries().filter(e => e.kind === 'policy').map(e => e.data.walletDailyMinor)).toEqual([2000, 500])
  })
})

describe('receipt export (#288)', () => {
  it('has one row per charge and matches the receipts table and run snapshot to the drop, with the refund tx', async () => {
    const h = await uc3Like()
    const rows = h.store.receiptRows()
    const run = h.store.getRun(h.run.runId)
    expect(rows).toHaveLength(run.receipts.length)
    expect(rows.reduce((n, r) => n + Number(r.amountMinor), 0)).toBe(run.spentMinor)
    for (const row of rows) {
      const receipt = run.receipts.find(r => r.intentId === row.intentId)!, intent = run.intents.find(i => i.intentId === row.intentId)!
      expect(row).toMatchObject({ runId: run.runId, intentId: intent.intentId, surface: 'web', principal: 'operator', policyVersion: 'wallet-v1', writer: intent.profileId, resourceId: intent.resourceId,
        amountMinor: receipt.amountMinor, amountDrops: String(receipt.amountMinor * 1000), txHash: intent.txHash, status: intent.status, label: SIMULATED_LABEL, settledAt: receipt.settledAt, refundTxHash: intent.refund?.txHash ?? '' })
      expect(row.payee).toBe(intent.quote!.payment!.payTo)
    }
    const refunded = rows.find(r => r.intentId === 'leak')!
    expect(refunded).toMatchObject({ status: 'REFUNDED', refundAmountMinor: refunded.amountMinor })
    expect(refunded.refundTxHash).toMatch(/^[0-9A-F]{64}$/)
    expect(run.refundedMinor).toBe(refunded.refundAmountMinor)
  })
  it('renders CSV and JSONL with the same columns and a rail label on every row', async () => {
    const h = await uc3Like()
    const rows = h.store.receiptRows()
    const [header, ...lines] = toCsv(rows).trim().split('\r\n')
    expect(header.split(',')).toEqual(RECEIPT_COLUMNS)
    expect(lines).toHaveLength(rows.length)
    expect(lines.every(l => l.includes(SIMULATED_LABEL.replace(/,/g, '')) || l.includes('"'))).toBe(true)
    const parsed = toJsonl(rows).trim().split('\n').map(l => JSON.parse(l))
    expect(parsed).toEqual(rows)
    expect(parsed.every(r => r.label === SIMULATED_LABEL && /SIMULATED/.test(r.network))).toBe(true)
  })
  it('filters by settled date; a bare end date is inclusive, a bad date is an error', async () => {
    const h = await uc3Like()
    const day = h.store.receiptRows()[0].settledAt.slice(0, 10)
    expect(h.store.receiptRows({ from: day, to: day })).toHaveLength(2)
    expect(h.store.receiptRows({ from: '2999-01-01' })).toHaveLength(0)
    expect(h.store.receiptRows({ to: '2000-01-01' })).toHaveLength(0)
    expect(() => h.store.receiptRows({ from: 'tomorrow-ish' })).toThrow('Invalid date')
  })
  it('neutralises spreadsheet formulas in writer-controlled fields', () => {
    const row = { ...Object.fromEntries(RECEIPT_COLUMNS.map(c => [c, ''])), writer: '=HYPERLINK("http://x")', resourceId: 'a,"b"', amountMinor: 5 } as unknown as ReceiptRow
    const line = toCsv([row]).split('\r\n')[1]
    expect(line).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(line).toContain('"a,""b"""')
  })
  it('reads a database without opening it for writing', async () => {
    const h = await uc3Like()
    const db = reopen(h.dbPath)
    try { expect(receiptRows(db)).toHaveLength(2) } finally { db.close() }
  })
})

describe('payee denylist hook (#288)', () => {
  it('blocks a listed payee before anything is signed: no submission, no payment, a refusal entry with the listed reason', async () => {
    const dir = tmp(), file = join(dir, 'deny.json')
    const h = await payPath({ storePath: join(dir, 'app.db') }); cleanups.push(h.close)
    const candidate = await h.candidate(honestArticle)
    writeFileSync(file, JSON.stringify([{ address: candidate.wallet, reason: 'Operator list: test entry' }]))
    vi.stubEnv('PAYEE_DENYLIST_FILE', file)
    const { run } = admit(h.store, { surface: 'web', principal: 'operator', question: 'q', requestedMinor: 500, idempotencyKey: 'd', maxMinor: 500 })
    const intent = await h.manager.purchase({ runId: run.runId, candidate, intentId: 'denied' })
    expect(intent).toMatchObject({ status: 'FAILED_NOT_SETTLED', error: 'Payee is on the operator denylist; nothing was charged' })
    expect(h.store.getSubmission('denied')).toBeUndefined()
    expect(h.store.getRun(run.runId).receipts).toEqual([])
    expect(h.store.getRun(run.runId).spentMinor).toBe(0)
    expect(h.journal.refundByTx('x')).toBeUndefined()
    const refusal = h.store.auditEntries().find(e => e.kind === 'refusal' && e.intentId === 'denied')!
    expect(refusal.data).toMatchObject({ stage: 'purchase', reason: 'Payee is on the operator denylist; nothing was charged', listedAddress: candidate.wallet, listReason: 'Operator list: test entry', screen: 'operator-denylist' })
    expect(h.store.auditEntries().some(e => e.kind === 'sign' && e.intentId === 'denied')).toBe(false)
    expect(h.store.auditVerify().ok).toBe(true)
    // Removing the entry lets the next intent through: the hook is configuration, not code.
    writeFileSync(file, '[]')
    expect((await h.manager.purchase({ runId: run.runId, candidate, intentId: 'allowed' })).status).toBe('VERIFIED')
  })
  it('matches exact addresses only, fails closed on a malformed list, and passes when no list is configured', () => {
    const dir = tmp(), file = join(dir, 'deny.json')
    expect(screenPayee('rAnyone', file)).toBeUndefined()
    writeFileSync(file, JSON.stringify([{ address: 'rBad1', reason: 'listed' }]))
    expect(screenPayee('rBad1', file)).toMatchObject({ refusal: 'Payee is on the operator denylist; nothing was charged', reason: 'listed' })
    expect(screenPayee('rBad2', file)).toBeUndefined()
    expect(screenPayee('rbad1', file)).toBeUndefined()
    writeFileSync(file, '{not json')
    expect(screenPayee('rBad2', file)?.refusal).toBe('Operator payee denylist is invalid; nothing was charged')
    writeFileSync(file, JSON.stringify([{ address: 'rBad1' }]))
    expect(screenPayee('rBad2', file)?.refusal).toContain('invalid')
  })
})

describe('retention (#288)', () => {
  const later = (days: number) => Date.now() + days * 86_400_000
  it('prunes premium content, events and the question past the window but keeps receipts and the whole chain', async () => {
    const h = await uc3Like()
    const before = { receipts: h.store.getRun(h.run.runId).receipts, entries: h.store.auditEntries().length, rows: h.store.receiptRows() }
    expect(h.store.getDelivery('honest')).toBeDefined()
    // Nothing is old enough yet.
    expect(h.store.prune({ olderThanDays: 30 }).runIds).toEqual([])
    const dry = h.store.prune({ olderThanDays: 30, now: later(31), dryRun: true })
    expect(dry.runIds).toEqual([h.run.runId])
    expect(h.store.getDelivery('honest')).toBeDefined()
    const result = h.store.prune({ olderThanDays: 30, now: later(31) })
    expect(result.deleted).toMatchObject({ grants: 2, grantSalts: 2, runBodies: 1, questionSalts: 1 })
    expect(result.deleted.events).toBeGreaterThan(0)
    const run = h.store.getRun(h.run.runId)
    expect(run).toMatchObject({ question: PRUNED_QUESTION, grants: [], contents: [], answers: [], decisions: [], events: [] })
    expect(h.store.getDelivery('honest')).toBeUndefined()
    expect(run.receipts).toEqual(before.receipts)
    expect(run.intents.map(i => i.status)).toEqual(['VERIFIED', 'REFUNDED'])
    expect(h.store.receiptRows()).toEqual(before.rows)
    const verified = h.store.auditVerify()
    expect(verified).toMatchObject({ ok: true, entries: before.entries + 1, coverage: { receipts: 2, signed: 2, refunds: 1 } })
    expect(h.store.auditEntries().at(-1)).toMatchObject({ kind: 'prune', data: { runIds: [h.run.runId], olderThanDays: 30 } })
    // The salted question hash can no longer be linked back to a question, and a second prune is a no-op.
    expect(h.store.prune({ olderThanDays: 30, now: later(31) }).runIds).toEqual([])
    expect(h.store.auditVerify().entries).toBe(before.entries + 1)
  })
  it('never prunes a run that still has money in flight or a failed proof that can be challenged', async () => {
    const dir = tmp()
    const h = await payPath({ storePath: join(dir, 'app.db') }); cleanups.push(h.close)
    const { run } = admit(h.store, { surface: 'web', principal: 'operator', question: 'q', requestedMinor: 500, idempotencyKey: 'f', maxMinor: 500 })
    expect((await h.manager.purchase({ runId: run.runId, candidate: await h.candidate(), intentId: 'leak' })).status).toBe('CLAIM_FAILED')
    h.store.updateRun(run.runId, { phase: 'DONE' })
    expect(h.store.prune({ olderThanDays: 1, now: later(40) }).runIds).toEqual([])
    expect(h.store.getDelivery('leak')).toBeDefined()
  })
  it('parses windows', () => {
    expect(parseWindow('30d')).toBe(30)
    expect(parseWindow('7')).toBe(7)
    expect(() => parseWindow('soon')).toThrow('Invalid retention window')
  })
})

describe('audit:verify against the Testnet (#288)', () => {
  const base: ReceiptRow = { ...Object.fromEntries(RECEIPT_COLUMNS.map(c => [c, ''])), label: XRPL_LABEL, intentId: 'i1', payee: 'rPayee', payer: 'rPayer', amountMinor: 80, amountDrops: '80000', txHash: 'A'.repeat(64), invoiceId: 'B'.repeat(64), ledgerIndex: 7 } as unknown as ReceiptRow
  const ledger = (tx: Record<string, unknown> | 'missing', meta: Record<string, unknown> = { TransactionResult: 'tesSUCCESS', delivered_amount: '80000' }, index = 7) => ({
    request: async () => { if (tx === 'missing') throw Object.assign(new Error('x'), { data: { error: 'txnNotFound' } }); return { result: { validated: true, tx_json: tx, meta, ledger_index: index } } },
  })
  const payment = { TransactionType: 'Payment', Account: 'rPayer', Destination: 'rPayee', InvoiceID: 'B'.repeat(64) }
  it('confirms a payment that matches destination, delivered amount and InvoiceID', async () => {
    expect(await verifyOnTestnet([base], ledger(payment))).toMatchObject([{ status: 'ok', kind: 'payment' }])
  })
  it.each([
    ['destination', { ...payment, Destination: 'rOther' }, undefined, 'wrong destination'],
    ['amount', payment, { TransactionResult: 'tesSUCCESS', delivered_amount: '1' }, 'wrong delivered amount'],
    ['invoice', { ...payment, InvoiceID: 'C'.repeat(64) }, undefined, 'InvoiceID'],
    ['result', payment, { TransactionResult: 'tecUNFUNDED_PAYMENT', delivered_amount: '80000' }, 'tecUNFUNDED_PAYMENT'],
    ['sender', { ...payment, Account: 'rSomeoneElse' }, undefined, 'sender differs'],
  ])('flags a mismatching %s', async (_name, tx, meta, detail) => {
    expect(await verifyOnTestnet([base], ledger(tx, meta))).toMatchObject([{ status: 'mismatch', detail: expect.stringContaining(detail) }])
  })
  it('flags a ledger index that differs from the receipt, a missing tx, and an unreachable node', async () => {
    expect(await verifyOnTestnet([base], ledger(payment, undefined, 9))).toMatchObject([{ status: 'mismatch', detail: expect.stringContaining('ledger 9') }])
    expect(await verifyOnTestnet([base], ledger('missing'))).toMatchObject([{ status: 'pending' }])
    expect(await verifyOnTestnet([base], { request: async () => { throw new Error('socket closed') } })).toMatchObject([{ status: 'error', detail: expect.stringContaining('socket closed') }])
  })
  it('checks the refund and skips SIMULATED rows', async () => {
    const refunded = { ...base, refundTxHash: 'D'.repeat(64), refundAmountMinor: 80 }
    const answers: Record<string, unknown>[] = [
      { TransactionType: 'Payment', Account: 'rPayer', Destination: 'rPayee', InvoiceID: 'B'.repeat(64) },
      { TransactionType: 'Payment', Account: 'rPayee', Destination: 'rPayer', InvoiceID: base.txHash },
    ]
    const ok = { request: async (r: { transaction: string }) => ({ result: { validated: true, tx_json: answers[r.transaction === refunded.txHash ? 0 : 1], meta: { TransactionResult: 'tesSUCCESS', delivered_amount: '80000' }, ledger_index: 7 } }) }
    expect((await verifyOnTestnet([refunded], ok)).map(c => [c.kind, c.status])).toEqual([['payment', 'ok'], ['refund', 'ok']])
    const wrong = { request: async (r: { transaction: string }) => ({ result: { validated: true, tx_json: r.transaction === refunded.refundTxHash ? { ...payment, Account: 'rPayee', Destination: 'rWrong', InvoiceID: base.txHash } : payment, meta: { TransactionResult: 'tesSUCCESS', delivered_amount: '80000' }, ledger_index: 7 } }) }
    expect((await verifyOnTestnet([refunded], wrong)).find(c => c.kind === 'refund')).toMatchObject({ status: 'mismatch', detail: 'refund was not sent to the payer' })
    expect(await verifyOnTestnet([{ ...base, label: SIMULATED_LABEL }], ledger('missing'))).toMatchObject([{ status: 'skipped' }])
  })
})
