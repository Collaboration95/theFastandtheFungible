# Question relevance and answer leads

`shared/relevance.ts` holds the small XRPL/x402 glossary. It expands protocol
abbreviations, transaction families, HTTP 402 challenge terms, prompt injection
and payment finality. Authorization and receipt-verification aliases also cover
ordinary budget-policy and independent-ledger-verification wording. Expansion supplies search vocabulary, never answer text.
Original question words remain in the relevance denominator. Keyword search keeps
its existing title (3) and facet (2) boosts and absolute BM25 promise scale.

Before a purchase, deterministic policy requires the title/facets to match the
question or its frozen requested fact. For detailed finance requests, verified
signed fact-menu entity/measure fields also supply public topic metadata. A
known compatible fact promise plus two subject-word matches can establish that
scope; an unknown or unsigned menu cannot. Protocol requirements always need
the requested title/facet family. A broad wallet/payment mention alone does
not match finality, and a shared country/date does not match an unrelated question.
The model cannot override this rejection. Existing value, trust, scope, cap,
budget, rewrite, idempotency and new-writer-probe limits still apply.

Composition considers accessible purchased passages first, then accessible free
passages. Lead ranking uses the first requested fact, question form, entity,
answer type, article title and facets. Generated entity-basics coverage rows do
not replace the user's first requested fact. Date questions reward the requested
event rather than an unrelated date. It prefers definitions and causal answers
over introductions, recommendations and caveats; exact source bytes and bindings
remain in receipts. Leads have both a 40-word and 620-character limit; conclusions
have a 120-word limit and omit malformed sentences longer than 1,800 characters.
Screen-only cleanup removes Markdown markers and author reference numbers while
retaining the engine's verified citation. Only frozen requested facts appear as
unanswered once coverage is checked.

Signed free content must pass signature, registered-wallet and article/version
identity checks plus full delivery verification (salts, leaves/root, claims and
word count) before ingestion. Unsigned free input is accepted only by the existing
local legacy policy; federated free input always requires a signed proof.

## Development verification without held-out access

`RA_DEV_BANKS_ONLY=1 npm run gate` excludes the held-out-bank schema test from
Vitest collection. Its captured checkout replaces held-out question content with
empty existence markers, and its helper scanner refuses to read those paths.
Cache inputs retain their Git blob identities. The default gate is unchanged. The local-gate runtime receipt
and content cache key record this restriction so this run cannot be reused as a
full-bank schema check. This is for lanes explicitly forbidden to read held-out
questions. It does not disable any engine, policy, proof, browser or hard-gate test.

`scripts/k4-dev-measure.ts <output-directory>` allowlists v1, v3, v3-dev and
v3-negatives plus public examples and UC1–UC3. It runs the real local engine,
publisher, proofs and offline verifier with fixture models and SIMULATED payments
on an ephemeral port. It records raw runs, receipts, lead-only canonical scores,
all decision rows and bank hashes. These are development measurements, not
Testnet, live-model, production or held-out evidence. Use the shared heavy lock
for full gates, full browser suites and CPU-heavy acceptance. I/O-bound Testnet
judge-bank runs do not take that lock (owner correction, 11 November 2026).
