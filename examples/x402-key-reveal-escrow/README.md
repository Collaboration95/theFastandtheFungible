# x402 key-reveal escrow on XRPL

**XRPL Testnet only · faucet XRP · synthetic article · no real value.**

A copyable seller and buyer in one 191-line JavaScript file, using only Node,
`xrpl@4.7.0` and the Starter Kit payment integration `x402-xrpl@0.3.4`.
Copy this directory anywhere; it imports no ResearchAgent code, model, wallet
service, Express app or facilitator. The lockfile pins the dependencies.

## Run in about 60 seconds

Node ≥22.13 and access to the public Testnet faucet and WebSocket are required.
From this directory:

```sh
npm ci && OFFSET=1400 XRPL_KEY_REVEAL_TESTNET=1 npm start
```

The command explicitly authorizes two fixed 1,000-drop escrow principals
(0.002 Testnet XRP total) and at most 1,000 drops per transaction in fees.
It creates two fresh faucet wallets, binds an ephemeral loopback HTTP port,
prints four explorer links, verifies delivery and cancellation, then exits.
It reads no wallet seed or API key from the environment and never prints keys.
The offset is accepted by the environment; this example always uses port 0.
Faucet and ledger latency can take longer than a minute; it never substitutes
a simulated success. Keep faucet use modest.

## What happens

1. Buyer requests `/article?intent=deliver`. Seller returns HTTP 402 with the
   same challenge in the body and `PAYMENT-REQUIRED`. It includes only encrypted
   content, AES-GCM metadata, a plaintext hash, buyer, price and expiry.
2. Seller holds a random 32-byte key K. The offer's Condition is the serialized
   PREIMAGE-SHA-256 crypto-condition `A0258020 || SHA256(K) || 810120`.
   **Condition is not a bare digest.** The fulfillment is `A0228020 || K`.
3. Fixed buyer policy checks Testnet, seller, amount, buyer and bounded expiry.
   It signs one `EscrowCreate` with that Condition and `CancelAfter`; its Memo
   commits to the canonical challenge, including invoice and encrypted envelope.
4. After validation, buyer sends that same signed create blob in
   `PAYMENT-SIGNATURE`. Seller checks its hash, validated `tesSUCCESS`, exact
   terms and live escrow object, then submits `EscrowFinish` with K.
5. Buyer reads the finish directly from the ledger, requires validated success
   and the original owner/sequence, checks SHA256(K) against the saved on-ledger
   Condition, authenticates/decrypts AES-GCM and checks the plaintext hash. Only
   then does it expose a verified grant's plaintext. HTTP never delivers K.
   Replaying the same create returns the same finish without another charge.
6. A separate `withhold` intent deliberately gets no key. Buyer waits for
   **validated ledger close time** to pass `CancelAfter`, submits `EscrowCancel`,
   and verifies its balance increased by the full principal less cancellation fee.
   Expiry permits cancellation; it does not submit it or return funds itself.

## Trust model and boundaries

Delivery is atomic via key reveal: the ledger releases payment only on a valid
fulfillment, which publicly reveals the decryption key. This holds for an honest
envelope prepared under that key. The ledger does **not** inspect ciphertext,
guarantee truthful content, enforce article quality, or judge a broken promise.
A malicious seller can commit to garbage or an envelope that cannot decrypt.
Once finish succeeds, `CancelAfter` cannot reverse payment. A refund then needs
a **writer-signed Payment**; a writer can refuse. This minimal example does not
implement that cooperative refund. A seller who never finishes leaves principal
recoverable by explicit cancellation after the deadline; fees are never refunded.

K is public after finish. Anyone with the ciphertext can decrypt it then. Use a
fresh key/envelope per buyer and intent, and never treat this as lasting DRM.

This is an **experimental `key-reveal-escrow` scheme**, not t54 `exact` escrow
support or a standardized x402 extension. We reuse the actual pinned package's
header codecs and signed-blob envelope builder. Its `XRPLPresignedPaymentPayer`,
`requirePayment` and hosted exact facilitator require Payment transactions and
must not settle these offers. No facilitator is called here. See the
[t54 scheme](https://xrpl-x402.t54.ai/docs/xrpl-scheme),
[XRPL escrow semantics](https://xrpl.org/docs/concepts/payment-types/escrow) and
[EscrowCancel](https://xrpl.org/docs/references/protocol/transactions/types/escrowcancel).

Ripple's Phase 1 Starter Kit is a curated toolkit, not one npm package. The
payment dependency is pinned to the same `x402-xrpl@0.3.4` used by the parent
repository's bidirectional native-XRP interop tests. No RLUSD, IOU, mainnet,
model, external adoption or upstream acceptance is claimed.

This is a single-process teaching example: buyer and seller have separate
wallets but share a process and a trusted loopback transport. Offers and signed
blobs live in memory. Production needs authenticated signed offers, durable
intent/nonce and signed-blob journals, bounded recovery, reserve checks, network
timeouts and cancellation recovery. On an uncertain submit, query the original
hash; never create a replacement payment. On interruption, inspect the printed
create hashes and cancel unfinished escrows after their deadlines. A new run
creates new wallets/intents; it is not crash recovery for an earlier run.

## Tests

```sh
npm test                                      # offline crypto / policy / SDK boundaries
OFFSET=1400 XRPL_KEY_REVEAL_TESTNET=1 npm test  # also runs both paths on real Testnet
```

The root `npm run check:fast` runs the offline tests and explicitly skips its
live Testnet test unless `XRPL_KEY_REVEAL_TESTNET=1`. Offline tests cover a wrong
key/Condition, altered authentication tag and plaintext commitment, budget and
network rejection, missing invoice binding, codec preservation and the exact
payer's refusal of this custom scheme. Live checks include replay and actual
principal recovery. Synthetic crypto fixtures do not establish ledger success.

## Recorded Testnet run · 10 Nov 2026

The completed live test and the four independently validated transaction hashes
are recorded below. Public Testnet history may be pruned or reset.

`OFFSET=1400 XRPL_KEY_REVEAL_TESTNET=1 node --test example.test.mjs`:
**3 passed, 0 skipped, 0 failed; live subtest 49.3 s** (49.7 s including offline
checks). A separate read-only `tx` query confirmed all four were validated
`tesSUCCESS`. Fees: create 12 drops each, finish 423 drops, cancel 12 drops;
459 drops burned total. Delivery paid 1,000 drops; the withheld 1,000 drops
returned in full before cancellation fee.

| Step | Transaction / explorer |
|---|---|
| Withheld create | [25CC953B9B337D8A45499433A8BD55FA928FA81C33E1735BD407699887052124](https://testnet.xrpl.org/transactions/25CC953B9B337D8A45499433A8BD55FA928FA81C33E1735BD407699887052124) |
| Delivery create | [C7BCC2963C3FBAAC370AD192E75019A6FDAB62FB2F7922BE5DD7825E89792FB3](https://testnet.xrpl.org/transactions/C7BCC2963C3FBAAC370AD192E75019A6FDAB62FB2F7922BE5DD7825E89792FB3) |
| Delivery finish / public key | [770580CE68742B35268EEAF82F74B8D19B2863E0CD9A12F3911ED3E5C602AC73](https://testnet.xrpl.org/transactions/770580CE68742B35268EEAF82F74B8D19B2863E0CD9A12F3911ED3E5C602AC73) |
| Withheld cancel / principal back | [B901A74FF2A8741816AE2D5660E2FA7F44AB69E963C5D88620AF3644D4AB6D5D](https://testnet.xrpl.org/transactions/B901A74FF2A8741816AE2D5660E2FA7F44AB69E963C5D88620AF3644D4AB6D5D) |

Expected output (hashes and timings change on each run):

```text
XRPL TESTNET · faucet XRP · synthetic content · no real value
withhold create: https://testnet.xrpl.org/transactions/<create hash>
deliver create: https://testnet.xrpl.org/transactions/<create hash>
deliver finish: https://testnet.xrpl.org/transactions/<finish hash>
Verified grant: sha256(K) matches on-ledger Condition; AES-GCM and plaintext hash OK
Synthetic article: keys travel on XRPL.
withhold cancel: https://testnet.xrpl.org/transactions/<cancel hash>
CancelAfter: 1000 drops principal returned; transaction fees are not refunded. RESULT PASS
```

Exploratory runs before this complete run funded disposable wallets and created
one escrow before exposing an RPC annotation comparison bug. Those faucet
allocations and transaction fees are additional to the final-run totals above.
No private wallet material is committed. The preliminary escrow was cancelled
after expiry; its create and cleanup receipt are recorded below.

Preliminary create:
[ACE5E576450557CF5CBDA57B6C1A273480180CF3919098207A13010A38968566](https://testnet.xrpl.org/transactions/ACE5E576450557CF5CBDA57B6C1A273480180CF3919098207A13010A38968566).
Cleanup cancel (a third-party faucet wallet can submit cancellation for the
original owner):
[9E06AA77E120B46467CEAF7B12C802B20CDCB77E783D9B10E6934AE7B220854D](https://testnet.xrpl.org/transactions/9E06AA77E120B46467CEAF7B12C802B20CDCB77E783D9B10E6934AE7B220854D),
validated `tesSUCCESS` in ledger 22218670, fee 12 drops. Principal went back to
the original buyer, not the cancellation submitter.
