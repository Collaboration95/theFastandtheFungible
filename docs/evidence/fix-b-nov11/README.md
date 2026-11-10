# FIX-B · proof of refusal inside the Mac app · 11 Nov 2026

Sweep findings S3 (P1), S17 and S16 (proof chip at 390). The Mac app is the owner's possible on-stage demo in Testnet mode, and the two newest proof features did not work in it.

## What was wrong (observed on `origin/main` f4a8fb93)

- `/proof/<id>` arrived with two policies stacked: the page's own nonce-based one and the shell's `script-src 'self'`. The browser applies both, so the page's inline script was blocked and "Verify on XRPL in your browser" did nothing.
- The renderer could not open a Testnet socket (`connect-src 'self'`, and the request filter cancelled everything outside `app://`), so the in-app "Verify in your browser" card could not read the ledger either.
- "Open proof page" went nowhere (window-open and navigation both swallowed). "Copy link" copied `app://researchagent/proof/…`, which nobody else can open.
- The proof page said "13 checks passed · 4 need the ledger" and, after the check, "All 15 checks passed" (13 + 4 ≠ 15), and dropped its environment chip at 390 px.

## What changed

- `desktop/policy.mjs`: `responseHeaders()` serves a proof page with its own policy alone, but only when `acceptableProofCsp()` finds it deny-by-default (`default-src 'none'`, script and style from this origin or a nonce, data images, the two Testnet nodes in `connect-src`, no wildcard, no `unsafe-*`); every other response still gets the shell's policy added. `CSP` gains exactly `wss://s.altnet.rippletest.net:51233` and `wss://clio.altnet.rippletest.net:51233`; `allowedRequest()` lets exactly those two origins (WebSocket, root path) through and cancels everything else.
- `desktop/main.mjs`: "Open proof page" opens `/proof/<32 hex>` in its own window (one per proof); that window cannot navigate anywhere else, not even into the app.
- `src/components/ShareProof.tsx`: with no public address (the app, a local run) there is no URL and no "Copy link", only "Open proof page" and "Download proof card". Hosted keeps both.
- `server/proof-page.ts`: one count ("13 of 17 checks passed when shared" before the check, "15 of 17 checks passed" after, with "Skipped here: writer credentials and historical origin" named); the chip shows "Testnet demo · no real value" on a phone; a downloaded card without a public origin no longer links to a page that is not there.
- `desktop/proof-smoke.mjs` (new step of `make desktop-smoke`, or `node desktop/smoke.mjs --proof`), and `desktop/smoke.mjs` selectors for the UI-2 "Export report" menu, stale since UI-2.

## Evidence, labelled

Real: the built Mac app (`node desktop/download.mjs && node desktop/build.mjs`, launched from `desktop/dist` with isolated user data), its engine in fixture mode, a decline asked through the app's own UI, the share flow, the proof window, the server's policy header, the renderer's WebSocket, the verifier chunk, and the shell's real CSP and request filter.
Stand-ins: the simulated rail never anchors, so the finished decline is promoted to "anchored" with a **synthetic** transaction (`tests/helpers/stand-in-anchor.ts`), and the "Testnet node" is a local TLS WebSocket server answering read-only `tx` lookups for it (Chromium resolves the public hostnames to it with `--host-resolver-rules` and trusts only its key). No wallet, key or Keychain was used.

| | |
|---|---|
| [desktop-share-ready.png](desktop-share-ready.png) | the app after sharing: "Open proof page" and "Download proof card", no `app://` link, no "Copy link" |
| [desktop-proof.png](desktop-proof.png) | the proof page in its own window (1000 px) |
| [desktop-proof-verified.png](desktop-proof-verified.png) | after "Verify on XRPL in your browser": "15 of 17 checks passed", skipped checks named, one total |
| [desktop-proof-390.png](desktop-proof-390.png) | the same window at 390 px: the chip is kept, in its short form |
| [desktop-settings.png](desktop-settings.png) | Settings in the Mac app |
| [desktop-proof-smoke.json](desktop-proof-smoke.json) | what the node saw (only `tx`, only the two hosts) and which attempts were blocked |
| [desktop-live-testnet.json](desktop-live-testnet.json) | `DESKTOP_PROOF_LIVE=1`: the shell's renderer, no stand-in, asked the real public node for the recorded real refusal's anchor (`B08899058C99…`) and got `validated` at ledger 22223096 |

Before the fix the same step fails at "Open proof page" (no window opens); run against the old `main.mjs` and `policy.mjs` on 11 Nov.

## Reproduce

```sh
node desktop/download.mjs && node desktop/build.mjs                                  # stages desktop/dist
DESKTOP_EXECUTABLE=$PWD/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron DESKTOP_APP_PATH=$PWD/desktop/dist \
  DESKTOP_EVIDENCE_DIR=docs/evidence/fix-b-nov11 node desktop/smoke.mjs --proof      # add DESKTOP_PROOF_LIVE=1 for the real node
npx vitest run tests/desktop.test.js tests/refusal-proof.test.ts tests/share-proof.test.tsx
npx playwright test --config tests/playwright/hosted.config.ts tests/proof-of-refusal.spec.ts
```
