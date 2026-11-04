# Key-reveal escrow

**XRPL is our delivery channel.** Exchange of XRP payment for an article
key on XRPL Testnet. `make testnet` defaults to key reveal for its local writers
(including `.devcontainer/testnet`). Opt out with `ESCROW_MODE=payment make testnet`.
Other launches retain their existing settlement configuration. Set `ESCROW_MODE=key-reveal` on
buyer and publisher, opt the writer into `ESCROW_WRITERS`, and use the
`xrpl-testnet` rail with XRP. An unsupported writer is skipped without an exact
payment fallback. Existing `escrow-policy-v1` remains buyer-controlled.

The writer generates a fresh 32-byte key K and 12-byte IV per buyer and intent,
and AES-256-GCM encrypts the delivery JSON (body, passages, salts and identity).
The writer signs the escrow quote with its wallet key. The signed terms bind
buyer, intent, article version, passage-manifest root, XRP amount, CancelAfter,
PREIMAGE-SHA-256(K), ciphertext SHA-256, plaintext SHA-256, IV and GCM tag.
The existing passage manifest separately authenticates each salted passage.

```mermaid
sequenceDiagram
    participant W as Writer
    participant P as Buyer policy
    participant L as XRPL Testnet
    participant G as Grant / answer
    P->>W: Request quote for buyer + intent
    W->>W: Persist K, ciphertext and signed quote
    W-->>P: Signed commitments + quarantined ciphertext
    P->>P: Reserve budget; persist quote + exact create blob
    P->>L: EscrowCreate (Condition, CancelAfter)
    P->>W: Same signed create blob
    W->>L: Verify validated create and exact escrow object
    W->>W: Persist signed finish blob
    W->>L: EscrowFinish (Fulfillment encodes K)
    L-->>P: Validated successful finish, K and ledger index
    P->>P: Persist reveal; verify K; decrypt; verify commitments + passages
    P->>G: Verified grant; premium plaintext accessible; cited answer
    Note over P,L: No writer finish: after CancelAfter, policy submits EscrowCancel
```

## Gate 1 interpretation

The rule is **“no premium bytes before a grant.”** Ciphertext arrives before the
grant, but it is quarantined: never decrypted, never shown, and never given to any
model before the validated EscrowFinish reveals K. Premium **PLAINTEXT is
accessible only after the verified grant**. Decryption and proof checks run in the
private engine boundary after validation and before publishing the grant. This is
an explicit interpretation, not a loosening; no leak threshold is changed.

Snapshots, model contents, payment-row HTML, audit rows and ordinary receipt
exports contain neither ciphertext nor plaintext before the grant. Public quote
commitments contain hashes, IV and tag. Post-grant receipts intentionally include
the ciphertext and the now-public K for offline verification.

## Recovery and fraud

Buyer SQLite persists the signed quote and ciphertext before create signing,
and persists the exact signed create blob before submit. Writer SQLite persists
K before returning its quote, and the exact signed finish before submit. Retries
reuse those blobs. An expired writer signature is not replaced by a second
principal purchase: the buyer can cancel the original object after its deadline.

Recovery verifies the escrow object or searches validated terminal history; an
absent object without terminal history stays pending. It persists the validated
reveal before decrypting. A crash after create, observed reveal or stored grant
replays the same intent. The terminal receipt and intent update are atomic and
idempotent. CancelAfter is checked against validated ledger time, not wall time;
expiry permits cancellation and does not automatically return principal.

An invalid authenticated envelope or failed passage proof creates no accessible
grant. Payment has already completed: it remains charged, with status
`CLAIM_FAILED`, and uses the existing reputation rejection path. No unilateral
refund or new money flow is implied. Download the evidence from
`GET /runs/:id/intents/:intentId/key-reveal-proof.json` after validated release.
It contains the signed quote, passage manifest, ciphertext, K, create hash and
validated finish transaction. Normal API access rules apply. Before release this
endpoint refuses the request. Honest deliveries have the same downloadable proof.

## Receipts

Optional `proofs[].keyReveal` in the existing receipt bundle adds the signed
quote/envelope, key, create/finish hashes and reveal ledger index. TS and independent
stdlib Python verifiers verify the writer signature, K/Condition binding, GCM tag,
ciphertext and decrypted-byte SHA-256, delivered identity, receipt/quote binding,
and the existing salted passage hashes. Python's public-evidence AES implementation
has independent NIST known-answer tests. The old 177 conformance vectors are
unchanged; seven additive vectors cover valid delivery and changed key, Condition,
ciphertext, manifest, ledger index and signature.

Offline success checks cryptographic consistency, **not ledger finality**. The
bundled ledger index and transaction hashes require an independent ledger lookup
to establish that publication actually occurred. TS and Python `--ledger` add read-only s.altnet ledger checks for create,
finish/cancel, IOU settlement and key publication.

## Threat model and limits

| Asset | Key-reveal escrow on Testnet |
| --- | --- |
| XRP | ✓ Default |
| TEST-SGD (SGT) | ✓ Opt-in; our Testnet issuer; no real value; stand-in for RLUSD |
| Official RLUSD | ✗ Until its issuer enables AllowTrustLineLocking |

TEST-SGD · IOU issued by our Testnet issuer · no real value · stand-in for RLUSD. S$ prices map 1:1 to TEST-SGD; this is neither a peg nor a backing claim.

`make testnet ARGS=--iou` provisions a dedicated issuer with AccountSet flag 17,
buyer/writer trust lines and a buyer issuance using only public-faucet-funded
Testnet accounts. Seeds remain in the 0600 scratch wallet store. `ESCROW_ASSET=test-iou`
is the equivalent environment switch (the launcher supplies TESTNET_IOU_ISSUER).
XRP remains the default; MCP IOU support is a follow-up.

The issuer is separate from buyer and writer. Policy rejects issuer-as-party,
missing permission, nonzero transfer fees, frozen/unauthorized lines, insufficient
balance or destination limit before create signing. This is a conservative subset
of XLS-85: no transfer-fee arithmetic or freeze exception is claimed. Settlement
checks the writer RippleState balance delta (currency, issuer, sign and exact
value), never the requested Amount as proof of delivery. Cancellation checks the
buyer's returned balance delta. Existing reservations and signed outboxes remain.

See [XLS-85](https://xls.xrpl.org/xls/XLS-0085-token-escrow.html) and
[xrpl.js flag 17](https://js.xrpl.org/enums/AccountSetAsfFlags.html).
No mainnet support is claimed.
- The writer receives the principal only by publishing K through a successful
  finish. A relay can submit the same fulfillment; funds still go to the original
  destination. Buyer cancellation is policy-only and cannot win before expiry.
- K becomes public. This is acceptable because each ciphertext is encrypted for
  one buyer and intent with a fresh key; it does not unlock other buyers' copies.
  It is not DRM: anyone with that ciphertext and public K can read that copy.
- A writer can commit to nonsense or an undecryptable envelope and collect. The
  cryptographic proof establishes responsibility, not truth or automatic damages.
  Existing challenges/reputation handle broken promises; this is not a truth oracle.
- K may appear in an unvalidated submitted finish. The buyer still waits for
  validation. Ledger outages/history gaps retain reservations pending reconciliation.
- A dishonest buyer can create extra escrow objects outside policy. This product
  guarantees one charge per policy intent, not control of arbitrary wallet activity.
- Conditional finish costs more than a Payment. The [XRPL fee formula](https://xrpl.org/docs/concepts/transactions/transaction-cost)
  scales as `base_fee × (33 + fulfillment_bytes / 16)` before multisign/load effects.
  Here K is 32 bytes and its encoded fulfillment is 36 bytes. At the observed
  12-drop signing base, `ceil(12 × (33 + 36/16)) = 423` drops. A 2,000-drop cap
  rejects excessive fees. Live create/cancel each cost 12 drops. A cancelled
  60,000-drop principal is fully returned; its buyer still pays 24 drops in fees.
- Synthetic corpus and extractive fixture answers in the proof are labelled;
  Testnet value transfer is real Testnet execution, with no real value.

[Evidence and commands](evidence/round2-r/README.md).

## Live product and refunds

Live purchase activity and receipts show validated create and finish links, the
publication ledger, and separate policy results for key/Condition binding and
ciphertext authentication/decryption. A pending CancelAfter countdown is advisory;
only a validated EscrowCancel reports principal returned. Historical receipts
without the new check fields do not acquire check marks by inference.

UC3's failed signed passage promise can be challenged after EscrowFinish. Policy
reopens the authenticated envelope privately; no failed plaintext enters a grant,
snapshot or model. The publisher validates its persisted finish before recording
the settlement for the existing write-once refund journal. The refund is a separate
Payment whose InvoiceID is the finish hash. Replacement expertise uses a new
intent and escrow; gross budget authorization is not replenished by the refund.
Multi-origin key-reveal intent identifiers hash the complete source identity,
run and round to fit the existing 200-character quote limit.

An envelope that cannot authenticate/decrypt, or lacks a failed passage claim,
cannot support the passage challenge and remains quarantined and charged.
Unsupported escrow writers remain skipped with no exact-payment fallback.
Caller hire funding, royalties, change and refunds remain explicit Payments;
they are transfers rather than purchases of encrypted article delivery.
Simulated `make run` remains unchanged. No gates or test thresholds were loosened.
