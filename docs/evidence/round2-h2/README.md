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
