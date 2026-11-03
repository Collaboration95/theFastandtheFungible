import { createClient } from '../sdk/index.js'
import { openPaymentJournal } from '../sdk/x402-journal.js'
import { Wallet } from 'xrpl'
// Fixture injection is explicit; it never contacts a ledger or loads a real seed.
const fixture = process.env.RA_SDK_FIXTURE === '1'
  ? await import('../tests/fixtures/sdk-payment.js') : undefined
const journal = openPaymentJournal(process.env.RA_JOURNAL ?? 'payment-journal.db')
try {
  const client = createClient({ baseUrl: process.env.RA_URL ?? 'http://127.0.0.1:6100',
    payment: { wallet: fixture?.wallet ?? Wallet.fromSeed(process.env.XRPL_CALLER_SEED!),
      maxDrops: process.env.RA_MAX_DROPS ?? '1000', journal, ledger: fixture?.ledger } })
  const paid = await client.pay(process.argv[2], { idempotencyKey: 'example-pay-v1' })
  console.log(JSON.stringify({ fixture: !!fixture, receipt: paid.receipt, payment: paid.payment }))
  await paid.response.body?.cancel()
} finally { journal.close() }
