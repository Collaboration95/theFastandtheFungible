# H2 finals rehearsal

This lane measures a fixture workload on a declared local host. All inference is
synthetic and all settlement is simulated. Results describe the named source,
commands and sampled intervals; they establish no universal memory bound,
production availability, live-provider success or owner acceptance.

The one-command runner is:

```sh
mkdir -p scratch
caffeinate -dims node scripts/final-acceptance.mjs > scratch/final-acceptance.log 2>&1 &
wait $!
```

`--quick` reduces only the soak to 200 measured asks / 20 warmups; the same history,
thresholds, burst and restart requirements remain. Quick is labelled separately
and does not replace the 2,000-ask rehearsal. The runner uses a fresh timestamped
scratch root, no dotenv, fixed fixture providers, simulated settlement, telemetry
and embeddings off, and ephemeral test ports. It stops at the first failed step
and preserves dist/final/acceptance.json and per-step logs. Host load is sampled
throughout the workload. No threshold is changed.

The soak retains all completion rows and interval samples so its comparisons and
SVG can be recomputed. Five performance gates are RSS slope ≤5 MiB/100 asks,
median growth ≤100 MiB, sampled RSS ≤1,536 MiB, worst measured interval worker p99
<50 ms, and matched-window p95 drift ≤max(20%,250 ms). Safety audits, one engine
identity, zero gaps/failures/reservations, 100-request admission at limit four,
and 20 separate clean restart cycles are additional conjunctive requirements.
Whole-process RSS includes workers; worker heap is recorded separately. No forced
GC is used. First/last 100 windows contain the matched four-use-case sequence.

Exact-artifact consumers install the tgz, wheel, sdist and extracted MCPB, assert
cited delivered passages, one receipt/VERIFIED intent, an idempotent retry and a
200-minor cap. One exported receipt is verified by the repository TypeScript CLI
and the Python CLI installed from the exact wheel. Artifact digests identify
local bytes, not a future rebuild. Unsigned arm64 app recovery is separate from
cross-built x64 native acceptance and from owner signing.

The committed report names the source actually tested. After merge, rerun the
same runner on main's resulting SHA and retain dist/final plus dist/release as
release evidence rather than trying to create a self-referential evidence commit.
Owner actions remain in pinned #265; owner-final.md is the prepared command packet.

## Retained preliminary run

`preliminary-soak-279.json` records source bc804a3 and the first full workload:
2,000 measured asks after 200 warmups, 20/20 clean restarts, zero audit violations,
failed asks or sample gaps. All five performance gates passed: RSS slope 0.346
MiB/100 asks, median change −0.531 MiB, sampled max 993.485 MiB, loop 31.556 ms,
and p95 drift +0.692 ms (250 ms allowed). It is **not overall acceptance**.

Its burst assertion incorrectly equated cumulative admissions with simultaneous
active work: 6 admitted / 94 overloaded / 6 idempotent retries failed an assumed
4-total assertion. Planning releases a work lease on completion, so arrivals may
reuse slots during the burst. That result cannot establish a cap violation.
The subsequent harness records actual acquire/release counts in the same engine
worker via the diagnostic preload, requiring peak four, drained zero, all 100
responses accounted for, typed overloads and every admitted retry idempotent.
No product code or limit changed. Tests reject peak five, undrained work, missing
responses and a non-idempotent retry. The ordinary stalled-planner regression
still requires exactly 4 admissions / 96 overloaded responses.

## Authoritative blocked rehearsal — 4 November 2026

Tested clean source `38446e5d223a98ace432eaac2651427875647501`. Full command is recorded in
acceptance.json; duration 455.581 seconds. Darwin 25.6.0,
10 logical CPUs, Node v26.3.1; host identity is in acceptance.json.
One-minute interval load ranged 4.307–11.221.

| Gate | Observed | Result |
|---|---:|---|
| rssSlope | -0.981018 (limit 5) | PASS |
| rssMedian | -35.002678 (limit 100) | PASS |
| rssMax | 961.059448 (limit 1536) | PASS |
| loopP99 | 64.389119 (limit 50) | FAIL |
| latencyP95 | -130.236208 (limit 250) | PASS |

All 200 warmups and 2,000 measured asks complete with one engine/worker/store
identity. Zero failed/censored asks, audit violations, sample gaps, blocked
network attempts or unexplained reservations. Burst: 100 submitted, peak four,
4 admitted, 96 typed overloaded responses, 4 idempotent retries, zero active
leases after drain. All 20 separate restarts close their owned listeners.

**Release acceptance is blocked.** The worst measured worker interval p99 is
64.389119 ms at 110.833 seconds / 280 completions. Load is 10.4849 / 5.5806 /
3.6528, sample interval 1002.375 ms, sleep indicator zero. Correlation with host
load does not prove causation or excuse the unchanged <50 ms gate. No source
repair, threshold change or further attempt to select a passing run follows.
The orchestrator must assign diagnosis/repair and rerun the exact runner.

The runner exits 1 at the soak and preserves a failed acceptance.json. Exact
artifacts, packaged recovery, x64, full/demo/ledger Playwright, published-page
comparison, check:fast, Python, coverage and 200-run chaos are NOT RUN on this
tested source. They are not inferred from earlier lanes.

An earlier partial invocation at 7ec6a3c passed all four clean artifact consumers
(8 citations, one receipt/intent, idempotent retry, 200-minor cap each) and both
verifiers on one exported receipt, then built the unsigned arm64 DMG. Its next
report save exposed Vite clearing dist/, losing the release files/manifest and
logs. Those partial results cannot admit current or future release bytes. The
retained DMG is hashed separately as an unaccepted earlier build; packaged
recovery, x64, browser/site and integrated gates were not reached. The runner
now stages durable logs and accepted release bytes in scratch and restores the
required dist outputs. End-to-end validation of later steps remains blocked.

The final SVG was rasterized with Playwright and inspected for axes, units, phase
labels, complete bounds and the failure label. Startup/restart intervals remain
visible and are separate from the measured-phase gate. Targeted harness/cap
tests and script lint pass; no product source was changed.
