# Lane A: resource ownership (7 Nov 2026)

Fixture evidence only. No live provider, wallet funding, cloud provisioning or
Testnet transaction was performed. Runtime payment and escrow code is unchanged.

The first check attempt could not find ESLint in this fresh checkout. After
`npm ci`, the baseline `npm run check:fast` passed in 96.49 s. Across that
host TMPDIR observation window, 40 new directories remained (before.json).
Duplicate leak prefixes and unrelated entries indicate concurrent host activity;
40 is a host observation, not an attributable count of this suite's leaks.
No host-wide purge was performed. The audit independently identified at least
19 leaked roots in the original full collection, including Lane D's history root.

The after run uses `node scripts/test-resources.mjs npm run check:fast`:
80.72 s, exit 0, zero new host TMPDIR entries, zero unexpected entries inside the
private invocation and zero live owned groups. See after.json and check-fast.log.
After rebasing over T1 (#393), the check passed again in 94.73 s with zero
private invocation entries/groups. That host window saw 34 new directories from
concurrent activity outside the owned root (rebased.json); these were not purged.
These local runs do not establish a causal speedup or the CI coverage
wall-time target (100 s versus the audit's 121.57 s baseline).

## API for lanes B, C and D

- `new ResourceScope()` / `withResourceScope(async scope => ...)`.
- `tempDir(prefix)` returns an immediately owned private directory synchronously
  (it can also be awaited). All test roots sit under the invocation TMPDIR.
- `defer(closer)` registers LIFO handle cleanup; all closers run despite errors.
- `own(handle)` registers an idempotent close method immediately after creation.
- `spawn(command, argv, options)` owns a detached process group with piped stdio.
  The group survives leader exit in the ownership registry. `close()` sends TERM,
  then KILL after 1.5 s, and checks for live survivors for at most another 3 s.
- `timer(timeout)` registers timer cleanup. Intervals can use defer(clearInterval).
- `close()` is idempotent; stops groups first, then handles, then removes exact
  owned scratch paths; rejects with AggregateError if cleanup fails.
- `waitForOutput(child, regex, timeoutMs)` removes readiness listeners and timers
  on readiness, startup error, early exit, signal exit or timeout.
- `evidenceDir(prefix, reason)` creates durable private state below
  `$XDG_STATE_HOME/researchagent/acceptance` (default `~/.local/state`). Its private
  retention.json explains why manual reconciliation is required before deletion.
  This state is never put inside disposable scratch, even on failed boot.
  Supplied J1_STATE_DIR remains caller-owned.
- Tests use `resources()` from tests/helpers/resource-scope.ts for per-test
  ownership. Concurrent tests must pass their own scope. The setup adapter also
  adopts existing raw synchronous creators at file lifetime to preserve beforeAll
  fixtures without editing D's files. D should adopt tempDir/own directly.
- `processTransport(child)` in scripts/release-processes.ts shares MCP framing
  and closes the already owned process group. The artifact-admission node:test
  invocation remains intact.

Direct `vitest run`, including coverage, gets the invocation leak gate through
vitest global setup. The standalone wrapper additionally bounds the whole child
invocation and catches orphan descendants of its invocation group. It reports
leaks before removing the exact root and emergency-killing registered groups.
Known Node/tsx compiler caches are explicitly owned and cleaned before inspection.
raw-creators.json freezes the remaining legacy allocation sites; adding new raw
creators fails setup. No directory contents, wallet keys or seeds are reported.

## Regression evidence and limits

The unit regressions cover success, thrown failure, actual readiness timeout,
failed spawn, cleanup-error aggregation, idempotence, deliberate directory leak,
live group leak, whole-invocation timeout, and a TERM-ignoring grandchild whose
leader exits. The process-group teardown regression takes about 1.7 s (<5 s).
The artifact-admission regression still runs and adds early boot failure coverage.
Original purchase, refund, RLUSD, anchor, scenario raw-leak/Stop and accounting
assertions remain intact. Nothing loosened.

The 150 net LOC deletion target is missed: the shared implementation, independent
regressions and leak runner add code overall. Repeated lifecycle implementations
were consolidated where safe; no arbitrary deletion was made to hit a line target.
Packaged Electron acceptance and public Testnet consumers were migrated but not
run live. SIGKILL of the owning wrapper itself cannot execute finally; its exact
invocation path is needed for later manual recovery. No claim of cleanup after
power loss or parent SIGKILL is made.
