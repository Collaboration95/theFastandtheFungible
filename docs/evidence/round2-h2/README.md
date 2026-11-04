# H2 finals rehearsal

Current result (#374): Quiet-host full soak now passes all five unchanged gates (worst-interval p99 25.8 ms); the heavily loaded shared-host run failed. [Local synthetic/SIMULATED evidence](../soak-nov4-ab/README.md). Historical measurements below remain pinned to their original runs.

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
and embeddings off, and ephemeral test ports. It continues after failed steps, marks the overall result FAIL, skips genuine
dependents as `skipped (dependency)`, and preserves dist/final/acceptance.json and per-step logs. Host load is sampled
throughout the workload. `--fail-fast` retains first-failure exit for CI-style
use. `--skip-soak` explicitly records a requested skip and skips dependent report/render
steps; it keeps overall acceptance false. No threshold is changed.

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

## Retained full REHEARSAL — 4 November 2026

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
The final acceptance rerun is scheduled for **Monday 9 November 2026 on a quiet
host, with no other agent lanes running**. This rehearsal does not replace it.

That historical runner exited 1 at the soak and preserved a failed acceptance.json. Exact
artifacts, packaged recovery, x64, full/demo/ledger Playwright, published-page
comparison, check:fast, Python, coverage and 200-run chaos are NOT RUN on this
tested historical source. The continuation rehearsal below tests the rebased source.

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

## Loop-spike diagnosis

The retained measured-phase interval at 110.833 s has 280 completions, worker
heap 408,262,680 bytes, process RSS 919,429,312 bytes, host load
10.484863 / 5.580566 / 3.652832 and no sleep indicator. Adjacent worker loop p99s
are 34.898 ms (109.831 s), 46.694 ms (111.833 s) and 38.830 ms (112.833 s).
Worker heap rises from 365,610,768 to 408,262,680 to 447,814,640 bytes, then
falls to 149,484,496 bytes at 112.833 s. That drop is consistent with collection,
but **GC pauses were not recorded**, so neither GC nor host contention can be
assigned as the cause of the 64.389 ms interval. The phase is measured asks,
not startup, burst or restart. The shared host had two other test lanes active
(operator report); retained one-minute load spans 4.307–11.221. Quiet-host #358's
600-ask 28.6 ms result is comparison evidence, not a replacement pass.

The harness now observes worker `perf_hooks` GC entries and sends per-interval
count, total pause ms, maximum pause ms and GC kinds alongside loop p99. This
adds attribution data only: no forced GC and no changed gate. Observer delivery
is asynchronous; these are observed GC-entry batches, not proof of exact temporal
causality. Monday's full run must retain these samples and all independent steps.

## Continuation REHEARSAL — 4 November 2026

Command: `caffeinate -dims node scripts/final-acceptance.mjs --quick`.
Tested clean source `8b7358dc95a77cf19dbab1312cede5e13b9b8406`, tree
`6f1046e64ce4b5d10ce81372a4beb164cb133657`. `rehearsal-continuation.json`
records every step, commands, log digests, source/runtime, artifact consumers and
receipt verifiers. `quick-gc-soak-279.json` retains all quick samples. Documentation
and the subsequent report-handling guards are later changes; final check:fast and
CI validate the landing head. No product repair was required.

The quick soak passed 200 measured asks / 20 warmups, one engine identity,
20 clean restarts, zero audit violations, failed asks or gaps. Loop p99 is
36.143103 ms. RSS slope −25.205990 MiB/100 asks, median change −18.842308 MiB,
sampled max 986.734070 MiB and p95 drift +94.680125 ms all pass. These reduced
counts **do not supersede the failed full loop gate**. GC batches were observed
in 56 samples; the raw report retains counts, pauses and kinds.

Consumers of tgz, wheel, sdist and MCPB each pass delivered citations, one
receipt/intent, idempotency and the 200-minor cap. TypeScript and exact-wheel
Python both verify receipt SHA-256
`8c207efc7649c133797c550363acd3267d5440d7a48dc4165a6393a3f2caa0d9`.
The exact unsigned arm64 app passes 13 fixture recovery cases with zero owned
listeners after quit. App contents were rehashed after smoke: no manifest
mismatches. Injected credential/network fault cases are labelled; this is not
real Keychain-incident, live-provider, Testnet or signed-app acceptance.
Cross-built x64 native acceptance remains pending.

The live-site checks require HTTP 200 for `/demo/` and `/ledger/` through `gh`.
This replaces the runner's earlier published-byte comparison with the requested
availability probes: it does not claim deployed bytes equal the local build.
No numerical threshold, safety gate or coverage floor was changed.

SHA-256 of the tested local bytes:

| Artifact | SHA-256 |
|---|---|
| researchagent-sdk-1.0.0.tgz | `0f8d67ca4f2dc44899f182c28d087e55b42e49a7f2cf11bc9e1828a50cc0c9f9` |
| researchagent-1.0.0-py3-none-any.whl | `a65bb1185170c04abe2a3f0edc5c8a09ef3d9fe7bd16daf30d26581baabf0787` |
| researchagent-1.0.0.tar.gz | `243265292ca1b761dce2a47beaa6cfc79b4c704c1c74951abc60534af2aefe68` |
| ResearchAgent.mcpb | `ec65d52b989ce0e85b61f032b84f523ac7d1e6b38b39b40ad57f473cd4fbbefa` |
| server.json | `fe7715ec47ddb0b9be3afe044be6efbc082b6da09c22cbd7408b153fa6351ba4` |
| ResearchAgent-1.0.0-arm64.dmg | `8d51b21228f02b3284e871a57cab5dfc97771061a581df9ddc300d21d4feebd3` |
| ResearchAgent-1.0.0-x64.dmg | `6ffc8d6dd06900846c84af2a27666b9b6ebb338114bb76aba682203d68557f60` |

Final full acceptance is scheduled for **Mon 9 Nov, on a quiet host with no other
lanes running**. No tag, release, publication or signing was performed.

| Step | Result |
|---|---|
| soak | PASS |
| render | PASS |
| artifacts | PASS |
| consumers | PASS |
| artifact-evidence | PASS |
| desktop-download-arm64 | PASS |
| desktop-arm64 | PASS |
| arm64-evidence | PASS |
| desktop-recovery | PASS |
| desktop-download-x64 | PASS |
| desktop-x64 | PASS |
| x64-evidence | PASS |
| browser | PASS |
| demo-build | PASS |
| browser-demo | PASS |
| browser-ledger | PASS |
| site-demo | PASS |
| site-ledger | PASS |
| check-fast | PASS |
| python | PASS |
| coverage | PASS |
| coverage-gate | PASS |
| chaos | PASS |
| TypeScript receipt verifier | PASS |
| Exact-wheel Python receipt verifier | PASS |

Full Playwright: 17 passed; demo: 1 passed; ledger: 4 passed. Python: 205 passed.
check:fast: 1,157 tests in 132 files and 20-run chaos smoke pass. Coverage collection
and `scripts/check-coverage.mjs` both pass with unchanged floors. 200-run chaos,
seed 279: 200 faults, 55 process kills, 171 recoveries, 29 clean failures, zero
double charges, invariant violations or stuck reservations (344.779 seconds).
The source was clean at runner start; docs and harness report-handling edits made
during later steps are why nested chaos records a dirty worktree. No product files
changed during this run. Durable logs and exact release bytes remain in the local
timestamped scratch root and restored `dist/final` / `dist/release`.

## Final integrated REHEARSAL — 4 November 2026

After #359/#361 merged, source `05a44382` completed a second quick soak:
200 asks / 20 warmups, RSS slope **77.366358 MiB/100 asks FAIL** (limit 5),
median +79.224152 MiB PASS, max 957.647301 MiB PASS, loop 25.837567 ms PASS,
p95 drift −1.547626 ms PASS, burst 4 admitted / 96 refused, 20 clean restarts,
zero failed asks or audits. `integrated-quick-soak-279.json` retains all samples;
`integrated-quick-rehearsal.json` shows the failed soak did not prevent later
independent checks. The short-window growth result remains a miss requiring the
full Monday workload; it does not establish sustained retention or its cause.

That run also exposed a stale UX test expecting a post-purchase comparison for
UC4, although its facts are fully covered by free evidence. The minimal test
repair requires the comparison to be absent for UC4 and adds a separate paid UC2
comparison/return regression. Both targeted tests and the full 18-test browser
suite pass; no product code, timeout or threshold changed. The original failed
browser result is preserved. A subsequent rebase picked up #362; P1's
builder-feedback file was preserved exactly when resolving the historical H2
append conflict. No P1/Q-owned file was edited by this continuation.

The final pass is `caffeinate -dims node scripts/final-acceptance.mjs --skip-soak`
on clean source **`1fcf8a818cc1270ebf5e6ba086bc036c46f9afb2`**. It rebuilds the
exact artifacts and apps after #362, and records all independent results in
`landing-rehearsal.json`. Overall `pass:false` and exit 1 are intentional: the
soak and dependent metadata/render steps were explicitly skipped, so this cannot
claim full acceptance. Both earlier measured misses remain outstanding.
The final fresh rebase was up to date; later changes are this evidence and the
required SFF line only. No source changed during this final pass.

Full browser 18/18, demo 1/1, ledger 4/4; live `/demo/` and `/ledger/` HTTP 200.
check:fast passes 1,164 tests in 135 files plus its 20-run chaos smoke. Python
205/205; coverage collection and unchanged coverage gate pass. Unsigned arm64
recovery passes all 13 cases; x64 builds with **native acceptance pending**.

Final chaos: 200 iterations, 200 faults, 55 process kills, 0 double charges, 0 invariant violations, 0 stuck reservations.

| Final integration step | Result |
|---|---|
| soak | skipped (requested) |
| soak-evidence | skipped (dependency) |
| render | skipped (dependency) |
| artifacts | PASS |
| artifact-preservation | PASS |
| consumers | PASS |
| artifact-evidence | PASS |
| desktop-download-arm64 | PASS |
| desktop-arm64 | PASS |
| arm64-evidence | PASS |
| desktop-recovery | PASS |
| desktop-download-x64 | PASS |
| desktop-x64 | PASS |
| x64-evidence | PASS |
| browser | PASS |
| demo-build | PASS |
| browser-demo | PASS |
| browser-ledger | PASS |
| site-demo | PASS |
| site-ledger | PASS |
| check-fast | PASS |
| python | PASS |
| coverage | PASS |
| coverage-gate | PASS |
| chaos | PASS |
| TypeScript receipt verifier | PASS |
| Exact-wheel Python receipt verifier | PASS |

| Final local artifact | SHA-256 |
|---|---|
| researchagent-sdk-1.0.0.tgz | `0563d841ba417d80f84777a17e2e1bbca24bacba42e2c9569761ed7bfd529714` |
| researchagent-1.0.0-py3-none-any.whl | `70510cf6c919619a0a5af1d4b6175d5b75ef29c4b711f687dbc07299bbc62a2d` |
| researchagent-1.0.0.tar.gz | `79216806b875440afbf67a2255c147d12bc31e53db96cef017d5a383e90d99d5` |
| ResearchAgent.mcpb | `d032a25c076da188f8bc07fb9df15d49cbdd5625b2e0b3a649fbfd1537cec72d` |
| server.json | `0f3167a7ec76319e7e3a41f52a7bf7c858269638f52fbc8e0e00a853cf30219c` |
| ResearchAgent-1.0.0-arm64.dmg | `b4df1cb9970b115b78bf72c8329b694bcc313a3d92f993cb38b4a9ad9a1f7d1d` |
| ResearchAgent-1.0.0-x64.dmg | `fbf38fea38850af63718c267e94e7b271ce4a2d4b438b8db919951bc7b97d0ce` |

Final full acceptance remains scheduled for **Mon 9 Nov on a quiet host, with no
other lanes running**. No tag, release, publication or signing.
