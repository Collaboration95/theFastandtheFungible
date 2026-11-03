# Required fast verification — 4 November 2026

Local evidence uses synthetic providers, generated throwaway signing keys,
simulated settlement and in-memory ledgers. No live provider or Testnet calls.
Integration baseline: ec97bfdfe38e61b1b1b3fed6a1b4d3546052927c.
Node v26.3.1, macOS arm64, three Vitest workers, shared host.
The first fresh collection retained 744/744 tests in 100 files (47.13 s).
After adding coverage/CI contract tests and completing runtime .mjs inclusion,
the ratchet baseline retained 770/770 tests in 102 files (50.84 s).
Payment negative-path tests were added after that baseline.

coverage-baseline.json and coverage-final.json contain raw covered/total branch
and line counts; component-map.json assigns every included path once. Payments
includes the store, admission, agent keys, hire, x402, XRPL, escrow, asset and
issued-currency paths. Other publisher/server financial integration paths remain
included under their owning component. No financial file is excluded.
coverage-floors.json preserves exact baseline line and branch ratios and raises
the payment branch floor to the achieved result (always at least 85%).
New files are discovered from disk; a missing report entry fails admission.

V8 includes unexecuted product .ts/.tsx/.mjs files, excluding declaration files,
tests, desktop build tooling and generated dist/out. Unexecuted files can have
synthetic branch denominators. Python, browser, native Electron, child processes
and installed-app execution are not merged into V8. Desktop percentages are
diagnostic only: native launch/recovery/Keychain acceptance is a separate
release requirement, not established by this lane.

Local check:fast remains unchanged, including chaos:smoke. CI verify runs the
same hygiene/lint/typecheck/unit collection once with coverage, followed by
coverage admission, SDK package and generated README checks. Chaos runs its
unchanged 20 episodes plus four escrow probes in a separate parallel job.
Chromium e2e/a11y and Python SDK jobs are required for every full-code change.
All four results feed the always-reporting required check. Only intentional
docs-only skips are accepted. Unknown bases fall back to full verification.
The workflow's actual detector/evaluator is imported by failure-injection tests.

Only e2e.spec.ts and a11y.spec.ts are initially required; foundation/perf/ux/ux2
remain runnable. Browser config clears inherited keys/tokens/seeds/secrets and
does not activate .env; screenshot/error-context diagnostics use fixture data,
with traces disabled to avoid recording headers. Seven required browser tests
passed locally (16.0 s), including zero serious/critical axe findings; all five
Python tests passed (3.61 s).

ci-jobs.json records a recent successful main run and this PR's own hosted run,
including exact SHA, timestamps, wall time and job durations. Hosted RSS is not
reported by Actions and is not inferred. The 339 s target is an optimization
target, not permission to remove gates. docs/running.md is deferred because
Lane A owns it; CONTRIBUTING.md documents the commands and gate equivalence.

Final integrated local coverage collection: 835/835 tests, 109 files, 45.57 s
on Node 22.23.4, macOS arm64. Integration includes main
21b2a1edfae98e7ab9b63a34943372331c94ba70 (Lanes A/E); the baseline remains ec97bfd.
Payments: 1458/1710 → 1551/1802 branches; all component ratios pass their
original floors. The payment floor remains 1486/1732, above 85%.
Baseline configuration/contract tests were uncommitted, marked dirty in JSON.
Final tested SHA is in coverage-final.json. Later evidence-only commits do not
change product code or test execution. Component mapping includes A's new files.

The first hosted run (41690272807) failed the server branch ratchet; browser,
Python and chaos passed and the required check correctly failed. This is actual
hosted fail-closed evidence, in addition to injected contract cases. Floors
were retained; publisher refusal/telemetry-isolation tests were added. Coverage
summary artifacts now expose raw counts even on admission failures.

The second hosted run (41691867205) passed all unit tests but refused the web
branch ratio on Node 22. Compared with local Node 26, App.tsx had two extra
uncovered V8 branches. Private-mode and unconnected environment-label tests
were added; no floor was lowered. Final local collection now uses Node
22.23.4 to match CI's major. Baseline remains the original Node 26 ratios.
Worker jobs have a 15-minute execution bound (old monolithic job: 10 minutes)
for fresh browser/coverage/package setup; assertions and floors are unchanged.
