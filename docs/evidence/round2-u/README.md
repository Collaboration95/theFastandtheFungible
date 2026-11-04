> What this proves: worker heap attribution and a measured nursery-capacity reduction.

Current result (#374): Quiet-host full soak now passes all five unchanged gates (worst-interval p99 25.8 ms); the heavily loaded shared-host run failed. [Local synthetic/SIMULATED evidence](../soak-nov4-ab/README.md). Historical measurements below remain pinned to their original runs.
> Scope: local same-engine synthetic fixtures / SIMULATED settlement on a shared host.
> Limits: snapshots perturb GC; this is not live-provider, Testnet or final acceptance.

The 300-ask / 50-warmup diagnostic seeds 10,000 historical runs with 60 events
each and writes early/late worker snapshots through the harness diagnostic preload.
`--heap-dir` is opt-in and must not be used for timing acceptance: V8 snapshot
creation collects garbage and temporarily increases RSS. Snapshots are not committed.
`attribution.json` retains strong-edge dominators (ancestor sizes overlap), heap
used/total, external/ArrayBuffers and macOS native-memory observations. The analyzer
excludes weak edges; ephemeron/internal edges follow V8's representation. It is
not an exact native allocator census. Its diamond/weak-reference regression checks
that shared descendants are counted once.

Early/late retained worker graph: 97.37 / 109.61 MiB. The publisher app/router/index
chain remains 16.87 / 17.07 MiB, with its registry Map 16.80 / 16.79 MiB. Large
module source strings retain 6.63 and 5.81 MiB individually. Source/code/schema
infrastructure is material, but neither the corpus/index nor run-history projections
form a retained structure approaching the historical 966.6 MiB RSS. The late Store/ExactCache chain retains 3.97 MiB. Both exact
verification caches remain bounded at 8 MiB; no check or cache was weakened.
Active run promises and SSE clients have existing cleanup/bounds; snapshots do not
show a large retained terminal-run or SSE-buffer dominator. This finite measurement
does not establish absence of every leak. Embeddings are off for the measured workload.

SQLite connection defaults are cache_size=-2000 (about 2 MiB target), page_size=4096,
mmap_size=0; Store does not override them. macOS vmmap shows 96 KiB resident mapped
files, 130.4 MiB resident malloc (71.6 MiB allocated, 58.8 MiB fragmentation) and
622.7 MiB V8-tagged resident pages at its sample. These categories are asynchronous
and overlap other metrics. Native residual cannot be assigned wholesale to SQLite.
Process RSS includes host/loader isolates and libraries as well as the engine;
worker heapUsed is neither RSS nor heapTotal. ArrayBuffers are part of external.

The sole product change sets Worker `resourceLimits.maxYoungGenerationSizeMb` to
16 in `startEngine`, versus Node v26.3.1's observed default 96. Old-generation
capacity remains 4096 MiB. This limits transient allocation capacity, without a
manual GC, an old-space cap, disabled concurrent marking or altered money paths.
The runtime remains free to tune collection. Measurements apply to this Node build;
other supported runtimes require their own performance acceptance.

## Full workload and integration

The baseline uses base `7b26ceb9` with diagnostic instrumentation uncommitted.
Its measured engine worker was loaded before the nursery edit; subsequent restart
cycles may load the edited constructor, so only measured-phase worker metrics
are used for the heap/GC comparison. Harness digests are in each report.
It overlaps Lane U diagnostics, check:fast (including the commit hook), chaos
and a vmmap sample. Independent coverage and npm artifact-consumer processes
were also observed. These observations are not a controlled A/B benchmark.

The first tuned full run on clean `de61bb11` passes all five gates:
max RSS 890.970528 MiB, worst loop interval p99 47.677439 ms, GC max
16.636083 ms and individual-pause p99 about 0.48 ms. It is retained in
`soak-tuned-pre-integration.json`. A fresh rebase then picked up #366. The final
integrated full run uses `6508f6e1`, after npm ci synchronized its changed lockfile.
The initial integrated warmup was stopped before measurements to synchronize
dependencies. An earlier baseline warmup was stopped to add individual GC
sampling. Neither aborted warmup supplies a before/after result.

All complete runs use this workload, in the background with caffeinate and a
shell wait, fresh data directories, no heap snapshots and no forced collection:

```sh
caffeinate -dims node scripts/soak-same-engine.mjs --runs 2000 --warmup 200 --concurrency 1 --seed 279 --history-runs 10000 --events-per-run 60 --data-dir scratch/u-soak-integrated-final --output scratch/u-integrated-final.json > scratch/u-integrated-final.log 2>&1 &
wait $!
```

For snapshot attribution use the same harness with `--runs 300 --warmup 50` and
`--heap-dir scratch/u-before-heaps`, then run
`node scripts/heap-attribution.mjs scratch/u-before-heaps/early.heapsnapshot scratch/u-early-attribution.json`
and repeat for late. Compact diagnostic reports retain their original failures.

## Final measured results

| Metric | Untuned full baseline | Integrated tuned full |
|---|---:|---:|
| Max process RSS, MiB | 982.930153 | 906.839874 |
| Max worker heap used / total, MiB | 424.064812 / 599.421875 | 406.953812 / 582.625000 |
| Max worker external / ArrayBuffers, MiB | 24.013241 / 12.862724 | 21.932325 / 11.846397 |
| Observed GC max / p99, ms | 73.426500 / 10.845125 | 22.935584 / 0.711417 |
| Observed GC entries | 7,045 | 27,001 |
| Worst interval loop p99, ms | 694.681599 | 57.442303 |
| One-minute host load range | 7.011–43.583 | 2.946–11.399 |

GC quantiles use individual observed durations, not quantiles of batch maxima.
Repeated host samples of the same worker batch are deduplicated by engine ID and
V8 total-allocated-bytes. ArrayBuffers are already included in external. Peaks
are independently sampled and must not be subtracted as if simultaneous.

| Unchanged gate | Baseline value / verdict | Integrated value / verdict |
|---|---:|---:|
| RSS slope ≤5 MiB/100 asks | +0.683646 PASS | +3.527791 PASS |
| Median growth ≤100 MiB | −49.505424 PASS | +83.080368 PASS |
| Max RSS ≤1536 MiB | 982.930153 PASS | 906.839874 PASS |
| Worst interval loop p99 <50 ms | 694.681599 FAIL | 57.442303 FAIL |
| Matched-window p95 drift ≤250 ms | −9.833834 PASS | −71.506333 PASS |

Both full reports are valid but overall **FAIL**, preserving the loop miss.
Each completes 200 warmups and 2,000 measured asks, one engine identity, all 20
clean restart cycles, zero failed asks, audits, gaps, blocked network attempts
or unexplained reservations. Burst admission was not requested or re-established.
This is not the separate Monday release acceptance.

At 41.452 s / 64 completions, the integrated 57.442303 ms interval has 84 minor
GC entries, 19.822040 ms aggregate and only 0.571959 ms maximum pause; host load
2.950195 / 7.334473 / 8.458496, sample gap 1000.328167 ms. A long individual GC
pause cannot explain that spike. Engine work versus scheduler delay remains
unresolved; low one-minute load is not a scheduler trace. Every >50 ms interval
is retained and classified in attribution.json; asynchronous observer batches
cannot prove precise causal overlap. No further attempt selects a passing run.

The nursery setting is justified by reduced capacity and measured pause
distributions, not a guaranteed pause ceiling: the tuned snapshot diagnostic
under overlapping tests still observes an 85.516250 ms GC maximum and 189.923327 ms
loop p99. Full runs do not erase that counterexample. The full integration also
includes #366 and different host load, so the before/after deltas are observations,
not an isolated causal estimate. More frequent minor collections are explicit in
the entry counts. The supported gain is a safe bounded nursery and a smaller
observed footprint/GC distribution; overall responsiveness remains unaccepted.

Post-rebase safety results are recorded in attribution.json. The final dated
commit runs check:fast through the repository hook; CI must be green before merge.
No threshold, money semantics, verification or cache bound changed. Raw heap
snapshots and owned soak directories are removed after the compact reports are
committed. No snapshots are shipped.

Post-#366 validation on `6508f6e1`: Python **222 passed**; receipt conformance
**192 identical cases** in both languages (TypeScript suite 193 tests including
schema alignment), plus the analyzer regression. Chaos **200 iterations**, 55
process kills, 171 recoveries, 29 clean failures, **zero double charges, invariant
violations or stuck reservations**, 275.423 seconds. The worktree was dirty only
with Lane U evidence changes. Raw validation-log SHA-256 digests are retained.
