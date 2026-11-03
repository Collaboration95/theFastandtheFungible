import { encryptDelivery } from '../shared/key-reveal.js'
import { XrplPayer } from '../server/xrpl.js'
import { fulfillmentFor } from '../shared/escrow.js'
import { Wallet, decode, hashes } from 'xrpl'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { PaymentSignature } from '../shared/contracts/x402.js'
import { EscrowQuoteSchema, type EscrowQuote } from '../shared/contracts/escrow.js'
import { escrowInvoice, ledgerTime, matchesCreate, safeSignature, signEscrowQuote } from '../shared/escrow.js'
import { lookupTx, type Ledger } from '../shared/xrpl.js'
import type { PublisherJournal } from './journal.js'
import type { PublisherKeys } from './registry.js'
export const EscrowRequestSchema = z.object({ mode: z.literal('key-reveal').optional(), payer: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/), intentId: z.string().min(1).max(200), condition: z.string().regex(/^A0258020[0-9A-F]{64}810120$/), cancelAfter: z.number().int().positive() })
export async function escrowQuote(input: unknown, item: { publisherSlug: string; articleId: string; version: string; manifestRoot: string; amount: string; payTo: string }, keys: PublisherKeys, ledger: Ledger, journal: PublisherJournal, delivery?: unknown): Promise<EscrowQuote> {
  const request = EscrowRequestSchema.parse(input), now = await ledgerTime(ledger)
  if (request.cancelAfter < now + 60 || request.cancelAfter > now + 120) throw new Error('Escrow deadline outside policy')
  const encrypted = request.mode === 'key-reveal' && delivery ? encryptDelivery(delivery) : undefined
  if (request.mode && !encrypted) throw new Error('Key reveal unavailable')
  const { mode: _mode, ...base } = request
  const terms = { ...base, ...item, ...(encrypted ? { condition: encrypted.condition, keyReveal: encrypted.commitment } : {}), scheme: 'escrow-v1' as const, network: 'xrpl:1' as const, asset: 'XRP' as const, quoteId: randomUUID() }
  const quote = { ...signEscrowQuote(terms, keys.publicKey, keys.privateKey), ...(encrypted ? { ciphertext: encrypted.ciphertext } : {}) }
  if (encrypted) journal.saveKeyReveal(escrowInvoice(terms), { secret: encrypted.secret })
  journal.saveEscrowQuote(quote)
  return quote
}
export function verifyEscrowSignature(signature: PaymentSignature, journal: PublisherJournal) {
  const quote = journal.escrowQuote(signature.accepted.extra.invoiceId)
  if (!quote) throw new Error('Unknown escrow invoice')
  const t = quote.terms, a = signature.accepted
  if (a.scheme !== 'escrow-v1' || a.network !== t.network || a.asset !== t.asset || a.payTo !== t.payTo || a.amount !== t.amount || a.maxTimeoutSeconds !== 120 || !safeSignature(signature.payload.signedTxBlob) || !matchesCreate(decode(signature.payload.signedTxBlob), t)) throw new Error('Escrow signature binding rejected')
  return quote
}
/** Validate the exact create and object before issuing a durable conditional grant. */
export async function lockEscrow(blob: string, invoice: string, articleId: string, version: string, ledger: Ledger, journal: PublisherJournal, timing = { pollMs: 1000, timeoutMs: 30000 }) {
  const quote = journal.escrowQuote(invoice)
  if (!quote) throw new Error('Unknown escrow invoice')
  const { terms } = EscrowQuoteSchema.parse(quote)
  const tx = decode(blob), hash = hashes.hashSignedTx(blob).toUpperCase()
  if (escrowInvoice(terms) !== invoice || terms.articleId !== articleId || terms.version !== version || !safeSignature(blob) || !matchesCreate(tx, terms)) throw new Error('Escrow create does not match signed quote')
  const existing = journal.escrowGrant(hash)
  if (existing) {
    if (await ledgerTime(ledger) >= terms.cancelAfter) throw new Error('Conditional grant expired')
    return { hash, payer: terms.payer, grant: existing }
  }
  let found = await lookupTx(ledger, hash)
  if (found.state !== 'validated') {
    const now = await ledgerTime(ledger)
    const index = Number((await ledger.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger_index)
    if (now >= terms.cancelAfter || Number(tx.LastLedgerSequence) < index || Number(tx.LastLedgerSequence) > index + 25) throw new Error('Escrow create expired or unbounded')
    try { await ledger.request({ command: 'submit', tx_blob: blob }) } catch { /* hash lookup decides */ }
    const deadline = Date.now() + timing.timeoutMs
    while (found.state !== 'validated' && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, timing.pollMs))
      found = await lookupTx(ledger, hash)
    }
  }
  if (found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS' || !matchesCreate(found.tx, terms)) throw new Error('Escrow not validated')
  const object = (await ledger.request({ command: 'ledger_entry', escrow: { owner: terms.payer, seq: Number(tx.Sequence) }, ledger_index: 'validated' })).result.node
  if (object.Account !== terms.payer || object.Destination !== terms.payTo || object.Amount !== terms.amount || object.Condition !== terms.condition || object.CancelAfter !== terms.cancelAfter) throw new Error('Locked object mismatch')
  const grant = { scheme: 'escrow-v1', state: 'LOCKED', articleId, version, manifestRoot: terms.manifestRoot, createHash: hash }
  journal.saveEscrowGrant(hash, invoice, grant)
  return { hash, payer: terms.payer, grant }
}

/** Writer alone holds K. Persist the exact finish blob before any network submission. */
export async function revealEscrow(quote: EscrowQuote, createBlob: string, keys: PublisherKeys, ledger: Ledger, journal: PublisherJournal) {
  const invoice = escrowInvoice(quote.terms), privateState = journal.keyReveal(invoice)
  if (!privateState || !quote.terms.keyReveal) throw new Error('No writer key')
  const payer = new XrplPayer(ledger, new Wallet(keys.publicKey, keys.privateKey))
  let finish = privateState.finish
  if (!finish) {
    await lockEscrow(createBlob, invoice, quote.terms.articleId, quote.terms.version, ledger, journal)
    const sent = await payer.escrow({ TransactionType: 'EscrowFinish', Owner: quote.terms.payer, OfferSequence: Number(decode(createBlob).Sequence), Condition: quote.terms.condition, Fulfillment: fulfillmentFor(privateState.secret) }, 0,
      s => { journal.saveKeyReveal(invoice, { ...privateState, finish: s }); return s },
      s => ledger.request({ command: 'submit', tx_blob: s.txBlob }))
    finish = sent.submission
    await sent.sent
  } else {
    const found = await lookupTx(ledger, finish.txHash)
    if (found.state !== 'validated') await ledger.request({ command: 'submit', tx_blob: finish.txBlob })
  }
  return { finishHash: finish.txHash }
}
