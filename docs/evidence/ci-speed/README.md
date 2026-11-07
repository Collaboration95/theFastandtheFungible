# CI history audit — 7 November 2026

Historical hosted evidence, frozen at `369dd0e2` before the current CI changes.
Window: **25 October 2026 00:00:00 UTC through 7 November 2026 11:57:59 UTC**.
All GitHub access used authenticated `gh` CLI. No tests or benchmarks were run by
this audit lane. [Parent measurements](#parent-measurements) are separate.

The retained history contains **397 ci.yml runs, 4 desktop.yml runs and 137 merged
PRs**, plus **9 release parent runs** invoking these workflows. All **418 attempts**,
**1,813 job records** (1,804 in scope; 9 publishing jobs excluded), **95 failed-job
logs** and every PR commit/file list were retrieved. **Zero unrecovered retrieval
failures**. Collection details, recovery of a GraphQL query limit and raw-response
hashes are in [collection.json](collection.json).

Of **44 root failure jobs**, **8** led to inspected code/build fixes, **21** to test
repairs, **5** passed at the same source SHA, and **10** remain unknown. No failure
is confirmed as environment/infrastructure. The other **51** failed jobs only
propagated failed/cancelled dependencies. The eight code/build failures represent
**seven distinct defects**: browser and artifacts caught the same removed Cast
consumer. Six merged PRs have confirmed real catches; one additional desktop
checksum catch belongs to a standalone tag commit.

**36/137 PRs (26.28%)** have any failed job; **28/137 (20.44%)** have a root
failure; **6/137 (4.38%)** have a confirmed real catch. PR #289 targets gh-pages and has no in-scope application CI
run; it is not counted as passing. Full per-PR results are in
[pull-requests.json](pull-requests.json).

## Job catches and observed runner time

Minutes are the sum of assigned-runner `completed_at − started_at`, including
setup, installs, failures, cancellations and reruns. Skips and unstarted jobs add
zero. These are **observed runner minutes, not billed minutes, CPU time or
end-to-end latency**. Concurrent job times must not be summed into wall time.
The table includes direct executions and reusable invocations.

| Job | Runner min | Real catches | Catches/min | Flakes | Unknown |
| --- | ---: | ---: | ---: | ---: | ---: |
| ci/artifacts | 338.13 | 2 | 0.00591 | 0 | 0 |
| ci/browser | 643.82 | 4 | 0.00621 | 1 | 1 |
| ci/changes | 41.30 | 0 | 0.00000 | 0 | 0 |
| ci/chaos | 383.47 | 0 | 0.00000 | 0 | 0 |
| ci/check-aggregate | 37.15 | 0 | 0.00000 | 0 | 0 |
| ci/check-monolithic | 472.32 | 0 | 0.00000 | 0 | 4 |
| ci/python | 229.15 | 0 | 0.00000 | 0 | 0 |
| ci/verify | 784.37 | 0 | 0.00000 | 4 | 5 |
| desktop/dmg | 39.42 | 2 | 0.05074 | 0 | 0 |

Total: **178,147 runner seconds = 2,969.116667 runner minutes** across **1,804**
target job records (1,774 started). The 51 aggregate failures are cascades, not
root catches. `check-monolithic` is kept separate because it formerly ran several
gates; comparing it directly with the newer aggregate would conflate workloads.
Per-job catches are not additive: browser and artifacts caught the same Cast
deletion. The five failed flake jobs consumed **1,001 runner seconds**; this is
only their leaf-job time, not the total cost of repeating the workflows.

## Percentages and bounded waste proxies

**131/137 PRs (95.62%)** have **no confirmed real catch observed**. That includes
#289, which has no in-scope application CI run. This is not a 95.62% unnecessary-CI
rate, a causal estimate of time wasted, or evidence that those PRs would have
been safe without verification. Passing gates, deterrence, regression protection,
coverage admission and defects never introduced are not valued by this numerator.

For the requested non-product-failure proxy, **21 test repairs + 5 same-SHA passes
= 26/44 root failures (59.09%)**. This is an operational test-repair/same-SHA-pass
bucket, not proof that all 26 lack a product cause: an intermittent product defect
can pass at the same SHA. It also is not 59.09% of job minutes or money. The other
root failures are **8 confirmed fix-linked jobs (18.18%)** and **10 unknowns
(22.73%)**; unknowns are retained, not forced into flakes. The seven distinct real
defects differ from the eight detecting jobs because Cast was detected twice.

The compact job table reports observed catches per runner minute across changing
historical workloads. Its rates are descriptive and are not a controlled ranking
of job necessity. No queue, billed-cost, removed-work or paid-runner saving has
been measured by this audit.

## Confirmed fixes

A real catch requires the failure symptom, a relevant inspected corrective patch,
and a later successful execution. It includes build/tooling defects; it does not
imply observed funds loss or a payment-policy exploit. PR attribution names the
PR associated with the failing run, which can differ from the repair PR.

| Failing PR / source | Run | Observed defect | Inspected repair |
| --- | --- | --- | --- |
| standalone desktop tag | [41562353549](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/41562353549) | Electron binary-mode checksum filename parser | [725e0eb9](https://github.com/Collaboration95/theFastandtheFungible/commit/725e0eb927073b523ebaf2771ae7c7c6c646499e) |
| #344 | [41693484395](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/41693484395) | Oversized terminal stream leaves browser Searching | [b806ea0f](https://github.com/Collaboration95/theFastandtheFungible/commit/b806ea0ffc0bdbc291fbb0e2961b0ab09b35dd64) (PR #344) |
| #364 | [41740868918](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/41740868918) | Release consumer process groups/stdio keep build alive | [00faaddd](https://github.com/Collaboration95/theFastandtheFungible/commit/00faaddd7b3e7c3099dcb03de7f75322cf690454) (PR #364) |
| #366 | [41742856407](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/41742856407) | Delayed onboarding covers Ask after interaction | [01f268cb](https://github.com/Collaboration95/theFastandtheFungible/commit/01f268cb9d12acf4318dd46a80cd3dca41a839c5) (PR #366) |
| #367 | [41784438897](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/41784438897) | Onboarding focus variant still covers Ask | [b44cc008](https://github.com/Collaboration95/theFastandtheFungible/commit/b44cc0085c113ec7ef82026c2dbcd4aa4f6cb34c) (PR #367) |
| #394 | [42345570196](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/42345570196) | Deleted Cast still imported by built QA page; browser + artifacts | [3d2d321b](https://github.com/Collaboration95/theFastandtheFungible/commit/3d2d321be563eb2ba81c7dd03b628a7daca9e7b4) (PR #394) |
| #371 release parent | [41789154763](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/41789154763) | Electron download skipped before architecture inspection | [d08d9bbd](https://github.com/Collaboration95/theFastandtheFungible/commit/d08d9bbdf6619c6fb442a261cac5caca46a4cf76) (PR #373) |

## Classification and per-PR outcomes

Classification is at the failed-job/attempt level. `true_positive` requires the
code/build repair above. `flake` requires a pass of the same target workflow/job
at the identical source SHA; it does not diagnose the underlying cause. The
refund failures in #396/#404 could involve their 100 ms challenge deadline, but
that remains a code-derived possibility. Different-SHA passes never establish
flakes here. Infrastructure is assigned only with evidence, so the confirmed
environment/infrastructure count is **zero**, with **ten unknowns retained**.

The requested `stale_test` bucket means **test repair**, with explicit subtypes:
**six** stale fixture/label/layout assertions, **eight** coverage deficits, and
**seven** test-harness/deadline repairs. Coverage deficits are not represented as
stale assertions or proven runtime defects. Historical #284 raised the leak-oracle
timeout **5 s → 30 s**; #296 later optimized the oracle and restored **5 s**. The
#394 history repair moved repeated limit edge cases from the 2,000-history fixture
to a separate 30-history fixture while retaining large ordered parity. These
historical changes are disclosed; this audit changes no assertion or threshold.

All 137 PRs have a row in `pull-requests.json`. The following 28 had root failures;
eight additional PRs had only aggregate cascades from cancellations. A workflow
can be cancelled after a leaf fails, and earlier failed attempts can be hidden
by the latest passing outcome; neither case is dropped.

| PR | Root failed jobs | Classification counts | Distinct real catches |
| --- | ---: | --- | ---: |
| [#264](https://github.com/Collaboration95/theFastandtheFungible/pull/264) | 2 | unknown: 2 | 0 |
| [#266](https://github.com/Collaboration95/theFastandtheFungible/pull/266) | 1 | unknown: 1 | 0 |
| [#268](https://github.com/Collaboration95/theFastandtheFungible/pull/268) | 2 | stale_test: 2 | 0 |
| [#284](https://github.com/Collaboration95/theFastandtheFungible/pull/284) | 2 | stale_test: 2 | 0 |
| [#290](https://github.com/Collaboration95/theFastandtheFungible/pull/290) | 1 | unknown: 1 | 0 |
| [#301](https://github.com/Collaboration95/theFastandtheFungible/pull/301) | 1 | stale_test: 1 | 0 |
| [#332](https://github.com/Collaboration95/theFastandtheFungible/pull/332) | 1 | stale_test: 1 | 0 |
| [#344](https://github.com/Collaboration95/theFastandtheFungible/pull/344) | 3 | stale_test: 2, true_positive: 1 | 1 |
| [#352](https://github.com/Collaboration95/theFastandtheFungible/pull/352) | 1 | unknown: 1 | 0 |
| [#364](https://github.com/Collaboration95/theFastandtheFungible/pull/364) | 1 | true_positive: 1 | 1 |
| [#366](https://github.com/Collaboration95/theFastandtheFungible/pull/366) | 1 | true_positive: 1 | 1 |
| [#367](https://github.com/Collaboration95/theFastandtheFungible/pull/367) | 1 | true_positive: 1 | 1 |
| [#371](https://github.com/Collaboration95/theFastandtheFungible/pull/371) | 1 | true_positive: 1 | 1 |
| [#378](https://github.com/Collaboration95/theFastandtheFungible/pull/378) | 2 | stale_test: 1, flake: 1 | 0 |
| [#380](https://github.com/Collaboration95/theFastandtheFungible/pull/380) | 1 | stale_test: 1 | 0 |
| [#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381) | 1 | unknown: 1 | 0 |
| [#382](https://github.com/Collaboration95/theFastandtheFungible/pull/382) | 2 | flake: 1, unknown: 1 | 0 |
| [#386](https://github.com/Collaboration95/theFastandtheFungible/pull/386) | 4 | stale_test: 2, unknown: 2 | 0 |
| [#389](https://github.com/Collaboration95/theFastandtheFungible/pull/389) | 2 | stale_test: 2 | 0 |
| [#390](https://github.com/Collaboration95/theFastandtheFungible/pull/390) | 1 | stale_test: 1 | 0 |
| [#394](https://github.com/Collaboration95/theFastandtheFungible/pull/394) | 3 | stale_test: 1, true_positive: 2 | 1 |
| [#395](https://github.com/Collaboration95/theFastandtheFungible/pull/395) | 1 | stale_test: 1 | 0 |
| [#396](https://github.com/Collaboration95/theFastandtheFungible/pull/396) | 1 | flake: 1 | 0 |
| [#402](https://github.com/Collaboration95/theFastandtheFungible/pull/402) | 1 | stale_test: 1 | 0 |
| [#403](https://github.com/Collaboration95/theFastandtheFungible/pull/403) | 1 | stale_test: 1 | 0 |
| [#404](https://github.com/Collaboration95/theFastandtheFungible/pull/404) | 2 | stale_test: 1, flake: 1 | 0 |
| [#409](https://github.com/Collaboration95/theFastandtheFungible/pull/409) | 2 | stale_test: 1, flake: 1 | 0 |
| [#415](https://github.com/Collaboration95/theFastandtheFungible/pull/415) | 1 | unknown: 1 | 0 |

Counts reflect observed retained history, not fault-introduction claims.
Association uses failed checkout `refs/pull/N/merge`, exact merge/PR commit SHAs,
then a unique PR head branch. Rebased historical SHAs can require the last method.
The three standalone desktop-tag runs remain unassociated rather than being
assigned to a guessed PR.

## Scope, retrieval and limitations

Direct latest outcomes: **315 success / 32 failure / 54 cancelled**. Including
every direct attempt gives **316 success / 39 failure / 54 cancelled**. The nine
reusable release parents add **8 success / 1 failure**. Nine publishing jobs are
retained for traceability but excluded from target workflow time/catch totals.

The repository-wide enumeration returned **439 retained run IDs** in the frozen
window. The requested scope includes 401 direct IDs and nine reusable parents;
the other 29 Pages/nightly/Codespaces/non-reusable release runs are explicitly
listed as excluded in `collection.json`. The supplied CI list contained 552 rows;
155 predated the cutoff, and all 397 in-window IDs match the API enumeration.
No supplied pre-window CI row has a later update inside this window.

All 418 attempt job lists, 95 failed logs, 137 PR commit lists and 137 complete
file lists were retrieved. One oversized GraphQL request failed and was replaced
with an explicit paginated query. Eight 100-file GraphQL truncations were completed
through paginated REST calls. **No unresolved retrieval failures or missing failed
logs**. `collection.json` records endpoints and response hashes; `failures.json`
retains exact run/job/attempt/source IDs, failed tests, log SHA-256/line excerpts,
same-SHA passing executions and corrective commit references. Full raw responses
and logs were fetched to temporary cache, not copied into the repository.

This is exhaustive for retained API history in the stated window; deleted runs
cannot be discovered without a separate deletion audit. No underlying timing
cause, account queue saturation or regression-free future is inferred from this
sample. The snapshot predates the parent's current gate changes.

## Separate local evidence

- **#395 → #416:** local desktop recovery failed at tsx registration. The inspected repair switches five scripts to `tsx/esm/api` and adds a hygiene guard. #416 reports 13 passing native recovery cases; the audit did not rerun them or retrieve a raw local failure artifact. This is a local acceptance catch, not hosted CI catch.
- **#393:** two browser assertions were updated from “All writers and articles are fictional.” to “Built-in examples are fictional.” The inspected commit is test-only; its PR reports six local passing browser cases. No hosted failure is attributed to this repair, and no raw pre-repair local log was retrieved.

## Recommendations

Keep the browser, installed-artifact and macOS build coverage that found concrete
defects. Address the known local desktop startup gap with the #416 hygiene guard
and native acceptance. Preserve the unknown performance failures, including the
main #415 result below, until a controlled rerun or targeted diagnosis exists.

`verify`, dedicated `chaos`, Python and the aggregate have **zero confirmed
runtime/build catches in this window**. This is not proof that their assertions
are redundant: verify enforced eight coverage repairs and several test repairs,
while the aggregate correctly refused failed/cancelled dependencies. Avoid using
that historical zero alone to remove a hard gate.

A narrow consolidation candidate exists in `tests/ci-contract.test.ts` at the
pinned source: the same five jobs × four failure states run both in process and
through **20 separate Node CLI processes**. The in-process matrix already checks
the decision table; a smaller representative CLI integration set could preserve
JSON/exit-code/error plumbing, docs-skip behavior and browser-group propagation.
No historical failure names this test as a root cause. Its attributable cost and
any speedup are **unmeasured**, so this is a parent-owned review candidate, not a
measured saving or a completed change.

## Evidence tables

- [summary.json](summary.json): totals, per-job catches/minutes/flakes and metric definitions.
- [history.json](history.json): all run IDs, attempts, source SHAs, outcomes, PR associations and job IDs.
- [jobs-01.json](jobs-01.json), [jobs-02.json](jobs-02.json), [jobs-03.json](jobs-03.json): all job/step outcomes and timestamps, including cancelled/skipped jobs and unrelated publishing records.
- [failures.json](failures.json): all 95 failed jobs, failed tests, classifications, log hashes/excerpts, rerun and repair links.
- [repairs.json](repairs.json): inspected corrective commit patches and source links.
- [local-incidents.json](local-incidents.json): separate #395 → #416 loader defect and #393 stale label assertions; excluded from hosted metrics.
- [collection.json](collection.json): pagination/completeness checks, endpoints, limitations and raw cache manifest.

## Main c66bd7fc / PR #415

[Run 42367054706](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/42367054706)
failed [browser job 128387254946](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/42367054706/job/128387254946)
in `tests/perf.spec.ts:59`: palette p95 **107.8 ms**, required **<50 ms**.
Recorded view-switch p95 was also over budget at **96.3 ms**; that later assertion
was not reached. Interactive time was 240.14 ms, initial gzip JS 140,911 bytes,
and CLS 0.00401. `check` only cascaded the browser failure.

Classification: **unknown**, not a confirmed flake. There is no same-SHA passing
execution or targeted repair in the snapshot. The later #416 green run fixes the
separate local desktop loader defect and cannot establish this timing failure's
cause. Early health-proxy connection refusals recovered; they are not assigned
as the root cause.

## Parent measurements

Reserved to the parent: `timings.json` (pending),
[acceptance-serial.json](acceptance-serial.json) and
`acceptance-parallel.json` (pending). The parent may replace this
section after measurements finish. Historical hosted job minutes above are not
an isolated before/after speed experiment.

The parent reports the serial baseline started at **20:00 SGT on 7 November**,
finished at **20:15**, and took **856.548 s**. Its soak loop gate failed at
**60.98 ms**; RSS/latency passed. Lint included a new gate still being implemented.
Python, coverage, consumers, all browser groups and DMGs passed according to that
report. These are parent-reported local results, not fresh hosted audit evidence;
read the parent-owned artifacts for the final exact outcomes.

## Capacity and billing context

Verified against current official GitHub documentation on 7 November 2026:
[GitHub Free concurrency limits](https://docs.github.com/en/actions/reference/limits)
are 20 total and 5 macOS jobs; [standard hosted runners for public repositories
are free, while larger runners are billed](https://docs.github.com/en/billing/concepts/product-billing/github-actions);
[larger runners require Team or Enterprise](https://docs.github.com/en/actions/concepts/runners/larger-runners).
This repository was verified public through `gh`. Account plan, queue saturation
and larger-runner speedup were not measured; this audit gives no measured reason
for a paid-runner decision.
