# Settled invoice consumption obstructs recovery

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
node scripts/repro/03-invoice-consumption.mjs
```

Pinned dependency: x402-xrpl 0.3.4 (lockfile). No wallet, signing, funding or submission.
Offline only; historical observations are evidence replay, not a fresh network measurement.

## Finding, workaround and proposed change


- Date / class: 2026-11-03; Code-derived; reproduced offline.
- Pinned package/source: x402-xrpl 0.3.4; npm source commit and hosted facilitator revision unknown.
- Evidence / reproduction: [record](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/starter-kit-interop.md); Pinned t54 middleware consumes the invoice; a repeated signed payment can be refused while delivery recovery is needed.
- Workaround: Retain the same signed blob; ResearchAgent supports same-blob redelivery.
- Suggested fix: Persist settlement-to-delivery mapping with idempotent replay.
- Severity: Medium.
- Mainnet consequence: New signing after ambiguity risks a second charge; none observed here.

## Scope

No mainnet incident claimed. Please document or provide conformance coverage for this boundary.
