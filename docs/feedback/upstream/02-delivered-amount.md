# Exact issued amount must mean delivered amount

**draft, not filed** — owner-only filing.

## Reproduce

From this checkout after `npm ci` (Node 22+):

```sh
node scripts/repro/02-delivered-amount.mjs
```

Pinned dependency: x402-xrpl 0.3.4 (lockfile). No wallet, signing, funding or submission.
Offline only; historical observations are evidence replay, not a fresh network measurement.

## Finding, workaround and proposed change


- Date / class: 2026-11-03; Code-derived; adversarial fixture proof.
- Pinned package/source: Committed rlusd.md and corresponding public JSON at this repository revision; official Testnet issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV where applicable.
- Evidence / reproduction: [record](../../evidence/rlusd.md); Amount/DeliverMax alone cannot prove exact delivered value; wrong issuer and partial payment fixtures are rejected.
- Workaround: Reject partial/conversion fields; compare validated delivered_amount currency, issuer and exact decimal.
- Suggested fix: Publish negative issued-asset conformance vectors.
- Severity: High.
- Mainnet consequence: Underpayment acceptance is an integrity risk on mainnet; no live attack observed.

## Scope

No mainnet incident claimed. Please document or provide conformance coverage for this boundary.
