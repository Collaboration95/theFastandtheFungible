/** Presentation only. Public validated RPC results, never additions to the signed receipt. */
import { xrpAmount } from './presentation'
type Json = Record<string, unknown>
const obj = (v: unknown): Json => v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {}
const uint = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0
const drops = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v)
function transaction(r: Json, type: string) {
  const tx = r.tx_json ? obj(r.tx_json) : r, meta = obj(r.meta)
  if (r.validated !== true || !uint(r.ledger_index) || r.ledger_index === 0 || tx.TransactionType !== type || meta.TransactionResult !== 'tesSUCCESS' || !drops(tx.Fee)) throw new Error('Validated successful transaction required')
  const time = typeof tx.date === 'number' ? tx.date : Date.parse(String(r.close_time_iso)) / 1000 - 946684800
  if (!uint(time)) throw new Error('Ledger close time required')
  return { tx, meta, ledger: r.ledger_index, time }
}
function nodes(meta: Json, kind: string): Json[] {
  return Array.isArray(meta.AffectedNodes) ? meta.AffectedNodes.map(v => obj(obj(v)[kind])) : []
}
export type LedgerReceipt = {
  buyer: string; writer: string; amount: string; buyerFee: string; writerFee: string
  createLedger: number; finishLedger: number; ledgersLater: number; heldSeconds: number; ownerReserveDrops: string
}
/** Refuse missing/failed/mismatched evidence rather than fabricate a settled purchase or reserve release. */
export function ledgerReceipt(create: Json, finish: Json, feesAtCreate: Json): LedgerReceipt {
  const c = transaction(create, 'EscrowCreate'), f = transaction(finish, 'EscrowFinish')
  if (typeof c.tx.Account !== 'string' || typeof c.tx.Destination !== 'string' || f.tx.Owner !== c.tx.Account || f.tx.Account !== c.tx.Destination || !uint(c.tx.Sequence) || f.tx.OfferSequence !== c.tx.Sequence || typeof c.tx.Condition !== 'string' || !/^A0258020[0-9A-F]{64}810120$/i.test(c.tx.Condition) || c.tx.Condition !== f.tx.Condition || typeof f.tx.Fulfillment !== 'string' || !/^A0228020[0-9A-F]{64}$/i.test(f.tx.Fulfillment) || f.ledger < c.ledger || f.time < c.time) throw new Error('Different or incomplete escrow')
  const created = nodes(c.meta, 'CreatedNode').find(n => n.LedgerEntryType === 'Escrow' && obj(n.NewFields).Account === c.tx.Account && obj(n.NewFields).Sequence === c.tx.Sequence)
  const deleted = nodes(f.meta, 'DeletedNode').find(n => n.LedgerEntryType === 'Escrow' && n.LedgerIndex === created?.LedgerIndex && obj(n.FinalFields).Account === c.tx.Account && obj(n.FinalFields).Sequence === c.tx.Sequence)
  const ownerChanged = (meta: Json, delta: number) => nodes(meta, 'ModifiedNode').some(n => {
    const prev = obj(n.PreviousFields), final = obj(n.FinalFields)
    return n.LedgerEntryType === 'AccountRoot' && final.Account === c.tx.Account && uint(prev.OwnerCount) && uint(final.OwnerCount) && final.OwnerCount - prev.OwnerCount === delta
  })
  const settings = obj(feesAtCreate.node)
  if (!created || typeof created.LedgerIndex !== 'string' || !/^[a-f0-9]{64}$/i.test(created.LedgerIndex) || !deleted || !ownerChanged(c.meta, 1) || !ownerChanged(f.meta, -1)) throw new Error('Reserve release not shown')
  if (feesAtCreate.validated !== true || feesAtCreate.ledger_index !== c.ledger || settings.LedgerEntryType !== 'FeeSettings' || !drops(settings.ReserveIncrementDrops)) throw new Error('Historical owner reserve required')
  let amount: string
  if (drops(c.tx.Amount)) amount = `${BigInt(c.tx.Amount).toLocaleString('en-SG')} drops`
  else {
    const a = obj(c.tx.Amount)
    if (a.currency !== 'SGT' || a.issuer !== 'rhto8NT62NUYYXUUuHzwLNq3A78eaNwUwx' || typeof a.value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(a.value)) throw new Error('Unrecognised asset')
    amount = `TEST-SGD ${Number(a.value).toFixed(2)} (stand-in for RLUSD, no real value)`
  }
  return { buyer: c.tx.Account, writer: f.tx.Account as string, amount, buyerFee: c.tx.Fee as string, writerFee: f.tx.Fee as string, createLedger: c.ledger, finishLedger: f.ledger, ledgersLater: f.ledger - c.ledger, heldSeconds: f.time - c.time, ownerReserveDrops: settings.ReserveIncrementDrops }
}
export function ledgerReceiptLine(r: LedgerReceipt): string {
  return `Buyer locked ${r.amount} (fee ${r.buyerFee}, paid by the buyer) · writer revealed the key ${r.ledgersLater} ledgers later (fee ${r.writerFee}, paid by the writer) · ${xrpAmount(r.ownerReserveDrops)} owner reserve held ${r.heldSeconds} s, then released.`
}
