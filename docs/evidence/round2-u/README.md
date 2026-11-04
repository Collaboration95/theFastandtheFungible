> What this proves: worker heap attribution and a measured nursery-capacity reduction.
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
form a retained structure approaching the historical 966.6 MiB RSS. Both exact
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

Full before/after measurements and safety results follow in the final evidence
commit. The baseline overlaps Lane U diagnostics, check:fast and chaos on the
shared host. No passing-run selection or causal claim from host load is warranted.
The final tuned soak is run after those workloads finish.
