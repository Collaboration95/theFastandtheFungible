# FairCut security posture

FairCut is a controlled prototype. Its security boundary is designed to make
the risky actions explicit, not to claim production wallet or copyright
assurance.

## Signer boundary

- The browser sends mandate-scoped commands and cannot submit arbitrary XRPL
  transaction JSON.
- The XRPL seed is server-only configuration. It must never be placed in a
  `VITE_*` variable, browser storage, client bundle, or logs.
- The live adapter allows only XRPL Testnet URLs, the stored eligible payee,
  the exact frozen amount, `Payment` type, zero flags, a bounded
  `LastLedgerSequence`, the invoice memo, and the expected source tag.
- A live claim is accepted only after an independent lookup reports both
  `validated: true` and `TransactionResult: tesSUCCESS`.

## Protected delivery

The clean master is kept under the server asset boundary and is withheld until
payment evidence is presented. The delivery evaluator hashes returned bytes
and checks the manifest, ODRL-shaped policy digest, MIME type, container and
effective duration, placement timing, attribution, and purchase reference.
Any mismatch becomes `FULFILMENT_EXCEPTION`; the clean stem is not inserted.

## Privacy and audit

Receipts expose public-safe identifiers, hashes, and ledger evidence only. No
seed, secret, or private signing material is serialized into the event chain.
Non-GET requests support idempotency keys; a changed request body under the
same key is rejected as an idempotency conflict. The append-only audit chain
uses canonical JSON and SHA-256 links, with verification covered by unit and
contract tests.

## Prototype limitations

The local fixture is not a production authorization service, custody system,
ODRL reasoner, C2PA verifier, or legal determination of ownership. Testnet
funds are disposable. Production deployment would still need key management,
rate limiting, authenticated provider identities, durable storage, replay
protection across replicas, monitoring, incident response, and independent
security review.
