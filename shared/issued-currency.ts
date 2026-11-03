import { decimalUnits, type Asset } from './contracts/asset.js'
import type { Ledger } from './xrpl.js'
/** Fail before signing. Native XRP reserve (all owner objects included) still pays fees. */
export async function checkIssuedPayment(ledger: Ledger, payer: string, payee: string, value: string, asset: Exclude<Asset, 'XRP'>) {
  const [issuer, source, destination, account, server] = await Promise.all([
    ledger.request({ command: 'account_info', account: asset.issuer, ledger_index: 'validated' }),
    ledger.request({ command: 'account_lines', account: payer, peer: asset.issuer, ledger_index: 'validated' }),
    ledger.request({ command: 'account_lines', account: payee, peer: asset.issuer, ledger_index: 'validated' }),
    ledger.request({ command: 'account_info', account: payer, ledger_index: 'validated' }),
    ledger.request({ command: 'server_info' }),
  ])
  const flags = Number(issuer.result.account_data.Flags)
  if ((flags & 0x00400000) || (issuer.result.account_data.TransferRate ?? 1000000000) !== 1000000000) throw new Error('Issuer frozen or transfer fee unsupported; nothing was charged')
  const line = (r: typeof source) => r.result.lines?.find((l: { currency: string; account: string }) => l.currency === asset.currency && l.account === asset.issuer)
  const a = line(source), b = line(destination)
  if (!a || !b) throw new Error('RLUSD trust line missing; nothing was charged')
  if ([a,b].some(l => l.freeze || l.freeze_peer || l.deep_freeze || l.deep_freeze_peer || ((flags & 0x00040000) && !l.peer_authorized))) throw new Error('RLUSD trust line frozen or unauthorized; nothing was charged')
  const amount = decimalUnits(value), balance = decimalUnits(a.balance), held = decimalUnits(b.balance), limit = decimalUnits(b.limit)
  if (amount === undefined || amount <= 0n || balance === undefined || balance < amount) throw new Error('Insufficient RLUSD balance; nothing was charged')
  if (held === undefined || limit === undefined || limit - held < amount) throw new Error('Writer RLUSD trust limit insufficient; nothing was charged')
  const v = server.result.info.validated_ledger, data = account.result.account_data
  const reserve = Math.ceil((Number(v.reserve_base_xrp) + Number(data.OwnerCount) * Number(v.reserve_inc_xrp)) * 1e6)
  if (!Number.isSafeInteger(reserve) || Number(data.Balance) - reserve < 2000) throw new Error('Insufficient XRP reserve for RLUSD fee; nothing was charged')
}
