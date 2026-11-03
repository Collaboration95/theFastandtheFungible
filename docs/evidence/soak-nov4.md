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
no progress logging. No stack or phase was recorded. The exact historical
blocked await, and whether the machine was suspended or starved, cannot be
reconstructed from these artifacts. A provider transport hang is not proven:
the provider-down fixture returns local HTTP 503 immediately, and the existing
LLM transport already had an abort timer and two attempts.

The original summary is `soak-nov4-run1.json`. The terminal log evidence was:

```text
Error: iteration 3031 provider-down/UC2: exit=null signal=SIGKILL watchdog=true elapsedMs=605751
Node.js v26.3.1
make: *** [soak] Error 1
```

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

Verification results will be recorded after the background short soak completes.
