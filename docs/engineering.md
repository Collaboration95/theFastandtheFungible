# Engineering: tests, gates and releases

How the code is checked and shipped. Counts are from a local run on 7 Nov 2026 at
`a4514881` plus the v1.0.0 release-prep changes unless a line says otherwise; the
[progress page](https://collaboration95.github.io/theFastandtheFungible/progress/) has the
current, query-defined counts.

- **Tests.** 1,369 TypeScript tests in the post-#398 integration check
  ([retained evidence](evidence/refactor-b/README.md)) and 258 Python tests
  ([#393](https://github.com/Collaboration95/theFastandtheFungible/pull/393)); timings depend
  on the host. `npm run check:fast` also runs hygiene, lint, typecheck and 20 chaos episodes
  with four escrow probes. Chromium end-to-end and axe accessibility specs run locally when
  affected.
- **Coverage floors.** Nine components each have an exact covered/total floor that may not
  fall; payments branches must also stay at or above 85% (86.2% when measured).
  [Method and numbers](evidence/round2-b/README.md).
- **Merge gate.** `npm run gate -- --publish` on the clean PR head publishes the
  `local-gate` commit status; a PR merges only on a green local gate. It routes each change
  to the checks it can affect and always runs hygiene. [Contract](contracts/local-gate.md).
- **Hosted CI (historical).** `changes` decided whether the full set ran; then `verify`,
  `chaos`, `browser`, `python` and `artifacts` ran in parallel, and an always-reporting
  `check` job refused a failed, cancelled, missing or unexpectedly skipped one. Five
  successful integration runs had a median wall time of 262 s (7 Nov, #396; branch/PR
  sample). One failed attempt is retained ([measurements](evidence/refactor-b/README.md)).
- **Release admission.** A tag publishes only if its commit is on `main`, it equals the
  package version, its checks passed on the same SHA, and every artifact hash matches the
  manifest. The SDK tarball, wheel and MCPB must each pass a clean-install consumer: cited
  passages, one receipt, one intent, an idempotent retry and the cap preserved. The
  publisher uploads those accepted bytes without rebuilding
  ([`release-contract.mjs`](../scripts/release-contract.mjs), [evidence](evidence/round2-d/README.md)).
- **Chaos and soak.** Real SIGKILLs with zero double charges; the loaded-host soak failure
  is kept beside the quiet-host pass ([soak](evidence/soak-nov4-ab/README.md),
  [chaos](evidence/chaos-279.md)).
- **Repo hygiene.** `npm run hygiene` checks community files, every relative Markdown link
  and anchor, secret-shaped strings, the shared site header, the generated progress page
  and that every marked fact matches [`submission/facts.json`](submission/facts.json).

[Contributing](../.github/CONTRIBUTING.md) · [Security policy](../.github/SECURITY.md) ·
[Runbook](RUNBOOK.md).
