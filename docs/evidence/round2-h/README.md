# Lane H1: same-engine baseline on a shared host

This is a BASELINE with fixture inference and simulated payments on a shared development Mac. It is not the final finals workload, release-artifact proof, packaged DMG acceptance or v1.0.0 candidate. Burst admission at limit 4 remains pending C1; `--burst` fails explicitly until that interface exists.

Run from a clean checkout with dependencies installed:

```sh
caffeinate -dims node scripts/soak-same-engine.mjs \
  --runs 2000 --warmup 200 --concurrency 1 --seed 279 \
  --history-runs 10000 --events-per-run 60 \
  --data-dir /tmp/h1-baseline-279-fresh \
  --output docs/evidence/round2-h/soak-same-engine.json > /tmp/h1-baseline.log 2>&1 &
wait $!
node scripts/render-soak.mjs docs/evidence/round2-h/soak-same-engine.json docs/evidence/round2-h/soak-same-engine.svg
npx vitest run tests/same-engine-soak.test.ts
npm run check:fast
```

The explicit root must not exist. It remains on disk for diagnosis; the harness never deletes it. No protected port is configured. The launcher passes only PATH/HOME/TMPDIR/LANG and fixed fixture settings to its child, with no dotenv loader, inherited API token, key, wallet seed, proxy or provider configuration. The pre-import guard wraps both fetch and the Node socket connection seam in host and engine workers. Non-loopback attempts throw and invalidate evidence. Runtime health labels assert fixture research/decisions and simulated settlement; embeddings and telemetry are explicitly off. No forced GC is used.

The main measured sequence uses one engine worker and one persistent Store. UC1/UC2/UC3/UC4 rotate with seed 279 (UC4 first), including the UC2 pricing/margins clarification. The first/last 100 windows therefore contain 25 of each UC. There are 200 unmeasured warmups, then 2,000 measured asks. A minimum 61-second observation window includes the 1-second reconciler sweep. Twenty subsequent engine boots and graceful shutdowns reuse the same data root and are reported separately; each verifies both owned listeners are unreachable after close. Synthetic historical rows and selector metadata represent no settlement.

RSS is for the whole host Node process, including worker/loader and harness. Heap and active-resource counts are recorded separately for host and engine worker; there is no worker-only RSS claim. Samples include DB/WAL bytes, three load averages, wall and monotonic sample intervals, and a sleep indicator (excess wall over monotonic elapsed). Gaps above 2.5 seconds or sleep indicators above 1.5 seconds invalidate acceptance and are retained. Clock/scheduler anomalies are indicators, not a diagnosis of host sleep. Per-second event-loop histograms use 10 ms resolution; the loop gate conservatively takes the worst interval p99 rather than treating quantiles as raw delay observations. A shared-host delay miss cannot establish an engine-only cause.

RSS slope is ordinary least squares over all successful post-warmup completion observations, expressed in MiB per 100 asks. Median and p95 use nearest-rank quantiles from the first and final 100 post-warmup asks. The JSON retains every completion and every one-second sample, plus source SHA and harness SHA-256. Its overall result also requires 200 non-overlapping comparator asks, 60 measured samples, one process/engine/worker/store identity, complete asks, no gaps/failures/audit violations, and 20 clean restart cycles. A small diagnostic invocation can finish but cannot earn workload acceptance.

Gate audits run against each completed workload snapshot using the existing gate auditor, covering policy, citations, at-rest/event premium leaks, budget, labels and duplicate settlements. This is not a complete transport capture of every response or a replacement for the fresh-child chaos matrix. Completed snapshots also require zero unexplained reserved principal. Restart selector fixtures are excluded from workload purchase claims.

The comparator tests use a known constant series and a hand-solvable 1 MiB/ask linear ramp, then adversarial identity, gap, timeout and threshold cases. They do not run the manual workload in CI.

Results are recorded below after the run completes.

Potential loop-delay cause to inspect in C1: `Store.usage` scans every retained run and validates its JSON, queries intents/receipts and policy state per run, and is called repeatedly by `walletStatus`, `mcpStatus`, admission and reservation. This is a source-derived hypothesis, not profiler attribution. History selector projections from #345 do not remove these wallet accounting scans. H1 does not change this code or any threshold. Per-interval heap samples can separate retained worker heap from process RSS; without access to the private `Worker` object returned internally by `startEngine`, this run does not claim a worker heap-snapshot diff.

## Completed baseline — 4 November 2026

Engine source: `571bb7802d029c5782a04084dc05dad51aacd7fc` (current main at launch, including #342/#345/#346). Harness SHA-256: `30b6928491b313a87f21d653485d345622d116b93937836141632bd5c68faa09`; the committed harness has the same digest. Later integration checks do not turn this baseline into acceptance of newer engine changes.

Executed the full documented command with data root `/tmp/h1-baseline-279-v3`, in the background under `caffeinate -dims`, and waited for completion. Duration: **7814439 ms (2 h 10 m 14.439 s)** including seeding and restart cycles. Completed **200 warmups + 2,000 measured asks**, concurrency 1, seed 279, **10,000 × 60 = 600,000 retained historical events**, plus 16 synthetic recovery-selector cases. One process/engine/worker/store identity across all workload asks. **20/20** separate restart cycles closed both owned listeners. Zero failed/censored asks, audit violations, unexplained reservations, blocked network attempts, or sample gaps.

| Proposed gate | Observed | Result |
|---|---:|---|
| RSS slope ≤5 MiB/100 asks | 1.611979 MiB/100 asks | PASS |
| Final-100 median ≤first-100 median +100 MiB | 474.835 → 482.069 MiB (+7.234) | PASS |
| Sampled process RSS ≤1.5 GiB | 547.132 MiB | PASS |
| Worker loop p99 <50 ms | 4261.413 ms, worst interval p99 | MISS |
| Matched-window p95 increase ≤max(20%,250 ms) | 2618.852 → 6777.544 ms; +4158.691 ms vs 523.770 ms allowed | MISS |

**Evidence is valid; proposed performance acceptance fails.** No threshold was loosened and no engine repair is included. The CLI exits 1 for the two performance misses.

Environment: darwin 25.6.0, 10 logical CPUs, Node v26.3.1. One-minute shared-host load ranged 1.25–38.45; initial load [25.103515625, 15.72998046875, 16.26416015625]. All 7795 samples remain in the compact JSON (whitespace only removed). No sampled maximum is called a lifetime peak.

Observed defect: responsiveness and latency degrade for this retained-history workload. Suspected component is `server/store.ts` at the tested source: `usage` (line 130 onward), invoked by wallet/MCP status (205–209), admission (225) and reservation (456). It synchronously parses retained run bodies and performs per-run queries; increasing retained completed workload is consistent with increasing cost. This is source-derived diagnosis, not a CPU profile or proof that shared load had no effect. C1 owns the fix and rerun. No retained-memory defect was established, and no worker heap-snapshot diff was obtained; `startEngine` exposes no Worker diagnostic handle.

Final SVG inspection checks axes (elapsed seconds, MiB and ms), mode labels, separate phase timestamps, full bounds and sample-gap legend. Final fast verification and hosted CI are reported in the PR. Burst at limit 4 and all H2 artifact/release acceptance remain pending.
