import { decode, hashes } from 'xrpl'
import type { Ledger } from '../../shared/xrpl.js'
/** Labelled synthetic ledger: no network; only used by tests and the explicit fixture demo. */
export function hireLedger() {
  const txs = new Map<string, Record<string, unknown>>()
  let submits = 0
  const ledger: Ledger = { async request(r) {
    switch (r.command) {
      case 'account_info': return { result: { account_data: { Sequence: 1 + txs.size, Balance: '100000000', OwnerCount: 0 } } }
      case 'ledger_current': return { result: { ledger_current_index: 100 + txs.size } }
      case 'fee': return { result: { drops: { open_ledger_fee: '12' } } }
      case 'ledger': return { result: { ledger_index: 100 + txs.size } }
      case 'submit': {
        submits++
        const tx = decode(String(r.tx_blob)) as Record<string, unknown>
        const hash = hashes.hashSignedTx(String(r.tx_blob))
        if (!txs.has(hash)) txs.set(hash, tx)
        return { result: { engine_result: 'tesSUCCESS' } }
      }
      case 'tx': {
        const tx = txs.get(String(r.transaction))
        if (!tx) throw Object.assign(new Error('not found'), { data: { error: 'txnNotFound' } })
        return { result: { validated: true, tx_json: tx, meta: { TransactionResult: 'tesSUCCESS', delivered_amount: tx.Amount }, ledger_index: 100 + txs.size } }
      }
    }
    throw new Error('Unexpected synthetic ledger request')
  } }
  return { ledger, txs, get submits() { return submits } }
}
