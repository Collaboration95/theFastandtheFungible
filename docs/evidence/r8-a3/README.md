# R8-A3: find the amendment the question describes, lead with the part the article answers, plural "which transactions" (11 November 2026)

These are local development measurements: **fixture research and decision models, SIMULATED payments and keyword search**. They are not Testnet, live models, the hosted demo or a held-out bank. The harness, bank hashes (`bank-hashes.json`), scorer, gold phrases and thresholds are the same as [R8-A2](../r8-a2/README.md), [R8-A](../r8-a/README.md) and [K5](../k5-dev/README.md).

## Read this first: this is a regression check

Every bank below is **used development data**: v1, v3, v3-dev, v3-negatives, v5 and v5-negatives. v5 H05 is one of the three follow-ups R8-A2 left, so these rules were checked against it while they were written. **None of these numbers is a held-out improvement.** The aim was to fix the three follow-ups without losing anything on the banks.

## Result on the development banks (`metrics.json`)

The before run is `main` at `2d2794cb` (`before-summary.json`; its metrics equal R8-A2's after run). The after run is this branch (`after-summary.json`).

| Bank | Buy and cite | Lead states the key fact (`answersIt`) | Negative purchases | Articles per purchase run | Runs buying 3 | Spend |
| --- | --- | --- | --- | --- | --- | --- |
| v1 (20) | 19 → 19 | n/a (no gold strings) | n/a | 1.21 → 1.21 | 0 → 0 | S$9.20 → S$9.20 |
| v3 (20) | 20 → 20 | 18 → 18 | n/a | 1.45 → 1.45 | 1 → 1 | S$11.60 → S$11.60 |
| v3-dev (20) | 18 → 18 | 8 → 8 | n/a | 1.22 → 1.22 | 0 → 0 | S$8.80 → S$8.80 |
| v3-negatives (10) | 0 → 0 | n/a | **0 → 0** | n/a | n/a | S$0 → S$0 |
| v5, used (20) | 19 → 19 | 16 → **17** | n/a | 1.26 → 1.26 | 1 → 1 | S$9.60 → S$9.60 |
| v5-negatives, used (10) | 0 → 0 | n/a | **0 → 0** | n/a | n/a | S$0 → S$0 |

- **Runs:** every run finished `DONE`, with zero gate violations and zero offline verification failures, before and after.
- **No question lost a result.** One lead changed, from wrong to right:
  - v5 H05, "Which XRPL amendment lets escrows hold issued tokens, not just XRP?":
    - **now buys the TokenEscrow (XLS-85) article first**;
    - its lead names "the proposed TokenEscrow amendment…".
  - Before, H05 bought the builder fee note and the EscrowCreate and EscrowCancel references, and the lead missed the amendment.
- **Spend and article counts** are unchanged on every bank.

### UC1–UC3, the presets and the strict comparison (`comparison.json`)

- **UC1–UC3** (`uc`, `uc-frozen`) and **presets XRPL1–3** are policy-identical: every decision row, purchase, spend and refund matches, and the leads are unchanged.
- **Strict comparison:** 104 of 109 runs are policy-identical. The other five differ as follows:
  - **v5 H05:** the purchases above.
  - **v1 J07, v3-dev D11 ("Credentials"), v5 H04 ("conditional escrows") and v3 V16:**
    - The same purchases, verdicts on the bought rows, spend and lead.
    - The added singular word changes the keyword score, so the decision table shows different relevance values. One skipped row in each pool is swapped for another:
      - J07 swaps TrustSet for the Credential-type explainer;
      - D11 swaps DisallowIncomingCheck for the Credential-type explainer;
      - H04 swaps LedgerStateFix for the TokenEscrow article;
      - V16 swaps AMMCreate for AMMDelete.

## The round-8 judge questions (`r8-judge-questions.json`)

These are the same 19 judge questions R8-A and R8-A2 pinned, at S$2.00 (D3: S$0.50). Before is `main` at `2d2794cb`, identical to R8-A2's after run.

| Judge question | Before | After |
| --- | --- | --- |
| C3 "What's the difference between EscrowFinish and EscrowCancel, and who can submit each one?" | EscrowCancel reference bought and cited 4 times; **lead slot empty** | same purchase (S$0.40); lead "EscrowCancel returns expired escrowed principal to the sender after the ledger's cancellation deadline." |
| the other 18 | — | unchanged purchases and leads |

## What changed

1. **Retrieval: keyword search gets the singular of a glossary plural** (`shared/relevance.ts` `searchQuery`, used by `publisher/search.ts`).
   - The glossary match folds plurals, and the keyword index does not. For "escrows … issued tokens", the expansion skipped "escrow" and "issued token" as already stated, but still added the sibling names EscrowCreate, EscrowFinish, EscrowCancel and TrustSet.
   - Those references therefore outranked the article whose title uses the family's word. The TokenEscrow article ranked 8th in its writer's hits, and only the top 5 per writer reach the decision pool.
   - The search term now also carries the glossary's singular spelling of any phrase the query says only in the plural. It adds no family, no plural and nothing for "-ed" or "-ing" forms. The topic checks, precision and lead finder keep `expandProtocolQuery` and are unchanged.
   - Rank of `c5-xrpl-token-escrow-xls85` in the team explainers' keyword hits, main → this branch:

     | Search wording | Main | Branch |
     | --- | --- | --- |
     | "XRPL amendment lets escrows hold issued tokens not just XRP" (fixture plan) | 8 | **1** |
     | "amendment that lets XRPL escrows hold issued tokens" | 7 | **1** |
     | "XRPL escrows holding issued tokens amendment" | 9 | **4** |
     | "Which amendment allows escrows of issued tokens on the XRP Ledger" | 9 | **1** |

   - Over all 103 fixture subqueries of the six banks, 7 of 1,030 per-writer top-5 lists change, across 4 questions (J07, D11, H04, H05). The preset subqueries are unchanged.
2. **Lead: a cited sentence that answers one part** (`shared/lead-finding.ts`).
   - Both existing passes need every name the question gives (EscrowFinish *and* EscrowCancel) in the cited article, so C3's lead slot stayed empty although its one article was cited 4 times.
   - A last pass now takes the best cited sentence that answers one clause of the question. It must:
     - name one of the question's names;
     - be on that clause's topic;
     - cover 40% of the clause's words;
     - name an answer of the kind the clause asks for, if it asks for one (an amount for "how much", a field for "which field").
   - R8-B's rules stay: never a sentence about what the sources lack (the same `LACKS` pattern, now shared with `answer-summary.ts`), a fragment, a lowercase start or a cut sentence.
   - When nothing qualifies, the view keeps R8-B's one plain line.
   - The kind check is why v1 J01 ("How much does EscrowFinish with a fulfillment cost…?") keeps an empty lead instead of a sentence about who may finish an escrow.
3. **Plural "which transactions"** (`server/agents/precision.ts`, `shared/lead-finding.ts`).
   - The named-transaction bonus (+3) read only `which … transaction`. For "Which XRPL transactions finish or cancel an escrow?" the generic escrow explainer therefore outranked the EscrowFinish reference (1.33 against 0.83).
   - It now reads `transactions?`, for the question and for the candidate's topics. The lead finder's "which transaction" bonus and its second-sentence identifier check get the same plural.
   - With the plural fixed, that question bought the EscrowFinish and EscrowCancel references, then a third article: the TokenEscrow article, admitted by R8-A2's coverage stop only because its name shares the word "escrow" with the fact.
   - **Coverage stop refinement** (`server/agents/decision.ts`): a word shared with an identifier that has no glossary family does not count as new when it is the name of a family a purchase already covers ("escrow" after EscrowFinish).
   - A word no family owns still counts. PermissionedDomainSet still follows PermissionedDomainDelete for v5 H10.
   - A first version that ignored any already-named shared word cost H10 its answer, so it was discarded.
   - Plural probes (not in any bank), main → this branch:

     | Question | Main | Branch |
     | --- | --- | --- |
     | "Which XRPL transactions finish or cancel an escrow?" | escrow explainer, TokenEscrow (S$0.80) | **EscrowFinish, EscrowCancel** (S$0.80) |
     | "Which transactions does an XRPL escrow need to finish and cancel?" | escrow explainer, TokenEscrow (S$0.80) | **EscrowFinish, EscrowCancel** (S$0.80) |
     | "What transactions release or return an XRPL escrow?" | EscrowCancel, EscrowCreate, EscrowFinish (S$1.20) | unchanged |

## Tests

`tests/r8-judge-questions.test.ts` pins:
- H05 buys the TokenEscrow article first and names the amendment, with the fixture plan and three other planner wordings (requested facts and search subqueries);
- the search term adds "escrow", "issued token" and "credential" for plurals, and nothing for preset XRPL3, "escrowed" or a query without a glossary plural;
- the TokenEscrow article is in its writer's top 5 for four search wordings;
- C3 leads with the EscrowCancel sentence, and three more planner wordings always get a capitalised lead sentence quoted from a cited passage;
- the lead fallback never takes a disclaimer, a fragment, a sentence naming neither side, or a "how much" answer without an amount;
- plural ranking for three wordings, and the plural gets the same weight as the singular;
- the two plural questions buy exactly EscrowFinish and EscrowCancel;
- the coverage stop skips TokenEscrow after them and still lets PermissionedDomainSet follow PermissionedDomainDelete.

## Limits

- **Fixture models only.** The hosted demo decides with the fixture model and plans with DeepSeek, so these rules apply there, but its requested facts and subqueries are worded differently. The wording tests cover the shapes above, not every wording. No live run was made in this lane.
- **H05 still buys 3 articles.** The TokenEscrow article now comes first, and the lead names the amendment. Then:
  - the fixture coverage judge keeps the fact open;
  - R8-A2's stop admits the builder fee note (it names EscrowFinish) and the EscrowCreate reference.

  Live coverage judges (owner item #265 B0) remain the real fix for coverage-driven over-buying.
- **"What transactions release or return an XRPL escrow?"** still buys three escrow references, as before.
- **The strict pass can still lead with a disclaimer that names every side** ("The EscrowCancel reference does not state who may submit EscrowFinish."). That pass belongs to R8-B and was not changed here. The new fallback never takes one.

## Reproduction

```
LLM_PROVIDER=fixture DECISION_PROVIDER=fixture SETTLEMENT_RAIL=simulated SEARCH_EMBEDDINGS=off LANGFUSE_ENABLED=0 npx tsx scripts/k5-dev-measure.ts <dir>
npx tsx scripts/k5-compare-runs.ts <before-dir> <after-dir> comparison.json
npx vitest run tests/r8-judge-questions.test.ts
```

The dev-measure run takes about two minutes. On `2d2794cb` the first command reproduces `before-summary.json`.
