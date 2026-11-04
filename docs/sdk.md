# ResearchAgent SDK v1

Install status: registries are not yet published. Run `node scripts/install-snippets.mjs --tag v1.0.0` after the owner publishes that release for asset install commands. Local tarballs are built with `make release-artifacts`; MCP includes `researchagent-mcp-1.0.0.tgz` with an npx bin. npm does not support a native git-subdirectory install.


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

### Reliability contracts

Bearer endpoints require HTTPS or exact loopback HTTP, without URL credentials or redirects. HTTP requests have a 15-second bound composed with caller cancellation. SSE uses a separate 30-second idle bound and a 256 KiB incomplete-frame bound; interrupted streams resynchronize via the existing run. `waitMs` bounds observation and returns the latest admitted handle. Interrupted observation errors preserve `runId`; resume with `getRun`, using the original idempotency identity for any admission retry.

`ResearchAgentError` carries `code`, optional `status`, `retryable` and optional `runId`. Codes include `cap_zero`, `paused`, `budget_exhausted`, `overloaded`, `deadline` and `settlement_pending`; overload scheduling itself is deferred. Budget clamps preserve free-only research and expose `clampReason` (`paused`, `cap_zero`, or `budget_exhausted`). `payAndFetch` requires an explicit durable journal, including with an injected ledger; a network payment never falls back to process-memory identity.

## Exact local release artifacts

`make release-artifacts` builds the SDK tgz, Python wheel/sdist and MCPB once,
then tests the installed bytes with fixture models and simulated settlement.
`dist/release/manifest.json` records independent versions, source SHA, runtimes,
bytes and SHA-256; `consumer-results.json` records acceptance separately.
The npm consumer installs declared dependencies normally in a temporary project;
the wheel uses a new venv; MCP starts from the extracted MCPB. Each asks twice
with the same key and checks delivered citations, one receipt/intent and caps.
No registry publication is performed. Python offline verification is independent of Node and works from the wheel alone;
see [independent verifier evidence](evidence/round2-k/README.md). Minimum supported Node is 22.13 and Python
3.10; hosted artifact acceptance uses those runtimes.

See [release artifact evidence](evidence/round2-d/README.md).

### Independent local origins (Lane F)

`PUBLISHER_URLS=http://127.0.0.1:<port>,http://127.0.0.1:<port>,http://127.0.0.1:<port>` admits at most three operator-configured numeric loopback origins. `PUBLISHER_URL` retains singleton compatibility. This is the labelled pinned-local-origin finals topology; public remote federation is deferred. Discovery/search has one two-second deadline per origin, four HTTP slots, 50 writers/origin and 50 returned hits/query, with healthy partial results.

Federated runtime references carry `source` version 1: origin, signed seller public key, profileId, resourceId and version. `shared/source-identity.ts` supplies the canonical tuple and citation key. TS, Python and MCP preserve that identity; wallet reputation crosses hosts. Receipt bundles dispatch v1/v2 explicitly. Historical missing origins remain unresolved; invoices, signed manifests, blobs, audit entries and intent IDs are unchanged. New obligations save endpoint context before signing; removal prevents new admission while recovery uses the saved endpoint. No engine bearer, delivery token or payment signature is forwarded across origins.

Offline reproduction: `node --import tsx scripts/demo-multi-origin.ts --fixture --output scratch/multi-origin.json`. Evidence and migration handoff: `docs/evidence/round2-f/README.md`. The proof is synthetic, uses simulated payments and an explicit fixture judging/citation rubric, and does not establish adoption or live model quality.

## Kill switch

`await client.pause({ reason: 'Unexpected spending' })` pauses spending durably and immediately. A scoped bearer pauses only
its own agent; an operator bearer pauses the wallet. Returns `{paused: true,
scope: "agent" | "wallet", agentId?: string}`. Repeated pause is safe. The optional
reason is at most 240 characters, excludes control characters, and is stored in
the audit trail. No client resume method exists: resume remains operator-only.
In-flight unsigned purchases cannot sign; signed obligations reconcile normally
without releasing their reservations. Cached desktop preferences cannot resume it.

Receipt contribution v3 exposes exact claim/passage use with semantic assessment
labelled not independently verified. See [receipt contribution contract](contracts/CONTRIBUTION.md)
and [offline fixture evidence](evidence/round2-g/README.md). Python callers can use
`Client.receipts(run_id)`; the existing offline verifier accepts v1/v2/v3.

## Verify against the ledger

`npm run verify:answer -- receipts.json --ledger` verifies an optional anchor-v1
against XRPL Testnet, read-only and without keys. The `audit anchor` check is
PASS for a validated matching memo, FAIL for missing/mismatched/unavailable
ledger evidence. Without `--ledger` it remains SKIP (requires online check).
The SDK equivalent is `verifyAnswer(bundle, { onlineLedger: true })`.
This is separate from `--testnet`, which checks article payments/refunds.
The operator enables anchoring with `ANCHOR_RAIL=xrpl-testnet`; anchor fees are
shown separately and do not change the article budget. See receipt-spec.md.
