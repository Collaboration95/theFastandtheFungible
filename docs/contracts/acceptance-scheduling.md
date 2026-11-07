# Local release acceptance scheduling

`node scripts/final-acceptance.mjs` retains the schema-1 report, exact artifact
hashes, installed consumer receipts, independent verifiers and native arm64
recovery evidence. It runs the soak alone, then uses four concurrent tasks on the declared local host.
Sibling subprocesses use niceness 10; the timing-sensitive soak retains normal
priority. This is scheduling priority, not an exemption from any measured gate.
All providers are fixtures and settlement is simulated. This does not publish
or sign anything. `scripts/release.mjs` requires a successful `local-gate` status
for the merged SHA; the hosted tag workflow independently admits its exact
artifact bytes and still publishes both arm64 and x64 DMGs.

The soak invocation and comparator are unchanged: 2,000 measured asks, 200
warmups, concurrency one, 10,000 historical runs with 60 events each, the burst
probe, and 20 restarts. RSS slope, median, maximum, loop p99 and latency p95
retain their existing limits. A concurrent miss remains a failed acceptance;
there is no automatic retry that turns the original miss into a pass.
The default isolates the soak. `--concurrent-soak` is an explicit contention experiment;
`--isolated-soak` remains an alias for the default.
Use `--serial` for a sequential diagnostic, or `--quick` for a rehearsal that
cannot qualify as full acceptance. Measurements and misses are retained in
[CI-speed evidence](../evidence/ci-speed/README.md).

The graph distinguishes ordering from admission. An explicit UI build prevents the packaged-app unit smoke from being skipped
on a fresh checkout. Coverage's MCP bundle test,
the app browser build, desktop staging, and release artifact construction all
write under `dist`. They run in that order. Other tasks, including full chaos,
Python and replay browsers, can overlap. Browser groups use separate output
directories under the existing excluded test-results area, so generated bundles
cannot enter a concurrent source lint scan. Failed semantic dependencies skip their consumers and remain
failed; an ordering edge alone does not suppress independent evidence.
Fail-fast drains all work already started before writing the final result.

`--reuse scratch/final-acceptance-<timestamp>/acceptance.json` admits only passed
non-soak steps from the exact clean SHA/tree on the same OS/CPU/runtime and
installed dependency identity, less than 24 hours old. It checks every saved
log hash and recursively fingerprints release assets, the complete app bundle,
DMGs, native recovery evidence and app manifest, including modes and symlinks.
A failed or missing required step, dirty or changed source, altered artifact,
quick rehearsal or identity mismatch refuses reuse. The source report and hash
remain in the new receipt; reused rows are explicit. The soak and live site
probes always execute afresh. `--skip-soak` can prepare the other checks without
claiming acceptance; a subsequent explicit reuse can establish acceptance only
if the fresh full soak passes. A prior failure is retained as its own report.
Changes to source invalidate this cache; a squash with a different SHA also
requires fresh consumer provenance. Full cold acceptance and a prepared-tree
retry are reported separately.

Two redundant executions are removed from acceptance: coverage already runs
the complete unit suite, and the 200-episode seed-279 chaos workload includes
the 20-episode smoke prefix and its escrow probes. The `check-fast` report row
requires hygiene, lint, typecheck, coverage and full chaos to pass. No unit
assertion or fault is removed. Coverage floors are unchanged.

Local Intel download/packaging is explicit via `--all-arch`; it never provided
native Intel execution evidence on this arm64 host. Hosted release packaging
continues to produce both architectures. The report labels Intel native
acceptance as pending instead of implying that a cross build established it.
