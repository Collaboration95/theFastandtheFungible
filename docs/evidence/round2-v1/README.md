# Lane V1 · key reveal on first touch · 4 November 2026

Fresh XRP Testnet execution, no real value. Synthetic articles, fixture research
and decision providers. Recorded through `make testnet ARGS="--capture --key-reveal"`
using isolated faucet wallets, never `.env`. Wallet material remains ignored.

AlphaLeak intentionally refuses signed delivery requests. Policy cancels after
validated ledger time passes CancelAfter and returns all 30,000 principal drops;
24 drops of create/cancel fees remain paid. The capture harness injects a labelled
fixture quarantine after cancellation and resumes the existing policy loop.
This fixture intervention is not automatic production no-show reputation scoring
or a public UI resume control. The Fab Floor then publishes K through its own
EscrowFinish, buyer policy decrypts and grants the delivery, and the engine writes
a cited fixture answer. Only existing policy transaction code submits purchases
and cancellation. No real money or mainnet.

| Operation | Hash | Ledger | Fee drops |
|---|---|---:|---:|
| key reveal: EscrowCreate | `888B84B5747ADA606C0DEA6C5D078FE8B620D9B8D9C243BB812579607B0B8E83` | 22055028 | 12 |
| EscrowCancel (writer no-show) | `68D9259F24DFB6DA173AD7FDF2F36C990AA80123648A2875C9AF7492DEE9C785` | 22055062 | 12 |
| key reveal: EscrowCreate | `4E66526A0E9E3D5690F9361874736A2AF21662EE599BAC9E431F94CEA06000CE` | 22055064 | 12 |
| EscrowFinish (key published) | `2C4710E977710F7D89EC6B0B7996859227A02A2547C4F321093E4FE2A43076ED` | 22055066 | 423 |

The public post-grant `proof.json` includes the now-published key, signed quote,
manifest and ciphertext. No unrevealed no-show key or wallet secret is exported.
`source.json` pins the commit containing transaction facts; the trace's source
SHA identifies the capture base with the lane implementation uncommitted.

Ciphertext before the grant stays quarantined. A missing GRANT trace event in
the key-reveal path was discovered by the unchanged replay provenance audit and
fixed in `server/escrow.ts`; restart retries emit only one grant event.
Early exploratory captures are excluded from completed-run evidence. Some were
aborted with Testnet objects still locked; those are not claimed as refunded.

Browser proof uses the bounded, read-only ledger WebSocket verifier. It decodes
Fulfillment, compares sha256(K) with the validated create Condition, binds the
ciphertext commitments to the create memo, hashes ciphertext, and authenticates
AES-GCM decryption plus plaintext SHA-256. It establishes cryptographic delivery,
not article truth. Missing history and mismatches show explicit failures.

Validation: `npm run check:fast`; `npm run build:demo`;
`npx playwright test --config tests/playwright/demo.config.ts`;
`npx playwright test --config tests/playwright/ledger.config.ts`;
`python3 -m pytest packages/sdk-python`. Python: 222 passed. Replay raw-premium
and every-prefix grant/citation audits pass, including the new trace. Live browser
verification also passes against s.altnet. No gate or threshold was loosened.

Demo JS+JSON: **1,040,773 bytes**, below 2,000,000; lossless gzip encoding of raw traces uses the browser decompressor.
