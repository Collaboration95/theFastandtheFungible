// Deterministic ledger SIMULATION, with durable state for SIGKILL recovery tests.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { decode, hashes } from 'xrpl'
import type { Ledger } from '../../shared/xrpl.js'
export function chain(path?: string, afterSubmit?: (type: unknown) => void) {
  const state = { now: 800000000, index: 100, balance: 100000000, owners: 0, submitEnabled: true, validate: true, terminalFail: false }
  const txs = new Map<string, Record<string, any>>() // eslint-disable-line @typescript-eslint/no-explicit-any
  const objects = new Map<number, Record<string, unknown>>()
  if (path && existsSync(path)) {
    const saved = JSON.parse(readFileSync(path, 'utf8'))
    Object.assign(state, saved.state)
    for (const [k,v] of saved.txs) txs.set(k,v)
    for (const [k,v] of saved.objects) objects.set(k,v)
  }
  const ledger: Ledger = { async request(r) {
    switch (r.command) {
      case 'server_info': return { result: { info: { network_id: 1, validated_ledger: { age: 1, reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } }
      case 'account_info': return { result: { account_data: { Sequence: 7 + txs.size, Balance: String(state.balance), OwnerCount: state.owners, Flags: 0x40000000 } } }
      case 'account_lines': return {result:{lines:[{account:process.env.TESTNET_IOU_ISSUER,currency:'SGT',balance: r.account === process.env.TESTNET_IOU_ISSUER ? '0' : '10000',limit:'1000000'}]}}
      case 'ledger': return { result: { ledger_index: state.index, ledger: { close_time: state.now } } }
      case 'ledger_current': return { result: { ledger_current_index: state.index } }
      case 'simulate': return { result: { engine_result: 'tesSUCCESS', ledger_index: state.index } }
      case 'fee': return { result: { drops: { open_ledger_fee: '12' } } }
      case 'account_tx': return { result: { transactions: [...txs].map(([hash, row]) => ({ ...row, hash })) } }
      case 'ledger_entry': return { result: { node: objects.get((r.escrow as { seq: number }).seq) } }
      case 'tx': {
        const found = txs.get(String(r.transaction))
        if (!found) throw Object.assign(new Error('missing'), { data: { error: 'txnNotFound' } })
        return { result: found }
      }
      case 'submit': {
        if (!state.submitEnabled) throw new Error('network fault')
        const blob = String(r.tx_blob), hash = hashes.hashSignedTx(blob)
        if (!txs.has(hash)) {
          const t = decode(blob), op = t.TransactionType
          const success = op === 'Payment' || op === 'EscrowCreate' || !state.terminalFail && objects.has(Number(t.OfferSequence)) && (op === 'EscrowCancel' ? state.now > Number(objects.get(Number(t.OfferSequence))!.CancelAfter) : state.now < Number(objects.get(Number(t.OfferSequence))!.CancelAfter))
          txs.set(hash, { validated: state.validate, tx_json: t, ledger_index: ++state.index, meta: { TransactionResult: success ? 'tesSUCCESS' : 'tecNO_PERMISSION', delivered_amount: t.Amount } })
          if (success && ['EscrowFinish','EscrowCancel'].includes(String(op))) {
            const obj=objects.get(Number(t.OfferSequence))!, a=obj.Amount as Record<string,string>
            if (typeof a==='object') { const recipient=String(op==='EscrowFinish'?obj.Destination:obj.Account); txs.get(hash)!.meta.AffectedNodes=[{ModifiedNode:{LedgerEntryType:'RippleState',PreviousFields:{Balance:{value:'0'}},FinalFields:{Balance:{currency:a.currency,value:a.value},LowLimit:{issuer:recipient},HighLimit:{issuer:a.issuer}}}}] }
          }
          if (success && op === 'EscrowCreate') { objects.set(Number(t.Sequence), t); state.owners++; state.balance -= typeof t.Amount === 'string' ? Number(t.Amount) : 0 }
          if (success && ['EscrowCancel', 'EscrowFinish'].includes(String(op))) { if (op === 'EscrowCancel') state.balance += typeof objects.get(Number(t.OfferSequence))!.Amount === 'string' ? Number(objects.get(Number(t.OfferSequence))!.Amount) : 0; objects.delete(Number(t.OfferSequence)); state.owners-- }
          state.balance -= Number(t.Fee)
        }
        if (path) writeFileSync(path, JSON.stringify({ state, txs: [...txs], objects: [...objects] }))
        afterSubmit?.(decode(blob).TransactionType)
        return { result: { engine_result: 'tesSUCCESS' } }
      }
    }
    throw new Error('unexpected RPC')
  } }
  return { state, ledger, txs, objects }
}
