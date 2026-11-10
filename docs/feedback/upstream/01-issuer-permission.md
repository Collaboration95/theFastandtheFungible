# Document issuer AllowTrustLineLocking preflight for RLUSD token escrow

> **Target:** `XRPLF/xrpl-dev-portal` · **Status:** ready to paste, not filed (owner-only, #265 B1) · **Labels:** none.
> Copy the H1 as the issue title and everything below the rule as the body.

---

## Summary

On XRPL Testnet the `TokenEscrow` amendment is enabled, but the official RLUSD Testnet issuer has not set `lsfAllowTrustLineLocking`. Token escrow for that issuer therefore cannot work, and nothing in the docs or tooling we found tells a builder to check the issuer flag. Amendment status alone suggests it will work.

## Environment

- Network: XRPL Testnet (network ID 1), read-only queries on 2026-11-03 and 2026-11-04.
- Issuer: `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV` (Ripple's documented Testnet RLUSD issuer).
- Node 22.13+; xrpl.js 4.7.0; x402-xrpl 0.3.4 (lockfile). No signing, funding or submission is needed.

## Steps to reproduce

```sh
gh repo clone Collaboration95/theFastandtheFungible researchagent-repro
cd researchagent-repro && git checkout d38fe39e && npm ci
node scripts/repro/01-issuer-permission.mjs
```

The script replays the committed observation offline. To re-observe: call `feature` on a Testnet server (`TokenEscrow` enabled), then `account_info` for the issuer and test `Flags & 0x40000000`.

## Expected

If the `TokenEscrow` amendment is enabled, a builder can tell from published guidance whether a given issuer's token can be escrowed, and how to check (issuer flag, not just amendment).

## Actual

- `feature` reports `TokenEscrow` enabled.
- `account_info` for the issuer (ledger 22058675, 2026-11-04) reports `Flags: 2174353408`, which does not include `0x40000000` (`lsfAllowTrustLineLocking`).
- Per XLS-85 an `EscrowCreate` of that token would be refused with `tecNO_PERMISSION`. **We predicted this and did not submit a rejecting transaction**, so this is observed flags plus document-derived refusal, not an observed failure.
- Evidence: [rlusd.md](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/rlusd.md).

## Workaround we use

Official RLUSD stays on the exact scheme with a cooperative refund; token escrow is refused in code. For escrow demos we use a labelled Testnet stand-in token from our own issuer with the flag set.

## Proposed fix

1. Publish a network **and** issuer preflight (amendment status plus issuer flag, with the date flags were read) in the token-escrow docs.
2. Say who can enable the flag and, for the official Testnet issuer, whether it will be set (`AccountSet` `SetFlag` 17).

## Scope and limits

No mainnet incident is claimed and mainnet issuer flags were not measured. Never infer mainnet permission from Testnet flags or amendment status.
