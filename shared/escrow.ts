// Node-only escrow-v1 protocol. No secret is derived from article bytes.
import { matchesAmount } from './contracts/asset.js'
import { createHash, randomBytes } from 'node:crypto'
import { deriveAddress, sign, verify } from 'ripple-keypairs'
import { verifySignature } from 'xrpl'
import { canonicalJson } from './manifest.js'
import type { EscrowQuote, EscrowTerms } from './contracts/escrow.js'
import type { Ledger } from './xrpl.js'
export const hex = (s: string) => Buffer.from(s).toString('hex').toUpperCase()
export const escrowInvoice = (terms: EscrowTerms) => canonicalJson(terms)
export const escrowMemo = (terms: EscrowTerms) => [{ Memo: { MemoType: hex('researchagent/escrow-v1'), MemoData: hex(escrowInvoice(terms)) } }]
const message = (terms: EscrowTerms) => hex(`researchagent/escrow-quote-v1:${escrowInvoice(terms)}`)
export const signEscrowQuote = (terms: EscrowTerms, pubKey: string, privateKey: string): EscrowQuote => ({ terms, pubKey, sig: sign(message(terms), privateKey) })
export function verifyEscrowQuote(q: EscrowQuote) {
  try { return deriveAddress(q.pubKey) === q.terms.payTo && verify(message(q.terms), q.sig, q.pubKey) } catch { return false }
}
export function newHashlock() {
  const secret = randomBytes(32).toString('hex').toUpperCase()
  return { secret, condition: conditionFor(secret) }
}
export const conditionFor = (secret: string) => `A0258020${createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex').toUpperCase()}810120`
export const fulfillmentFor = (secret: string) => `A0228020${secret}`
export async function ledgerTime(ledger: Ledger): Promise<number> {
  const result = (await ledger.request({ command: 'ledger', ledger_index: 'validated' })).result
  const time = Number(result.ledger.close_time)
  if (!Number.isSafeInteger(time) || time <= 0) throw new Error('Validated ledger time unavailable')
  return time
}
export function matchesCreate(tx: Record<string, unknown>, t: EscrowTerms): boolean {
  return tx.TransactionType === 'EscrowCreate' && tx.Account === t.payer && tx.Destination === t.payTo && matchesAmount(tx.Amount, t.amount, t.asset) &&
    tx.Condition === t.condition && tx.CancelAfter === t.cancelAfter && tx.FinishAfter === undefined && tx.InvoiceID === undefined &&
    tx.DestinationTag === undefined && tx.SourceTag === undefined && !tx.Flags &&
    canonicalJson(tx.Memos) === canonicalJson(escrowMemo(t)) &&
    Number.isSafeInteger(tx.Sequence) && Number(tx.Sequence) > 0 && Number.isSafeInteger(tx.LastLedgerSequence) &&
    Number(tx.Fee) > 0 && Number(tx.Fee) <= 2000
}
export function safeSignature(blob: string) { try { return verifySignature(blob) } catch { return false } }
