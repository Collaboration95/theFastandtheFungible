# K5 development evidence — 11 November 2026

Local development measurements, **fixture models and SIMULATED payments** (not
Testnet, not live models, not hosted, not held-out). Every question and miss is
kept; neither the scorer nor any gold phrase was changed, and no synonym credit
was added.

**v5 is a used bank.** It was run once as the blind held-out bank
([v5-heldout](../v5-heldout/README.md)) and is development data from here on, so
every v5 number below is labelled "v5 (used/dev)". None of it is a held-out
claim. Any future held-out claim needs a new blind bank.

## Result

Matched before/after on the same corpus and the same bank hashes
(`bank-hashes.json`). Before is `main` at `f4a8fb939e0d0118500747f7cffd3dcdb562762c`
(after K4 #442 and M5 #448); after is the K5 commit named in `sources.json`. On the
before side the fixture models reproduce the Testnet v5 run exactly (16/20 bought
and cited, 7/20 lead), so this harness is a faithful stand-in for lead selection.

| Development bank | Bought and cited | Lead states the key fact (`answersIt`) | Negative purchases |
| --- | --- | --- | --- |
| v1 (20) | 19 → 19 | n/a: no gold strings | n/a |
| v3 (20) | 20 → 20 | 13 → **15** | n/a |
| v3-dev (20) | 16 → 16 | 4 → 4 | n/a |
| v3-negatives (10) | 0 → 0 | n/a | 0 → **0** |
| v5 (used/dev) (20) | 16 → 16 | 7 → **9** | n/a |
| v5-negatives (used/dev) (10) | 0 → 0 | n/a | 0 → **0** |

- **Four leads now state the key fact** (v3 V05 and V16; v5 H09 and H13). None went
  from right to wrong. Two off-topic leads are gone (v3 V08, v5 H20).
- **Policy is untouched.** Across all 109 runs (70 bank questions, 30 negatives, six
  UC runs, three presets) the decisions, verdicts, values, purchases, receipts,
  refunds and spend are identical before and after (`comparison.json`:
  `policyIdentical` 109 of 109). UC1–UC3 and the three public presets keep
  byte-identical leads. All 109 runs finished DONE with zero gate violations and
  zero offline verification failures on both sides.
- **The gain is modest because most misses are not ranking misses** (next section).
  Judges type their own questions, so the rules below are generic: nothing in code
  knows a bank phrase or gold.

## Diagnosis: why a bought-and-cited answer does not lead with the key fact

Twenty-eight questions on the three dev banks with gold strings were bought and cited
but did not lead with the key fact before K5. For each we asked whether the purchased
passages held the gold, and whether any corpus article does.

- **ranking** (9): a delivered sentence states the gold; a more generic sentence outranked it.
- **retrieval** (9): a corpus article holds the answer but was not among the 12 candidates, so
  it was never bought. The fixture harness uses keyword search only
  (`SEARCH_EMBEDDINGS=off`); the hosted app can use vector search, which this run does not measure.
- **coverage** (10): no article holds the gold string at all. Corpus additions belong to other lanes.

| Bank | Q | Gold | In purchased passages | In corpus | Cause | Lead before (main) | After K5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v5 (used/dev) | H02 | tfFillOrKill | no | no | coverage | OfferCreate places a decentralized-exchange order and may immediately … | still misses |
| v5 (used/dev) | H04 | PREIMAGE-SHA-256 | no | yes | retrieval | A condition can bind release to a cryptographic fulfillment, while Fin… | still misses |
| v5 (used/dev) | H05 | TokenEscrow | no | yes | retrieval | EscrowFinish with a fulfillment cost 423 drops in our observed XRPL Te… | still misses |
| v5 (used/dev) | H09 | DIDSet | yes | yes | ranking | An XLS-40 decentralized identifier identifies a controller and support… | **now leads** |
| v5 (used/dev) | H13 | payment channel | yes | yes | ranking | PaymentChannelCreate locks XRP in a channel for repeated payments to a… | **now leads** |
| v5 (used/dev) | H14 | 524C555344 | no | no | coverage | XRP pays native ledger fees, RLUSD is an issued dollar-denominated tok… | still misses |
| v5 (used/dev) | H18 | Recommendation 16 | no | no | coverage | (none) | still misses |
| v5 (used/dev) | H19 | verif | yes | yes | ranking | an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; … | still misses |
| v5 (used/dev) | H20 | 80% | no | yes | retrieval | An XRPL sidechain is a separate ledger with its own rules and consensu… | off-topic lead removed |
| v3 | V02 | DestinationTag | no | no | coverage | A destination tag tells a recipient's off-ledger system which benefici… | still misses |
| v3 | V05 | PREIMAGE-SHA-256 | yes | yes | ranking | FinishAfter, when present, sets the earliest release time.… | **now leads** |
| v3 | V06 | EscrowFinish | yes | yes | ranking | A condition can bind release to a cryptographic fulfillment, while Fin… | still misses |
| v3 | V08 | 524C555344 | no | no | coverage | Recheck issuer permissions before enabling another settlement mode; an… | off-topic lead removed |
| v3 | V11 | CredentialAccept | no | yes | retrieval | CredentialDelete removes a credential under the issuer, subject or exp… | still misses |
| v3 | V15 | 1% | no | yes | retrieval | Initial amounts establish the starting price, while the trading fee an… | still misses |
| v3 | V16 | SendMax | yes | yes | ranking | XRP remains the default key-reveal asset, while TEST-SGD is a labelled… | **now leads** |
| v3-dev | D01 | tfPartialPayment | no | no | coverage | In API v2, the Amount field is renamed DeliverMax to make its maximum … | still misses |
| v3-dev | D03 | s.altnet.rippletest.net | no | no | coverage | (none) | still misses |
| v3-dev | D05 | FinishAfter | yes | yes | ranking | Trust-line token escrow requires the issuer's AllowTrustLineLocking pe… | still misses |
| v3-dev | D06 | crypto-condition | no | no | coverage | XRPL escrow locks funds until its time or cryptographic conditions per… | still misses |
| v3-dev | D08 | Ethereum | no | yes | retrieval | One XRP contains one million drops.… | still misses |
| v3-dev | D09 | AllowTrustLineClawback | no | yes | retrieval | XRPL issuers can claw back eligible issued tokens when the required co… | still misses |
| v3-dev | D11 | DepositPreauth | no | yes | retrieval | XRPL Credentials verify a writer only when an operator-trusted issuer … | still misses |
| v3-dev | D12 | DIDDocument | no | yes | retrieval | XLS-40 specifies the XRPL DID method and operations for managing DID d… | still misses |
| v3-dev | D13 | X-PAYMENT-RESPONSE | no | no | coverage | its x402 XRP Testnet facilitator confirms settlement only after a vali… | still misses |
| v3-dev | D14 | exact | yes | yes | ranking | Each option names scheme, network, amount, asset, payTo and maxTimeout… | still misses |
| v3-dev | D16 | LP token | yes | yes | ranking | AMMDeposit contributes assets to an existing AMM and receives liquidit… | still misses |
| v3-dev | D17 | Major Payment Institution | no | no | coverage | (none) | still misses |

Reading the table:

- Rows marked "In corpus: yes" with a one-token gold (`80%`, `1%`, `Ethereum`) are false
  matches in unrelated articles, so they are not real retrieval misses. The real ones are the
  articles that exist for H04, H05, D09, D11, D12 and V11.
- Some golds are weak (`verif`, `exact`) or phrased differently from a correct lead
  (`LP token` against "liquidity-provider tokens"). They stay failures; no synonym credit was added.
- Of the nine v5 cases whose lead was a correct but generic sentence: ranking H09, H13, H19;
  retrieval H04, H05, H20; coverage H02, H14, H18. Only the ranking ones are fixable in lead
  selection. H09 and H13 now lead with the answer. H19's answering sentence shares no word with
  the question (it never mentions the facilitator), so a lexical ranker cannot find it.
- H20's lead (a sidechain sentence for a consensus-threshold question) was off-topic. A question
  that asks for a share now needs a sentence with a percentage or a real overlap with the question,
  so that lead is withheld instead of shown.

## What changed

All generic, in `shared/lead-finding.ts` and the new `shared/answer-entity.ts`:

1. **Answer typing.** "Which flag / transaction / header / amendment / act / recommendation, what
   share / quantity / code" is read from the words right after the wh-word (`askedKind`). A sentence
   that names a thing of that shape which the question did not already say earns a bonus
   (`answerNames`): camel-case and acronym-led identifiers, flag prefixes, kebab and snake capitals,
   standard numbers, hex codes, percentages, numbers with units, numbered clauses, statute titles.
   A standard number is not a transaction name, and a currency tag is not a field.
2. **Rarity-weighted coverage.** A question term counts for more the fewer candidate sentences
   contain it, with light inflection folding (claims/claim, signed/sign). The sentence covering the
   distinctive terms outranks one that repeats frame words every article shares.
3. **Shared templates are not answers.** A sentence repeated verbatim across articles is demoted
   and never used as the second sentence; neither is the tail of a passage that opens with boilerplate.
4. **Off-topic never leads.** For a which/what question, the lead needs a sentence of the asked
   shape or enough overlap with the question (0.15 of its terms; 0.20 when a number is asked).
   The same floor keeps an unrelated sentence out of the answer's context paragraph
   (`onTopicSentence`, used by `summarizeAnswer`). With nothing left, the lead is empty and the
   answer reads "No concise finding could be selected" over "See the cited passages under Show work"
   (v5 H20). Explanatory ("how does ...") and yes/no questions have no such floor.
5. **Stop words.** Function words such as "be" no longer count as question terms; they made unrelated
   sentences look complementary.

K4's guards are unchanged. The three pinned preset leads are byte-identical (RLUSD starts with
AllowTrustLineLocking, x402 with its payment headers, reserves with the dated XRP amounts), and the
UC1–UC3 leads and policy decisions do not move.

Tests: `tests/k5-lead-entity.test.ts` (33 tests, invented names and sentences only) covers question
typing, name shapes, ranking by shape and by rarity, the off-topic floor in the lead and in the context
paragraph, templates, and the absence of a floor for explanatory questions. No existing golden or
snapshot changed. The answer's conclusion text differs in 42 of the 109 runs (its sentence order follows
the new lead, and unrelated sentences are dropped); no receipt, purchase or other policy field differs.

## Remaining misses (not fixed here)

- **Retrieval** (9, including false matches): needs vector search or better candidate selection;
  measured only with keyword search here.
- **Coverage** (10): needs corpus additions (an OfferCreate flag note, the RLUSD currency-code
  form, FATF recommendation numbering, the consensus threshold). Belongs to the coverage lane.
- **Ranking** (5 left: V06, D05, D14, D16, H19): paraphrase or weak-gold cases a lexical ranker
  cannot settle.
- Second sentences of a lead can still be loosely related. They are complements, and the pinned
  preset leads depend on the current choice.

## Reproduction

`OFFSET=3400 LLM_PROVIDER=fixture DECISION_PROVIDER=fixture SETTLEMENT_RAIL=simulated SEARCH_EMBEDDINGS=off LANGFUSE_ENABLED=0 npx tsx scripts/k5-dev-measure.ts <dir>`
runs the real publisher and engine on an ephemeral port (K4's harness plus v5 and v5-negatives) and
takes about four minutes. Then:

- `npx tsx scripts/k5-compare-runs.ts <before-dir> <after-dir> out.json` compares policy fields run
  by run and lists the changed leads.
- `npx tsx scripts/k5-replay-leads.ts <dir> [bank ...] [--explain bank-ID]` re-selects each saved
  lead from its delivered passages in seconds and prints the ranked sentences.

Files here: `before-summary.json` and `after-summary.json` (every result, lead and verifier outcome),
`before-runs.tar.gz` and `after-runs.tar.gz` (each run's `result` and `run`; receipt bundles and
verifier output are dropped, the summaries keep the outcome), `comparison.json`, `bank-hashes.json`,
`sources.json`.

The full gate runs under the shared heavy lock; this lane's measurements are local fixtures and do
not hold it.
