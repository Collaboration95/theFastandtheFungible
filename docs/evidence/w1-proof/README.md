# Proof of refusal (lane W1) · 11 Nov 2026

A declined, XRPL-anchored run, shared as a permalink anyone can open and re-check. Contract: [REFUSAL-PROOF.md](../../contracts/REFUSAL-PROOF.md).

## Two kinds of evidence, labelled

**1. Real XRPL Testnet (the `local-testnet-*` images).** Local app (`XDG_STATE_HOME=<throwaway> DEMO_PORT_OFFSET=2900 node --import tsx scripts/testnet-start.ts`): fixture models, isolated faucet wallets, real answer anchor. Question "Which Singapore banks are piloting RLUSD settlement in 2026?" → 12 paid articles judged, none bought, S$0.00. The anchor is a real Testnet transaction:
[B08899058C99D1BEA0190E83AD2AE7A7A20CAB202D63D78BFEE9593CC4B1303E](https://testnet.xrpl.org/transactions/B08899058C99D1BEA0190E83AD2AE7A7A20CAB202D63D78BFEE9593CC4B1303E), ledger 22223096 (if Testnet has been reset since, the link will no longer resolve).
"Verify on XRPL in your browser" on the proof page reported **All 15 checks passed** reading `s.altnet.rippletest.net` (read-only), at 1440 and 390 px. The Node verifier agrees on the same bytes:

```sh
npm run verify:answer -- docs/evidence/w1-proof/testnet-refusal.receipts.json --ledger --testnet
```

[`testnet-refusal.receipts.json`](testnet-refusal.receipts.json) is the sanitized bundle served at `/proof/<id>/receipts.json` for that run (free-tier sources and this run's own audit rows only).

**2. Hosted gateway, locally (the `hosted-*` images).** `tests/proof-of-refusal.spec.ts` on the `HOSTED=1` stack of `tests/helpers/hosted-stack.ts`: fixture models and the *simulated* rail, so nothing is anchored on its own. The spec promotes one finished decline to "anchored" through a test-only endpoint of the stack: **the anchor transaction in these images is synthetic, and the page's Testnet lookups are answered by a stand-in** (`page.routeWebSocket`), so "All N checks passed" there proves the page, the gateway and the verifier wiring, not the ledger. The environment indicator in the app shows "simulated payments" for the same reason. Not a deployment.

## Reproduce

```sh
npx vitest run tests/refusal-proof.test.ts tests/share-proof.test.tsx                      # sanitization, immutability, eligibility, hosted isolation, page, component
UPDATE_EVIDENCE=1 npx playwright test --config playwright.hosted.config.ts tests/proof-of-refusal.spec.ts   # hosted-* screenshots
node design/brand/build-proof-og.mjs                                                      # og-card.png (also public/og/refusal-proof.png)
```

## Files

| | |
|---|---|
| `local-testnet-app-decline-share-1440.png` | The decline view with "Share proof of refusal" (real Testnet run) |
| `local-testnet-app-share-confirm-1440.png`, `…-done-1440.png` | The explicit step, then the link, Copy link and Download proof card |
| `local-testnet-proof-1440.png`, `-390.png` | The public page |
| `local-testnet-proof-verified-1440.png`, `-390.png` | After "Verify on XRPL in your browser": All 15 checks passed |
| `hosted-app-*.png`, `hosted-proof-*.png` | Hosted gateway, stand-in anchor (see above) |
| `og-card.png` | The link-preview card, 1200 × 630: "Refused to spend · verified on XRPL", S$0.00. One static card; the question travels in each page's `og:description` |

## What the hosted spec checks

Ask → decline → (simulated: says why it can't be shared, no button) → anchored → Share needs a second, explicit step that names the question → Publish → the page opens in a fresh browser with **no cookies and no session** → metadata (`og:title`, a per-proof `og:description`, `og:image`) → verify in the browser → the card downloads with no script → 390 px: no horizontal scroll, axe clean (serious/critical) → another visitor can read the public link but gets 404 on the owner routes and 403 on a write. Unknown proofs show a same-design "This proof isn't here" page. Two-session isolation, immutability, sanitization (no paid text, no other session's rows, nothing from the other question), per-session caps and read rate limits are in `tests/refusal-proof.test.ts`.
