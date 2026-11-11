import { ledgerReceipt, type LedgerReceipt as Fields } from '../shared/ledger-receipt'
import { FEES_INDEX, publicRead, type Rpc } from './ledger-rpc'
export type LedgerKind = 'rlusd-escrow' | 'reserve' | 'fee'
export const RLUSD_ISSUER = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'
export const SHARED_PAYER = 'rbcLo4UJCbQMYzrYTLfdUcdSbJvYyc5Q1'
export type LedgerFact = { network: 'XRPL Testnet'; ledger: number; readAt: string; text: string }
export const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
export const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0
export const drops = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v)
/** Narrow subjects only; the answer text and the research model never control this card. */
export function ledgerKind(question: string): LedgerKind | undefined {
  const q = question.toLowerCase()
  if (/\brlusd\b/.test(q) && /\bescrow(?:s|ed|ing)?\b|\block(?:ing|ed)?\b|\ballowtrustlinelocking\b/.test(q)) return 'rlusd-escrow'
  const backingReserve = /\betfs?\b|\bstablecoins?\b|\bbacking\b|\bcollateral\b/.test(q) && !/\baccount\b|\bowner\b|\bownercount\b/.test(q)
  if (!backingReserve && /\bxrpl\b|\bxrp\b|\brippled\b/.test(q) && /\breserves?\b|\bowner\s*count\b/.test(q)) return 'reserve'
  const otherFee = /\btrading\b|\bswap\b|\bamm\b|\bpool\b|\betfs?\b|\bbrokerage\b|\bmanagement\b|\bwithdrawals?\b|\bexchange\b/.test(q) && !/\btransaction\b|\bnetwork\b|\brippled\b/.test(q)
  if (!otherFee && /\bxrpl\b|\bxrp\b|\brippled\b|\bescrow(?:create|finish|cancel)?\b/.test(q) && (/\bfees?\b/.test(q) || /\bescrow(?:create|finish|cancel)\b/.test(q) && /\bcosts?\b|\bcharges?\b/.test(q) || /\btransaction\s+costs?\b/.test(q))) return 'fee'
}
export function validated(result: Record<string, unknown>): number {
  if (result.validated !== true || !positive(result.ledger_index)) throw new Error('Validated ledger required')
  return result.ledger_index
}
export function feeSettings(result: Record<string, unknown>) {
  const ledger = validated(result), node = object(result.node)
  if (node.LedgerEntryType !== 'FeeSettings' || !drops(node.BaseFeeDrops) || !drops(node.ReserveBaseDrops) || !drops(node.ReserveIncrementDrops)) throw new Error('Fee settings unavailable')
  return { ledger, baseFee: node.BaseFeeDrops, baseReserve: node.ReserveBaseDrops, ownerReserve: node.ReserveIncrementDrops }
}
export function issuerFact(result: Record<string, unknown>, readAt: string): LedgerFact {
  const ledger = validated(result), account = object(result.account_data), flags = account.Flags
  if (account.Account !== RLUSD_ISSUER || !Number.isInteger(flags) || Number(flags) < 0 || Number(flags) > 0xffffffff) throw new Error('Issuer flags unavailable')
  const locking = (Number(flags) & 0x40000000) !== 0
  return { network: 'XRPL Testnet', ledger, readAt, text: `RLUSD issuer: AllowTrustLineLocking ${locking ? 'ON · issuer permits token escrow' : 'OFF · issuer blocks token escrow'}. This reads the issuer flag only.` }
}
export async function readLedgerFact(kind: LedgerKind, rpc: Rpc = publicRead): Promise<LedgerFact> {
  if (kind === 'rlusd-escrow') return issuerFact(await rpc({ command: 'account_info', account: RLUSD_ISSUER, ledger_index: 'validated', strict: true }), new Date().toISOString())
  const f = feeSettings(await rpc({ command: 'ledger_entry', index: FEES_INDEX, ledger_index: 'validated' }))
  return { network: 'XRPL Testnet', ledger: f.ledger, readAt: new Date().toISOString(), text: kind === 'reserve'
    ? `Account reserve ${(Number(f.baseReserve) / 1e6).toFixed(2)} XRP · owner reserve ${(Number(f.ownerReserve) / 1e6).toFixed(2)} XRP per object.`
    : `Base fee ${f.baseFee} drops. ResearchAgent pays 12 drops to lock (buyer) and 423 to reveal (writer). For our 36-byte fulfillment, rippled’s minimum is ${BigInt(f.baseFee) * 35n} drops.` }
}
export type PayerFact = LedgerFact & { openEscrows: number; ownerCount: number }
export async function readPayer(rpc: Rpc = publicRead): Promise<PayerFact> {
  const account = await rpc({ command: 'account_info', account: SHARED_PAYER, ledger_index: 'validated', strict: true })
  const ledger = validated(account), data = object(account.account_data)
  if (data.Account !== SHARED_PAYER || !Number.isSafeInteger(data.OwnerCount) || Number(data.OwnerCount) < 0 || typeof account.ledger_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(account.ledger_hash)) throw new Error('Payer unavailable')
  const list = await rpc({ command: 'account_objects', account: SHARED_PAYER, type: 'escrow', ledger_hash: account.ledger_hash, limit: 400 })
  if (validated(list) !== ledger || list.ledger_hash !== account.ledger_hash || list.account !== SHARED_PAYER || !Array.isArray(list.account_objects) || list.marker || list.account_objects.some(v => object(v).LedgerEntryType !== 'Escrow')) throw new Error('Incomplete payer objects')
  return { network: 'XRPL Testnet', ledger, readAt: new Date().toISOString(), openEscrows: list.account_objects.length, ownerCount: Number(data.OwnerCount), text: `Shared Testnet payer rbcLo4… · open escrows ${list.account_objects.length} · owner count ${data.OwnerCount} · read at ledger ${ledger}` }
}
/** L12 has not landed yet. SGT presentation per its contract, independent of the viewer's timezone. */
export function ledgerReadTime(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} SGT`
}

export type ReadReceipt = { fields: Fields; readAt: string }
export async function readLedgerReceipt(create: string, finish: string, rpc: Rpc = publicRead): Promise<ReadReceipt> {
  if (![create, finish].every(hash => /^[a-f0-9]{64}$/i.test(hash))) throw new Error('Transaction hashes required')
  const [c, f] = await Promise.all([create, finish].map(transaction => rpc({ command: 'tx', transaction, binary: false })))
  if (String(c.hash).toUpperCase() !== create.toUpperCase() || String(f.hash).toUpperCase() !== finish.toUpperCase()) throw new Error('Different transaction returned')
  const fees = await rpc({ command: 'ledger_entry', index: FEES_INDEX, ledger_index: c.ledger_index })
  return { fields: ledgerReceipt(c, f, fees), readAt: new Date().toISOString() }
}
