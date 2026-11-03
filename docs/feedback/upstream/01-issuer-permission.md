# Issuer permission blocks RLUSD escrow

**draft, not filed** — owner-only filing.

## Reproduce

Use Node 22+ and a clean public ResearchAgent checkout pinned to the repro source:

```sh
gh repo clone Collaboration95/theFastandtheFungible researchagent-repro
cd researchagent-repro
git checkout d38fe39e
npm ci
```

Then run:

```sh
node scripts/repro/01-issuer-permission.mjs
```

Pinned dependency: x402-xrpl 0.3.4 (lockfile). No wallet, signing, funding or submission.
Offline only; historical observations are evidence replay, not a fresh network measurement.

## Finding, workaround and proposed change


- Date / class: 2026-11-03; Observed flags + document-derived refusal.
- Pinned package/source: Committed rlusd.md and corresponding public JSON at this repository revision; official Testnet issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV where applicable.
- Evidence / reproduction: [record](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/rlusd.md); Issuer Flags 2174353408 lacked AllowTrustLineLocking on 2026-11-03; predicted tecNO_PERMISSION was never submitted.
- Workaround: Use official RLUSD exact with cooperative refund; refuse token escrow.
- Suggested fix: Publish network AND issuer preflight, with dated flags.
- Severity: High.
- Mainnet consequence: Amendment enablement alone cannot authorize token escrow; mainnet issuer permission unmeasured.

## Scope

No mainnet incident claimed. Please document or provide conformance coverage for this boundary.
