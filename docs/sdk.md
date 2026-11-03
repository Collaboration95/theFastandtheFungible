# ResearchAgent SDK v1

Node 22.13+ ESM, with TypeScript declarations. Build with `npm run build:sdk`,
then `cd packages/sdk && npm pack`. Install the tarball in another project.
Import `createClient` and `ResearchAgentError` from `@researchagent/sdk`;
import `openPaymentJournal` from `@researchagent/sdk/journal`.
No npm publication is performed; the owner decides that in #265.

The separate package excludes the private application and desktop assets. It
reuses the existing zod, xrpl and ripple-keypairs dependencies; no new runtime
library is introduced. This release is Node-only (SQLite journals and offline
verification use Node builtins). Three runnable examples live in examples/:
`npx tsx examples/ask.ts`, `npx tsx examples/verify.ts receipts.json`, and
`npx tsx examples/pay.ts https://publisher.example/resource`.
Set RA_URL and RA_API_TOKEN for the engine. Tests run all three against explicit
local synthetic fixtures on ephemeral ports, without .env or live providers.

```ts
import { createClient } from '@researchagent/sdk'
const client = createClient({ baseUrl: 'http://127.0.0.1:6100', token: process.env.RA_API_TOKEN })
const task = client.ask('How did margins change?', { budget: 2, idempotencyKey: 'deal-1' })
for await (const event of task.events) console.log(event.type, event.label)
const run = await task
console.log(run.answer, run.citations, run.receipts, run.clamped)
```

## API reference

Method names below are checked against the public client by a test.

### `ask`

`ask(question, { budget, idempotencyKey?, signal?, waitMs?, escrow? })` returns
an AskTask: a Promise of AskResult with an independent replayable `.events`
AsyncIterable. Budget is requested SGD; the server clamps it to operator caps.
The final result includes requestedBudgetMinor, budgetMinor, clamped,
humanMaxBudgetMinor, humanDailyCapMinor, answer, citations, receipts, purchases,
phase and mode labels. `budgetSgd` remains a compatibility alias.
FREE_DRAFT events contain labelled free-source drafts; ANSWER_READY marks checked
answers. Drafts are provisional. The iterator yields durable TraceEvents in order,
then ends with the same success or typed failure as the promise. SSE falls back
to read-only polling; admission is never automatically retried. A bounded waitMs
may return an active run; use watch/getRun to continue. Cancellation stops the
waiter, not an admitted run. Reuse the same idempotency key for retries.

### `getRun`

`getRun(id)` reads a presented run with exact delivered citation passages and
verified-grant checks. It never starts research or spends.

### `walletStatus`

`walletStatus()` reads operator caps, gross spend, reservations, pause state,
rail and public payer address, with remainingMinor. Never returns signing keys.

## Verify an exported answer (#278)

The verifier checks exact passages, writer signatures, receipts and audit links.

### `verify`

`verify(answerOrPath, options?)` checks an exported receipt bundle or report
wrapper, or reads a local JSON path. Returns `{ ok, runId?, checks }`; invalid
or tampered evidence returns ok=false. Input/IO failures are typed errors.
Options: expectHead pins an independently supplied audit head; testnet enables
read-only ledger verification. Offline checks are the default; self-contained
hashes do not establish independent authenticity. Export with receipts(id), or
GET /runs/:id/report.json. PDF verification remains available through the
repository's `npm run verify:answer` command.

### `hire`

`hire(question, { budgetMinor: 100 | 200 | 500, idempotencyKey })` calls the
baseUrl's /v1/ask x402 service, with its fixed S$0.20 fee. The typed HireResult
includes the presented run and moneyChain (inbound, payments, writer addresses,
royalties and caller change).
Requires explicit operator payment options (below). Reuse the key on uncertainty.

### `pay`

`pay(url, { idempotencyKey?, method?, body?, headers? }?)` buys any compatible x402
v2 exact XRP/issued-currency resource on XRPL Testnet. Returns response, receipt,
and payment proof. Configure `payment: { wallet, maxDrops, journal, issued? }` in
createClient. Use openPaymentJournal(path) and close it when finished. The journal
stores signed blobs, never seeds; keep it private and reuse it across restarts.
An ambiguous delivery reuses the persisted signed transaction, never a new charge.
Only HTTPS or loopback HTTP is accepted. Authority and fee limits remain enforced;
Mainnet is refused. The engine token is never forwarded to arbitrary pay URLs.
The pay example reads XRPL_CALLER_SEED and RA_MAX_DROPS only when explicitly run;
RA_JOURNAL selects its durable journal file. Fixtures are labelled synthetic.

### `receipts`

`receipts(id)` exports the typed verification bundle.

### `watch`

`watch(id, { signal? }?)` replays/follows durable TraceEvents once per event id.

### `search`

`search(query, { k? }?)` returns untrusted public metadata, never paid passages.

### `wallet`

Compatibility alias for walletStatus.

## Errors and authority

ResearchAgentError has a typed code: unauthorized, not_found, invalid,
backend_unavailable, cancelled, payment_failed, or verification_failed. Backend
bodies and low-level errors are not echoed. Verification failure is a result,
not an exception. Explicit payment authority is separate from a research budget;
only deterministic server policy can spend on research. No approval per purchase,
no real-money operation, and all substituted/fixture modes retain their labels.
