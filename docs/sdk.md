# Use ResearchAgent from code

The in-repository TypeScript SDK needs no additional dependency. Start the API
with your operator configuration, then run `npx tsx examples/sdk-quickstart.ts`.
The example defaults to the API's `OFFSET=600` port, 9388; set `RA_BACKEND_URL`
for another address. Operator MCP caps default to zero: set
`MCP_MAX_BUDGET_MINOR=100 MCP_DAILY_CAP_MINOR=100` on the **backend** to permit
the S$1 example. These are SGD cents, not XRP drops.

```ts
import { createClient } from '../sdk/index.js'
const client = createClient({ baseUrl: 'http://127.0.0.1:9388' })
const run = await client.ask('What changed in the deal?', {
  budgetSgd: 1, idempotencyKey: 'deal-question-1',
})
console.log(run.answer, run.purchases.map(p => p.txHash), run.labels)
```

| Method | Result |
|---|---|
| `createClient({ baseUrl, token?, fetch? })` | Typed client; injectable Fetch transport |
| `search(query, { k? })` | Public hits, labels, corpus label, unavailable writers; never bodies |
| `ask(question, { budgetSgd, idempotencyKey?, signal? })` | Terminal run, cited answer and delivered citation passages, purchases and transaction hashes, labels and budget clamp information |
| `getRun(runId)` | Same presentation of the current run; does not start work |
| `watch(runId, { signal? })` | Async iterator of durable trace events, replayed once per event ID, then live events until terminal |
| `wallet()` | Rail, public payer address, backend caps, gross spend today and reserved/remaining budget |

Only backend policy chooses and pays for articles. The SDK has no purchase
method. Ask follows the existing SSE snapshots and falls back to read-only
polling if the stream fails or is unsupported. `AbortSignal` cancels waiting,
not the already admitted run. Admission is never automatically retried. MCP
uses the additional `waitMs: 45_000` option to retain its bounded wait; an active
result can be followed with `getRun` or `watch`.

Keep a stable idempotency key for each intended question. Reuse it after a lost
response to retrieve the same persisted run without a new intent or charge.
Changing the question under that key fails. Without a key, each ask is a new
intent. `clamped` means the backend reduced the requested budget to its caps
or the available daily allowance; refunds do not replenish spending authority.

Preserve `labels` and `corpusLabel` when displaying results. Fixture providers
and fictional writers remain labelled; SIMULATED purchases have null transaction
hashes and explorer URLs. Paid citation passages are exposed only when their
delivered content matches a VERIFIED grant. Real Testnet settlement still has
no real monetary value.

`token` sends `Authorization: Bearer …` on JSON and SSE requests and defaults
to `RA_API_TOKEN` in Node. The backend enforces bearer auth, Host/Origin guards,
wallet-wide gross daily caps and pause; see [SECURITY](contracts/SECURITY.md)
for the exact operator and embedded-app contract. Errors use
`ResearchAgentError.code`: `unauthorized`, `not_found`, `invalid`, or
`backend_unavailable`. Backend bodies and transport details are not echoed.

`examples/python/ask.py` demonstrates the same capped, idempotent flow with
Python's stdlib `urllib` and polling. It prints the persisted answer, receipt
hashes and labels; it is an example, not a Python SDK package. TypeScript is
in-repo for now; npm publication awaits the owner (#265).

## Configuration seam

`server/config.ts` exports `loadConfig(env)` and the `Config` type. API/MCP boot
and doctor validate numeric settings, ports, URLs and caps here. Errors name
variables without values. Every existing variable name, provider fallback,
empty-string precedence and legacy DeepSeek/Groq key remains supported.
Call-time reads use this same parser so isolated engine workers and explicit
test environments stay independent. Publisher configuration remains separate
at this seam. Token/Host startup validation happens before an API listener.

## Pay an x402 seller or hire a remote agent

`sdk/x402.ts` exports `payAndFetch(url, { wallet, maxDrops, journal, ... })`
for any x402 v2 exact/XRP seller on XRPL Testnet. It verifies terms before
signing and settlement against the ledger. Use `openPaymentJournal` from
`sdk/x402-journal.ts` for durable retry; a timeout must reuse the same signed
intent. GET buys an article; POST can hire ResearchAgent at `/v1/ask`.
See [the example and full policy](x402-xrpl.md#generic-sdk-buyer-any-x402-on-xrpl-seller).

`createHireClient` from `sdk/hire.ts` wraps hired questions. MCP registers
`hire_researcher` only when the operator configures a remote URL, caller wallet
and maximum payment (see the protocol doc). The caller chooses a tier and a
stable idempotency key; the remote engine chooses purchases and royalties.
[Live proof](evidence/hire-274.md): a separate faucet caller paid an answer,
one purchase, paid/free citation royalties and change, with five validated hashes.
