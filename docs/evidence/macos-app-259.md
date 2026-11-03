# Installed macOS app · #259 · 3 Nov 2026

Reachability proof, Apple Silicon / macOS 26.6. Pre-merge installed artifact source `e339375`, based on `7807ce3` (main), built by [macOS validation run 41563657805](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/41563657805). This installed sample included #286 and #260; authenticated HTTPS remote mode and shared wallet controls are wired. This is a single-user local app.

- DMG: `ResearchAgent-0.4.0-arm64.dmg`, **136,597,522 bytes** / **130.27 MiB**.
- SHA-256: `ce7aa9a8b19f32a032500e4d96add94bb0c43e9ffbbff7ccc46d5db68adcd7d2`.
- Installed cold start: **2070 ms** from before Playwright process launch to an
  enabled engine-backed example button. Fresh empty app data; filesystem cache
  was not flushed, and automation overhead is included. One measured installed
  sample, not a percentile or first-ever Gatekeeper launch.
- Electron **45.2.1**, Node **24.22.1**, Chromium **156.0.8078.75**. Bundled Node
  loaded `node:sqlite`, XRPL, Orama and the fictional publisher without a rewrite.
  Minimum OS is **macOS 13** (the pinned Electron bundle's Info.plist).

## Reproduction and observed outcomes

`DESKTOP_VERSION=0.4.0 OFFSET=900 make dmg`; mount read-only with `hdiutil`, copy
ResearchAgent.app into `/Applications`, eject, then `OFFSET=900 make desktop-smoke`.
Two local DMG builds total (before the parallel #286 merge): the first failed installed startup and was deleted;
the second established installed operation. After #286 and #260 merged at the final fetches, the explicit validation tag built the updated artifact on macOS CI. That artifact was downloaded, installed and passed the same smoke, avoiding a third local DMG build. The fixed package uses real files because
ASAR is not a real working directory for utilityProcess. The worker is compiled
from the shared engine source, retaining startup and shutdown semantics.

The installed executable passed UC1 (free, 0 cents), UC2 (90 simulated cents,
one grant), UC3 (70 gross simulated cents, 30 refunded, two grants), printable
HTML report window, Settings IPC and shutdown with both listeners unreachable.
API/publisher use OS-assigned 127.0.0.1 ports, never the reserved demo ports.
A raw HTTP request with a foreign Host and a foreign-Origin mutation returned 403.
The smoke uses raw HTTP for Host spoofing because Node fetch did not transmit the
requested Host override; the rejection assertion was retained.

Renderer checks: context isolation, sandbox, no Node integration or require,
strict script/connect CSP, external fetch rejection, corpus path denial (403),
and desktop IPC denied to the research window. An inherited synthetic secret
canary appeared in neither Settings state, app data files nor captured logs.
No actual seed/provider credential was used in this smoke. A separate disposable
synthetic Keychain generic password was written over stdin, read back and deleted.
The custody/runtime limits are in desktop/README.md and contracts/SECURITY.md.

`npm run check:fast` passed with 577 tests in 71 files for this measured artifact.
Subsequent rebases onto payment recovery #287 and hire royalties #274 retain the shared worker
(including its async close); the combined source reruns `check:fast` and merge CI before merge. The release
workflow rebuilds the merged tag, and release-attached metrics identify its
separately installed sample.
No gate, leak threshold or test was loosened. The corpus-path expectation was
corrected from 404 to the stricter 403. Report URL tests now use a real URL-shaped
location and also reject a foreign app origin.

## Evidence and limits

[Installed UC2 screenshot](https://github.com/Collaboration95/theFastandtheFungible/releases/download/v0.4.0/macos-uc2.png)
· [raw smoke metrics](https://github.com/Collaboration95/theFastandtheFungible/releases/download/v0.4.0/macos-metrics.json).
Screenshots use reduced motion and wait for the final budget amount. Raw local
build/smoke logs and captures were retained under ignored desktop/evidence until
release upload. Binaries are release assets, never committed.

All research/settlement verification here used offline fixtures and SIMULATED
money, with no .env/provider inputs or ledger calls. A connected host was used;
this does not claim an OS network sandbox. No live Testnet settlement, provider
success, human usability acceptance, Developer ID signing, notarisation or
Gatekeeper acceptance was inferred. Signing/notarisation is implemented and
fail-closed when an identity exists; its unexercised owner setup is on #265.

The staged post-#286 smoke also passed UC1–UC3 through the authenticated proxy, direct unauthenticated mutation/MCP rejection (401), and the wallet-wide cap/status controls. Remote HTTPS credential/header validation uses offline transports; no deployed remote service was used.

Installer workflow validation caught and fixed a checksum-manifest parser error: Electron publishes binary-mode `*filename` records. Exact asset-name and SHA-256 verification remain required; no checksum check was bypassed (Actions run 41562353549).

The validation build exposed Electron Builder auto-publishing two bot-owned draft
v0.4.0 releases when GH_TOKEN was present (run 41562664758). Both unpublished
drafts were removed through gh; `desktop/build.mjs` now explicitly sets
`publish: 'never'`. Only the release workflow publishes after merge. This is a
packaging-side-effect fix; it does not change the engine or renderer code. The pre-merge installer is identified above by its exact SHA-256. The release
workflow rebuilds the merged tag; the attached release metrics record the final
installer measurement separately.
