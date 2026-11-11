// Read-only proof. Run: node --import tsx docs/evidence/ledger-check/real-read.mts
import { Client } from 'xrpl'
import { readLedgerFact, readPayer } from '../../../src/ledger-check.ts'
import { readLedgerReceipt } from '../../../src/ledger-check.ts'
import fixture from '../../../tests/fixtures/ledger-check/rpc.json' with { type: 'json' }
const client = new Client('wss://s.altnet.rippletest.net:51233')
await client.connect()
try {
  const rpc = async (request: Record<string, unknown>) => (await client.request(request as never)).result as Record<string, unknown>
  const result: Record<string, unknown> = { endpoint: client.url, readAt: new Date().toISOString() }
  for (const kind of ['rlusd-escrow', 'reserve', 'fee'] as const) result[kind] = await readLedgerFact(kind, rpc)
  result.payer = await readPayer(rpc)
  for (const name of ['hosted', 'token'] as const) result[name] = await readLedgerReceipt(fixture[`${name}Create`].hash, fixture[`${name}Finish`].hash, rpc)
  console.log(JSON.stringify(result, null, 2))
} finally { await client.disconnect() }
