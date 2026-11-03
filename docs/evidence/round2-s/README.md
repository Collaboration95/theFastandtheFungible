# Lane S — full-soak memory diagnosis, 4 November 2026

Verdict: the +77.366 MiB/100 asks quick result is a short-window artifact,
not sustained retention in the tested full workload. No engine repair is needed.
This is local synthetic fixture inference / SIMULATED settlement evidence, not
Monday's full acceptance, live-provider, Testnet, device or production acceptance.

## Tested source and command

Clean current main `d1bdc0f8c41596049319e4810f6f0ec09885f460` includes
#358, #359, #361, #362 and #360. Dependencies installed with `npm ci`.
The exact command, original harness digest, runtime, host load, all completion
rows, all interval GC samples and 20 restart results are in `soak-s.json`.
It is the original report compacted without dropping observations, with an added
`diagnosis` section and original report SHA-256. No dotenv or forced GC.

```sh
caffeinate -dims node scripts/soak-same-engine.mjs --runs 2000 --warmup 200 --concurrency 1 --seed 279 --history-runs 10000 --events-per-run 60 --data-dir scratch/s-soak-20261103T233247Z --output scratch/s-soak.json > scratch/s-soak.log 2>&1 &
wait $!
```

Darwin 25.6.0, Node v26.3.1, 10 CPUs; Lane R running in parallel per task
brief. Measured one-minute host load ranges 1.774–12.832. This was a shared-host
run, with no concurrent Lane S test workload. The shell waited for completion.
The command intentionally matches the requested workload without `--burst`;
burst admission is not re-established by this packet.

| Unchanged full gate | Result | Verdict |
|---|---:|---|
| RSS slope ≤5 MiB/100 asks | −1.899012 | PASS |
| Median RSS growth ≤100 MiB | −84.535713 | PASS |
| Sampled RSS ≤1,536 MiB | 947.349716 | PASS |
| Worst measured worker interval p99 <50 ms | 43.548671 ms | PASS |
| Matched-window p95 drift ≤250 ms | +13.652250 ms | PASS |

All 200 warmups and 2,000 measured asks complete on one engine/worker/store
identity. Zero failed asks, audit violations, sample gaps, blocked network
attempts or unexplained reservations. All 20 restart cycles close their listeners.

## Why the quick slope is an artifact

OLS over 200 asks depends strongly on where that window lands in the allocation,
collection and RSS reclamation cycle. Even this passing full run contains
200-ask windows ranging from −95.146 to +45.994 MiB/100 asks; five of ten
non-overlapping windows exceed +5 while the full-run slope is negative. All
windows are retained in `diagnosis.windows200`. Worker heap and GC batches also
show repeated collections rather than a monotonically retained heap. The prior
full H2 run similarly has four of ten 200-ask windows above +5.

This establishes that the short-window slope is not a reliable sustained-growth
gate for this workload. GC/RSS phase is the supported explanation; the historical
+77.366 run does not establish which individual allocation or collection caused
its slope. No claim is made that a finite soak excludes every possible leak.
The caches already store primitives/serialized bytes and are bounded by both
entries and bytes (8 MiB each); shrinking them has no measured justification here.

## Loop attribution

No measured interval exceeds 50 ms, so there is no new failing spike to assign
to GC, engine work or host load. The worst 43.548671 ms interval at 229.799 s /
1,516 completions observes 24 GC entries, 24.940794 ms total and 11.409500 ms
maximum pause, with host load 5.625 / 4.940 / 6.104. The largest single observed
GC pause across measured intervals is 14.924584 ms. Those observations do not
support a >50 ms GC spike in this run. Observer delivery is asynchronous;
interval aggregates do not prove exact causal overlap. The old H2 64.389 ms
spike remains unattributed because that run had no GC sampling. A later passing
run cannot retroactively assign its cause or erase that historical miss.

## Reporting repair and verification

`final-acceptance.mjs --quick` retains 200 asks / 20 warmups and passes
`--diagnostic-slope` to the harness. Only that explicit short-run mode marks RSS
slope `gating:false`; its numerical value, unchanged limit 5 and original
threshold `pass` remain visible. Every other gate and validity check still gates.
The flag is rejected for ≥2,000 asks, and comparator replay cannot bypass that
full-run gate even with forged report options. Default harness runs retain
all existing gates, including short runs without the flag.

Quick acceptance reports now distinguish `checksPass` from full `pass` and set
`acceptanceEligible:false`, `pass:false` even when quick checks succeed. Successful
quick checks exit zero; failures still exit nonzero. Full acceptance behavior and
all full thresholds are unchanged. Skipped soaks remain ineligible and fail.

Tests cover an independently calculated short ramp, unchanged median/max/loop
gates, full-run CLI and comparator bypass rejection, replay of the actual
historical +77.366 miss, and quick-versus-full acceptance eligibility. Product,
verification-cache and other lane-owned files are unchanged.
