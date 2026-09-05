# FairCut x402 contract

FairCut pins one provider challenge shape for the protected clean master.
The route is:

```text
GET /api/providers/mika-direct/assets/sku_dawn-current_12s_clean/master
```

Before payment it returns HTTP `402` and a `PAYMENT-REQUIRED` header. The
header value is base64-encoded JSON with this shape:

```json
{
  "x402Version": 2,
  "accepted": [{
    "scheme": "exact",
    "network": "xrpl:1",
    "asset": "XRP",
    "payTo": "<provider payee>",
    "amount": "8000",
    "maxTimeoutSeconds": 600,
    "extra": {
      "sourceTag": 804681468,
      "invoiceId": "<unique invoice>",
      "resourceSku": "sku_dawn-current_12s_clean",
      "rightsPolicyHash": "<frozen policy digest>",
      "assetHash": "<frozen asset digest>"
    }
  }],
  "quote": {
    "schemaVersion": "faircut.quote.v1",
    "id": "quote_dawn-current_v1",
    "invoiceId": "<same invoice>",
    "providerId": "mika-direct",
    "resourceSku": "sku_dawn-current_12s_clean",
    "network": "xrpl:1",
    "scheme": "exact",
    "asset": "XRP",
    "amountDrops": "8000",
    "payTo": "<same payee>",
    "sourceTag": 804681468,
    "rightsPolicyHash": "<same policy digest>",
    "assetHash": "<same asset digest>",
    "expiresAt": "<ISO-8601 expiry>",
    "maxTimeoutSeconds": 600,
    "x402Version": 2,
    "canonicalHash": "<SHA-256 quote hash>"
  }
}
```

The signer compares the challenge against the frozen eligible intent. A
fixture uses the explicit `X-FairCut-Fixture-Payment: SIMULATED_SETTLED`
evidence header. A live Testnet delivery uses
`PAYMENT-SIGNATURE: <validated transaction hash>` only after independent XRPL
reconciliation. Recorded Testnet mode is read-only and cannot be used as a
fresh settlement.
