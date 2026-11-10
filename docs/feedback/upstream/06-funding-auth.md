# Document authenticated access for the RLUSD Testnet faucet (`mint-xrpl` returns 401) and what `faucet fund` returns

> **Target:** `t54-labs/rlusd-cli` · **Status:** ready to paste, not filed (owner-only, #265 B1) · **Labels:** none.
> Copy the H1 as the issue title and everything below the rule as the body.

---

## Summary

A fresh, activated native XRPL Testnet account with a validated RLUSD trust line could not obtain Testnet RLUSD from the official faucet endpoint, which answered 401. The CLI's `faucet fund` funds XRP and then points to the web faucet, so a script cannot get RLUSD without a signed-in session.

## Environment

- XRPL Testnet, 2026-11-03; issuer `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`; `@rlusd/cli@0.2.0` source at `155ab72076c9cb455a6c6c2d46254768e941193b` run with tsx (the npm package returned E404 on install); no signed-in session.

## Steps to reproduce

```sh
gh repo clone Collaboration95/theFastandtheFungible researchagent-repro
cd researchagent-repro && git checkout d38fe39e && npm ci
node scripts/repro/06-funding-auth.mjs
```

The script replays the committed observation. To re-observe: fund a fresh account, submit a `TrustSet` for the RLUSD currency and issuer, then `POST https://tryrlusd.com/api/mint-xrpl` with `{"address": "<fresh address>"}` and no session.

## Expected

A documented, scriptable way to obtain Testnet RLUSD for a native XRPL address (or a clear statement that sign-in is required), with a typed result.

## Actual

- `POST /api/mint-xrpl` → HTTP 401 `{"error":"Authentication required"}` (2026-11-03 05:42:46 UTC), after a validated `TrustSet`.
- `rlusd faucet fund --chain xrpl` funded 100 XRP, not RLUSD; after the trust line, a second call returned `action: claim_rlusd` and `faucet_url: https://tryrlusd.com/`.
- `GET /api/sponsored/status` returned 200 but listed only Sepolia/EVM networks.
- Current access policy is unmeasured; we do not claim it is still 401.
- Evidence: [rlusd.md](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/rlusd.md).

## Workaround we use

A bounded, self-directed Testnet DEX payment (SendMax 26 Testnet XRP, 2,000-drop fee cap, no partial flag) acquired 2 RLUSD, checked against validated `delivered_amount`. Provisioning is kept separate from product purchases.

## Proposed fix

Document that the web faucet needs sign-in and whether native XRPL is supported; return a typed, machine-readable result from `faucet fund`; consider a bounded developer faucet for native XRPL. Also: say whether `@rlusd/cli` is meant to install from npm (we got E404).

## Scope and limits

No mainnet API or FX inference. Onboarding and redemption on mainnet are separate questions.
