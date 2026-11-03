# Lane E evidence · 4 November 2026

Nine curated historical Testnet rows: three official RLUSD purchase/refund,
four XRP escrow create/finish/cancel, two native XRP interop purchases.
No provisioning DEX/TrustSet or royalty row is attributed as a purchase.
Hire and agents evidence were inspected but are outside this initial nine-row scope.

`curation.json` selects only public committed fields. `node scripts/ledger-artifact.mjs`
generates both the download and the HTML fallback table; `--check` compares them.
JSON sources are checked field by field; interop hashes, ledgers and amounts
are checked against the committed Markdown table. Dates are observation dates,
not invented transaction timestamps; escrow ledgerDate is retained in the download.
Terminal escrow rows do not invent a delivered principal amount.
The source baseline is ec97bfdfe38e61b1b1b3fed6a1b4d3546052927c.

Read-only public RPC was actually tried: rpc-attempt.json records HTTP 200 /
txnNotFound for one allowlisted historical hash. This does not verify it freshly
or establish a reset cause. Browser refresh implemented; validated with fixtures.
No signing, submission, wallet access, account queries, paid fallback or provisioning.

Unit and browser fixtures cover matching validated success, pending/unvalidated,
wrong amount/issuer/network, failed, missing/reset, malformed and CORS responses.
Unit tests additionally exercise rate limiting, the streaming 256 KiB cap,
five-second abort and maximum two concurrent tx calls. Browser tests use an
OS-assigned ephemeral port and axe serious/critical checks plus keyboard focus.
Existing verify:answer validates the two committed RLUSD receipt bundles.
No independent receipt verifier is introduced. No live deployment is claimed.

Primary sources accessed 2026-11-04:
- https://xrpl-x402.t54.ai/docs/xrpl-scheme
- https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl
- https://xrpl.org/docs/concepts/payment-types/escrow
- https://xrpl.org/resources/known-amendments

These specify semantics, not current network/issuer capabilities. Facilitator
build revision and issued-codec execution remain unknown. Upstream drafts are
prepared only; no issue or comment was posted externally.
