# v1.1.1 release soak: the harness's own report writes, 11 Nov 2026

Lane REL2. Fixture models, SIMULATED rail, local host (Apple Silicon, 10 cores), Node 22.23.4. No Testnet,
live providers or real value. Every budget and the measurement are unchanged: RSS slope ≤ 5 MiB per 100 asks,
median growth ≤ 100 MiB, max ≤ 1,536 MiB, loop p99 < 50 ms, p95 latency drift ≤ max(20%, 250 ms); baseline
= the first 100 measured asks after 200 warm-ups; RSS = the whole soak process (harness main thread + engine
worker). Every run below uses the acceptance's exact arguments (`--runs 2000 --warmup 200 --concurrency 1
--seed 279 --history-runs 10000 --events-per-run 60 --burst`), under the shared heavy-verification lock.

## What failed

The v1.1.1 dry run (`make release TAG=v1.1.1 ARGS=--dry-run`, tag at `374743dd`) passed every stage except
the isolated soak: **RSS slope 6.81** and **RSS median growth 132 MiB**. Loop p99 47.5 ms, max 876 MiB and
latency drift 25.9 ms passed. Publication was correctly refused. [Raw report](dry-run-old-harness.json.gz)
(uncompressed sha256 `8034d2e3…2e85`).

## It was not round 9

Same arguments, same host, back to back:

| run | code | harness | slope (≤ 5) | median growth (≤ 100) | max | loop p99 (< 50) | ask p50 |
|---|---|---|---:|---:|---:|---:|---:|
| v1.1.0 release (published receipt) | v1.1.0 `3157fe41` | 5 s checkpoint | 4.47 | 82 | 820 | 41.4 | — |
| v1.1.1 dry run | main `374743dd` | 5 s checkpoint | **6.81** | **132** | 876 | 47.5 | 165 ms |
| A/B 1 | v1.1.0 `3157fe41` | 5 s checkpoint | 4.69 | **123** | 845 | 41.8 | 160 ms |
| A/B 2 | main `374743dd` | 5 s checkpoint | 3.54 | 38 | 827 | 40.5 | 160 ms |

v1.1.0's own code failed the median budget on this host, and main passed it on the next run: the RSS gates
swung 38–132 MiB on identical code. CPU profiles of the same 110-ask workload on v1.1.0 and main (engine worker,
`--cpu-prof-dir`) agree too: ask p50 166 vs 165 ms, p95 203 vs 200 ms, loop p99 max 40.5 vs 41.2 ms. Round 9
renamed the relevance overlap (`wordOverlap`) but added no measurable per-ask work.

## The cause: the harness still re-serialised its report inside the measured process

In every run the engine's JS heap is flat (about 310–360 MiB heapTotal) and its external memory is 10 MiB.
What grows is native memory outside both JS heaps (RSS − engine heapTotal − harness heapTotal), median of the
first and last 200 measured asks:

| run | outside heaps, first → last 200 asks |
|---|---|
| dry run | 170 → 257 MiB |
| A/B 1 (v1.1.0) | 213 → 289 MiB |
| A/B 2 (main) | 206 → 261 MiB |

SOAK (#470) found the harness rewriting its whole report after every ask and cut that to at most once every
5 s. At about 160 ms per ask that is still a fresh, growing 1–3 MiB `JSON.stringify(report, null, 2)` string
plus its native write buffer about every 30 asks. SOAK's own isolation script
([`save-sim.mjs`](../soak-nov11/save-sim.mjs), no engine) shows what that cadence alone costs:

| `save-sim.mjs` | RSS at ask 300 → 1,800 → 3,000 → 3,900 | outside heap at 3,900 |
|---|---|---:|
| save every 33 asks (the 5 s cadence) | 44 → 72 → 130 → 180 MiB | 121 MiB |
| never save | 42 → 48 → 58 → 62 MiB | 50 MiB |

The real report is larger than the simulated one (3.1 MiB at the end of a run), and how much of that churn the
allocator keeps resident varies from run to run (`vmmap`: the default malloc zone was 67.5 MiB resident with
16.6 MiB allocated, 76% fragmented). That is the 38–132 MiB swing above.

## Fix

`scripts/soak-same-engine.mjs`: during asks the harness appends one short JSON line per ask row and per
one-second sample to `<output>.progress.ndjson` through one open file, instead of re-serialising the whole
report. Each write costs only its own line. Stage boundaries, burst, restarts and the final summary still write
the full report, exactly as before. Unchanged: the per-ask RSS sample, the per-second worker metrics, the
formulas, the baseline, warm-ups, run count, burst, restarts and every budget. If the harness dies mid-run, the
sidecar holds every ask row and sample written so far (the 5 s checkpoint could lose up to 5 s).

## After

Three runs on `5bc9151f` (main + this fix), same arguments, back to back:

| run | slope (≤ 5) | median growth (≤ 100) | max | loop p99 (< 50) | drift | outside heaps first → last 200 | median load |
|---|---:|---:|---:|---:|---:|---|---:|
| fix 1 ([raw](fix-run-1.json.gz), sha256 `725ca3ed…da3c`) | **1.57** | **23** | 793 | 40.0 | 0.6 ms | 182 → 204 MiB | 2.2 |
| fix 2 | **1.49** | **38** | 790 | 40.4 | −0.4 ms | 157 → 213 MiB | 2.6 |
| fix 3 | **1.25** | **38** | 796 | **60.0** ✗ | 2.4 ms | 172 → 205 MiB | 3.8 |

RSS slope and median growth now sit far inside budget in every run.

Fix 3 failed **loop p99** on one-second intervals while other lanes loaded the host. The engine's median
per-second p99 was the same as in every other run (31.9–34.1 ms), and the change cannot reach the engine
worker's event loop (it only changes how the harness main thread writes). Across all six runs, loop p99 tails
follow host load:

| run | per-second p99 median | max | intervals > 45 ms | median load | idle control max |
|---|---:|---:|---:|---:|---:|
| dry run | 34.1 | 47.5 | 2 | 4.2 | 21.1 ms |
| A/B 1 (v1.1.0) | 32.6 | 41.8 | 0 | 2.5 | 13.7 ms |
| A/B 2 (main) | 33.3 | 40.5 | 0 | 3.0 | 14.7 ms |
| fix 1 | 32.1 | 40.0 | 0 | 2.2 | 13.3 ms |
| fix 2 | 31.9 | 40.4 | 0 | 2.6 | 12.9 ms |
| fix 3 | 33.5 | 60.0 | 7 | 3.8 | 44.9 ms |

The release soak therefore starts only when the 1-minute load is under 3, as the release brief requires; the
loop budget is not changed.

## Reproduce

```sh
node docs/evidence/soak-nov11/windows.mjs docs/evidence/soak-nov11b/dry-run-old-harness.json.gz
node docs/evidence/soak-nov11/windows.mjs docs/evidence/soak-nov11b/fix-run-1.json.gz
node docs/evidence/soak-nov11/save-sim.mjs /tmp/sim.json 33       # the 5 s cadence
node docs/evidence/soak-nov11/save-sim.mjs /tmp/sim.json 100000   # never
```
