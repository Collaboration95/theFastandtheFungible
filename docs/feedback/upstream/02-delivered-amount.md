# Document exact delivered-amount checks and negative issued-asset vectors

> **Target:** `t54-labs/rlusd-cli` · **Status:** ready to paste, not filed (owner-only, #265 B1) · **Labels:** none.
> Copy the H1 as the issue title and everything below the rule as the body.
> Note for the owner: the x402-xrpl SDK source is unpublished (npm 0.3.4 has no repository field); ask maintainers to route this to its owner.

---

## Summary

For issued-currency (RLUSD-style) payments, the transaction's `Amount` or API v2 `DeliverMax` does not prove what was delivered: partial payments and path conversions can deliver less, or a different issuer. A verifier must compare the **validated** `meta.delivered_amount` (currency, issuer, exact decimal). We could not find a published negative test vector for this in the RLUSD or x402 materials.

## Environment

- Node 22.13+; xrpl.js 4.7.0; x402-xrpl 0.3.4 (lockfile); fixtures only.
- Official Testnet issuer `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV` for the real RLUSD payment the fixture is shaped from.

## Steps to reproduce

```sh
gh repo clone Collaboration95/theFastandtheFungible researchagent-repro
cd researchagent-repro && git checkout d38fe39e && npm ci
node scripts/repro/02-delivered-amount.mjs
```

The script takes a real validated issued-currency payment, then mutates `delivered_amount` three ways (smaller value, wrong issuer, unavailable) and checks the verifier rejects each.

## Expected

A reference client or example that accepts an issued-asset payment verifies `delivered_amount` currency, issuer and exact decimal value, and rejects `tfPartialPayment` and conversion fields.

## Actual

`Amount`/`DeliverMax` alone accepts underpayment. Our fixtures for underpayment, wrong issuer and unavailable delivery are rejected only because we compare `delivered_amount`. **Code-derived and offline: no live attack was observed.** Evidence: [rlusd.md](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/rlusd.md).

## Workaround we use

Reject partial-payment and conversion fields; compare validated `delivered_amount` currency, issuer and exact decimal (no floats).

## Proposed fix

Publish negative issued-asset conformance vectors (underpaid, wrong issuer, partial payment, missing `delivered_amount`) next to the successful-payment example.

## Scope and limits

No mainnet incident claimed. The integrity risk of accepting an underpayment applies on any network.
