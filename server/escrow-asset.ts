import { loadConfig } from './config.js'
import { TEST_SGD_LABEL, decimalUnits, type Asset } from '../shared/contracts/asset.js'
import type { EscrowTerms } from '../shared/contracts/escrow.js'
import type { Ledger } from '../shared/xrpl.js'
import { checkIssuedPayment } from '../shared/issued-currency.js'
export function escrowAsset(): Asset {
  const env=loadConfig()
  if (!env.ESCROW_ASSET || env.ESCROW_ASSET === 'XRP') return 'XRP'
  if (env.ESCROW_ASSET !== 'test-iou' || !env.TESTNET_IOU_ISSUER) throw Error('Unknown escrow asset or missing Testnet issuer')
  return { currency: 'SGT', issuer: env.TESTNET_IOU_ISSUER, label: TEST_SGD_LABEL }
}
export async function preflightEscrow(ledger: Ledger, t: EscrowTerms) {
  if (t.asset === 'XRP') return
  if (!t.keyReveal || [t.payer,t.payTo].includes(t.asset.issuer)) throw Error('IOU escrow requires key reveal and separate issuer')
  const r = await ledger.request({command:'account_info', account:t.asset.issuer, ledger_index:'validated'})
  if (!(Number(r.result.account_data.Flags) & 0x40000000)) throw Error('Issuer has not enabled trust line locking')
  await checkIssuedPayment(ledger,t.payer,t.payTo,t.amount,t.asset)
}
/** EscrowFinish has no delivered_amount: prove the recipient's RippleState delta. */
export function verifyEscrowCredit(meta: Record<string, any>, t: EscrowTerms, recipient: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (t.asset === 'XRP') return
  const asset = t.asset
  let delta = 0n, count = 0
  for (const node of meta.AffectedNodes ?? []) {
    const n = node.ModifiedNode
    if (n?.LedgerEntryType !== 'RippleState') continue
    const f = n.FinalFields, p = n.PreviousFields
    if (f?.Balance?.currency !== asset.currency) continue
    const low = f.LowLimit?.issuer, high = f.HighLimit?.issuer
    if (!((low === recipient && high === asset.issuer) || (high === recipient && low === asset.issuer))) continue
    const before = decimalUnits(p?.Balance?.value), after = decimalUnits(f.Balance.value)
    if (before === undefined || after === undefined) throw Error('Missing IOU balance delta')
    delta += (after-before) * (low === recipient ? 1n : -1n); count++
  }
  if (count !== 1 || delta !== decimalUnits(t.amount)) throw Error('IOU escrow settlement amount/currency/issuer mismatch')
}
