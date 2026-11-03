# Payment chaos and soak, 3 Nov 2026 (#279)

All ledger activity below is **SYNTHETIC**, with generated unfunded fixture keys,
real production signers/API/SDK/MCP/publisher and actual SIGKILLs. No Testnet,
live model, real-value payment or cloud resource was used. The synthetic ledger
is deliberately labelled even though it exercises the production Testnet wire
path. No existing test or gate was loosened; no `src/` file was changed.

## Completed baseline experiments

Runtime source: `74a3d0101c67dc8f61591b601cb244f5935f5230`, based on main
`ef4b5b490d272c8c03886b8e812da8c9d4719a97`, before the audit, marginal-fact
policy and escrow integrations. The commits were rebased later; the immutable
source SHA above records what these experiments actually executed.

| Experiment | Seed | Duration | Iterations / fault episodes | SIGKILLs | Confirmed purchases | Refunds | Invariant violations |
|---|---:|---:|---:|---:|---:|---:|---:|
| Separate chaos pass | 1279 | 27m 49s | 500 / 500 | 130 | 624 | 52 | 0 |
| Baseline soak | 279 | 30m 1s | 570 / 570 | 144 | 663 | 80 | 0 |

Both had **0 double charges, 0 stuck SUBMITTING reservations after three recovery
ticks, and 0 held principal reservations at completion**. Every confirmed
purchase had exactly one receipt; refunds had at most one ledger transaction.
Grant/leak, policy, citation and cap assertions and the full gate audit ran for
each iteration (including all runs created by the cap probe). Fault counts are
episodes: e.g. one concurrent replay group counts as one injected episode.
The legacy `failedCleanly` summary bucket includes all zero-charge completions,
including legitimate free-only answers; it is not a count of product errors.

Raw bounded summaries: [500 iterations](chaos-279-500.json),
[baseline soak](chaos-279-baseline-soak.json). Their first/last 100-iteration p95
latencies are in `latencyMs`. The baseline soak drift was **+3223 ms**, and the
separate pass drift **+7918 ms**. Local test/build and competing chaos load
varied during these runs; this mixes fresh process startup, fault selection and
host contention. It is neither live ledger latency nor evidence of single-engine
memory stability. Maximum child RSS was 1.37–1.38 GB (decimal), maximum active
resources 105–107. Stores were removed each iteration; summary/log files stayed
small and contain no seeds, signed blobs or premium bodies.

## Integrated tree

After rebasing onto merged #273, #276 and #288, lint/typecheck and **661 tests in
79 files** passed. A 20-iteration integrated smoke passed with zero violations;
four additional escrow probes applied four creates, two releases and two
cancellations. Escrow probes preserve ledger/publisher state over Store/manager
restart and assert one principal, one terminal operation and one receipt, no
open object, no reserved authority and no accessible pending/failed-proof bytes.
Their policy BUY is controlled synthetic input; the main UC scenarios execute
the actual policy loop.

A second 30-minute integrated soak is in progress on runtime commit
`d05a340` (seed 2279). Final results will be appended before merging.

## Reproduce and limits

- `npm run chaos -- --runs 500 --seed 1279`
- `npm run chaos -- --soak 12h --seed 2279 --output scratch/chaos/soak-12h.json`
- `npm run check:fast` includes the 20-iteration smoke and escrow probes.
- See the runbook for optional historical scorecard rows and `make soak HOURS=12`.

The 12 h command is documented, not claimed as executed. Each iteration creates
a fresh engine/store set and retains it across crash recovery; this is a soak of
repeated recovery and resource cleanup, not one unbroken engine uptime test.
MCP tools run over in-memory JSON-RPC; the existing stdio end-to-end suite remains
in `check:fast`. Faults use only fixture Ledger, HTTP and SDK transport seams.
No production payment bug was found in the completed runs. During harness
development, an early assertion raced an active timer reconciliation; awaiting
purchase drain fixed the harness. No production test was weakened.

## Day 2 release

[v0.3.0 · Day 2 · Fact menu](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.3.0)
targets exactly `7807ce311f0bb3ae3807eb476436c7c6ba009f52`. The script's `--at`
path changes no package version or HEAD and pushes only the new annotated tag.
The tag date follows the original commit. The old workflow published it, then
Latest was explicitly restored to v0.4.0. Verified release order:
v0.4.0 → v0.3.0 → v0.2.0 → v0.1.0. Existing tag objects were unchanged.
[Release metadata](release-day2.json) records the target, order, Latest and tag
identities. Notes retain F1 0.235→0.419, uplift +11.3→+17.0 pts and the wasted
spend regression 36.2%→47.2%, with #276 identified as the then-pending fix.
