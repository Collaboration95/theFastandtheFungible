# Pay for a hosted answer over x402

Owner deployment opt-in: `PAID_ENDPOINT_PUBLIC=on`, default `off`. This exposes
`POST <HOSTED_ORIGIN>/v1/ask`, using the existing exact-payment hire service.
It is separate from MCP (which has no hire tool) and the key-reveal article
seller packages. Only XRPL Testnet is accepted. No sign-in or bearer token.

Hosted accepts `budgetMinor: 100 | 200`, additionally bounded by
`HOSTED_QUESTION_CAP_MINOR`. The local hire API's 500-cent option is refused on
hosted. A fixed S$0.20 service fee is added, so 200 cents needs a maximum inbound
payment of 220,000 drops under the existing 1,000-drops-per-budget-cent mapping.
The result includes cited evidence, all royalties and unused-budget change.
This mapping is a Testnet policy convention, not an XRP/SGD exchange rate.

The hosted session/IP/daily/model caps and pause controls apply before payment
settlement. Anonymous identities share a public address and survive reconnects;
request keys are namespaced per identity. A quote holds an allowance without
moving money. The existing S$40 VM budget kill switch also stops this endpoint.
The money path still checks wallet caps and pause state immediately before
accepting a payment and before signing payouts. Never sign another payment
after an uncertain response; retain the original journal, request and key.

## Curl challenge and replay

Set URL to the exact configured HTTPS origin. The first request returns 402:

```sh
URL=https://your-service.run.app
curl --include --request POST "$URL/v1/ask" \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: answer-001' \
  --data '{"question":"How do x402 payments work?","budgetMinor":200}'
```

Decode `PAYMENT-REQUIRED` with a v2-aware payer and validate its `exact`,
`xrpl:1`, XRP amount, destination, invoice and expiry against your policy. Have
your Testnet wallet sign the required transaction, then send the resulting
base64 v2 payload using **the same body and request key**:

```sh
curl --include --request POST "$URL/v1/ask" \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: answer-001' \
  --header "PAYMENT-SIGNATURE: $PAYMENT_SIGNATURE" \
  --data '{"question":"How do x402 payments work?","budgetMinor":200}'
```

The variable contains a signed payment, not a seed. Keep shell history and
request logs private. Curl does not sign or approve payments for you. Do not
repeat the command with a new key just because a connection timed out.

## TypeScript SDK

Install the existing `@researchagent/sdk` from a local packed archive or an
owner-published release, plus `xrpl`, in your project. Registry publication is a
separate owner action. The owner
provides a **dedicated Testnet** wallet and an explicit cap; models never get
signing authority. Public hosted URLs need no token:

```js
import {createClient} from '@researchagent/sdk'
import {openPaymentJournal} from '@researchagent/sdk/journal'
import {Wallet} from 'xrpl'
const journal = openPaymentJournal('./private/hire.db')
try {
  const researcher = createClient({
    baseUrl: process.env.RESEARCHAGENT_URL,
    token: '',
    payment: {wallet: Wallet.fromSeed(process.env.TESTNET_CALLER_SEED), maxDrops: '220000', journal},
  })
  const result = await researcher.hire('How do x402 payments work?', {
    budgetMinor: 200, idempotencyKey: 'answer-001',
  })
  console.log(result.run_id, result.moneyChain.inbound.txHash)
} finally { journal.close() }
```

Keep the journal across restarts. A valid signature does not override a paused
server or exhausted allowance. Network settlement is irreversible once
validated even when HTTP delivery fails; retry the original payment to recover
its result. Do not supply the key-reveal seller scheme to this exact payer.
