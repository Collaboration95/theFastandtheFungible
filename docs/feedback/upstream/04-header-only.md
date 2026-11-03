# Header-only v2 challenge is not retried

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
node scripts/repro/04-header-only.mjs
```

Pinned dependency: x402-xrpl 0.3.4 (lockfile). No wallet, signing, funding or submission.
Offline only; historical observations are evidence replay, not a fresh network measurement.

## Finding, workaround and proposed change


- Date / class: 2026-11-03; Observed offline and exploratory Testnet.
- Pinned package/source: x402-xrpl 0.3.4; npm source commit and hosted facilitator revision unknown.
- Evidence / reproduction: [record](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/starter-kit-interop.md); x402Fetch returned unpaid 402 when challenge was only PAYMENT-REQUIRED.
- Workaround: Mirror the challenge into JSON.
- Suggested fix: Read v2 header first and report unsupported challenge layouts.
- Severity: Medium.
- Mainnet consequence: Valid header-only sellers become unreachable; no mainnet incident observed.

## Scope

No mainnet incident claimed. Please document or provide conformance coverage for this boundary.
