# Publishers and purchases: October 10 implementation plan

Planning baseline: October 2, 2026. [INTERFACES.md](INTERFACES.md) is authoritative.
These are proposed issues. Retain React/Express/TypeScript.
Integrate a minimum complete COM-01..04 path by October 4; finish failure and
recovery cases October 5–6, then freeze/rehearse under the implementation index.

The target demonstration combines a live model, one local HTTP publisher
process, and fixture settlement. Model fixtures/fallbacks remain visibly
labelled independently of settlement mode. Buying is optional: an adequate
accessible answer must finish without settlement. Commerce supplies reliable
boundaries; RES-01 owns corpus metadata, RES-02 decisions/transitions, and
RES-03 synthesis and measured answer impact.

## COM-01 — Transactional store, checkpoints, and purchase records — P0

**Outcome / 80–20 reason.** Replace whole-file run writes with one small SQLite
storage seam. Durable intent before external effects and bounded research
checkpoints address the demo's restart/race risks without a repository framework.

**Current anchors.** `server/persistence.ts` validates only `runId` and atomically
renames JSON; `server/index.ts` uses mutable `runs`, `save`, `load`, and `emit`.
`src/domain.ts` embeds payment/evidence in `Source` and optional `purchaseKeys`
in `Run`. `tests/persistence.test.ts` already covers malformed JSON, nested
receipt data, process restart, and receipt retention after reset.

**Dependencies.** Shared RES-02 checkpoint/artifact schema and RES-01 version identities, frozen before implementation. Full RES-02 completion is not a dependency.
COM-02/03/04 consume this seam.

**Ordered subtasks.**

- [ ] COM-01.a Specify migrations and typed row validators; use built-in `node:sqlite`
  `DatabaseSync` (observed local Node v26.3.1 supports it). Pin/test that runtime
  in launch and verification environments; fail startup if unavailable.
- [ ] COM-01.b Add `RESEARCH_DB_FILE`, schema version, foreign keys, bounded busy timeout,
  WAL, and `synchronous=FULL`. Use short `BEGIN IMMEDIATE` transactions; never
  hold one over model calls or HTTP. Ignore database/WAL runtime artifacts.
- [ ] COM-01.c Implement the narrow storage interface below; replace every app writer,
  including reset, cancellation, approvals, receipts, and events. Emit SSE only
  after commit; authoritative GET reconstructs state without an in-memory balance.
- [ ] COM-01.d Add an explicit, one-time validated JSON importer, keyed by file digest;
  preserve the original file and import atomically. Update seed and isolated
  Playwright preparation; ordinary startup never deletes or silently reseeds.
- [ ] COM-01.e Adapt persistence tests to SQLite and add rollback, revision-conflict,
  interrupted-step, migration, and concurrent-writer coverage using two connections.

**Storage contract / failure decisions.** Keep a small schema: `runs` (mandate, currency, mode, revision, checkpoint JSON,
supersededBy); ordered `run_events`; immutable `run_artifacts`; `purchase_intents`;
`receipts`; `deliveries`; `access_grants`; and `imports`. Quotes and approvals are
immutable typed snapshots on intents; active reservation is an explicit intent
amount/state, not another subsystem. Persist quote/approval snapshots,
intent request hash/key, settlement attempt identity/status, timestamps/errors,
and receipt/delivery/grant links. Enforce unique `(runId,idempotencyKey)`, one
active-or-settled intent per `(runId,publisherId,resourceId,version)`, and one
receipt/grant per intent. Money is nonnegative safe integer minor units with
explicit currency/mode; spend is derived from receipts, reservations separately.

Research gets `createRun(config)`, `getRunSnapshot(runId)`,
`claimStep(runId,expectedRevision,stepId,kind)`,
`commitStep(runId,claimToken,expectedRevision,nextCheckpoint,artifacts,events)`,
`failStep(runId,claimToken,expectedRevision,errorCode)`, and
`getAccessibleEvidence(runId,resourceRefs)`.
Checkpoint schema v1 holds phase/status, bounded step count/limit, decision and
gap records, evidence references, baseline/answer references, provider label,
pending purchase ID, and optional in-flight `{stepId,kind,claimToken,startedAt}`.
Proposed bounds: 64 KiB checkpoint, 24 steps, 12 resource references; RES-02
defines payloads. Baseline/answer artifacts commit with their references.
Reject unsupported schemas. Claim/commit/fail transact and advance revision;
duplicate in-flight claims conflict; completed command replay returns its recorded result before revision checks, as specified in INTERFACES. A stale asynchronous result cannot overwrite a newer
snapshot. Restart marks interrupted research steps retryable explicitly; it
does not replay settlement from a checkpoint. Purchase state lives in its own
ledger and survives research failure. Expose named commerce transactions rather
than arbitrary SQL or balance setters to consumers.

Legacy import is history-only: validate full records, preserve historical spend,
timestamps, payment labels, and supplied evidence in isolated legacy snapshots.
Missing quote/version/proof means `LEGACY_UNVERIFIED`, never a new publisher
grant or inferred Testnet validation. Reject inconsistent amounts/duplicates;
minimal old records may remain explicitly incomplete history. No current-run
access comes from legacy premium text. No JSON/SQLite dual writes.

**Acceptance / verification / done.** Restart restores a checkpoint and ledger
without duplicating events; concurrent claims yield one winner; a rejected commit
leaves no partial rows. Corrupt imports/migrations fail closed, preserving originals.
Re-import is a no-op; new runs start with
zero spend/access. Existing `npm run test:unit -- tests/persistence.test.ts`
is available; SQLite cases are proposed additions. Capture temporary DB queries,
process restart logs, importer results, and command exits. Done requires all app
writers migrated and these cases passing. In scope: local app storage/import;
out: ORM, generic repositories, queues, multi-user tenancy, historical proof repair.

## COM-02 — One publisher service with three profiles — P0

**Outcome / 80–20 reason.** Make locked evidence a real HTTP boundary using one
Express process and three logical profiles. Search, quotes, and protected delivery
demonstrate selective acquisition.

**Current anchors.** `server/catalog.ts` loads all twelve complete fixture
articles; `toSource` removes bodies only after import. `loadSourceCatalog`,
`mockArticles`, `quoteFor`, and `publicSource` in `server/index.ts` retain premium
bytes in the app. `FixtureArticleSchema` couples cents to XRP drops; current
quotes advertise unqualified `x402` v2. `tests/domain.test.ts` verifies metadata
projection, not process separation; `tests/e2e.spec.ts` checks locked UI text.

**Dependencies.** COM-01 for durable settlement journal primitives; RES-01 for
public manifests, resource versions, spans, and the twelve-item profile mapping.
COM-03 consumes this protocol; COM-04 verifies deliveries.

**Ordered subtasks.**

- [ ] COM-02.a Split catalog loaders: publisher-only private corpus and app public
  manifest. App/client/model paths cannot import the private fixture or
  `toPurchasedSpans`; public manifest excludes premium article, quote excerpt,
  spans, evaluation labels, and hidden scores. RES-01 owns metadata curation.
- [ ] COM-02.b Add one publisher entry point and startup contract for VER-03's launcher, with three profile IDs
  `public-records`, `supplier-wire`, `grid-research`; preserve display names and
  family IDs. Follow the exact mapping and legacy policy in INTERFACES.
- [ ] COM-02.c Implement bounded lexical search and public preview, immutable bound
  quotes, protected version delivery, and authenticated fixture settlement/status.
  Add timeouts, response-size/schema validation, and an allowlisted publisher URL
  registry to the app HTTP client; do not follow arbitrary redirects.
- [ ] COM-02.d Persist publisher quotes/settlement results in a separate publisher SQLite
  file through the same small storage module; retain approved versions across
  restart. App and publisher do not share a writable database or private bodies.
  Require stable server-only simulator credentials, distinct DB paths, and
  loopback listeners. Missing credentials/schema fail startup; launcher waits for
  both health checks. Publisher outages never trigger private-catalog loading.
- [ ] COM-02.e Add real-process HTTP tests for disclosure, credential enforcement,
  quote invalidation, publisher restart, and idempotent settlement replay.

**Narrow protocol examples.**

```text
GET  /v1/profiles/grid-research/search?q=interconnection&limit=6
GET  /v1/profiles/grid-research/resources/meridian-ledger/preview
GET  /v1/profiles/grid-research/resources/meridian-ledger/versions/v1/content
POST /v1/profiles/grid-research/resources/meridian-ledger/versions/v1/quotes
POST /v1/simulator/settlements
GET  /v1/simulator/settlements/:intentId
POST /v1/simulator/settlements/:intentId/reconcile
```

Locked content returns actual HTTP 402 with a
`research-publisher-simulator/v1` challenge and quote endpoint. Quote creation
takes `{runId,intentId,settlementMode:'fixture'}`; returns `quoteId`, full SHA-256
`quoteHash`, publisher/journal identity, resource/version, content digest, amountMinor,
`currency:'SGD'`, mode, expiry, terms revision/text, and run/intent binding.
Canonical fixed-field encoding defines the hash. Fixture SGD has no implicit
XRP conversion. Reprice/version/terms changes invalidate unaccepted quotes;
expiry is checked at publisher settlement acceptance. Already accepted receipts
remain valid for the pinned version despite later repricing/expiry.

Trust boundary: only publisher process reads protected bytes. The simulator
settlement endpoint accepts a server-only bearer credential and validates the
exact stored quote/request binding; a plain browser approval/402 token is not
proof. It atomically journals one simulated result per intent and returns an
opaque random delivery credential bound to that receipt/resource/version/run.
Protected GET checks that credential plus `X-Research-Run-Id`, not arbitrary caller
assertions or the settlement bearer alone. Open resources return public bytes.
Tokens never enter public config, SSE, browser receipts, model input, or logs.
This trusts the app's COM-03 approval enforcement; it is a local simulator,
not independently verified external payment or full x402 interoperability.

**Acceptance / verification / done.** Exactly three profiles serve the small
corpus from one process. Missing/forged/wrong-version tokens reveal no premium
bytes; registry/app module graph has no private-corpus import. Search misses
return empty results; unavailable publisher produces a visible retryable error,
never local premium fallback. Proposed `tests/publisher-http.test.ts` starts the
real process and checks response bodies plus private-text canaries. Retain
existing domain tests for metadata; update obsolete conversion assertions.
Record sanitized HTTP transcripts and restart/token-negative results. Done
requires both process and import-boundary checks. In: local HTTP simulator;
out: crawling, production auth, three containers, external publisher integration.

## COM-03 — Exact approval, reservations, and fixture settlement — P0

**Outcome / 80–20 reason.** A human approves one immutable offer; races/retries
cannot spend twice or exceed the mandate. This is the critical purchase control,
independent of whether a model recommends buying.

**Current anchors.** The `/purchases` handler checks `APPROVED`/`quoteHash`, then
awaits `settleLivePayment` before saving; idempotency keys are optional and not
payload-bound. `quoteFor` recomputes terms from mutable catalog state. Budget
checks use only `spentCents`. Missing/stale approval tests exist in
`tests/persistence.test.ts`; concurrent reservation tests do not.

**Dependencies.** COM-01/02; frozen RES-02 proposal and RES-03 baseline schemas. UI-01 consumes approval; its completion does not block commerce tests.

**Ordered subtasks.**

- [ ] COM-03.a Add `POST /api/v1/research-runs/:runId/sources/:sourceId/quotes` to allocate
  a durable nonpaying intent from the current validated research proposal,
  fetch/store a bound quote, and expose an `AWAITING_APPROVAL` projection.
  Persist command identity so a lost response reuses the same intent. Quote retrieval never reserves or settles.
- [ ] COM-03.b Require purchase command `{intentId,quoteId,quoteHash,approval:'APPROVED',
  idempotencyKey,expectedRevision}`. In one transaction validate the binding,
  run/plan state, allowlist, mode, expiry, baseline reference, ceiling and budget;
  record approval and reserve the exact amount. Return stable purchase ID.
- [ ] COM-03.c Persist a claimed `SUBMITTING` attempt before calling authenticated
  simulator HTTP. Send immutable quote and intent/request hash; persist result
  transactionally. Separate settled accounting from delivery/access.
- [ ] COM-03.d Make skip/reject nonpaying commands, quote refresh create a new intent,
  and all duplicate/rejected operations explicit. Remove source-name purchase
  overrides and commerce edits to thesis/gap; RES-02/03 own evidence impact.
- [ ] COM-03.e Disable existing live Testnet submission in core startup/API paths;
  requesting it returns explicit configuration/error state, never fixture
  substitution. Qualifying it is separate gated work, including durable signed
  transaction identity, reconciliation, unit/recipient proof, and delivery binding.

**Lifecycle / failures.** `AWAITING_APPROVAL → RESERVED → SUBMITTING → SETTLED`
followed by independent delivery status. Definite nonsettlement transitions to
`FAILED_NOT_SETTLED` and releases reservation; timeout/disconnect/crash enters
`OUTCOME_UNKNOWN`, retaining it. Decline/expiry/supersession before submission
cannot spend. Publisher deduplicates before checking replay expiry, ensuring a
previous result is returned unchanged. Unknown outcomes cannot start another
intent for the same version or change adapter. An unaccepted quote invalidated
by price/version/terms requires fresh manual approval, never an adjusted debit.

Inside the reservation transaction enforce
`settledMinor + activeReservedMinor + proposedMinor <= budgetMinor`; settlement
atomically replaces its reservation with receipt spend. Duplicate key with
identical canonical request returns existing status even after revision changes;
same key/different intent or quote returns 409. Distinct keys for one active or
settled resource/version return existing purchase/conflict without another call.
Only one claim dispatches settlement. No request uses floats, caller amounts,
automatic plan approval, or wallet selection as purchase consent.

**Acceptance / verification / done.** Missing approval/key, wrong run/quote,
expired terms, stale revision, open/out-of-scope resource, wrong currency/mode,
and excess ceiling/budget yield no simulator call/access. Adequate-open-evidence
finish produces zero intents settled. Barrier-controlled tests submit two
80-minor purchases against a 100-minor cap: exactly one reserves; parallel
same-intent requests produce one simulator entry/receipt. Rollback leaves zero
approval/reservation leakage; denial releases funds, unknown retains them.
Proposed `tests/purchase-transactions.test.ts` plus updated existing persistence
approval tests run via existing `npm run test:unit`; capture row counts and HTTP
call counts, not just status codes. Done requires these transactional negatives.
In: manual fixture commerce; out: auto-buy, real money, live Testnet qualification.

## COM-04 — Recovery, verified delivery, grants, and historical receipts — P0

**Outcome / 80–20 reason.** Show a safe next action when settlement or delivery
breaks. Recover already purchased evidence without another debit; preserve the
historical transaction independently of current catalog and research state.

**Current anchors.** `/purchases/:purchaseId` currently interprets purchase ID as
source ID; `/receipt` recomputes `quoteFor`. Purchase copies fixture spans directly,
hashes article separately, and conflates BUY with unlocked. Reset uses two saves
and has no pending-settlement guard.

**Dependencies.** COM-01/02/03; RES-01 canonical delivery envelope/span identity;
RES-02 reacts to verified access; RES-03 compares the frozen baseline afterward;
UI-01 renders recovery; UI-03 consumes fresh-run state.

**Ordered subtasks.**

- [ ] COM-04.a On startup classify saved `SUBMITTING` as unknown and expose recovery;
  add `POST /.../:runId/purchases/:purchaseId/reconcile`, authenticated publisher
  status lookup, and compare all receipt bindings before accepting its result.
- [ ] COM-04.b Implement bounded `retry-delivery` for settled intents only. Fetch exact
  version using server-held credential; record attempts/errors without changing
  settlement identity/spend. Concurrent retries use one persisted claim; use
  a 5-second HTTP timeout and 256-KiB delivery limit, then explicit manual retry.
- [ ] COM-04.c Define publisher canonical UTF-8 JSON envelope `{publisherId,resourceId,
  version,body,spans}`. Validate maximum size, full SHA-256 over exact transmitted
  bytes, quoted/receipted identities, and RES-01 span schema/ownership. Atomically
  persist verified delivery bytes and exact-version grant; otherwise quarantine
  failure metadata without exposing content.
- [ ] COM-04.d Project receipt/settlement/delivery/access separately. Grant lookup, not
  `Source.decision === 'BUY'`, controls accessible evidence and model packets.
  Commit delivery event/revision before notifying research/UI through SSE.
- [ ] COM-04.e Make reset a transaction linking old/new runs; retain immutable receipts
  and grants. Block reset while reservation/submission/unknown outcome remains.
  Cancellation stops research; release unsubmitted reservations only when no
  dispatch claim exists, preserving in-flight accounting/recovery.
  Allow settled historical delivery recovery, but block new purchases/research
  on superseded runs. New runs inherit no approvals, grants, spend, or intent IDs.

**Recovery / historical contract.** Reconciliation reports `SETTLED`,
`DEFINITELY_NOT_SETTLED`, or `UNKNOWN`; only authoritative nonsettlement permits
release. Publisher reconcile atomically returns a receipt or inserts a terminal
nonsettlement tombstone rejecting delayed submissions; a status 404 alone cannot
release funds. Journal loss/epoch mismatch stays unknown. Persist/check journal
identity on startup and receipts. Core recovery never resubmits an ambiguous
attempt. A definitely unsubmitted attempt
may retry with the same identity only while its exact approval/quote is valid;
a tombstoned intent requires a fresh quote and approval.
Credential loss, publisher loss, or digest mismatch leaves a visible paid,
delivery-failed record; no inferred access/refund or alternative-version unlock.

`GET /.../:runId/purchases/:purchaseId` returns purchase identity, immutable
quote/approval references, settlement status, reservation/spend, delivery status,
access status, and safe next actions. `/receipt` uses stored snapshots, includes
declined/failed/unknown rows accurately, and labels settlement
`SIMULATED_SETTLEMENT_NO_REAL_FUNDS` alongside successful fixture bookkeeping status `SETTLED`.
Delivery states are `NOT_REQUESTED`, `PENDING`, `FAILED`, `VERIFIED`; access is
`LOCKED` or `GRANTED`. Settlement alone never produces `GRANTED`.
Research reads verified persisted bytes even after catalog changes; access does
not extend to a new resource version. Reset is never ledger deletion. Destructive
test seeding requires isolated paths and stopped processes; replace unsafe
`server/seed.ts` overwrite semantics.

**Acceptance / verification / done.** Kill the app after publisher journal
commit but before receipt persistence: restart/reconcile yields one receipt and
one debit. Kill before dispatch: no hidden purchase. Drop delivery, corrupt hash,
swap resource/version, and restart publisher: no grant until exact valid retry;
retry preserves spend. Replay credentials against another resource fails. Reset
returns 409 during unknown outcome, preserves old receipts after success, and
creates clean state; later repricing cannot rewrite historical amounts/hashes.
Proposed `tests/purchase-recovery.test.ts` uses actual child processes and named
fault barriers. Extend existing reset/restart tests and locked-evidence E2E.
Record crash-point logs, sanitized receipt snapshots, digests, grant counts, and
exits; run existing `npm run verify` at integration. Done requires restart and
HTTP-boundary evidence. In: explicit local recovery/history; out: refund systems,
background job platforms, disaster recovery, or universal payment adapters.

## Parent integration decisions

INTERFACES.md resolves the profile/legacy mapping, checkpoint ownership,
quote/intent binding, reset lifecycle, content encoding and independent mode
labels. Implement its decisions with the protocol and lifecycle in this module. Existing UI XRP controls/conversion and x402 claims conflict with
explicit fixture SGD units/simulator wording; UI and verification must adopt
the agreed contract. New test files/endpoints above are proposals; current tests
do not qualify these invariants. Each implementation issue's completion record
must include commit, acceptance results, command/exit evidence, and fault artifacts.
