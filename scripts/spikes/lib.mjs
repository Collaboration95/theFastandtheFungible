// Standalone Testnet harness. No product money-path imports and no seed output.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { Client } from 'xrpl'
export const TESTNET = 'wss://s.altnet.rippletest.net:51233'
export const evidenceDir = 'docs/evidence/money'
export function save(name, value) {
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(`${evidenceDir}/${name}.json`, JSON.stringify(value, null, 2) + '\n')
}
export async function connect() {
  const c = new Client(TESTNET, { timeout: 20000 })
  await c.connect()
  assert.equal((await c.request({ command: 'server_info' })).result.info.network_id, 1)
  return c
}
export async function funded(c) { return (await c.fundWallet()).wallet }
export async function account(c, w) {
  return (await c.request({ command: 'account_info', account: w.address ?? w, ledger_index: 'validated' })).result.account_data
}
export async function cancelAfter(c) {
  return (await c.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger.close_time + 300
}
export async function submit(c, wallet, transaction, { batchSigner, label = transaction.TransactionType } = {}) {
  const tx = await c.autofill(transaction)
  if (batchSigner) batchSigner(tx)
  const signed = wallet.sign(tx)
  const startLedger = await c.getLedgerIndex(), start = performance.now()
  const { result } = await c.submit(signed.tx_blob)
  let validated
  if (/^(tes|tec)/.test(result.engine_result)) validated = (await c.submitAndWait(signed.tx_blob)).result
  const record = { label, hash: signed.hash, explorer: `https://testnet.xrpl.org/transactions/${signed.hash}`, engine: result.engine_result,
    validated: Boolean(validated?.validated), result: validated?.meta?.TransactionResult, ledger: validated?.ledger_index,
    ledgers: validated ? validated.ledger_index - startLedger : 0, ms: Math.round(performance.now() - start), tx }
  console.log(JSON.stringify({ ...record, tx: undefined }))
  return { record, meta: validated?.meta }
}
export async function escrows(c, wallet) {
  return (await c.request({ command: 'account_objects', account: wallet.address, type: 'escrow', ledger_index: 'validated' })).result.account_objects
}
