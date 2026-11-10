# Public endpoints disagree on retained Testnet history; JSON-RPC over HTTP lacks CORS headers

> **Target:** `XRPLF/xrpl-dev-portal` · **Status:** ready to paste, not filed (owner-only, #265 B1) · **Labels:** none.
> Copy the H1 as the issue title and everything below the rule as the body.

---

## Summary

The same validated Testnet transaction hash resolved on some public endpoints and returned `txnNotFound` on another, and the two Ripple-operated HTTP JSON-RPC endpoints we tried send no CORS headers, so a browser page cannot call them. Builders have no published matrix of retention, transport and CORS support.

## Environment

- XRPL Testnet, read-only `tx` lookups, 2026-11-04; endpoints: `s.altnet.rippletest.net` (WebSocket 51233, HTTP 51234), Clio, and xrpl-labs. Node 22.13+; xrpl.js 4.7.0. No signing, funding or account queries.

## Steps to reproduce

```sh
gh repo clone Collaboration95/theFastandtheFungible researchagent-repro
cd researchagent-repro && git checkout d38fe39e && npm ci
node scripts/repro/07-endpoint-history.mjs
```

The script sends one HTTP JSON-RPC `tx` lookup for a committed hash to each of the three endpoints (reporting `error`, `validated` and `Access-Control-Allow-Origin`), then re-validates the committed ledger rows over the s.altnet WebSocket. It is read-only; availability can change.

## Expected

A hash that validated on Testnet resolves on every documented public endpoint, or the docs say how far back each retains history, which transports and CORS behaviour it supports, and where to find older transactions.

## Actual

- xrpl-labs returned `txnNotFound` for the committed RLUSD hash; s.altnet and Clio returned validated `tesSUCCESS`.
- A browser preflight to the Ripple JSON-RPC endpoint got a 400; a fresh HTTP comparison found no `Access-Control-Allow-Origin` on s.altnet or Clio. xrpl-labs advertises CORS but lacks these hashes.
- On 4 Nov all 13 hashes then committed validated 13/13 over the s.altnet WebSocket (the script now checks every committed row).
- This shows endpoint-specific availability, not a Testnet reset or a failed payment.
- Evidence: [live-validation.json](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/round2-p1/live-validation.json), [rpc-attempt.json](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/round2-e/rpc-attempt.json), [endpoint-comparison.json](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/round2-p1/endpoint-comparison.json).

## Workaround we use

Bounded WebSocket `tx` lookup on s.altnet, then Clio, then xrpl-labs; committed evidence is kept during outages; `txnNotFound` is reported as "pending", never as failed settlement.

## Proposed fix

Publish an endpoint matrix (retained ledger ranges, WebSocket and HTTP URLs, CORS), and state that `txnNotFound` does not prove a transaction never validated.

## Scope and limits

Mainnet endpoint selection carries an analogous risk, unmeasured. No mainnet incident claimed.
