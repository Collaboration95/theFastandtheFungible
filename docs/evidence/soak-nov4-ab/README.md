# Quiet-host same-engine experiment, 4 Nov 2026

LOCAL SYNTHETIC fixtures / SIMULATED settlement. No live providers, Testnet,
real funds, or human/finals acceptance. Measured C is `97770e1e`; later rebases
are not relabelled as measured source.

Verdict: **contention-supported; no W regression reproduced**. Both pre-W and
post-W settle near 25 ms with the same retained history. The historical W
2032 ms outlier under load 17.7–77.7 does not recur in either post-W repeat,
C, or the full run. This supports host contention rather than a W regression.
It does not retrospectively identify a specific OS scheduler, disk wait or
SQLite stall: W's quiet independent control rules out neither thread-specific
descheduling nor disk contention. A load-triggered engine stall cannot be
excluded without a separate controlled load experiment. No engine fix is
justified by these results.

All runs were sequential, A/B/C/B/A then C-full and a B rerun. No test, build,
Playwright, install or attribution ran concurrently with a soak. One shared
npm cache; `npm ci` completed in each detached worktree before measuring.
Node v26.3.1; caffeinate prevented sleep. Attribution/profiling/snapshots off.
Each short arm: 800 measured asks, 100 warmups, concurrency 1, seed 279,
10,000 historical runs × 60 events. Full: 2,000 asks, 200 warmups.
All seven reports are valid, zero failed asks/audit violations, one measured
engine identity, no sample gaps, and 20 closed clean restart cycles each.
Short arms are not acceptance eligible. C-full is eligible and passes.

Load ranges combine all one-second harness samples and recorded uptime
before/during/after. Uptime was recorded every 45 seconds (10 seconds for B3).
B2 briefly exceeded 4 during warmup and early measurement (peak 4.636);
external cause was not captured. Retained and rerun conservatively as B3.
No affected run is hidden or selected away.

| Arm | SHA | Load 1-min | Engine worst p99 ms | Control max p99 ms | RSS slope MiB/100 | Median growth MiB | Max RSS MiB | p95 drift ms | Verdict |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| A1 | `ed5d540d` | 1.850–3.993 | 25.706 | 11.911 | -2.239 | -29.395 | 896.300 | 0.607 | PASS all five |
| B1 | `45edb2c8` | 2.113–2.670 | 25.248 | 12.067 | -0.577 | 5.357 | 877.343 | 0.898 | PASS all five |
| C1 | `97770e1e` | 1.898–2.862 | 24.871 | 13.361 | -0.823 | 13.639 | 894.988 | -2.114 | PASS all five |
| B2 | `45edb2c8` | 1.910–4.636 | 24.658 | 12.083 | -2.177 | -24.817 | 841.637 | 3.082 | PASS; load affected, rerun B3 |
| A2 | `ed5d540d` | 1.810–2.726 | 24.969 | 12.157 | 0.444 | -26.098 | 846.730 | -3.052 | PASS all five |
| Cfull | `97770e1e` | 1.739–3.427 | 25.821 | 12.075 | 2.173 | 9.373 | 918.887 | 1.515 | PASS all five |
| B3 | `45edb2c8` | 1.494–2.270 | 24.494 | 11.698 | 0.092 | 2.481 | 841.359 | -0.710 | PASS all five |

Control is the maximum measured-window histogram p99, not a percentile across
p99s or a subtraction from engine timing. A uses W's unmodified idle probe in
an external fork with an independent epoch; its overlapping windows are not
exactly paired. B/C use W's built-in aligned idle probe. A's engine histogram
uses its original relative one-second timer; B/C use W's absolute timer.
This harness difference is retained, not silently backported into A.

## Harness audit and unchanged gates

`compare()` selects only samples with `stage === 'measured'` for loop p99;
the harness sets `stage='restart'` before closing the measured engine and
starting the 20 restart cycles. Deliberate restart intervals are already
excluded. Maximum RSS still includes all stages by design. No new exclusion,
control subtraction, diagnostic-slope option, threshold or formula change.
The loop gate remains maximum sampled worker one-second histogram p99 <50 ms
at 10 ms resolution. Limits remain slope ≤5 MiB/100, median growth ≤100 MiB,
max RSS ≤1536 MiB and matched-window p95 drift ≤max(20% first p95,250 ms).
Every measured first-window p95 here makes that last limit 250 ms.

## Reproduction and evidence

At each pinned SHA, after `npm ci --cache <shared-cache>`:

```sh
caffeinate -dims node scripts/soak-same-engine.mjs --runs 800 --warmup 100 --concurrency 1 --seed 279 --history-runs 10000 --events-per-run 60 --data-dir <fresh-owned-directory> --output <raw-report.json>
```

For C-full use `--runs 2000 --warmup 200`. Capture `uptime` before, during and
after. A's external probe forks B's `scripts/soak-idle-control.mjs`, waits for
`ready`, sends `{epoch: Date.now()}`, retains IPC samples, and sends `{stop:true}`
after completion. No source edits in the detached arms.

JSON summaries retain source/harness/raw-report SHA-256, options, all five
gates and validity, top five measured samples, independent-control method,
load and uptime records. Raw per-ask reports, databases and logs are scratch;
no raw payloads or environment files are committed. Detached arms and their
node_modules, shared npm cache and exact owned scratch paths are removed.

Validation: evidence-only change; no engine code changed. `check:fast` and
`hygiene` run after the soaks. The first check attempt lacked installed eslint;
`npm ci` repaired the checkout dependency state, then validation was rerun.
No subagent review: the lane instruction explicitly requires working alone.
No check or gate was loosened.
