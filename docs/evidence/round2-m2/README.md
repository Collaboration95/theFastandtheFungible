# Lane M2 — engine worker responsiveness

> What this proves: Lane M2 — engine worker responsiveness.
> Scope: Local shared-host follow-up measurements.
> Limits: This packet alone does not establish mainnet readiness or human acceptance.

Synthetic fixture inference and SIMULATED settlement only. No providers, Testnet,
real value, protected ports, threshold changes or weakened checks.

## Causal attribution

Baseline is merged #356 (`b6e4f2ac`). The 100 µs CPU profile and synchronous Store
spans cover 12 measured asks plus three warmups, 10,000 retained runs × 60 events.
The first engine worker samples 938.542 ms in manifest verification and 695.266 ms
in rawRun (inclusive CPU; nested categories overlap). Its 2,327 rawRun calls and
1,564 snapshots mean 155.13 and 104.27 calls per ask including warmup. Individual
rawRun/getRun maxima are 1.66/2.50 ms; saveRun is 1.56 ms, updateRun 4.58 ms.

A separate diagnostic records 5 ms heartbeat gaps and synchronous signature/Store
spans on the same performance.now clock. Every >50 ms gap and the overlapping
call counts/totals are retained in attribution.json. Those totals overlap for
nested Store methods; timer gaps also include GC, scheduler delay and work not
instrumented, so they are not labelled pure CPU time. Raw traces/profiles stay in
ignored scratch. Instrumented runs are attribution, not performance acceptance.

The baseline has 1,035 signature checks across 15 asks (69/ask), totaling
966.371 ms, maximum 2.118 ms each. Batches of 45–62 checks account for 43–62 ms
inside individual 50–67 ms gaps. Store chains contain roughly 70 raw reads and
43–44 assembled snapshots, with individual heartbeat gaps of 60–133 ms.

Signatures are repeated for identical search manifests, including the independent
candidate eligibility check in clef.ts. Snapshot schemas revalidate receipts and
grants structurally; they do not reverify receipt/grant signatures. rawRun parses
the complete stored run body repeatedly. saveRun validates/serializes the complete
body when a run field changes. Events are already append-only rows: appendEvent
does not rewrite an ever-growing event array into the run body. getRun reads and
validates the assembled event/answer/decision/ledger arrays on every snapshot.

An intermediate field-level cache was slower and discarded. The JSON retains its
trace explicitly as an intermediate result. A calibration-order test rejected an
early yield; that yield was removed without changing the assertion.

## Final repair and equivalence

- A 512-entry, 8 MiB bounded exact-canonical-manifest LRU stores immutable boolean
  verdicts for retrieval and candidate eligibility. Signature, key, wallet and all
  signed fields participate in the key. Misses execute the unchanged cryptographic
  verifier. Caller-specific registry/payee/quote bindings still execute each time.
- A per-Store 32-entry, 8 MiB LRU stores validated serialized snapshots keyed by
  exact authoritative SQLite bytes. Reads still query SQLite; every hit parses a
  fresh object. Altered database bytes miss and undergo the complete original Zod
  schema. Writes and assembled public snapshots still run the full original schema.
- Explicit event-loop yields split content additions, answer processing and
  decision rounds, including fixture promises that otherwise only yield to the
  microtask queue. Transactions and the Stop gate → purchase handoff stay synchronous.

There is no signer worker. No wallet key handling, signing, signed-blob persistence,
submit ordering, intent identity, settlement or crash recovery code changed.
Verification misses preserve the original verifier, including its Ed25519 and
secp256k1 acceptance semantics. Cached values are primitives/strings; callers
cannot mutate a verdict or obtain an aliased snapshot. Eviction always rechecks.
Rollback/external edits cannot make a stale run body authoritative because the
current SQLite bytes are part of every lookup.

Tests cover altered signature/root/key/wallet, LRU eviction invoking the original
verifier, entry/byte bounds, snapshot mutation isolation and externally altered
stored run bytes. Existing payment, Stop, calibration ordering, receipt conformance,
strict accounting equivalence and gate-audit assertions are retained.

## Final diagnostic and safety checks

At `c8433ab2`, the identical short instrumented workload executes **211 signature
checks (14.07/ask)**, **181.281 ms total (12.085 ms/ask)**, maximum **1.262 ms**.
The 15-ask total includes cold-cache population. Remaining uncached checks include
free-source identity and settlement/proof boundaries; publisher-client.ts belongs
to Lane N and was not edited. Store call counts stay identical (2,327 raw reads,
1,564 snapshots, 486 writes). The cache reduces validation work, not calls:
rawRun totals 554.952 ms, getRun 727.645 ms, saveRun 221.234 ms. Nested totals overlap.

The final 5 ms trace observes two gaps >50 ms: startup (258.561 ms) and cold search
verification (55.782 ms with 58 signature calls totaling 50.467 ms). No other >50 ms
heartbeat gap occurs in this short trace. Its measured loop histogram maximum is
48.333 ms. The run is too short for acceptance; that diagnostic's invalid summary
is retained honestly. Cold verification remains synchronous, bounded by the search
hit count; further cold-path work could yield between manifest misses or offload
public-key verification. This PR does not claim startup or cold-search <50 ms.

`npm run check:fast`: 130 files, 1,133 tests, all pass; chaos smoke 20 iterations,
zero violations/double charges. Receipt TS suite 178 tests including 177 shared
cases; Python conformance 186 tests including the same shared matrix, all pass.
`npm run chaos -- --runs 200 --seed 279`: 200 injected faults, 55 process kills,
259 payments, 34 refunds, 0 invariant violations, 0 double charges, 0 stuck
reservations. All four sign/submit/validation SIGKILL categories execute. Four
escrow probes per 20 iterations produce 40 additional clean probes. These are
synthetic-ledger/process-fault results, not Testnet transactions.

The first intermediate 600-ask soak misses loop at 346.554 ms; the final code's
first 600-ask run overlaps full checks and chaos and misses loop at 65.143 ms.
Both valid misses and host metadata remain summarized in attribution.json. Neither
is declared passed, and contention is not asserted as their proven cause.

The subsequent soak without concurrent agent-owned tests still misses narrowly at
52.363 ms. It is retained as a third intermediate valid miss in attribution.json.
Consequently decision-row scoring (marginal-value and policy checks) now yields
after each four rows, preserving row order, arithmetic, checks and final tie-break.
The short final diagnostic above predates this additional chunking; its signature
and Store implementations are identical, but it does not measure that later yield.

## Authoritative integrated result — 4 November 2026

Source `9a36e7d856f002dde73aa4db4a318776cd5d8147`, rebased onto Lane N #357. The final commit adds only
this evidence and the dated SFF tracker line. Harness SHA-256
`4460027f70c478dedea1c71fa2d3afda7e0c0f2f4c5a5d15ec8c760900aca9c9`; no harness changes. Background `caffeinate -dims`, shell
waited for completion. No concurrent agent-owned test workloads during this soak.
Host one-minute load 1.392–2.255 on 10 CPUs.
All interval host loads and samples are retained in compact soak-m2.json.

| Unchanged gate | #356 before | Integrated M2 | Result |
|---|---:|---:|---|
| RSS slope ≤5 MiB/100 asks | 1.602 | 3.534 | PASS |
| Median growth ≤100 MiB | 11.111 | 8.657 | PASS |
| Sampled process RSS ≤1,536 MiB | 551.413 | 956.122 | PASS |
| Worst interval loop p99 <50 ms | 205.914 | 28.623 | PASS |
| p95 drift ≤250 ms | +4.792 | +1.129 | PASS |

Valid: all 600 measured asks after 100 warmups, one engine/worker/store identity,
20/20 clean restarts, zero failed asks, audit violations, sample gaps, blocked
network attempts or unexplained reservations. All five gates pass. This is bounded
synthetic engine evidence, not release, device or live-payment acceptance.

After integration: check:fast passes all **1,152 tests in 131 files** and chaos
smoke. Python conformance remains **186/186**. The integrated 200-run seed-279 chaos
check passes with **0 violations, 0 double charges, 55 SIGKILLs**, and 40 additional
escrow probes. Exact full chaos receipts are in attribution.json. No signer worker
was introduced and no gate was loosened.
