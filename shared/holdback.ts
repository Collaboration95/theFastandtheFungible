// Exact decimal arithmetic and public Batch binding. No buyer fulfillment lives here.
import { hashes, type Transaction } from 'xrpl'
import type { EscrowTerms } from './contracts/escrow.js'
import { ledgerAmount, matchesAmount } from './contracts/asset.js'
import { canonicalJson } from './manifest.js'
import { escrowMemo, matchesEscrowMemo } from './escrow.js'
const units = (s: string) => { const [a,b = ''] = s.split('.'); return BigInt(a) * 1000000n + BigInt(b.padEnd(6,'0')) }
const decimal = (n: bigint) => `${n / 1000000n}.${(n % 1000000n).toString().padStart(6,'0')}`.replace(/\.?0+$/, '')
export function splitHoldback(amount: string, percent: number, xrp: boolean) {
  const total = units(amount), quantum = xrp ? 1000000n : 1n
  const held = total * BigInt(percent) / 100n / quantum * quantum
  if (held <= 0n || held >= total) throw Error('Price cannot be split into two positive escrows')
  return { amount: decimal(held), keyAmount: decimal(total - held) }
}
export function keyTerms(t: EscrowTerms): EscrowTerms { return t.holdback ? { ...t, amount: decimal(units(t.amount) - units(t.holdback.amount)) } : t }
export function createPair(t: EscrowTerms) {
  if (!t.holdback) throw Error('Holdback terms required')
  return [
    { TransactionType: 'EscrowCreate', Account: t.payer, Destination: t.payTo, Amount: ledgerAmount(keyTerms(t).amount,t.asset), Condition: t.condition, CancelAfter: t.cancelAfter, Memos: escrowMemo(t) },
    { TransactionType: 'EscrowCreate', Account: t.payer, Destination: t.payTo, Amount: ledgerAmount(t.holdback.amount,t.asset), Condition: t.holdback.condition, CancelAfter: t.holdback.cancelAfter, Memos: escrowMemo(t) },
  ]
}
export function batchInners(tx: Transaction | Record<string, unknown>): Record<string, unknown>[] {
  return tx.TransactionType === 'Batch' && Array.isArray(tx.RawTransactions) ? tx.RawTransactions.map((r: { RawTransaction: Record<string, unknown> }) => r.RawTransaction) : []
}
export function matchesHoldbackBatch(tx: Transaction | Record<string, unknown>, t: EscrowTerms) {
  const pair = batchInners(tx)
  return !!t.holdback && tx.Account === t.payer && tx.Flags === 65536 && !tx.BatchSigners && pair.length === 2 && pair.every((inner,i) => {
    const expected = createPair(t)[i]
    return inner.TransactionType === expected.TransactionType && inner.Account === t.payer && inner.Destination === t.payTo && canonicalJson(inner.Amount) === canonicalJson(expected.Amount) && inner.Condition === expected.Condition && inner.CancelAfter === expected.CancelAfter && matchesEscrowMemo(inner.Memos,t) && inner.Flags === 1073741824 && inner.Fee === '0' && inner.SigningPubKey === '' && !inner.TxnSignature && Number(inner.Sequence) === Number(tx.Sequence) + i + 1 && !inner.FinishAfter && !inner.DestinationTag && !inner.SourceTag && !inner.InvoiceID && !inner.TicketSequence
  }) && Number(tx.Fee) > 0 && Number(tx.Fee) <= 2000 && Number.isSafeInteger(tx.LastLedgerSequence)
}
export function innerHash(tx: Record<string, unknown>) { return hashes.hashSignedTx(tx as unknown as Transaction).toUpperCase() }
export function matchesHoldbackObject(node: Record<string, unknown>, t: EscrowTerms, held: boolean) {
  return node?.Account === t.payer && node.Destination === t.payTo && matchesAmount(node.Amount, held ? t.holdback!.amount : keyTerms(t).amount,t.asset) && node.Condition === (held ? t.holdback!.condition : t.condition) && node.CancelAfter === (held ? t.holdback!.cancelAfter : t.cancelAfter) && node.FinishAfter === undefined
}

export function holdbackMinor(t: EscrowTerms) { return t.asset === 'XRP' ? Number(t.holdback!.amount) / 1000 : Number((Number(t.holdback!.amount) * 100).toFixed(4)) }
