> Local synthetic fixture asks / SIMULATED settlement on a shared Mac. No live
> providers, Testnet purchases, real funds, or Monday acceptance are claimed.

Lane W adds an independent idle Node child with the same 10 ms histogram
resolution and absolute one-second boundaries as the engine worker. Each
`intervals` row pairs engine p99, control p99 and host load. The control has no
engine, SQLite, tsx loader, profiler or network work. It exits on explicit stop
or IPC disconnect. It is diagnostic only: the original five comparison gates,
including maximum worker interval p99 strictly below 50 ms, are unchanged.

`--spans` loads instrumentation only through the soak's diagnostic preload.
Production modules never import it. It wraps Store projection/state methods,
SQLite queries/transactions, RunLoop stage entry slices, publisher client entry
slices, AuditLog and HTTP response methods, and JSON serialization. Async-hook
callback timing covers synchronous continuations after awaits. Async method
wrappers measure only their initial synchronous slice, never promise wait time.
A 4,096-entry ring reports overlaps when the diagnostic 10 ms timer is more
than 30 ms late. Sizes are string argument/output bytes, not object sizes;
objects are not serialized just to measure them. Values/payloads are not logged.
Callback IDs are local to an isolate. Nested spans overlap and must not be summed.
Wall durations include GC, I/O wait and descheduling; they are not CPU counters.

The 500-ask / 50-warmup window uses the full 10,000-run × 60-event history and
`--spans --cpu-prof-dir scratch/w-prof`. The main engine's worker profile is the
thread-2 profile (not the host or a restart isolate). `profile-summary.json`
ranks sampled self time and longest sample gaps. Native SQLite time is charged
to its JS wrapper. Profiling and hooks perturb timing. This is a shorter
attribution window, not a full acceptance baseline or an isolated A/B estimate.

Its measured >30 ms lag was a 31.87 ms callback containing `RunLoop.trace`
25.82 ms: `updateRun` 12.00 ms and `appendEvent` 13.04 ms, with synchronous
SQLite commits 8.47 and 12.34 ms. The worker profile assigns 11.31 seconds to
wrapped native/method work, 5.38 seconds to `rawRun`, 2.15 seconds to JSON
serialization and 1.72 seconds to GC. Startup/index/loader callbacks also exceed
30 ms but are outside the measured phase. The largest sampled gaps (15.54 and
12.88 ms) land in the method wrapper; they are not proof of continuous CPU use.

The fixes cache up to 128 prepared statements per Store and avoid hydrating an
unused full snapshot after trace metadata writes. `updateRunState` retains all
of `updateRun`'s protection, validation, transaction and audit behavior; the
existing hydrated `updateRun` API is preserved. Trace still persists phase and
checkpoint before the event; no await was inserted across a transaction or a
Stop/purchase handoff. Money, receipt/hash, grant, idempotency and citation
semantics were not weakened. Statement cache entries are cleared on close.

The initial instrumentation had an early-timer boundary bug: a timer firing
just before a boundary could reset twice and overwrite a control histogram
with an empty sample. `before-diagnostic.json` and `after-diagnostic.json` are
explicitly superseded prototype measurements. Their top-five rows retain the
actual paired values; the full after prototype failed at 78.12 ms versus
13.89 ms control. It overlapped unit tests, chaos and artifact consumers, and
had one-minute host load up to 30.93. It does **not** support a host-wide
scheduler explanation. Overlapping spans included `rawRun` 51.63 ms and a
SQLite read 63.98 ms, plus answer entry slices up to 83.09 ms elsewhere.
The evidence cannot separate CPU, disk wait and thread-specific descheduling.
Lane U's historical 57.44 ms interval cannot be retrospectively attributed.

The corrected schedule refuses early callbacks before histogram reset. A
regression checks unique interval IDs and full subsequent idle windows. The
final full run uses a fresh database and spans/profiling off, with the idle
control still enabled; this avoids tracing retention affecting memory gates.

Scratch ownership audit (`rg mkdtemp scripts/`): consumers, Python artifact build
environment, history benchmark, multi-origin fixture and key-reveal chaos now
remove their exact generated directory in finally blocks. Consumers stop their
managed child groups and engine before the outer removal. All five support
`KEEP_CONSUMER_SCRATCH=1` with an explicit path message; the wrapper forwards it.
Existing cleanup in chaos, escrow chaos, SDK package check, recording, MCP demo
and the disposable hire fixture is retained. Persistent live/demo destinations
are not generated disposable directories. `scripts/testnet-wallets.ts` is an
intentional exception: it reloads the same `wallets.private.json`, enforces mode
0600 (directory 0700), and reuses wallet identities and balances across first
contact runs. That private file is not removed, read or copied by Lane W.
No existing scratch belonging to another lane was deleted.

## Final full run

Measured source `9a34e9d4fcb52444740a2898fb7f092d54a75324` (after #369), 200 warmups / 2,000 measured asks, full retained history, one engine, 20 clean restarts. Valid: **True**; overall pass: **False**. No failed asks or audit violations.

| Gate | Value | Limit | Result |
|---|---:|---:|---|
| rssSlope | 2.833550 | 5 | PASS |
| rssMedian | 67.249771 | 100 | PASS |
| rssMax | 899.010399 | 1536 | PASS |
| loopP99 | 2032.140287 | 50 | FAIL |
| latencyP95 | -204.820042 | 250 | PASS |

One-minute host load during measurement: 17.729–77.718. This run overlapped the lane's integrated check:fast, chaos and artifact consumers as well as other shared-host work. No passing rerun was selected.

| Worst interval | Engine p99 ms | Control p99 ms | Load (1 min) |
|---|---:|---:|---:|
| 327 | 2032.140 | 12.042 | 28.333 |
| 432 | 493.355 | 12.067 | 26.151 |
| 273 | 482.345 | 12.403 | 18.315 |
| 165 | 479.461 | 15.401 | 52.730 |
| 398 | 440.140 | 12.476 | 31.908 |

The worst paired control p99 is 12.042 ms versus engine 2032.140 ms. The control did not have a matching p99 stall. A shared scheduler explanation is not established. Thread-specific descheduling or disk contention remain possible, not proven. The loop gate remains failed; the Monday quiet-host run is still required. No control subtraction, threshold change, or money-path relaxation was made.

Validation on measured source 9a34e9d4: check:fast **1,209 tests / 142 files**
plus 20-run chaos smoke; hygiene passes; Python **222 passed**, including the
Python conformance suite. Explicit TypeScript conformance **193 cases/tests**,
Python conformance **201 tests** (includes parameterized wire cases). Integrated
chaos **200 iterations / 55 actual kills / 171 recoveries / 29 clean failures**,
zero double charges, invariant violations or stuck reservations; 40 escrow
probes. Artifacts and all five consumers pass; isolated TMPDIR inspection finds
zero remaining ra-consumers-* or ra-build-* directories. Digests and the chaos
report are retained in validation.json. Initial failed attempts (test doubles
missing the new method, an artifact build colliding with test builds, and a
test import type error) were repaired and rerun; no gate/test was loosened.

The final rebase also picks up #367 (UI/MCP labels, Testnet/tooling). The measured
full soak and 200-chaos report above remain pinned to 9a34e9d4, not relabelled as
new-head evidence. Final commit hooks rerun check:fast after integration; green
CI is required before squash merge. The loop failure remains a known,
unresolved performance acceptance issue. No assertion of an exact cause for
the two-second uninstrumented interval is made. Its maximum GC was 0.306 ms.
