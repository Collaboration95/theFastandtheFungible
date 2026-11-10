# C5 coverage, candidate recall and the development-only gate — 11 November 2026

Local development measurements: **fixture models and SIMULATED payments** (not Testnet, not live models, not hosted, not held-out). Same harness, same bank hashes (`bank-hashes.json`) and same code path as [K5](../k5-dev/README.md); neither the scorer nor any gold phrase was changed, and no synonym credit was added.

## Read this first: these are development numbers

v5 was run once as the blind held-out bank ([v5-heldout](../v5-heldout/README.md)) and is **used development data** from here on. The eighteen articles below were chosen from the misses K5 diagnosed on the used banks (v3, v3-dev, v5) and from the judges' own questions in the round-7 mock panel. So every gain on v3, v3-dev and v5 here is "informed by the used misses". **None of it is a held-out improvement.** A held-out claim needs a new blind bank written after these articles exist.

## Result

Matched before/after on the same corpus snapshot rules and bank hashes. Before is `main` at `017e798b` (after K5 #450). After adds the eighteen articles, the retrieval changes and the plan fix below.

| Development bank | Bought and cited | Lead states the key fact (`answersIt`) | Negative purchases |
| --- | --- | --- | --- |
| v1 (20) | 19 → 19 | n/a: no gold strings | n/a |
| v3 (20) | 20 → 20 | 15 → **17** | n/a |
| v3-dev (20) | 16 → **18** | 4 → **7** | n/a |
| v3-negatives (10) | 0 → 0 | n/a | 0 → **0** |
| v5 (used/dev) (20) | 16 → **19** | 9 → **16** | n/a |
| v5-negatives (used/dev) (10) | 0 → 0 | n/a | 0 → **0** |

Twelve leads went from missing to stating the key fact (v3 V08, V15; v3-dev D01, D03, D16; v5 H02, H04, H12, H14, H15, H18, H20) and none went from right to wrong. Every run finished DONE with zero gate violations and zero offline verification failures, before and after (`after-summary.json`).

### Candidate recall (`recall-before.json`, `recall-coverage-only.json`, `recall-after.json`)

`scripts/c5-recall.ts` runs the real publisher and `retrieve` (keyword search only, the fixture setting) and asks whether the candidate pool contains an article whose body holds the bank's gold phrase. The denominator is the questions that some corpus article can answer, so it grows when coverage grows. One-token golds (`80%`, `1%`, `Ethereum`) can match unrelated fictional articles; they are counted as K5 counted them.

| Bank | Before | Coverage only (first draft) | After (coverage + retrieval) |
| --- | --- | --- | --- |
| v3 | 16 / 18 | 20 / 20 | **20 / 20** |
| v3-dev | 9 / 14 | 15 / 20 | **17 / 20** (misses D02, D09, D11) |
| v5 (used/dev) | 12 / 15 | 18 / 19 | **19 / 19** |
| Mean candidates, positive banks | 7.7 / 8.6 / 6.6 | 7.7 / 8.7 / 6.8 | 7.7 / 8.1 / 6.7 |
| Mean candidates, negative banks | 1.7 / 1.9 | 1.8 / 1.9 | 1.7 / 1.9 |

Search stays a few milliseconds per question on this machine (about 25–40 ms for the whole fan-out under load); the candidate cut (5 per writer per sub-query, 8 paid) did not change.

## What changed

1. **Coverage: 18 sourced, answer-first explainers** through the existing disclosed writer `team-xrpl-explainers` (disclosure unchanged: **team-authored explainer · sources cited · not an independent writer · Testnet**; S$0.40; no new writer, no self-boost, no model call). Topics: OfferCreate flags; the RLUSD hexadecimal currency code; the validation quorum; the Ticket limit; the crypto-condition type; payment channels; AMMCreate and AMMDeposit; DestinationTag; Payment flags; TokenEscrow (XLS-85); Testnet servers; the x402 facilitator verify and settle steps on XRPL; AP2; RLUSD networks, issuer and reserves; the GENIUS Act; the MAS stablecoin framework; whether a Singapore company needs a MAS licence to pay suppliers in RLUSD; FATF Recommendation 16. `inventory.json` maps every article to its sources and to why it was chosen. Each is 164–256 words, four exact passages, a first sentence of at most 38 words that states the answer (the lead window is 40 words), numbered citations to primary documents, an explicit "Author interpretation" paragraph and the access date. Paid bodies contain no repository path or engineering text (paid-body lint: 252 articles, 0 violations).
2. **Retrieval, generic and small.**
   - *Glossary vocabulary* (`shared/relevance.ts`): one block naming the topics above. Triggers are specific phrases or identifiers (`PREIMAGE-SHA-256`, `TicketCreate`, `tfFillOrKill`, `DeliverMax`, `GENIUS Act`, `AP2`, `DepositPreauth`, `altnet`...), never an everyday word. `tests/c5-retrieval.test.ts` pins that a leaking faucet, a concert ticket, a central-bank mandate, a broker's trading fee, a partial credit-card payment and the yen's currency code borrow none of it.
   - *Fixture plan keeps a capitalised acronym that spells a stop word* (`server/agents/scope.ts`): "DID" was dropped as the verb "did", so a DID question searched for nothing about DIDs (v3-dev D12 is now a candidate).
   - *Host fragments are not words* (`publisher/search-text.ts`): `s.altnet.rippletest.net` counts as `altnet` and `rippletest`, not as the generic word `net`, which had let "Taylor Swift's net worth" half-match the Testnet article.
3. **Development-only gate** (`scripts/local-gate-banks.mjs`): `RA_DEV_BANKS_ONLY=1` blanked v4/v5 evidence, so hygiene and `tests/progress-page.test.ts` failed on a clean main. Now only a bank version above `USED_BANKS_THROUGH` (5) is unreleased. v1–v5 are readable; a future v6 is protected from the moment its file appears. Tests: a synthetic v6 is blanked and a synthetic v5 is not (`scripts/local-gate.test.mjs`), the predicate for v1–v12 and look-alike paths, and the facts audit reads v5 results in dev mode (`tests/facts.test.ts`). `RA_DEV_BANKS_ONLY=1 npm run hygiene` and the progress-page test pass.

## Tried and not shipped

Measured with `scripts/c5-recall.ts` on the coverage-only corpus; recall is the number above, so a change had to beat it without adding off-topic candidates.

- **Larger first-stage pool** (5/8, 7/10, 8/10, 10/12 per writer / paid cut): recall unchanged (20/20, 15/20, 18/19) while mean candidates grew from 7.7 to 11.7. With two XRPL writers, rank fusion keeps the best few of each, so the missed articles sit below the cut inside the big writer, not outside the pool.
- **Inflection folding in the keyword index** (plural, -ed, -ing, trailing -e): v3 20/20 → 18/20, v5 18/19 → 15/19, and the negative banks' candidates doubled (1.8 → 3.4). Rejected.
- **Splitting camel-case identifiers in the index**: v3-dev 15/20 → 13/20. Rejected.

## Policy and negatives (`comparison.json`)

- UC1–UC3 (both sets): purchases, spend, refunds and every verdict identical in 6 of 6 runs. The three public presets: identical purchases, spend and verdicts, leads byte-identical; their decision values moved in the third decimal because corpus statistics moved.
- Negatives: 0 purchases before and after, identical in 20 of 20 runs.
- Bank runs (80): the purchased set changed in 38 because a new article replaced an older one (for example `c5-xrpl-crypto-condition-type` for `xrpl-tx-escrowfinish` on a crypto-condition question). The strict K5 comparison (`scripts/k5-compare-runs.ts`) reports 27 of 109 runs identical because it compares every decision row, and a new article is a new row; the loose comparison in `comparison.json` states what it checks.

## Sources and limits

Every fact was read from the primary document named in `inventory.json` and attributed in the paid body: xrpl.org reference and concept pages, the XRPL-Standards XLS-85 specification, the x402 specification and its XRPL exact-scheme document pinned to commit `0e6e8c55`, ap2-protocol.org, Ripple's stablecoin page, Public Law 119-27 on govinfo.gov, and MAS pages (media release, Payment Services Act FAQ of 19 April 2024, overview of the Act).

**FATF.** The FATF website returned HTTP 403 to every automated download from this environment. The FATF article therefore rests on FATF excerpts returned by search, not on a full read of the guidance. Please check it against the PDF before relying on its wording. The licence-threshold figures in the MAS licence article come from MAS's 2019 overview of the Act, which is a primer, not the current statute.

Not done: embeddings. The XRPL explainers and builder notes have no cached vectors, so even with the hosted Cloudflare key those writers search by keyword; the vector path is untouched here.

## Reproduction

`OFFSET=3800 LLM_PROVIDER=fixture DECISION_PROVIDER=fixture SETTLEMENT_RAIL=simulated SEARCH_EMBEDDINGS=off LANGFUSE_ENABLED=0 npx tsx scripts/k5-dev-measure.ts <dir>` (about five minutes, ephemeral ports), then `npx tsx scripts/k5-compare-runs.ts <before> <after> out.json`. Recall: `LLM_PROVIDER=fixture SEARCH_EMBEDDINGS=off npx tsx scripts/c5-recall.ts out.json` (about a minute). The before run is `main` at `017e798b`; checking out that commit and running the same command reproduces `before-summary.json`.

Files: `before-summary.json`, `after-summary.json` (every result, lead and verifier outcome), `comparison.json`, `bank-hashes.json`, `inventory.json`, `corpus-golden.json` (the new corpus pin), `recall-*.json`.
