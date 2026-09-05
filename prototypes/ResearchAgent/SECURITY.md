# ResearchAgent security posture

- Fixture source text is treated as quoted, untrusted evidence; it is never
  executed as instructions.
- Premium bodies and payment details are server-only. Public source responses
  contain metadata and preview until an exact source purchase is recorded.
- The server owns integer-cent budget enforcement, source ID binding, invoice
  identity, and access grants. The browser cannot approve a payment or submit a
  transaction payload.
- Every claim is allowlisted to a source and evidence span in the dossier
  contract. Derivative sources do not add independent families.
- Fixture settlement is labelled simulation and never produces a fake Testnet
  hash. When `XRPL_MODE=live`, the server signs and submits only to the
  configured XRPL Testnet endpoint, waits for validation, and records the real
  transaction hash and explorer URL. Testnet XRP has no S$ equivalence.
- `XRPL_PAYER_SEED` is server-only and must stay in the ignored local `.env`;
  never copy it into `.env.example`, the client bundle, logs, or persisted run
  data. The receiver secret is not needed to receive a Payment.
- The fixture corpus is original synthetic content attributed to fictional
  publishers. No real article body is scraped, bypassed, or redistributed.
- JSON persistence is local demo storage, not multi-user production storage;
  deployers should add authentication, encryption, retention, rate limits, and
  a transactional database before production use.
