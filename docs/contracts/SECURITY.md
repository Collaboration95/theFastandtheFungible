# ResearchAgent security posture

Design: [FINAL-PUSH.md](../FINAL-PUSH.md) (D3–D7, §8–§9). Everything below
is built and covered by the gate suite.

- Source text is treated as quoted, untrusted evidence; it is never executed
  as instructions.
- Premium bodies and payment details are server-only. Public source responses
  contain metadata and preview until a verified payment grants the article.
- Search hits never carry premium bytes: only the writer's abstract,
  tags, relevance, and a signed manifest (D3).
- The server owns integer-cent budget enforcement, source ID binding, invoice
  identity, and access grants. The browser cannot approve a payment or submit a
  transaction payload.
- Every claim is allowlisted to a source and evidence span in the dossier
  contract. Derivative sources do not add independent families.
- Offline scenario mode settles in a labelled simulation and never produces a
  fake Testnet hash. With `SETTLEMENT_RAIL=xrpl-testnet` and a payer seed,
  the buyer server signs a Payment bound to the article's x402 terms; the
  publisher's facilitator verifies the signed blob, submits it to the
  configured XRPL Testnet endpoint, waits for validation, and records the
  transaction hash. The buyer records the receipt and explorer URL. Both
  sides restrict ledger access to Testnet; Testnet XRP has no real value.
- Each paid article carries a writer manifest signed with the XRPL
  key that receives payment. The buyer accepts it only if the key derives to
  the payee wallet and the signature verifies. The signed message is
  domain-prefixed canonical JSON, so it can never double as a valid
  transaction (D4).
- A failed proof triggers `POST /challenge`. The writer's facilitator
  re-checks and refunds with a Payment to the payer. A refund is write-once per
  intent. The trust penalty applies whether or not the writer refunds (D5).
- `XRPL_PAYER_SEED` is server-only and must stay in the ignored local `.env`;
  never copy it into `.env.example`, the client bundle, logs, or persisted run
  data. A receiver secret is not needed to receive a Payment.
- Publisher keys are needed at runtime to sign manifests and refunds. They are
  server-only, and never logged, traced, persisted in run data, or sent to a
  model.
- Built-in writers and articles are original synthetic content attributed to fictional
  writers and labelled SYNTHETIC. Draft questions name real institutions with
  invented facts (O3). No real article body is scraped, bypassed, or
  redistributed.
- Locally published writers are labelled unverified (no KYB on Testnet). Author-supplied content is distinguished from SYNTHETIC starter content. Publisher keys are stored in an ignored, mode-0600 `.env.writer` beside the private corpus. An operator denylist is checked before funding a new wallet and before purchase signing; it is not sanctions screening.
- Persistence is SQLite (`node:sqlite`): `data/app.db` and the publisher journal.
  It is local demo storage, not multi-user production storage; deployers should
  add authentication, encryption, retention, rate limits, and a managed
  database before production use.
