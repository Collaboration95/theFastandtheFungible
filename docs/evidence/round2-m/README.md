# Lane M — responsive retained-history accounting

> What this proves: Lane M — responsive retained-history accounting.
> Scope: Local synthetic retained-history performance and exact accounting equivalence.
> Limits: This packet alone does not establish mainnet readiness or human acceptance.

Synthetic fixtures and SIMULATED payments only, on a shared development Mac. No live provider, Testnet or real value. No performance threshold or test assertion was loosened. This is bounded engine evidence, not release or device acceptance.

## Attribution and repair

Baseline is merged #353 (`c9bf4fbe`), with the original 2,000-ask evidence in round2-h. Before editing production accounting, ran the merged harness with six measured asks, two warmups, 10,000 retained runs and 60 events per run, using a fresh root and Node `--cpu-prof`. The optional `--cpu-prof-dir` flag passes Node's profiling options through the isolated launcher to the engine worker. It preserves the launcher network/environment guard and is covered by the harness flag test. Raw CPU profiles stay in ignored scratch storage; `profile-summary.json` records sampled inclusive stacks, not wall-clock latency or exclusive CPU claims.

The first engine worker attributed 2,859.122 ms to usage, 1,409.914 ms to rawRun, 401.960 ms to policyPayments, 624.423 ms to runnableRunIds and 553.154 ms to recoverableRunIds (inclusive stacks overlap). It confirmed both accounting and operational selectors as synchronous history work. An intermediate profile caught SQLite choosing a broad phase index for runnable selection; the final query explicitly uses the active partial index.

Source-row expression/partial indexes select active runs, open hire holds, reserved/submitting intents, charged intents with today's or missing receipts, today's cancelled escrows, today's confirmed policy payments and pending policy payments. Surface/principal filtering joins admissions by run ID instead of building an all-history Map. Agent seven-day receipt summaries scope admissions, receipts, payouts and inbound audit rows by principal using source indexes, while preserving the unattributed export case. Only contributing run phase/budget fields are extracted; full RunSnapshot parsing is removed from accounting. All spending arithmetic remains unchanged. One SQLite statement batches financial rows per candidate, explicitly retaining intent insertion order and policy ID order; this removes repeated JS prepares and database crossings. Policy lookups now have a run/id index. Operational selectors use the active partial index and failed-phase index. Wallet status reads pause once.

This is O(active or financial rows), independent of completed history without financial rows. The charged-intent branch inspects indexed charged financial rows and receipt dates, including older receipts, to preserve the legacy rule that a charged intent with no receipt counts on every day. It does not hydrate old run JSON. Further scaling with very large financial ledgers is outside this measured retained-event workload.

No counters, cache or separately maintained projection was added: source rows remain authoritative and SQLite maintains indexes in the same transaction. There is consequently no counter reconciliation/startup mismatch mode. Existing BEGIN IMMEDIATE boundaries still serialize admission and reservation across processes. Startup migration creates indexes on existing source rows, including legacy databases.

Equivalence argument: any omitted terminal run has no open hold, reserved intent, charged contribution on the requested day, same-day cancelled escrow or outstanding policy payment; its spent/reserved additions in the oracle are both zero. Included runs execute the old arithmetic with unchanged per-run ordering, including excluded-run semantics, gross refund treatment and cross-midnight holds. Runs are visited in primary-key order, matching the old covering-index traversal; strict equality tests caught and corrected an initial rowid-order floating-point discrepancy. No rounding or tolerance was introduced.

## Exact equivalence

`tests/fixtures/legacy-usage.ts` freezes the original method as a test-only oracle. The matrix has 104 runs, three days plus a no-receipts day, four surfaces, two agents, legacy admissions/receipts, active and terminal phases, all charged states, reserved/submitting/failed/skipped states, cancelled escrow, pending refund metadata, signed-unconfirmed submission rows, hire holds and confirmed/cancelled/pending hire/royalty payments, and retained/pruned run bodies. It compares every surface/principal/excluded-run combination before and after restart, plus wallet/MCP output. Separate paired old/new stores compare admission, reservation, submission, settlement, agent status and pause/revoke decisions. Four concurrent OS processes exhaust the identical 500-minor cap in both implementations. A SIGKILL between reservation and settlement tests WAL recovery and unchanged spending authority on reopening.

Existing money-path tests additionally cover real synthetic refund, escrow, pruning and hire state machines. No diagnostic handle was added; profiling uses Node's existing worker profiler.

## Workload and result

Required 600 measured asks + 100 warmups, concurrency 1, seed 279, 10,000 × 60 retained events, fresh root, background `caffeinate -dims`, with the shell waiting on the job. The final performance run is unprofiled at source `30420ef5`; `soak-m.json` records the full SHA. The separate after-profile uses the same batched accounting at `38a01ffe`, before the agent-only receipt-summary scoping (not exercised by this operator-MCP workload). Later rebases add documentation-only #354/#355 changes. Host load is retained per interval in `soak-m.json`. See its summary for unchanged gates, identity, audit, reservation, gap and restart checks.

The after-profile attributes 2,332.254 ms to usage across 700 asks (3.332 ms/ask, 1.80% of sampled non-idle time), versus 2,859.122 ms across eight asks before (357.390 ms/ask, 40.61%). Inclusive totals overlap and include startup; these are sampled stack attribution means, not ask latencies. Runnable/recovery selectors fall to 3.005/1.512 ms total across the larger after run. `rawRun` outside accounting and signature arithmetic remain prominent; usage no longer hydrates RunSnapshots.

A retained diagnostic 600-ask profiled run was valid but missed RSS slope (5.481 MiB/100 asks) and loop (221.643 ms); median growth +28.721 MiB, maximum RSS 602.916 MiB and p95 drift +6.209 ms passed. Profiling overhead is not subtracted or used to declare any gate passed. Its worker profile is summarized in profile-summary.json; the subsequent unprofiled required command is the authoritative final performance result below.

## Final unprofiled result — 4 November 2026

Source `30420ef5` (full SHA in JSON). 100 warmups + 600 measured asks, all complete; one engine/worker/store identity, 20/20 clean restarts, zero audit violations, failed asks, sample gaps or unexplained reservations. Fixture inference and simulated settlement; no external network attempts. The shell waited for the caffeinate background process. Exit 1 correctly retains the loop miss.

| Unchanged gate | #353 baseline (2,000 measured) | Lane M (600 measured) | Final result |
|---|---:|---:|---|
| RSS slope ≤5 MiB/100 asks | 1.612 | 1.602 | PASS |
| Median growth ≤100 MiB | +7.234 | +11.111 (501.301 → 512.412) | PASS |
| Sampled process RSS ≤1,536 MiB | 547.132 | 551.413 | PASS |
| Worst worker interval p99 <50 ms | 4,261.413 | 205.914 | MISS |
| p95 drift ≤max(20% first p95,250 ms) | +4,158.691 (523.770 allowed) | +4.792 (250 allowed; 288.152 → 292.944) | PASS |

**Evidence valid; overall performance acceptance still fails.** The root accounting/selector repair reduces usage attribution by about 107× per ask, and p95 drift passes, but does not establish the <50 ms loop target. No threshold was changed. This is not full Lane M performance acceptance.

Measured one-minute host load ranged 2.904–8.875 on 10 logical CPUs. Every interval is retained in the compact JSON, including paired load/loop values under laneMLoadCorrelation. Pearson r = −0.151: this run does **not** support blaming the residual miss on host load. The after-profile shows current-ask signature arithmetic, run parsing/writes and schema processing as remaining synchronous costs; it is not a per-interval causal trace of the unprofiled run. Removing or weakening signature checks, schema validation or payment gates to meet the loop target was not attempted. No simulated evidence is represented as live or release acceptance.

Validation: strict equivalence, scoped receipt-export comparisons, money-path suites and the full `npm run check:fast` gate; hosted CI and squash merge are reported in the PR. No diagnostic handle was added. Raw profiles and scratch databases were not committed.
