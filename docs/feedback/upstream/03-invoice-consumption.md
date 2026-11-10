# Document same-payment replay after invoice consumption

> **Target:** `t54-labs/rlusd-cli` · **Status:** ready to paste, not filed (owner-only, #265 B1) · **Labels:** none.
> Copy the H1 as the issue title and everything below the rule as the body.
> Note for the owner: the x402-xrpl SDK source is unpublished (npm 0.3.4 has no repository field); ask maintainers to route this to its owner.

---

## Summary

In x402-xrpl 0.3.4 the Express middleware consumes the invoice when payment settles. If the response is lost after settlement, a client that retries with the **same** signed payment is refused because the stored requirements are gone, even though delivery still needs recovering. Integrators who then sign a new payment risk a second charge.

## Environment

- Node 22.13+; x402-xrpl 0.3.4 (lockfile; source commit and hosted facilitator revision unknown); offline.

## Steps to reproduce

```sh
gh repo clone Collaboration95/theFastandtheFungible researchagent-repro
cd researchagent-repro && git checkout d38fe39e && npm ci
node scripts/repro/03-invoice-consumption.mjs
```

The script loads the pinned default `InMemoryInvoiceStore`, puts an invoice, consumes it and shows it is gone, and checks the middleware calls `invoiceStore.consume(invoiceId)`.

## Expected

After settlement the middleware keeps a settlement-to-delivery mapping so a repeated request with the same signed blob receives the resource (or a clear "already settled" receipt) without new signing.

## Actual

Consumed invoices are deleted from the default store, so replay is refused and there is no record to recover delivery from. **Code-derived and reproduced offline against the store class; no live double charge was observed.** Evidence: [starter-kit-interop.md](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/starter-kit-interop.md).

## Workaround we use

The client persists the signed blob before sending and re-sends the same blob; our publisher supports same-blob redelivery.

## Proposed fix

Persist settlement receipts keyed by invoice and signed-payment hash, and make replay idempotent. Document the crash window between ledger validation and delivery.

## Scope and limits

No mainnet incident claimed. Applies wherever a client can re-sign after an ambiguous response.
