# Soak memory and event-loop misses, 11 Nov 2026

Lane SOAK. Fixture models, SIMULATED rail, local host, Node 22.23.4 (`.nvmrc`). No Testnet, live
providers or real value. Every budget is unchanged: RSS slope ≤ 5 MiB per 100 asks, median growth
≤ 100 MiB, max ≤ 1,536 MiB, loop p99 < 50 ms, p95 latency drift ≤ max(20%, 250 ms).
**No measurement changed**: the baseline is still the first 100 measured asks after 200 warm-ups,
and the soak still measures the whole process.

## What the v1.1.0 dry runs reported

REL's Node 22 dry runs failed only the soak's performance gates. REL read the RSS miss as a heap still
reaching its working size (no leak) and the loop p99 miss as other lanes loading the host. The data
supports neither reading.

## 1. RSS: sustained growth outside the JS heaps, caused by the harness itself

[`windows.mjs`](windows.mjs) splits each soak into 200-ask windows. RSS = `process.memoryUsage().rss`
of the soak process, which runs the harness on the main thread and the engine in a worker thread.
"Outside heaps" = RSS − engine heapTotal − harness heapTotal.

An extended run on main `ef36a9e5` (200 warm-ups + **4,000** measured asks, `--burst`, 10,000 history
runs) did **not** plateau ([raw](before-extended-4000.json.gz)):

| asks | RSS median | engine heapUsed | engine heapTotal | engine external | harness heapUsed | outside heaps |
|---|---:|---:|---:|---:|---:|---:|
| 0–199 (warm-up) | 610 | 232 | 299 | 10 | 85 | 187 |
| 1000–1199 | 729 | 291 | 357 | 10 | 83 | 276 |
| 2000–2199 | 798 | 253 | 328 | 10 | 83 | 358 |
| 3000–3199 | 780 | 234 | 314 | 10 | 99 | 326 |
| 3800–3999 | 879 | 250 | 309 | 10 | 104 | 442 |

MiB. Engine and harness JS heaps and engine external memory are flat; native memory outside the heaps
grows by about 5 MiB per 100 asks for the whole run. Moving the baseline later would not have
been honest: a baseline after 1,000 asks still showed 59 MiB median growth and 3.3 MiB/100 slope over the
next 2,000 asks, rising again at 2,000 (119 MiB). Gates: slope 4.60, median **145**, max 1,055,
loop p99 **71.4** (the host also ran a 30× test loop at the start).

The cause is the harness. After **every** ask it rewrote the full report
(`JSON.stringify(report, null, 2)` + `writeFileSync`), which grows to 5–7 MiB: one fresh multi-MiB string
and native write buffer per ask, each slightly larger than the last. In isolation
([`save-sim.mjs`](save-sim.mjs)), rewriting a growing 2 MiB report 3,900 times grew RSS outside the heap
by **115 MiB**; rewriting it every 100 asks grew it by 30 MiB. The harness now checkpoints at most every
5 s (stage boundaries, burst, restarts and the final summary still write in full). The measured
asks, the RSS sample per ask, the formulas and the budgets are unchanged.

## 2. Loop p99: a code regression, not host load

The idle control process (same host, same time) read 12 ms in every run, so the host was quiet.
The engine's per-second loop p99 doubled between 10 and 11 Nov at the same or lower load:

| run | source | load (1 min) | loop p99 median / max | ask p50 |
|---|---|---:|---:|---:|
| 10 Nov locked | `e03a0a41` | 2.9 | 23.0 / 33.5 ms | 150 ms |
| 10 Nov final rehearsal | `22e8ec6e` | 3.3 | 22.8 / 29.5 ms | 149 ms |
| REL dry run 2 | `3c07fce2` | 2.4 | 45.7 / 63.9 ms | 179 ms |
| REL dry run 3 | `0b4f6645` | 2.5 | 45.1 / 62.9 ms | 178 ms |

A fixture ask resolves its providers instantly, so each ask runs as one long synchronous span. CPU
profiles of the same 110-ask workload on `22e8ec6e` and main (`--cpu-prof-dir`) attribute the extra
time to K4/K5/C5/R8 relevance checks (#442, #450, #453, #460, #464, #467): one question, gap or clause
was matched against the ~280-phrase glossary again for every candidate, passage and sentence, and every
free read re-verified the same writer manifests with ed25519 (K4 widened protocol retrieval, so about
9× more reads).

Fix, outputs unchanged: query-side glossary matches, query words, subject families and the
technical-subject families are cached per text (512 entries, texts ≤ 4 KiB, frozen); document words and
phrases per text (64 entries, ≤ 16 KiB); manifest verification results keyed by sha256 of the exact
signed message, signature, key and wallet (256 entries). An old-versus-new comparison of every exported
relevance function over 687 eval/scenario questions × 400 corpus texts (3,305,844 checks, run twice so
cached answers are compared too) found **0** differences. A tampered manifest still fails after its valid
original was cached (new test).

Profiled 110-ask workload (`--cpu-prof`, so absolute times are inflated):

| source | ask p50 / p95 | busy span p90 |
|---|---:|---:|
| `22e8ec6e` (10 Nov) | 158 / 195 ms | 70 ms |
| main `ef36a9e5` | 191 / 224 ms | 116 ms |
| this branch | 165 / 205 ms | 81 ms |

The rest of the remaining difference is K5's new lead-sentence ranking, which is new work rather than
repeated work.

## 3. After

Same design (200 warm-ups + 4,000 measured asks, `--burst`, 20 restarts) on this branch `531dfd85`,
heavy lock held, load 2.1, 696 s ([raw](after-extended-4000.json.gz), uncompressed sha256
`a22c63c4…8577`; before: `912e6da5…d233`). Zero failed asks, burst passed, 20 restarts closed.

| gate (unchanged budget) | before, main `ef36a9e5` | after, this branch |
|---|---:|---:|
| RSS slope ≤ 5 MiB / 100 asks | 4.60 | **1.88** |
| RSS median growth ≤ 100 MiB | **145** ✗ | **51.9** |
| RSS max ≤ 1,536 MiB | 1,055 | 849 |
| loop p99 < 50 ms | **71.4** ✗ | **42.0** |
| p95 latency drift ≤ 250 ms | 5.8 | 0.7 |

| asks | RSS median | engine heapUsed | engine heapTotal | engine external | outside heaps | loop p99 max |
|---|---:|---:|---:|---:|---:|---:|
| 0–199 (warm-up) | 592 | 216 | 302 | 10 | 166 | 280.5 (boot) |
| 1000–1199 | 647 | 262 | 344 | 10 | 200 | 39.6 |
| 2000–2199 | 673 | 254 | 327 | 10 | 225 | 39.5 |
| 3000–3199 | 676 | 246 | 315 | 9 | 235 | 39.8 |
| 3800–3999 | 704 | 239 | 332 | 10 | 203 | 39.5 |

Memory outside the heaps is now flat (200–260 MiB, no trend). RSS rises while the engine heap reaches
its working size (about the first 1,200 asks) and then holds at 670–705 MiB. Within this run, the
acceptance's own window (asks 200–2,199) gives slope 3.62 and median growth 67 MiB, both inside budget.
Measured ask p50 158 ms (before 187 ms); per-second loop p99 median 31.5 ms (before 47.0 ms); the idle control read 12.0 ms in both runs, load p50 2.4 (before 3.6). [`windows.json`](windows.json) holds both runs' full window tables and
baseline what-ifs, produced by `windows.mjs` from the two raw files.

## 4. Oversize upload to the zero-clone app (EPIPE)

`mcp/app.ts` threw from `readBody` mid-upload. Leaving the `for await` loop destroyed the request
and reset the socket while the client was still writing, so the client saw EPIPE/ECONNRESET instead of
a status (26 of 40 uploads of 2 MiB in a standalone repro). The proxy now discards (never buffers)
bytes past 1 MiB and answers **413** once the upload has ended. The new test pauses the client until
the server has passed the limit, then keeps writing; it fails 3 of 3 on the old code and passed 30 of 30
whole-file runs of `tests/mcp-app.test.ts`.

## Reproduce

```sh
node docs/evidence/soak-nov11/windows.mjs docs/evidence/soak-nov11/before-extended-4000.json.gz
node docs/evidence/soak-nov11/windows.mjs docs/evidence/local-release-nov10/final-soak.json.gz
```
