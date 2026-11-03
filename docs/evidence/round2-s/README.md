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

Validation: targeted 16/16 tests and `npm run check:fast` pass, including
1,184 tests in 136 files and the 20-run chaos smoke (zero invariant violations,
double charges or stuck reservations). Fresh rebase before the final dated tracker
commit picked up Lane R key-reveal escrow changes (#363); this does not relabel the earlier
clean-main soak as a measurement of that later source. Final commit checks and
PR CI validate the integrated reporting change.

## Fresh-main integration after #363

The fresh rebase picked up main `b5e991c0` (#363), so a second full workload
was run rather than assuming engine equivalence. `soak-s-integrated.json` retains
all rows and samples. Runtime source is `bec87e1bf429fac31867dbb8bec6b02e6dad8759`
(the rebased reporting change atop that main); the later `5891bdd8` commit during
the run changed only documentation. The first roughly 60 seconds overlapped
Lane S's final commit check:fast, including chaos smoke; there were no Lane S
tests afterward. This context applies only to the second run. The same command,
background `caffeinate -dims` and shell wait were used, with data directory
`scratch/s-soak-integrated-20261104` and output `scratch/s-soak-integrated.json`.

| Unchanged full gate | Integrated result | Verdict |
|---|---:|---|
| RSS slope ≤5 MiB/100 asks | −0.643762 | PASS |
| Median RSS growth ≤100 MiB | −4.017937 | PASS |
| Sampled RSS ≤1,536 MiB | 966.616165 | PASS |
| Worst measured worker interval p99 <50 ms | 78.708735 ms | FAIL |
| Matched-window p95 drift ≤250 ms | +1.854125 ms | PASS |

All 200 warmups / 2,000 measured asks and 20 clean restarts complete with one
identity and zero failed asks, audits, gaps or unexplained reservations. Memory
verdict is unchanged. Overall soak `pass:false`, exit 1, correctly preserves the
independent loop gate failure; this is not final acceptance.

Two measured loop intervals exceed 50 ms. The worst is: at 244.802 s / 1,458 completions,
loop p99 78.708735 ms, observed GC maximum 71.354292 ms (14 entries, 83.114832 ms
total; minor, major and incremental kinds), host load 8.839 / 7.062 / 6.667.
This is GC-associated: a single observed pause is large enough to explain most
of the loop delay. Asynchronous observer batches prevent proving exact temporal
causation; scheduler contention may contribute. The interval is long after
Lane S's local checks ended. It does not demonstrate >50 ms of engine work.

A cache footprint reduction was considered and rejected here: both caches are
already byte-bounded to 8 MiB and retain only serialized bytes/primitive verdicts;
there is no measured cache-retention regression. Arbitrary downsizing could add
signature verification work without fixing scheduler/collection pauses. No
verification or gate was weakened. Monday's quiet-host full acceptance must
still meet the unchanged loop gate. Both the passing original run and this miss
are retained; neither is selected to erase the other.

The second interval at 324.074 s / 1,919 completions records p99 54.919167 ms,
maximum observed GC pause only 0.935208 ms (19 minor entries, 11.469793 ms total),
load 10.406 / 8.089 / 7.096 and sample gap 1,023.981 ms. A single long GC pause
is not supported as its cause. Host contention is plausible on the loaded
10-CPU host; engine work versus scheduler delay cannot be separated by the
retained interval aggregates. Its attribution remains explicitly unresolved
between those two causes, requiring quiet-host comparison or scheduler/CPU
profiling, not an invented causal label. The unchanged gate still fails.
Measured one-minute load in this integrated run ranges 5.595–12.054.
