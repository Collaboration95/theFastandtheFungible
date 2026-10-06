# October 10 shared implementation contracts

Status: planned behavior, not an implementation claim. This document owns the
cross-module decisions for the October 10 scope. Module plans own detailed tasks
and acceptance. The implementation index owns dependencies and issue ordering.

## Scope and ownership

- Single-user React/Express application; keep the existing TypeScript stack.
- One local HTTP publisher service with three logical publisher profiles.
- Keep the small data-centre corpus. Add targeted variants only to prove behavior.
- A live model is the primary demonstration target; deterministic fixtures are
  an explicitly labelled rehearsal and offline mode.
- Simulated settlement is the required mode. Existing Testnet behavior is
  conditional and must not bypass purchase invariants. No production money.
- No new framework, vector database, general crawler, multi-agent research team,
  authentication system, or generic coding controller is required.

| Owner / issue IDs | Owns | Consumers |
| --- | --- | --- |
| Research: RES-01..03 | Corpus/evidence metadata, research transitions, source decisions, answer impact | Commerce, UI, verification |
| Commerce: COM-01..04 | Durable storage, publisher transport, quotes, exact approval, settlement, delivery, grants | Research, UI, verification |
| UI: UI-01..03 | Run presentation, approval and recovery controls, answer impact, demo setup/reset | Researcher/presenter |
| Verification: VER-01..04 | Scenario runner, independent gates, release operations, optional AgentCore experiment | All implementation lanes |

## Shared rules

1. The server owns the run state and revision. The browser sends commands and
   renders state; reload or event reconnect fetches the authoritative snapshot.
2. Persist a bounded research checkpoint and execute one transition at a time.
   Do not require a generic job queue or continuously running worker platform.
3. A model proposes a typed decision: continue with accessible evidence,
   propose one eligible purchase, finish, or abstain. The server validates it.
   Waiting for approval is a run state, never an automatic purchase permission.
4. The decision context contains public metadata and accessible spans only.
   Evaluation labels and locked bodies are never exposed to the model.
5. Source, resource version, evidence family, and span identity are explicit.
   IDs support joins; source names and IDs do not encode purchase policy.
6. Money uses integer minor units and an explicit currency/settlement mode.
   Use no floating-point arithmetic or implicit conversion between simulated
   prices and Testnet units.
7. A quote is an immutable snapshot of publisher, resource/version, price/unit,
   expiry, terms, and selected settlement mode. Exact approval binds that quote
   to one run and one purchase intent. Changed terms require fresh approval.
8. Commerce owns a small transactional local ledger and reservations. Run,
   approval, intent, receipt, delivery, and access state must have an explicit
   persistence relationship. Prefer SQLite; all writers use one storage seam.
   Existing JSON fixture data can remain an import/seed format. No dual-write
   migration or general database abstraction is required.
9. Persist intent and reserve budget before settlement. Same-intent retries
   preserve identity. An uncertain outcome is reconciled before another
   settlement attempt. Settled plus reserved spend cannot exceed the mandate.
10. Settlement and delivery are separate. A paid delivery retry preserves the
    receipt and spend. Verify resource/version and the expected content digest
    before granting access. A grant unlocks only the verified version.
11. Synthesis uses accessible evidence and validates citation ownership. Material
    claim support has a curated evaluation rubric; a valid span ID alone is
    insufficient evidence of semantic correctness.
12. Capture the baseline answer before purchase and compare it with the answer
    after delivery. Impact can strengthen, qualify, contradict, or leave the
    conclusion unchanged. Never require a purchase to produce positive impact.
13. A budget/price counterfactual starts a fresh isolated run. It cannot mutate
    the terms, approval, or history of an already approved purchase.
14. Failures return an explicit state and safe next action. Modes never switch
    silently, and a pending intent never changes settlement adapter.

## Integration boundaries

- Research calls commerce through quote, approve/execute, purchase-status, and
  retry-delivery operations; it never mutates a balance or grants access.
- Commerce exposes storage operations for run checkpoints and evidence access;
  research does not open a second persistence path.
- UI consumes run/decision/quote/purchase/impact projections. SSE provides
  progress hints; the persisted snapshot resolves reconnects and stale views.
- Publisher transport supports public discovery/preview, a locked-resource
  challenge, quote handling, and protected delivery. The protocol is described
  accurately as a simulator contract unless external compatibility is tested.
- Verification starts real local API/publisher processes where the HTTP or
  restart boundary matters. Provider output and fault timing may be controlled.

Detailed payloads, endpoint paths, state names, and test filenames belong to
their owning module. Resolve any cross-module disagreement here before coding;
do not create competing definitions in separate issues.

## Resolved integration decisions

### Profiles, scope, and evidence identity

Use these three transport profile IDs. The mapping is seed metadata, never a
purchase-policy branch. Preserve display publications and independent origins.

| Profile | Initial resource IDs |
| --- | --- |
| `public-records` | All eight current OPEN resources, including company, energy, and contextual material |
| `supplier-wire` | `northstar-wire`, `circuit-note` |
| `grid-research` | `meridian-ledger`, `gridscope-asia` |

New run config uses `allowedPublisherProfileIds`; `familyId` describes evidence
lineage, not authorization. Old `siteKey` values can span profiles and cannot be
translated by a global key rename. Preserve old runs as legacy history; convert
the current seed explicitly and ask for a newly reviewed mandate on new runs.
Keep the current data-centre question and 2028 horizon. RES may vary demand,
equipment-delivery, and grid-energisation facets within that scope; unsupported
questions/horizons return a visible limitation.

The shared reference is `{publisherProfileId, resourceId, resourceVersion}`;
citations append `spanId`. COM wire aliases `publisherId` and `version` mean the
same profile ID and immutable version; the adapter maps them once at its typed
boundary. Family counts are derived from cited provenance roots. Replace
`afterNorthstar`/`afterMeridian` fields with answer and impact artifact references.

### Run creation, commands, and reset

Unsubmitted setup exists only in the browser. Reviewing a plan can create a
persisted `DRAFT` via `POST /api/v1/research-runs`; it cannot retrieve content,
invoke a provider, reserve funds, or buy. Plan approval freezes config and starts
the bounded RES-02 executor. Continue/resume advances server-owned transitions
until a user boundary, completion, or a configured limit. The browser never
scripts discover/rank/gap phases.

State-changing commands carry `commandId` and `expectedRevision`. COM-01 owns
their durable result mapping; identical completed-command replay returns the
recorded result before revision checking. Changed payload with the same ID and
new commands with stale revision return 409. RES-02 research state names and
checkpoint fields are authoritative; COM-01 persists them without a second enum.
An in-flight claim returns its post-claim revision/token; commit/fail compares
that pair. A user pause/cancel advances revision and prevents a late result from
overwriting it. A provider call interrupted by process death can be explicitly
retried and counted again; financial exactly-once claims do not extend to model
inference.

`POST /api/v1/research-runs/:runId/reset` atomically supersedes the old research
run and creates a fresh unapproved DRAFT with copied editable inputs. UI adopts
the returned ID and opens review; it must not discard the new run. Reject reset
with 409 while funds are reserved, submission is in flight, or outcome is unknown;
show reconciliation on the old run. Settled delivery recovery remains available
after supersession. A separate New research action from a finished run may return
to unsent setup, but never calls reset and discards its response. A counterfactual
uses the fresh-run flow, changes inputs before plan approval, and preserves history.

### Purchase and delivery protocol

COM-02's `research-publisher-simulator/v1` endpoints and COM-03/04's application
endpoints own the wire contract. Quote creation requires the current validated
RES proposal, resource/version and run; browsing a preview never creates an
intent. Quote refresh supersedes an unsubmitted intent and requires new approval.
Persisted quote-request command identity makes a lost HTTP response retryable.

Required money shape is `{amountMinor, currency: 'SGD', settlementMode: 'fixture'}`.
The UI labels amounts as simulated SGD; no XRP conversion applies. A successful
fixture settlement has bookkeeping status `SETTLED` and mode `fixture`, with the
disclosure `SIMULATED_SETTLEMENT_NO_REAL_FUNDS`. Do not label that success
`SIMULATION_NOT_SETTLED`; it obscures whether simulation execution succeeded.
COM's settlement state and separate delivery/access enums are authoritative.

Quote/delivery digest is SHA-256 of the exact UTF-8 bytes of COM-04's canonical
JSON content envelope. The publisher retains those immutable bytes. Span offsets
refer to the decoded `body` using JavaScript UTF-16 string indices with exclusive
end; RES validates each substring. Do not hash a separately reserialized object
or compute span offsets against the wire envelope. The app validates size,
digest, identity, offsets, schema and receipt binding before persisting a grant.

Use COM-01's SQLite seam for app data and a separate publisher journal file.
The implementation pins the locally verified Node v26.3.1 runtime for
`node:sqlite` and updates launch/CI/prerequisites together. Keep storage narrow:
snapshot fields may be JSON within typed rows; no ORM or generic query layer.
VER-03 provisions one stable random simulator credential in its ignored local
environment and passes it only to the API/publisher children. No user-managed
cloud credential is required to run the fixture service. Receipt delivery tokens
stay server-side; startup rejects swapped/lost journal identity.

### Model modes, failure, and UI projections

Represent requested provider, actual provider, model ID and execution status
separately from evidence transport/corpus and settlement mode. A live-model
failure preserves the last valid artifact and enters explicit recovery/blocked
state. The presenter deliberately starts a new labelled fixture run for offline
fallback. No automatic provider or settlement switch occurs in the core demo.

RES-03 owns baseline/final answer and impact projections; UI-02 renders them.
UI-01 owns approval and purchase recovery; UI-03 owns setup, mode labels and fresh
runs. VER-03 owns launch/release operations. `NO_PURCHASE` is a final-outcome label;
purchase impact is `STRENGTHENS`, `QUALIFIES`, `CONTRADICTS` or `UNCHANGED`.

Structural citation validation is a runtime gate; semantic support uses the
curated independent verification rubric. A numerical confidence uplift is not
part of the contract. Fixture decisions use public metadata and accessible
content under the same guards, never private acceptance answers.

## Evidence required for completion

An implementation issue records its commit, acceptance results, relevant test
commands and exit statuses, and failure artifacts when applicable. New scripts
in these plans are proposed until implemented. Existing `npm run verify` is the
current aggregate; fixture success does not qualify live model, AWS, or Testnet.
