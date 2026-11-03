# Official RLUSD funding requires authenticated access

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
node scripts/repro/06-funding-auth.mjs
```

Pinned dependency: x402-xrpl 0.3.4 (lockfile). No wallet, signing, funding or submission.
Offline only; historical observations are evidence replay, not a fresh network measurement.

## Finding, workaround and proposed change


- Date / class: 2026-11-03; Observed Testnet HTTP.
- Pinned package/source: Committed rlusd.md and corresponding public JSON at this repository revision; official Testnet issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV where applicable.
- Evidence / reproduction: [record](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/rlusd.md); Official mint endpoint returned 401 despite activated account and trust line; CLI faucet only discovers token funding.
- Workaround: Historical bounded native Testnet DEX acquisition; separate provisioning from purchases.
- Suggested fix: Document authenticated native XRPL faucet access and typed asset results.
- Severity: Medium.
- Mainnet consequence: No mainnet API or FX inference; onboarding/redemption remain separate.

## Scope

No mainnet incident claimed. Please document or provide conformance coverage for this boundary.
