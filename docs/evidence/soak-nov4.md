# Fixture soak failure and bounded recovery, 4 Nov 2026

All results here are SYNTHETIC fixture ledger/model evidence, real process kills,
local API/SDK/MCP/publisher paths; no Testnet, live providers or real value.

The original run at eae85eda66c9fc2b39a701167df2efd113873d50 stopped at
zero-based iteration 3031 (`provider-down`, UC2), after 3,031 successful iterations
and 787 intended SIGKILLs. The supplied problem statement said 3,030 successes;
the preserved JSON reports 3,031. There were zero double charges and zero stuck
reservations. Runtime was 9,558,754 ms including the failing child. Its recorded
elapsed time was 605,751 ms, although the source watchdog was 45,000 ms. The
original log's output tail is empty because stdout was discarded and stderr had
no progress logging. No stack or phase was recorded. The application artifacts alone do not identify a blocked await. Subsequent
local power-log inspection identifies a **606-second clamshell suspension**
covering the entire stall (see below). A provider transport hang is not proven:
the provider-down fixture returns local HTTP 503 immediately, and the existing
LLM transport already had an abort timer and two attempts.

The original summary is `soak-nov4-run1.json`. The terminal log evidence was:

```text
Error: iteration 3031 provider-down/UC2: exit=null signal=SIGKILL watchdog=true elapsedMs=605751
Node.js v26.3.1
make: *** [soak] Error 1
```

## Historical root cause: host suspension

`pmset -g log` records clamshell sleep at **3 Nov 17:04:23 SGT**, lasting
**606 seconds**, followed by DarkWake at **17:14:29 SGT**. Run-1 end time derived
from its start + duration is **17:14:29.610 SGT**; subtracting the recorded child
elapsed time places launch at approximately **17:04:23.859 SGT**. These align to
within the power log's one-second precision. The host suspended both child work
and parent watchdog scheduling. Provider-down was the selected fault when the
machine slept; it is not evidence of a provider hang. The relevant timestamps,
with unrelated power/account details omitted, are in `soak-nov4-host-sleep.json`.

The harness repair makes this operational interruption diagnosable and keeps
later iterations running while retaining a failing final status. Application
deadlines do not run while the host is suspended. The separate transport defects
below are deterministically reproduced defensive repairs, not claims about the
missing run-1 provider stack.

Two concrete defects were found independently:

- LLM HTTP-error body cancellation and final SSE-reader cancellation were awaited.
  An abort timer alone cannot settle a cancellation promise or an injected
  transport that ignores its signal. The LLM now races the entire operation
  against a typed `ProviderDeadlineError`, aborts the transport, and starts
  cleanup without awaiting potentially stuck stream cancellation. Retry count
  remains two; HTTP 503 errors remain typed HTTP failures. Deterministic fake-time
  tests inject hung headers, a hung body, and hung cancellation; all settle and
  clear their timers.
- The test-only leak auditor retained token sets for every wire snapshot in one
  Map for the duration of each audit. Those sets repeat the growing trace and
  accessible contents. The fix retains only the current observation's token set.
  Every exact marker and eight-word-run check and every grant exemption remains
  the same. Fresh child processes and fresh databases per iteration rule out an
  engine heap accumulating across iterations in this particular harness.

Watchdogs now drain both output pipes, retain the last 8 KB, preload diagnostics
before application imports, request a sanitized diagnostic report on SIGUSR2,
then SIGKILL after a one-second grace period. Reports omit environment, command
line and socket addresses. Failure context includes seed, fault, use case,
iteration, phase/resource samples and stacks. Watchdogs on intentional-kill
faults are violations rather than successful fault injections. Violations are
recorded and subsequent iterations continue; the CLI exits nonzero at the end.
Escrow subprocesses use the same asynchronous watchdog. `windows` in the JSON
records each 50 successful iterations plus a final partial window, including
p95 latency, median/max child RSS, parent RSS and handles. Reported RSS is current
RSS at the end of each child, not peak lifetime RSS. Heartbeats and phase samples
provide finer diagnosis on failure. No gate, leak threshold or test was loosened.


## Interpreting the old drift

Replaying the exact seed/UC RNG draws yields **four `caps` faults in the first
100 successes and six in the last 100**. The reconstructed full fault counts
match the original summary (including 163 caps). See `soak-nov4-fault-mix.json`.
This crosses the 5% percentile boundary: the 95th of 100 samples can move from
the ordinary workload into the much slower caps workload with no slowdown in
either workload. The new series shows the same pattern: the first 50-sample
window has one caps and a 5.63 s p95; windows with three caps have approximately
12.5 s p95, while median child RSS stays around 345 MB. This is strong evidence
of a fault-mix confound, not proof of the exact timing contribution in run 1,
whose per-fault timings were not retained. Raw aggregate p95 is not a normalized
latency regression metric. The fix exposes each window's fault mix rather than
changing the seeded fault distribution or suppressing its slow samples.

## Resource measurements and limits

The 200-iteration baseline with the **original leak auditor** completed in
629,571 ms with zero violations; maximum end-of-child RSS was 944,802,656 bytes,
max handles 105 and first/last-100 p95 was 6,799.97 / 6,010.70 ms. It did not
reproduce the historical positive drift. It ran in a dirty worktree while
availability fixes and phase instrumentation were under development; the leak
auditor stayed unchanged for all 200 iterations. These are local observations,
not an isolated performance benchmark. Both baseline and verifying run use the
same Node v26.3.1 host, corpus and seed; other host work is uncontrolled.

The 25 opportunistically captured baseline phase sequences are summarized in
`soak-nov4-before-phases.json`: the maximum sampled RSS rose from 628 MB before
audit to 916 MB after the separate leak check. Reducing retained token sets and
using a lazy word-run generator removes real harness allocation pressure. It
does not remove the cost of collecting full wire snapshots or promise a small
absolute peak RSS for the multi-run caps workload. Resource windows report
median and maximum RSS separately; memory spikes are not evidence of a heap
retained across fresh child processes. The original harness's parent arrays
were already bounded to 100 latency samples; it was not retaining a result per
iteration. No cumulative engine leak was demonstrated by this experiment.

## Completed 30-minute verification

`make soak HOURS=0.5` ran in the background and was awaited to exit **0**:
**615 successes, 155 real intended SIGKILLs,
0 violations, 0 double charges,
0 stuck reservations**, 1,800,530 ms total.
Code commit: `c67b9eaa6894a5c58349e81e0e4d294c8f353218`. The dirty metadata reflects evidence/doc
work; executable code stayed unchanged during this run.

First/last 100-iteration p95: **6.154 → 5.515 s**
(drift **-639.3 ms**). Window median child RSS:
**357.6 → 381.9 MB**, range **307.6–381.9 MB**.
Parent RSS: **18.5 → 29.7 MB**.
Maximum end-of-child RSS: **1,002,594,448 bytes**, max handles **101**.
The absolute maximum is lower than run 1's 1,079,158,368 bytes, but higher than
the shorter 200-iteration baseline's 944,802,656 bytes; this does **not** establish
a reduction in absolute peak RSS. The series supports stable per-iteration
memory with intermittent heavy workloads rather than cumulative engine growth.
The final window has 15 samples; full windows have 50. The JSON
preserves every window, including slow p95 samples and its fault counts.

`npm run check:fast` passed after rebase and after the final allocation fix:
**100 unit-test files / 744 tests**, plus the 20-iteration fixture chaos smoke.
The focused transport/watchdog/continuation and existing audit regressions also
passed. No live providers, Testnet, real money or protected ports were used.


## Quiet-host same-engine status, 4 Nov 2026

The separate same-engine memory/latency soak now has a valid **five-gate PASS**
on `97770e1e`: 200 warmups / 2,000 measured asks, 10,000 retained runs ×60
events, 20 clean restarts, no failed asks or audit violations. Worst interval
engine p99 **25.821 ms**, idle-control max p99 **12.075 ms**, one-minute load
**1.739–3.427**. RSS slope **2.173 MiB/100**, median growth **9.373 MiB**,
max RSS **918.887 MiB**, p95 drift **1.515 ms**. All original limits remain.
Controlled A/B/C and reverse repeats support contention rather than a W
regression, with historical causal limits documented in
[the compact evidence](soak-nov4-ab/README.md). This is local synthetic fixture /
SIMULATED evidence, not live-provider, Testnet or human/finals acceptance.
Historical failed runs above and in round2-u/round2-w remain unchanged.
