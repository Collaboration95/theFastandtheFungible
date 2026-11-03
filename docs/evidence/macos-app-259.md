# Installed macOS app · #259 · 3 Nov 2026

Reachability proof, Apple Silicon / macOS 26.6. Build source `c2b24b2`, based on
`a4e27d3` (main). Final source rebase found #286 unmerged; remote backend and
publisher selection therefore remain disabled. This is a single-user local app.

- DMG: `ResearchAgent-0.4.0-arm64.dmg`, **136,647,266 bytes** / **130.32 MiB**.
- SHA-256: `a360e4cd66c5e34bad36c0a0b8b095b9cff9d909d1711920ce36af540f4e8f15`.
- Installed cold start: **2126 ms** from before Playwright process launch to an
  enabled engine-backed example button. Fresh empty app data; filesystem cache
  was not flushed, and automation overhead is included. One measured installed
  sample, not a percentile or first-ever Gatekeeper launch.
- Electron **45.2.1**, Node **24.22.1**, Chromium **156.0.8078.75**. Bundled Node
  loaded `node:sqlite`, XRPL, Orama and the fictional publisher without a rewrite.
  Minimum OS is **macOS 13** (the pinned Electron bundle's Info.plist).

## Reproduction and observed outcomes

`DESKTOP_VERSION=0.4.0 OFFSET=900 make dmg`; mount read-only with `hdiutil`, copy
ResearchAgent.app into `/Applications`, eject, then `OFFSET=900 make desktop-smoke`.
Two local DMG builds total: the first failed installed startup and was deleted;
the second is the measured artifact. The fixed package uses real files because
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

`npm run check:fast` passed after the source rebase: 546 tests, 67 files.
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
