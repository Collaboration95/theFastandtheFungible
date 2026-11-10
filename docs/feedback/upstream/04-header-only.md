# x402Fetch returns the unpaid 402 when the v2 challenge is only in the PAYMENT-REQUIRED header

> **Target:** `t54-labs/rlusd-cli` · **Status:** ready to paste, not filed (owner-only, #265 B1) · **Labels:** none.
> Copy the H1 as the issue title and everything below the rule as the body.
> Note for the owner: the x402-xrpl SDK source is unpublished (npm 0.3.4 has no repository field); ask maintainers to route this to its owner.

---

## Summary

x402 v2 sellers may carry the payment challenge in a base64 `PAYMENT-REQUIRED` response header. `x402Fetch` from x402-xrpl 0.3.4 only reads the JSON body, so a header-only challenge is returned to the caller as an unpaid 402 with no diagnostic.

## Environment

- Node 22.13+; x402-xrpl 0.3.4 (lockfile); mocked transport, no wallet, no network.

## Steps to reproduce

```sh
gh repo clone Collaboration95/theFastandtheFungible researchagent-repro
cd researchagent-repro && git checkout d38fe39e && npm ci
node scripts/repro/04-header-only.mjs
```

```js
import { x402Fetch } from 'x402-xrpl'
const challenge = { x402Version: 2, accepts: [{ scheme: 'exact', network: 'xrpl:1', asset: 'XRP', amount: '1000', payTo: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', maxTimeoutSeconds: 60 }] }
const buyer = x402Fetch({ network: 'xrpl:1',
  fetchImpl: async () => new Response(null, { status: 402, headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge)).toString('base64') } }),
  paymentHeaderFactory: async () => { throw Error('must not sign') } })
console.log((await buyer('https://offline.invalid/article')).status) // 402, paymentHeaderFactory never called
```

## Expected

The v2 header is read first. The client either pays or fails with a message naming the unsupported challenge layout.

## Actual

Status 402 comes back, `paymentHeaderFactory` is never called (0 signs) and nothing says why. Observed offline and in an exploratory Testnet run. Evidence: [starter-kit-interop.md](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/starter-kit-interop.md).

## Workaround we use

Our publisher mirrors the header challenge into the JSON body.

## Proposed fix

Read `PAYMENT-REQUIRED` first (fall back to the body), and surface a diagnostic when neither layout parses.

## Scope and limits

No mainnet incident claimed. Header-only v2 sellers are unreachable from this client until fixed.
