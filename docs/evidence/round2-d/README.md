# Lane D: local artifact and browser acceptance

4 November 2026. Fixture providers, fictional corpus, simulated settlement only.
No registry publication, release/tag, signing, live provider or Testnet action.

`make release-artifacts` builds independent SDK 1.0.0, Python 1.0.0 and MCPB
app-version artifacts into `dist/release/`. The companion consumer script installs
normal npm dependencies without repository symlinks, installs the wheel into a
fresh venv, and boots the extracted MCPB. Each asks the pricing/margins fixture
with an oversized budget twice under one idempotency key; it checks the same run,
one VERIFIED intent, one receipt, the enforced 200-minor cap, and each cited
passage against the engine's delivered spans. Temporary consumers use port 0.
The Python offline verifier remains repository-backed.

`consumer-results.json` and `artifact-manifest.json` identify the exact locally
accepted bytes and source commit. They are historical local evidence, not the
final merge SHA or registry acceptance. CI builds and accepts fresh files at the
PR/merge/tag SHA; the tag publisher downloads those exact accepted files rather
than rebuilding. The manifest records build provenance; the separate receipt
records consumer acceptance bound to the manifest hash.

Commands (all passed locally unless a later log says otherwise):

- `npm run build`
- `npx vitest run tests/browser-demo.test.ts tests/release.test.ts tests/mcp-bundle.test.ts tests/release-artifacts.test.ts`
- `npx playwright test tests/ux.spec.ts tests/ux2.spec.ts tests/e2e.spec.ts tests/a11y.spec.ts`
- `npm run test:demo`
- `make release-artifacts`
- `node scripts/check-release-consumers.mjs --manifest dist/release/manifest.json`
- `npm run hygiene`
- `npm run check:fast`

Raw UC1–UC3 snapshots retain their historical source SHA/date. Raw paid content
must have a VERIFIED intent, grant and GRANT event; nested bodies must belong to
delivered content. Staged prefixes additionally enforce grant/citation boundaries.
Browser smoke covers UC3 and UC2, and UC1 is checked by the raw/prefix tests.
No fixture trace recapture was needed. JS+JSON bytes are recorded in demo-audit.

Ledger HTML remains lane E's unchanged file. The header validator explicitly
validates its existing navigation without the new demo entry; E can refresh its
own header after this merge. This compatibility exception does not omit its
header or brand checks. Mac links select the latest release page until future
releases contain stable architecture aliases and desktop-manifest.json.

Release helper accepts a day or explicit SemVer, never edits versions or pushes
main, and requires a clean merged SHA with successful CI before a new current
tag. Historical backfill semantics remain tested; no historical tag was changed.
Unsigned is the reusable workflow default. Only an explicit owner-dispatched
signing input exposes signing setup. No signing path was executed here.

The first final-head hosted verification (6bad2b6e, run 41703318583) rejected
publisher branch coverage: 434/535 versus the preserved floor 435/536. Node 26
local coverage had passed; Node 22 reproduction also exposed the adjacent web
ratchet after the terminal palette change. Added guide-example parsing and
unsafe-metadata rejection checks plus explicit replay-terminal Stop and
pending/refused/rejected refund rendering checks. No floor or gate was lowered.

A local browser rerun under coverage contention exposed a readiness race: Vite
answered before the API, the first health request was refused, and the initial
preset stayed disabled. Playwright now waits for the proxied /api/health rather
than the HTML shell. This strengthens startup admission; no timeout was raised.
