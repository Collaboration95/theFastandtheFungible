# Local release procedure

Automatic hosted tests and release publishing are off (10 Nov 2026). Manual CI,
Testnet boot and optional desktop signing remain dormant owner capabilities.
`npm run site:publish` and gh-pages serving are unchanged.

Use an Apple Silicon Mac, supported Node (22.13+; `.nvmrc` recommends 22), Python
with venv/pytest, installed Playwright Chromium, and authenticated `gh` with release
write access. Install with `HUSKY=0 ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` and
`npx playwright install chromium`; no `.env` or model/wallet credentials are
needed. Python build tooling and Electron downloads require network access;
fixture tests do not spend money. Keep the host idle for the isolated soak.

1. Merge the version bump through a PR. Root, SDK, Python (PEP 440), MCP bundle
   and server metadata versions must agree. Confirm the exact merged SHA has a
   green `local-gate` (the post-merge gate publishes it).
2. Check out that exact clean commit. Create an annotated local version tag,
   e.g. `node scripts/release.mjs 1.1.0 "Finals release"` (no `--push`). Existing
   annotation notes are preserved by publication. Lightweight tags are rejected.
3. `make release TAG=v1.1.0 ARGS=--dry-run OFFSET=1200` runs every release stage,
   verifies manifests, stages assets and prints timings. It never pushes a tag or
   creates a release. A clean branch rehearsal may be outside main ancestry;
   that fact is recorded and publication still requires a fresh run after merge.
   Use a unique local `-rc.N` version/tag for throwaway rehearsals, with all
   package versions matching. Remove only that temporary tag after rehearsal.
4. `make release TAG=v1.1.0 OFFSET=1200` repeats verification, requires ancestry
   of freshly fetched origin/main and green merged `local-gate`, pushes the exact
   annotated tag and calls `gh release create --verify-tag`. It never bumps a
   version, pushes main or publishes to npm/PyPI/MCP Registry.

The publisher runs `gate --full`, then `final-acceptance --all-arch`: coverage
floors, 200-episode chaos, isolated 2,000-ask soak, native arm64 recovery, both
DMG builds, artifact construction, five clean installed consumers and receipt
verifiers. The gate separately covers key-reveal, judge browsers, packed SDK,
README drift and runner tests. Full suites run at releases/breaking changes;
ordinary `make ship-check` keeps the existing unit invariant suite and routing.
No coverage, performance, leak or hard-gate threshold is relaxed.

Admission requires exact clean HEAD/tag/version, source SHA/tree agreement in
both local receipts, every required successful check, matching consumer hashes
and manifest hashes, and the exact DMG bytes accepted by the rehearsal. Artifacts
are copied once into `dist/local-release/assets` and hashed again before remote
writes. Failure stops publication; it never substitutes GitHub job results.
`release-publication.json` records source, timings, hashes and dry-run/main
ancestry state. The acceptance and gate receipts are attached with the packages.

Assets: versioned arm64/x64 DMGs and `ResearchAgent-unsigned-{arm64,x64}.dmg`
aliases, desktop hash manifest, SDK npm tgz, MCP/app npm tgz, Python wheel/sdist,
MCPB, server.json, package manifest, consumer results and local admission receipts.
Prereleases set `--prerelease --latest=false`; an older stable backfill cannot
replace Latest (only the newest stable Git version tag can). Release notes retain
the tag annotation and explain unsigned installation and fixture evidence.

Cross-built x64 packaging does not establish native Intel runtime acceptance.
Linux/container boot, supported Python-version checks, native Intel execution,
real Testnet probes and owner signing/notarization are separate evidence classes.
Do not claim those from an offline fixture receipt. Needs-human work stays in #265.
