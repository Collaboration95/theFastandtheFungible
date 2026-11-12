# Key-Reveal Escrow Scheme for XRP Ledger (`key-reveal-escrow`)

**Proposal draft. Not filed, registered, published or adopted by x402.**

Prepared 12 November 2026. Format follows the generic scheme overview and XRPL
binding in `coinbase/x402/specs/schemes/exact/`, read-only at commit
`0e6e8c55d86b4f14234fb6e49a4052074fb93e57`. This document defines a separate scheme;
it does not change `exact` or claim compatibility with an exact-payment payer.

## Summary and motivation

A buyer can inspect encrypted content before transferring principal to a seller.
A conditional XRPL escrow binds payment to revelation of the content key. If the
seller does not finish, ledger expiry permits the buyer to cancel and recover
principal. Network fees remain spent. This is useful for static articles,
precomputed API results and agent-readable evidence whose ciphertext can be
committed before payment. It does not prove content quality or correctness.

## Scheme name

`key-reveal-escrow`

## Payment model

| Aspect | Rule |
| --- | --- |
| Authorization | Buyer policy approves amount and signs one EscrowCreate per invoice |
| Submission | Buyer submits EscrowCreate and presents its signed blob as proof |
| Settlement | Seller verifies the validated escrow and submits EscrowFinish |
| Finality | Validated successful EscrowFinish, not HTTP success or an unvalidated reveal |
| Expiry | Buyer submits EscrowCancel after CancelAfter, if finish has not won |
| Fees | Buyer pays create/cancel fees; finish submitter pays finish fee |
| Replay | Network escrow owner/sequence plus persistent network:create-hash binding |

The initial reference profile supports native XRP on Testnet only (`xrpl:1`).
Mainnet (`xrpl:0`), Devnet and issued currencies are outside this profile. The
engine's separate TEST-SGD token-escrow path is not evidence of RLUSD support.

## Protocol flow

1. Buyer requests a resource with its classic address and stable request intent.
2. Seller generates a fresh 32-byte key K and a 12-byte AES-GCM IV, encrypts the
   immutable resource, and persists the key, invoice and complete challenge.
3. Seller returns HTTP 402, mirroring base64 JSON `PaymentRequired` in
   `PAYMENT-REQUIRED` and the JSON body. The response contains ciphertext only.
4. Buyer checks policy budget, destination, asset, network, request identity,
   expiry, encryption metadata and maximum transaction fees. A language model
   cannot override that policy. The buyer may decline without signing.
5. Buyer signs and persists one EscrowCreate, submits it, and waits for validated
   success. Its memo commits to the entire challenge, including ciphertext.
6. Buyer retries the original resource with `PAYMENT-SIGNATURE` carrying the
   accepted requirements and that same signed blob.
7. Seller independently verifies the validated create and escrow node against
   the stored invoice, binds its hash once, and persists one signed finish before
   submission. No fulfillment-bearing simulation or logging is permitted.
8. Seller submits EscrowFinish containing the fulfillment for K. On validated
   success it returns the finish hash and `PAYMENT-RESPONSE`; it never sends K or
   plaintext through the resource HTTP response.
9. Buyer obtains the validated finish independently from XRPL, verifies its
   identity, condition and success, derives K, and authenticates/decrypts the
   original ciphertext. Only then does a conforming buyer release plaintext to
   its agent or caller.
10. A lost HTTP response repeats the original intent and signed create. The
    seller returns the recorded finish outcome without creating a second charge.

## `PaymentRequirements`

A challenge contains one supported entry in `accepts`:

```json
{
  "x402Version": 2,
  "resource": { "url": "https://seller.example/article" },
  "accepts": [{
    "scheme": "key-reveal-escrow",
    "network": "xrpl:1",
    "asset": "XRP",
    "amount": "1000",
    "payTo": "<seller classic address>",
    "maxTimeoutSeconds": 60,
    "extra": {
      "invoiceId": "<unique persisted invoice>",
      "buyer": "<buyer classic address>",
      "condition": "A0258020<32-byte SHA-256(K), uppercase hex>810120",
      "cancelAfter": 850000060
    }
  }],
  "extensions": {
    "keyReveal": {
      "ciphertext": "<uppercase hex>",
      "iv": "<12-byte uppercase hex>",
      "tag": "<16-byte uppercase hex>",
      "plaintextHash": "<32-byte SHA-256(plaintext), uppercase hex>"
    }
  }
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `scheme` | string | Exactly `key-reveal-escrow` |
| `network` | CAIP-2 string | Exactly `xrpl:1` in the reference profile |
| `asset` | string | Exactly `XRP`; no decimal metadata or conversion |
| `amount` | string | Positive integer drops; buyer checks its policy limit |
| `payTo` | string | Seller's classic destination address |
| `maxTimeoutSeconds` | integer | Advertised lifetime, reference 24–300 seconds |
| `extra.invoiceId` | string | Immutable unique invoice binding |
| `extra.buyer` | string | Escrow owner, which signs the create |
| `extra.condition` | DER hex | PREIMAGE-SHA-256 condition, cost 32 |
| `extra.cancelAfter` | integer | Absolute Ripple-epoch ledger time, not Unix time |
| `extensions.keyReveal` | object | AES-256-GCM envelope and plaintext commitment |

A client MUST check remaining time against the latest validated ledger time;
it MUST NOT assume the full advertised lifetime remains. The seller MUST use a
fresh per-invoice key and IV and MUST retain the exact challenge for retries.

## `PaymentPayload`

`PAYMENT-SIGNATURE` is base64 JSON:

```json
{
  "x402Version": 2,
  "accepted": { "scheme": "key-reveal-escrow", "...": "the complete original accepts entry" },
  "payload": { "signedTxBlob": "<original buyer-signed EscrowCreate hex>" }
}
```

The abbreviated `accepted` above is explanatory; the actual payload MUST echo
all advertised terms, including `extra`. The signed EscrowCreate MUST contain
`Account=buyer`, `Destination=payTo`, the exact native `Amount`, `Condition` and
`CancelAfter`, a positive normal `Sequence`, and exactly one memo:

```json
{ "Memo": { "MemoData": "<uppercase SHA-256 of RFC 8785 canonical JSON of complete PaymentRequired>" } }
```

The reference offers use ASCII URLs, integer timestamps and hex-encoded binary
data, with no floating-point values. Implementations MUST agree on canonical
JSON; ordinary serialization order is not an invoice commitment.

## Verification rules

The seller/facilitator MUST enforce:

- Supported v2 envelope, exact equality to the stored accepted terms, and a
  recognized invoice and resource identity. Never trust an arbitrary payee or
  invoice supplied only by the caller.
- Decode the blob, compute its transaction hash, fetch that exact transaction
  from the configured Testnet node, require `validated=true` and metadata
  `tesSUCCESS`, and compare the decoded and validated signed fields.
- Match type, owner, destination, amount, condition, cancel time, sequence and
  memo. Reject FinishAfter, tags, TicketSequence, NetworkID, unsupported flags
  and transfer/conversion variants. This narrow profile supports ordinary
  sequence-based native-XRP escrow only.
- Before first finish, fetch the validated escrow entry for `(buyer, Sequence)`
  and compare all economic terms. A missing or uncertain escrow never grants
  plaintext or authorizes a new create.
- Bind `(network, create hash)` to one invoice atomically. The same invoice may
  reuse only the original create hash. Concurrent identical retries share the
  same result; a different create or changed ciphertext is refused.

A conforming buyer independently checks the validated create and finish, escrow
owner and sequence, finish Condition, fulfillment DER shape
`A0228020<32-byte K>`, `SHA-256(K)` against the original condition, AES-GCM tag,
and plaintextHash. A hash returned by the seller alone is not ledger proof.

## Settlement rules and response

The seller signs an EscrowFinish with the original owner/sequence, condition
and fulfillment; its own policy caps the fee. It persists the signed blob and
hash before submitting and never signs a replacement after an uncertain
submission. The seller can re-submit the original blob or look up its outcome.
An unresolved finish retains exclusive ownership of its wallet sequence. A
seller MUST NOT allocate a potentially conflicting signature for another invoice
until the original finish is reconciled; reference packages refuse it.

After validated success:

```json
{
  "success": true,
  "transaction": "<validated EscrowFinish hash>",
  "network": "xrpl:1",
  "payer": "<escrow owner>"
}
```

The resource response additionally returns `createHash` and `finishHash`. Pending
or rejected settlement MUST NOT be represented as success. Persisted invoice,
create and finish bindings survive restarts. Reference packages support one
process per journal/wallet; scaled implementations require shared atomic state
and coordinated seller sequencing. An ambiguous original finish stays pending
until reconciled; its key MUST NOT be rotated to make a retry pass.

## Security considerations

### Key reveal and atomicity

A successful ledger finish both transfers escrow principal and records the
preimage. This binds payment to release of the committed decryption key, not to
useful, truthful or exclusive content. A malicious seller can encrypt junk;
the buyer's quality/refund policy remains separate. Plaintext hashes authenticate
the seller's committed bytes, not their truth.

A signed finish discloses K before validation to any observer who sees the
transaction. Near expiry a failed finish or a cancel race can disclose the key
without settlement. Sellers MUST allow sufficient finish headroom (the reference checks more than
eight seconds against validated ledger time before and after autofill), protect
pre-submission material and avoid claiming unconditional off-ledger atomicity.
Conforming clients quarantine plaintext until successful validated finish, but
this does not prevent a malicious client from using an observed pending key.
After reveal, the key is public and ciphertext can be copied.

### Refund on expiry

CancelAfter makes cancellation eligible; no automatic transfer occurs. The
buyer or a recovery worker MUST submit EscrowCancel and verify its success.
Principal is returned only if cancellation wins; create/finish/cancel fees are
not refundable. The buyer must reserve liquidity, owner reserve and fee headroom
until finish or cancel is validated. Lost journal state can strand recovery.

### Front-running, replay and network routing

An observer can submit a valid fulfillment or finish first, but cannot change
the escrow destination, principal or condition. Clients therefore verify the
original escrow identity rather than trusting only the finishing account.
A finish/cancel race resolves on ledger; an HTTP timeout proves neither outcome.
The reference HTTP adapters return their own recorded finish. If a third-party
finish wins, reconcile the original escrow identity and validated outcome; the
reference does not provide a history indexer to discover another submitter's
finish hash. Never create a replacement escrow to recover HTTP delivery.

A replay cannot transfer the same escrow twice. Application invoices and
challenge commitments prevent using one escrow for a different resource or
ciphertext. Persist invoice bindings rather than deleting them on settlement.
Standard XRPL networks omit signed NetworkID; use separate Testnet accounts,
verify node network_id=1 and never route these signatures to mainnet.

### Operational bounds

Treat all writer text as untrusted data. Bound challenge and signature sizes,
invoice creation, content size, connection concurrency and fee authority at the
application edge. This reference mirrors ciphertext in the 402 header and body;
hex plus base64 requires about 2.67 times plaintext size before metadata.
Implementers MUST qualify client and intermediary header limits for their chosen
content bound. The short fixture acceptance does not qualify large articles;
a body-only or content-addressed ciphertext variant needs explicit negotiation.
Protect journals containing unrevealed keys and signed blobs;
do not log or simulate fulfillment-bearing transactions. Rate limits and payer
budget checks are application policy, not authority granted by this scheme.

## Reference implementations and evidence

- `examples/x402-key-reveal-escrow/`: original standalone Testnet flow.
- `packages/seller-core/`, `packages/seller-express/`, `packages/seller-hono/`:
  unpublished Node protocol core and adapters with durable journals.
- `packages/seller-fastapi/`: unpublished typed Python implementation.
- `scripts/reach/acceptance.mjs`: isolated local package install, Python HTTP
  buyer, Hono seller, validated reveal/decrypt, retry and expiry/cancel proof.
- `docs/evidence/reach/REACH.md`: measured results and exact transaction hashes.

The paid-answer hosted `/v1/ask` uses the existing `exact` hire service and is a
separate protocol from these key-reveal article packages.

## References

- [Upstream XRPL binding read for format](https://github.com/coinbase/x402/blob/0e6e8c55d86b4f14234fb6e49a4052074fb93e57/specs/schemes/exact/scheme_exact_xrpl.md)
- [XRPL EscrowCreate](https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate)
- [XRPL EscrowFinish](https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish)
- [XRPL EscrowCancel](https://xrpl.org/docs/references/protocol/transactions/types/escrowcancel)
- [JSON Canonicalization Scheme, RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)
