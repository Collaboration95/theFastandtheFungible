# Architecture review, Nov 2026

Written 3 Nov 2026 for the SFF finals push (submit 12 Nov, pitch 18 Nov). It
covers `main` at `9117365`: the run loop, purchases, store, MCP server (#266)
and publisher. It asks where the current architecture limits a win on the
[Ripple criteria](../JUDGING-CRITERIA.md) and what would slow the
[feature-a-day run](../SFF-PUSH.md#feature-a-day-5-13-nov). Constraint: a
stable base, no rewrites, targeted seams only.

**Verdict.** The money core is better than most hackathon payment code:
persist-before-submit, one signed blob per intent, ledger-proven release,
resend-for-delivery, manifest-bound invoices, and a policy-only purchaser. What
limits the score is what's around that core: authority (who may spend, and how
much across surfaces), operations (nothing resolves an ambiguous payment until a
restart), evidence for a compliance-minded judge (no audit trail or export), and
a missing client seam that three upcoming features each need.

## Ranked proposals

Ranked by criteria impact per unit of effort. **Do now** = filed as an
architecture issue for Wed 4 → Sat 7. **Fold** = a comment on that feature's
issue. **After SFF** = written down here, not built.

| # | Proposal | Criteria | Effort | When | Issue |
|---|---|---|---|---|---|
| 1 | One spend gate across surfaces: wallet-wide daily cap, API token + host guard, pause switch, decision-input hardening + injection tests | Technical depth · Reachability (compliance) | 1 day | **Do now**, Thu 5 | [#286](https://github.com/Collaboration95/theFastandtheFungible/issues/286) |
| 2 | Typed client SDK v0 (`sdk/`), one config module, `server/routes.ts` split by surface | Reachability (dev access) · dev speed | 1 day | **Do now**, Wed 4 (first) | [#285](https://github.com/Collaboration95/theFastandtheFungible/issues/285) |
| 3 | Live reconciler, balance pre-check, deep health, `/api/metrics`, runbook | Feasibility | 1 day | **Do now**, Fri 6 | [#287](https://github.com/Collaboration95/theFastandtheFungible/issues/287) |
| 4 | Hash-chained audit log, receipts export + on-ledger verify, payee screening hook, retention, `COMPLIANCE.md` | Reachability (compliance) · Builder feedback | 1 day | **Do now**, Sat 7 | [#288](https://github.com/Collaboration95/theFastandtheFungible/issues/288) |
| 5 | `sdk/x402.ts`: `payAndFetch()` exact-scheme buyer for any x402-on-XRPL seller | Reachability (interop) · Creativity | ½ day inside the feature | **Fold** into Day 6 | #274 |
| 6 | Agent keys as principals in the spend gate; hashed at rest | Technical depth | inside the feature | **Fold** into slack F12 | #280 |
| 7 | Mac app on the SDK; API token in the Keychain; config module | Reachability · Feasibility | inside the feature | **Fold** into Day 3 | #259 |
| 8 | Escrow states driven by the reconciler; escrow rows in the audit log | Technical depth | inside the feature | **Fold** into Day 5 | #273 |
| 9 | Receipt bundle built on the audit schema and verifier | Technical depth | inside the feature | **Fold** into slack F10 | #278 |
| 10 | Chaos faults at the SDK/Ledger seams; "stuck reservation" metric | Feasibility | inside the feature | **Fold** into slack F11 | #279 |
| 11 | Issuer screening, trust-line reserve, `delivered_amount` in audit | Reachability (compliance) | inside the feature | **Fold** into Day 7 | #275 |
| 12 | "Unverified writer" label; new wallets screened | Reachability (compliance) | inside the feature | **Fold** into Day 9 | #277 |
| 13 | Streaming via SDK `watch()`; TTFA from `/api/metrics` | Feasibility | inside the feature | **Fold** into slack F13 | #281 |
| 14 | Parallel payments: local Sequence tracking or XRPL Tickets, per-payer queues | Feasibility (scale) | 1–2 days, risky | **After SFF** | — |
| 15 | Postgres + multi-tenant engine (one `startEngine` per tenant already isolates) | Feasibility (scale) | days | **After SFF** | — |
| 16 | Key custody for mainnet: KMS/HSM signer, RegularKey with master disabled, multisig treasury | Technical depth · compliance | days | **After SFF** | — |
| 17 | KYB provider for writers, sanctions-screening provider behind #288's hook | Reachability (compliance) | integration | **After SFF** | — |
| 18 | Python SDK package; npm publish of `sdk/` (owner decision on #265) | Reachability | ½–1 day | **After SFF** (publish may move up) | — |

**Sequencing.** The four do-now bundles are one Sol lane (call it D), one
bundle a day. #285 goes first because it splits `server/routes.ts`, the file
#273, #274, #275 and #280 all edit. That makes four coding lanes for four
days, one more than the "about three lanes" rule. My recommendation is to run
it anyway: #286 has to land before #259 (remote backend) and #274 (paid
callers) or both ship without authentication. The revert path is plain: each
bundle is one squash-merged PR. If the owner keeps three lanes, #285 and #286
take Lane A's Thu 5 – Fri 6 slot and #259 slips a day into slack.

## 1. SDK

**Recommendation: build a small TypeScript client now (#285). Python should be
an example, not a package, until after SFF.**

Three consumers need the same client this week. The MCP server has its own
fetch wrapper and `presentRun` (`mcp/tools.ts`). The Mac app needs a
remote-backend client (#259). Hire the agent (#274) needs an outside caller.
Writing it once now saves rewriting it three times and gives judges one line
for developer accessibility: `createClient(...).ask(question, { budgetSgd })`.

Surface (lives in `sdk/`, typed from `shared/contracts`, no new dependency):

| Call | Returns | Notes |
|---|---|---|
| `createClient({ baseUrl, token?, fetch? })` | client | `fetch` injectable (tests, chaos #279) |
| `search(query, { k? })` | public hits | never bodies or passages (gate 1) |
| `ask(question, { budgetSgd, idempotencyKey?, signal? })` | answer, citations with passages, purchases with tx hashes, labels, `clamped` | budget is a request; the server clamps it (gate 2) |
| `getRun(runId)` / `watch(runId)` | snapshot / async iterator of trace events | `watch` carries #281's streaming draft |
| `wallet()` | rail, payer address, caps, spend today, paused | read-only |
| `receipts(runId)` | receipt bundle | added by #278 |
| `x402.payAndFetch(url, { wallet, maxDrops })` | delivery + receipt | the generic buyer, added by #274, Testnet-only |

There is deliberately no `buy()` method. The client can ask and set a budget
request, but only server policy picks and pays; a test pins the exported
surface. Two layers: the **client** talks to a ResearchAgent engine, and
**`sdk/x402`** is the protocol piece that lets any agent pay any
x402-on-XRPL seller. The second is the more interesting interop story for
the Ripple track, and it falls out of #274's hire demo for about half a day.

## 2. Compliance readiness

A fintech judge will look for spend limits, an audit trail, export, custody,
and honesty about what is and isn't regulated. What exists today:

- **Spend limits.** There is a per-run budget (≤ S$5, step S$0.05), a
  per-source cap (S$1), and for MCP only a per-call and daily cap. The web
  `/runs` route has no daily cap, so unlimited S$5 runs are allowed. There
  is no wallet-wide limit and no pause. Fixed by #286.
- **Audit.** Receipts and events live in per-run JSON blobs. Nothing records
  which surface or principal authorized a spend, or under which policy and
  model version. There is no export and no tamper evidence. Fixed by #288:
  a hash-chained `audit_log` written in the same transaction as the state
  change, CSV/JSONL export, and `audit:verify`, which re-checks every tx on
  Testnet.
- **Custody.** Today it's honest: non-custodial. The buyer pays the writer
  directly and the seed sits in `.env` (Keychain from #259). #274 changes
  this, because receiving a caller's payment and forwarding royalties and
  change is a payment-service question on mainnet. `COMPLIANCE.md` (#288)
  must say so instead of keeping the "we never hold funds" line.
- **KYC/AML.** Writers are fictional and unverified on Testnet. The cheap,
  real control is a payee screening hook before signing (#288). It's an
  operator denylist, labelled as such and not as sanctions screening, and a
  provider plugs into the same hook after SFF. Travel Rule thresholds
  (FATF USD/EUR 1,000; MAS S$1,500 for DPT transfers) sit far above
  per-article payments, but aggregate monitoring is a mainnet item, and the
  doc says so rather than claiming exemption.
- **Retention.** Premium bodies and salts stay in `app.db` indefinitely, and
  Langfuse public traces (opt-in, `LANGFUSE_PUBLIC_TRACES=1`) carry question
  text. #288 adds `data:prune`, which keeps receipts and the audit chain.

What we should *not* add: a KYC form on Testnet, risk scores, or any
"compliant" badge. Each of those is theatre.

## 3. Reliability and operations

The purchase core's failure handling is correct. Every post-sign exception is
treated as ambiguous, and only the ledger can release a reservation (failed,
or expired past `LastLedgerSequence` with the account Sequence unmoved). A
resend returns the same delivery. The facilitator de-duplicates by blob.
What's missing:

| Failure | Today | Fix |
|---|---|---|
| Ambiguous SUBMITTING (facilitator timeout, ledger slow) | stays reserved until the **next boot** (`reconcile()` runs only in `createApiApp`); holds the MCP daily cap | live reconciler, 15 s (#287) |
| DELIVERY_FAILED after settlement | waits for a manual retry | bounded auto-retry (#287) |
| Payer underfunded | signs, submits, fails on ledger, released via the proof path | balance and reserve pre-check, refused before signing (#287) |
| One slow writer | the payer lock is held until the facilitator answers (≤ 60 s), so every purchase on the wallet waits | measure lock wait now (#287); Tickets/local Sequence after SFF |
| "Is it up?" | `/health` is a static `ok` | deep health: DB, publisher, ledger age, balance headroom, backlog (#287) |
| Numbers for Feasibility | Langfuse only, forced off in engine/MCP | `/api/metrics` feeds `make scorecard` (#287) |

For "production-ready" to be an honest claim we need: no stuck reservation
without a restart, a health endpoint that can say `degraded`, a runbook, and
chaos numbers (#279) on top of #287. Until then, say "production-shaped,
single-tenant, Testnet".

**Scalability, stated plainly:** one process, one SQLite file, one payer lock.
That's fine for a desktop app and a demo. `startEngine` already isolates one
engine per data directory, which is the multi-tenant seam. Postgres and
parallel signing come after SFF.

## 4. Security

- **Authentication: none.** Every route, including `/runs`, stop, retry and
  `/api/reputation/reset`, is open. `npm run dev:client` binds Vite to
  `0.0.0.0` and proxies `/runs` to the API, so anyone on the venue Wi-Fi can
  spend. There is no `Host` check, so a web page can reach `127.0.0.1:8788`
  through DNS rebinding. `RA_BACKEND_URL` (MCP) and #259's remote backend
  send no credential. All of this is fixed in #286 with a bearer token,
  loopback-only anonymous access, a `Host` allowlist, and a refusal to boot
  on a non-loopback host without a token.
- **Prompt injection into decisions.** #208 closed the main hole: the
  decision model judges the frozen requirement, not the LLM-written gap. Two
  paths remain. `conclusion` is still DeepSeek text written over free source
  text a writer controls, and it is sent in the batch state. Candidate
  title/preview/facets reach the model uncapped. Policy code bounds the worst
  case (budget, per-source cap, one charge per intent), but nothing tests that
  bound under an obedient, injected model. #286 drops `conclusion` on the
  requirement path, caps and filters the candidate fields, and adds an
  injection pack with a worst-case stub provider.
- **Key handling.** Good: the seed stays inside `XrplPayer`, `maskSecrets`
  covers telemetry, the Testnet-only host check is in place, and the simulated
  key is refused on Testnet. To add: the API token in the mask list (#286),
  the token beside the seed in the Keychain (#259), and RegularKey + KMS for
  mainnet (after SFF).
- **MCP permissions.** These are right: tool arguments can't raise caps, choose
  an article or settle, and caps come from the operator environment. Gaps:
  writer-supplied text returns to the calling LLM unmarked, so a second-order
  injection is possible (#286 marks it `untrusted`). Caps are per server
  process, not per agent (#280).

## 5. Dev speed

- **Tests are not the bottleneck:** 491 unit tests in 58 files run in 39–53 s
  locally (`vitest run`, 3 Nov). The long pole is the search leak gate
  (`tests/search-leak.test.ts`, ~38 s alone). It is a hard-gate test, so
  don't loosen it; if the suite grows, give it its own vitest project so it
  runs beside the rest. Use `vitest related <files>` in the inner loop.
- **Hot files are.** `server/routes.ts` (one 250-line closure),
  `server/purchases.ts`, `server/store.ts` and `server/agents/loop.ts` are on
  the file list of #273, #274, #275 and #280, which run in different lanes.
  Splitting the routes (#285) and putting authority in one module (#286)
  means those features add a router and a surface instead of editing the same
  closure.
- **Config is scattered:** 48 `process.env` reads across 17 files. The engine
  worker clones env to isolate them, and the Mac app and `make doctor` will
  each re-derive the same variables. One zod config (#285) fails fast with the
  variable's name.
- **Store shape:** runs are JSON blobs re-hydrated whole, and `mcpUsage` scans
  every MCP run on each admission. This is fine at demo scale. Leave it alone
  until after SFF; #286's `admissions` table removes the scan.
- **Docs drift:** `ARCHITECTURE.md` says "As built (8 Oct)". `SECURITY.md`
  says everything is "covered by the gate suite" while the gate audit (#256)
  is still an open PR. `PRODUCT.md` "we never hold the money" stops being
  true at #274. The owners of #256, #274 and #288 should each fix their own
  line.
- **Very long single-line statements** in the core files (200+ characters)
  make three-lane rebases conflict on whole statements. This is not worth a
  reformat PR now. New code in the do-now bundles should use normal line
  lengths.
