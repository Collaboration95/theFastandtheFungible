# Tooling observations — 4 November 2026

Observed locally while implementing H1: `startEngine` isolates the engine in a worker, and tsx also creates a loader worker. Treating every worker as an engine gave false identity changes in an initial discarded 4-ask probe. Workaround: metric preload identifies only `workerData.apiPort` engine workers. Suggested improvement: a public engine diagnostics/identity seam. Severity: low; mainnet impact: none observed (offline harness only). Evidence: same-engine harness guard and its identity regression test; source SHA is retained in the baseline JSON.

Observed initial launcher exit: an asynchronous background command without an explicit shell `wait` left an incomplete data root. The accepted command uses `caffeinate -dims ... &` followed by `wait $!`, and a fresh root. Incomplete probes were discarded from measured evidence. Severity: low; suggested fix: document the waiting shell lifetime; mainnet impact: none.
