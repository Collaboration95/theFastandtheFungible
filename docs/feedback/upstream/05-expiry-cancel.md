# Escrow expiry does not return funds automatically

**draft, not filed** — owner-only filing.

## Reproduce

From this checkout after `npm ci` (Node 22+):

```sh
node scripts/repro/05-expiry-cancel.mjs
```

Pinned dependency: x402-xrpl 0.3.4 (lockfile). No wallet, signing, funding or submission.
Offline only; historical observations are evidence replay, not a fresh network measurement.

## Finding, workaround and proposed change


- Date / class: 2026-11-03; Observed Testnet.
- Pinned package/source: Committed escrow-273.md and corresponding public JSON at this repository revision; official Testnet issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV where applicable.
- Evidence / reproduction: [record](../../evidence/escrow-273.md); Failed-proof escrow stayed locked through 120-second deadline; explicit EscrowCancel returned 29988 of 30000 drops after fee.
- Workaround: Durable CANCEL_DUE with ledger-time ticks and terminal fee headroom.
- Suggested fix: Document expiration versus validated cancellation and reserve liquidity.
- Severity: Medium.
- Mainnet consequence: Recovery availability and liquidity matter before real-money use; mainnet untested.

## Scope

No mainnet incident claimed. Please document or provide conformance coverage for this boundary.
