# Buyer-controlled holdback

Testnet evidence collected so far: **10 passing purchases, 10 holdbacks released**. Five independent promise-failure trials are still being collected. The local suite has 13 holdback tests and three fourth-state UI checks, alongside the existing key-reveal and stepper regressions. Final gate results follow below.

Opt in with `ESCROW_HOLDBACK=on` and `ESCROW_MODE=key-reveal`. `HOLDBACK_PERCENT` defaults to 20; `HOLDBACK_CANCEL_AFTER_S` defaults to 600. The flag defaults off. The evidence command uses 60 seconds and synthetic signed fixture articles, with real XRPL Testnet settlement. It does not deploy or call a live model.

```sh
PATH=$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH node --import tsx scripts/holdback-evidence.mjs
```

The full quoted price remains budget-committed. One ALLORNOTHING Batch creates the key-release escrow and holdback. The writer receives the key-release portion on reveal. Buyer policy alone holds the second fulfillment and either releases the holdback after checks or cancels it after the deadline. **Only the holdback is refundable without writer cooperation; the key-release payment stays paid.** Fees remain paid.

Sequence reservation commits before signing. The unsigned reservation, buyer secret, signed Batch and terminal outbox are private SQLite state. Retries reconstruct or re-submit the same transaction; they never allocate another principal Batch. Outer success alone does not unlock anything: both inner results, parent IDs and escrow objects are checked at the creation ledger. Object identity is buyer plus inner Sequence.

Promise checks use the existing signed delivery proof, receipt-value policy and (for hybrid search) recorded relevance calibration. Missing live calibration keeps the holdback pending until recovery or cancellation. Keyword-only runs do not compare keyword and cosine relevance scales. Failed proofs stay quarantined. Pending obligations are reconciled after an answer is complete or stopped.

Receipts include both escrow identities, the public signed Batch and the terminal transaction when available. The offline verifier checks signatures, quote binding, identities and pending/released/refunded state. Ledger validation still requires the read-only Testnet verifier. No unreleased buyer secret or signed terminal blob is exported.


The first combined harness run stopped when its first failure trial was skipped before a Batch was submitted. This is retained as a harness interruption, not counted as a refund. Failure trials reset synthetic writer reputation between trials so a deliberately rejected fixture does not quarantine the next independent trial. The production reputation policy is unchanged.

Protocol reference: [XRPL Batch](https://xrpl.org/docs/references/protocol/transactions/types/batch). Inner transaction results are separate from the wrapper result. The spike recorded the multi-account signing mismatch; this purchase uses one signer and no multi-sign workaround.
