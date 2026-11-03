# Required fast verification — 4 November 2026

> What this proves: Required fast verification — 4 November 2026.
> Scope: Local tests and CI contract evidence.
> Limits: This packet alone does not establish mainnet readiness or human acceptance.

Offline synthetic providers, throwaway signing keys, simulated settlement and
isolated ledgers only. No live provider, Testnet, mainnet or real-money calls.

The integration includes A/E/C1/C2 at main
4df971aa7899b8fa9c54c4f007687280db6acb35. Baseline source is
ec97bfdfe38e61b1b1b3fed6a1b4d3546052927c. Original collection retained all
744 tests / 100 files (47.13 s). Runtime-inclusive ratchet baseline, after
coverage/CI contract tests but before payment refusals: 770 / 102 (50.84 s).
Baseline runner: macOS arm64, Node 26.3.1, three Vitest workers. Baseline JSON
marks its uncommitted collection configuration/contract tests as dirty.

coverage-baseline.json and coverage-final.json record local raw counts;
coverage-hosted.json records the uploaded V8 summary from this PR's own
successful run 41699047504, head 65ccf5e5a608486077c51252a767bc7ef7741c31.
Local final: 876 tests / 116 files, 47.14 s, Node 22.23.4 on macOS arm64.
Hosted final uses ubuntu-latest / Node 22. Runner variation can change V8 branch
denominators; local counts are retained, not replaced by hosted estimates.

| Component | Branches: reproduced baseline → hosted final | Lines: reproduced baseline → hosted final |
| --- | --- | --- |
| desktop | 38/63 (60.32%) → 134/174 (77.01%) | 58/673 (8.62%) → 145/882 (16.44%) |
| mcp | 30/42 (71.43%) → 35/47 (74.47%) | 72/141 (51.06%) → 76/143 (53.15%) |
| publisher | 435/536 (81.16%) → 435/536 (81.16%) | 761/810 (93.95%) → 761/810 (93.95%) |
| payments | 1458/1710 (85.26%) → 1556/1805 (86.20%) | 2179/2206 (98.78%) → 2251/2278 (98.81%) |
| sdk | 324/357 (90.76%) → 362/390 (92.82%) | 308/342 (90.06%) → 316/350 (90.29%) |
| server | 2087/2400 (86.96%) → 2204/2523 (87.36%) | 2499/2655 (94.12%) → 2627/2781 (94.46%) |
| providers | 379/417 (90.89%) → 484/529 (91.49%) | 527/534 (98.69%) → 622/627 (99.20%) |
| shared | 191/205 (93.17%) → 194/208 (93.27%) | 426/426 (100.00%) → 431/431 (100.00%) |
| web | 1101/1392 (79.09%) → 1158/1445 (80.14%) | 1503/1777 (84.58%) → 1540/1814 (84.90%) |

component-map.json assigns all 170 product paths once. Payments includes store,
admission, agent keys, hire, x402, XRPL, escrow, assets, issued currency, and
publisher facilitator/journal/refund. Other financial integration paths remain
covered under their owning server/publisher component; none are excluded.
C1 compatible/json-decision modules belong to providers. Floors are exact
covered/total ratios, compared without rounding; every original floor is
retained. Payment branch floor is raised to 1486/1732 (85.80%) and independently
must be ≥85%. Missing product files and a one-branch loss fail contract fixtures.
The historical narrower server-payment heuristic was 551/650 (84.77%); the
current local cross-check is 562/659 (85.28%). It is not rounded into the gate
or substituted for the committed disjoint grouping.

V8 includes unexecuted product .ts/.tsx/.mjs files. Exclusions: declarations,
tests, desktop build tooling and generated dist/out. Unexecuted-file branch
denominators can be synthetic. Python, browser, native Electron, child processes
and installed-app execution are not merged into V8. Desktop percentages are
diagnostic; native launch/recovery/Keychain acceptance is a separate release
requirement and is not established by this lane.

Local check:fast is unchanged, including chaos:smoke. CI verify runs its
non-chaos equivalent: hygiene/lint/typecheck and the full Vitest suite once
with coverage, followed by coverage admission, SDK package and README checks.
Chaos runs the unchanged 20 episodes and four escrow probes in a parallel job.
Chromium e2e.spec.ts/a11y.spec.ts and Python run on every full-code change.
Foundation/perf/ux/ux2 remain runnable; only the first two browser specs are
initially required. Browser config clears inherited provider/seed credentials,
never activates .env, disables traces and retains fixture failure screenshots
and error context for seven days. No repository protection/security settings
were changed. Workers are bounded to three; job timeout is 15 minutes versus
the old serial job's ten, disclosed in the PR. No assertion or floor was lowered.

Always-reporting check requires changes and all four worker results. Failed,
cancelled, missing and unexpectedly skipped jobs refuse admission. Only detected
docs-only skips are admitted; unknown bases/fetch/diff failures run full checks.
Both sides of renames are examined. Workflow contracts import the actual CLI
helpers and inject each required job's failure; the aggregate command exits
nonzero for each. Shared-only, Python-only and docs-only triggers are covered.

Hosted comparison uses gh run list / gh run view timestamps and job records in
ci-jobs.json. Latest comparable main run 41697524722 at the integration
SHA took 278 s wall; its serial check took 274 s, omitted browser
and skipped Python. This PR took 249 s wall (target ≤339 s).
Wall means createdAt → updatedAt, including scheduling. Single observations,
not p95 or isolated causal proof: the PR adds coverage, browser, Python,
negative-path tests and consumer recovery to the main verification workload.

| PR job | Duration | Result |
| --- | ---: | --- |
| changes | 11 s | success |
| python | 38 s | success |
| chaos | 112 s | success |
| verify | 207 s | success |
| browser | 84 s | success |
| check | 20 s | success |

All six jobs ran and reported success. Whole-job RSS is unavailable and is not
inferred. Maximum reported per-iteration chaos child RSS:
323825664 → 318672896 bytes. These are fresh-child metrics,
not retained-engine soak memory. Both runs retained 20 episodes / four escrow
probes with zero double charges or invariant violations. No OOM was observed.
The older successful 350 → 291 s observation is retained under
historicalComparisons rather than relabeled as this final integration.

Actual fail-closed receipts are retained in ci-jobs.json: run 41690272807
refused the server ratchet; 41691867205 refused web coverage on hosted Node 22
versus local Node 26; 41693484395 failed three browser scenarios after #345.
Each required aggregate failed. Floors remained unchanged. Refusal/environment
label cases fixed the first two; final local verification matches Node 22.
The C1 integration initially refused 455/507 provider branches. Eight additional
B-owned fixture/transport tests preserve its original floor by covering failed,
malformed, oversized, absent/aborted identity and invalid-relevance paths, public
metadata projection and separate credentials. No server or SDK runtime edits.

The browser failure exposed a #345 consumer regression: durable DONE snapshots
of 266655, 266655 and 281277 bytes exceeded the 262144-byte SSE cap, leaving
Searching visible. Explicit user scope approval allowed src/api.ts recovery.
On stream error or five-second snapshot stall it GETs only the existing run ID,
serializes reads, ignores stale event/revision/money/receipt state and aborts on
unsubscribe. It never admits another run or creates an idempotency identity.
Six unit recovery tests cover races/identity/cleanup; the eighth required
browser test completes an oversized terminal state and reloads the same run
with exactly one admission and unchanged receipts/spend. The existing stream
adapter test now uses matching run identities and waits for a failed recovery
read before its error callback; no prior assertion was removed.

Final integrated local check:fast: 876 tests / 116 files (43.95 s), unchanged
20 chaos episodes / four escrow probes (44.499 s), zero double charges or
invariant violations. Chromium: eight passed (19.1 s), zero serious/critical
axe findings. Python: 17 passed (2.59 s). Clean npm ci, SDK package inspection
and generated README checks passed. The local coverage SHA is recorded in
coverage-final.json; its dirty flag reflects the previous report artifact only.
Later evidence-only commits do not change product, test or runner execution.

CONTRIBUTING documents commands/equivalence. docs/running.md is deferred under
the ownership override. Tooling friction with required fields is kept in the
B-owned feedback-fragment.md; docs/BUILDER-FEEDBACK.md remains E-owned. The
single dated SFF line is added last after a fresh rebase. Final PR-head hosted
admission is checked independently before squash merge.
