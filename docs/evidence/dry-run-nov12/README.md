# Unsigned ledger dry runs · 12 November 2026

Run `node scripts/ledger-dry-run.mjs` (or repro 01 with `--live`). Public RPC only; nothing signed or submitted, no fees paid. Mainnet is read-only. TEST-SGD is our no-value Testnet stand-in for RLUSD.

| Network | Transaction | Verdict | Autofilled fee (drops) | Ledger index |
|---|---|---|---:|---:|
| Testnet | RLUSD | tecNO_PERMISSION | 10 | 22244249 |
| Testnet | TEST-SGD control | tesSUCCESS | 10 | 22244249 |
| Testnet | Dummy finish fee | tecNO_TARGET | 350 | 22244249 |
| Mainnet | RLUSD | tecNO_PERMISSION | 10 | 108262329 |

The Testnet creates use the same source, destination, value, deadline and condition; only currency/issuer change. The dummy finish tests fee autofill, not successful delivery: OfferSequence 1 names no escrow. Its 36-byte synthetic fulfillment is public test data.

We retain the signing fees: buyer 12 drops to lock; writer 423 to reveal (xrpl.js fractional formula and 1.2× cushion). rippled autofills 350 for the finish. A simulation is a ledger-state snapshot, not a guarantee of later submission.

[Raw requests and responses](result.json), including amendment status, issuer flags and ledger indexes. [Official simulate API](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/transaction-methods/simulate).
