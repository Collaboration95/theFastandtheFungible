// SYNTHETIC, durable ledger. Never connects to XRPL; enforces account Sequence as well as hash identity.
import { DatabaseSync } from 'node:sqlite'
import { decode, hashes } from 'xrpl'
import type { Ledger } from '../../shared/xrpl.js'

export function fixtureLedger(path: string) {
  const db = new DatabaseSync(path)
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS txs(hash TEXT PRIMARY KEY, account TEXT, sequence INTEGER, json TEXT, UNIQUE(account,sequence));`)
  let submits = 0
  const transactions = () => db.prepare('SELECT hash,json FROM txs').all().map(r => ({ hash: String(r.hash), tx: JSON.parse(String(r.json)) as Record<string, unknown> }))
  const sequence = (account: string) => Number(db.prepare('SELECT coalesce(max(sequence),0)+1 AS n FROM txs WHERE account=?').get(account)!.n)
  const ledger: Ledger = { async request(r) {
    switch (r.command) {
      case 'account_info': return { result: { account_data: { Sequence: sequence(String(r.account)), Balance: '100000000', OwnerCount: 0 } } }
      case 'server_info': return { result: { info: { validated_ledger: { age: 0, reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } }
      case 'ledger_current': return { result: { ledger_current_index: 100 } }
      case 'ledger': return { result: { ledger_index: 100 } }
      case 'fee': return { result: { drops: { open_ledger_fee: '12' } } }
      case 'submit': {
        submits++
        const blob = String(r.tx_blob), hash = hashes.hashSignedTx(blob)
        if (db.prepare('SELECT 1 FROM txs WHERE hash=?').get(hash)) return { result: { engine_result: 'tefALREADY' } }
        const tx = decode(blob) as Record<string, unknown>
        if (Number(tx.Sequence) !== sequence(String(tx.Account))) return { result: { engine_result: 'tefPAST_SEQ' } }
        db.prepare('INSERT INTO txs VALUES (?,?,?,?)').run(hash, String(tx.Account), Number(tx.Sequence), JSON.stringify(tx))
        return { result: { engine_result: 'tesSUCCESS' } }
      }
      case 'tx': {
        const row = db.prepare('SELECT json FROM txs WHERE hash=?').get(String(r.transaction))
        if (!row) throw Object.assign(new Error('Synthetic txnNotFound'), { data: { error: 'txnNotFound' } })
        const tx = JSON.parse(String(row.json))
        return { result: { validated: true, tx_json: tx, meta: { TransactionResult: 'tesSUCCESS', delivered_amount: tx.Amount }, ledger_index: 100 } }
      }
      default: throw new Error('Unsupported synthetic ledger command')
    }
  } }
  return { ledger, transactions, get submits() { return submits }, close: () => db.close() }
}
