import { afterEach, describe, expect, it, vi } from 'vitest'
import { Wallet, decode } from 'xrpl'
import { escrowQuote, lockEscrow, revealEscrow } from '../publisher/escrow.js'
import { PublisherJournal } from '../publisher/journal.js'
import { conditionFor, escrowInvoice, escrowMemo, fulfillmentFor } from '../shared/escrow.js'
import { chain } from './fixtures/key-reveal-ledger.js'

const journals: PublisherJournal[] = []
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); journals.splice(0).forEach(j => j.close()) })
async function setup() {
  vi.stubEnv('ESCROW_ASSET', 'XRP')
  const c = chain(), buyer = Wallet.generate(), writer = Wallet.generate()
  const keys = { publicKey: writer.publicKey, privateKey: writer.privateKey, wallet: writer.classicAddress, simulated: false }
  const journal = new PublisherJournal(':memory:'); journals.push(journal)
  const quote = await escrowQuote({ mode: 'key-reveal', payer: buyer.classicAddress, intentId: 'guard', condition: conditionFor('00'.repeat(32)), cancelAfter: c.state.now + 120 },
    { publisherSlug: 'guard', articleId: 'article', version: '1', manifestRoot: 'ab'.repeat(32), amount: '40000', payTo: writer.classicAddress }, keys, c.ledger, journal, { synthetic: 'encrypted test article' })
  const invoice = escrowInvoice(quote.terms)
  const create = buyer.sign({ TransactionType: 'EscrowCreate', Account: buyer.classicAddress, Destination: writer.classicAddress, Amount: quote.terms.amount, Condition: quote.terms.condition, CancelAfter: quote.terms.cancelAfter, Sequence: 7, LastLedgerSequence: 120, Fee: '12', Memos: escrowMemo(quote.terms) })
  await c.ledger.request({ command: 'submit', tx_blob: create.tx_blob })
  // Exercise the dangerous recovery case: lockEscrow now reuses a cached grant.
  await lockEscrow(create.tx_blob, invoice, 'article', '1', c.ledger, journal)
  const secret = journal.keyReveal(invoice)!.secret, fulfillment = fulfillmentFor(secret)
  const original = c.ledger.request.bind(c.ledger)
  const request = vi.spyOn(c.ledger, 'request'), sign = vi.spyOn(Wallet.prototype, 'sign')
  const reveal = () => revealEscrow(quote, create.tx_blob, keys, c.ledger, journal)
  const privateRequests = () => request.mock.calls.map(([r]) => r).filter(r => r.command !== 'submit')
  const expectNoLeak = () => {
    expect(JSON.stringify(privateRequests())).not.toContain(fulfillment)
    expect(JSON.stringify(privateRequests())).not.toContain(secret)
    expect(request.mock.calls.filter(([r]) => r.command === 'simulate')).toEqual([])
  }
  return { ...c, buyer, writer, quote, journal, invoice, original, request, sign, reveal, secret, fulfillment, expectNoLeak }
}

describe('writer read-only ledger pre-check (cached grant cannot bypass it)', () => {
  for (const terminal of ['missing', 'finished', 'cancelled'] as const) it(`${terminal} escrow: no writer signature and no key in RPC`, async () => {
    const s = await setup()
    if (terminal === 'missing') s.objects.clear()
    else {
      if (terminal === 'cancelled') s.state.now = s.quote.terms.cancelAfter + 1
      const tx = s.buyer.sign({ TransactionType: terminal === 'finished' ? 'EscrowFinish' : 'EscrowCancel', Account: s.buyer.classicAddress, Owner: s.buyer.classicAddress, OfferSequence: 7, Sequence: 8, Fee: '423', LastLedgerSequence: 120,
        ...(terminal === 'finished' ? { Condition: s.quote.terms.condition, Fulfillment: s.fulfillment } : {}) })
      await s.ledger.request({ command: 'submit', tx_blob: tx.tx_blob })
    }
    s.sign.mockClear(); s.request.mockClear()
    await expect(s.reveal()).rejects.toThrow()
    expect(s.sign).not.toHaveBeenCalled()
    expect(s.journal.keyReveal(s.invoice)!.finish).toBeUndefined()
    expect(s.request.mock.calls.some(([r]) => r.command === 'submit')).toBe(false)
    s.expectNoLeak()
  })
  it.each(['Condition', 'Destination', 'Account', 'Amount', 'CancelAfter'] as const)('mismatched %s: no sign or key in RPC', async field => {
    const s = await setup()
    s.objects.get(7)![field] = field === 'CancelAfter' ? s.quote.terms.cancelAfter + 1 : 'mismatch'
    await expect(s.reveal()).rejects.toThrow('pre-check failed')
    expect(s.sign).not.toHaveBeenCalled()
    s.expectNoLeak()
  })
  it('compares the ledger Condition with K derived locally, even when quote and ledger agree', async () => {
    const s = await setup()
    vi.spyOn(s.journal, 'keyReveal').mockReturnValue({ secret: '12'.repeat(32) })
    await expect(s.reveal()).rejects.toThrow('pre-check failed')
    expect(s.sign).not.toHaveBeenCalled()
    s.expectNoLeak()
  })
  it.each([30, 29, 0])('only %i seconds before CancelAfter: no sign or key in RPC', async seconds => {
    const s = await setup(); s.state.now = s.quote.terms.cancelAfter - seconds
    await expect(s.reveal()).rejects.toThrow()
    expect(s.sign).not.toHaveBeenCalled()
    s.expectNoLeak()
  })
  it('fails closed on a ledger read error', async () => {
    const s = await setup()
    s.request.mockImplementation(r => r.command === 'ledger_entry' ? Promise.reject(Error('RPC unavailable')) : s.original(r))
    await expect(s.reveal()).rejects.toThrow('RPC unavailable')
    expect(s.sign).not.toHaveBeenCalled()
    s.expectNoLeak()
  })
  it('signs at 31 seconds; the first request containing K is the persisted signed submit', async () => {
    const s = await setup(); s.state.now = s.quote.terms.cancelAfter - 31
    s.request.mockImplementation(r => {
      if (r.command === 'submit') expect(s.journal.keyReveal(s.invoice)!.finish!.txBlob).toBe(r.tx_blob)
      return s.original(r)
    })
    const result = await s.reveal()
    s.expectNoLeak()
    expect(result.ledgerPreCheck).toBe(true)
    expect(s.sign).toHaveBeenCalledOnce()
    const submits = s.request.mock.calls.map(([r]) => r).filter(r => r.command === 'submit')
    expect(submits).toHaveLength(1)
    const blob = String(submits[0].tx_blob)
    expect(blob).toContain(s.fulfillment)
    expect(decode(blob)).toMatchObject({ TransactionType: 'EscrowFinish', Fulfillment: s.fulfillment, LastLedgerSequence: 106, Fee: '423', TxnSignature: expect.any(String) })
    expect(s.journal.keyReveal(s.invoice)!.finish).toMatchObject({ txBlob: blob, ledgerPreCheck: true })
    const preSubmit = s.request.mock.calls.slice(0, s.request.mock.calls.findIndex(([r]) => r.command === 'submit')).map(([r]) => r)
    expect(JSON.stringify(preSubmit)).not.toContain(s.fulfillment)
    expect(JSON.stringify(preSubmit)).not.toContain(s.secret)
    expect(preSubmit).toContainEqual({ command: 'ledger_entry', escrow: { owner: s.buyer.classicAddress, seq: 7 }, ledger_index: 'validated' })
  })
})
