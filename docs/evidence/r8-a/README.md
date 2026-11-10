# R8-A: buy the right article, honest spending guard, chat routing (11 November 2026)

These are local development measurements: **fixture research and decision models, SIMULATED payments and keyword search**. They are not Testnet, live models, the hosted demo or a held-out bank. The method is the same harness and the same bank hashes (`bank-hashes.json`) as [K5](../k5-dev/README.md) and [C5](../c5-coverage/README.md). The scorer, the gold phrases and the thresholds are unchanged.

## Read this first: this is a regression check

Every bank below is **used development data**: v1, v3, v3-dev, v3-negatives, v5 and v5-negatives. The questions this lane fixes come from the round-8 mock judges (`notes/review-nov10/12-mock-judges-r8.md` §1), so the changes were informed by those exact questions. **None of these numbers is a held-out improvement.** The aim was to fix the judges' misses without losing anything on the banks.

## Result on the development banks (`metrics.json`)

The before run is `main` at `0c12748e` and the after run is this branch. Both use the same corpus and the same bank hashes.

| Bank | Buy and cite | Lead states the key fact (`answersIt`) | Negative purchases | Articles per purchase run | Runs buying 3 |
| --- | --- | --- | --- | --- | --- |
| v1 (20) | 19 → 19 | n/a (no gold strings) | n/a | 1.53 → **1.47** | 3 → **2** |
| v3 (20) | 20 → 20 | 17 → 17 | n/a | 1.90 → **1.65** | 7 → **5** |
| v3-dev (20) | 18 → 18 | 7 → 7 | n/a | 1.72 → **1.50** | 5 → **3** |
| v3-negatives (10) | 0 → 0 | n/a | **0 → 0** | n/a | n/a |
| v5, used (20) | 19 → 19 | 16 → 16 | n/a | 1.79 → **1.68** | 6 → **5** |
| v5-negatives, used (10) | 0 → 0 | n/a | **0 → 0** | n/a | n/a |

- **Runs:** every run finished `DONE`, with zero gate violations and zero offline verification failures, before and after.
- **Spend:** spend on the four positive banks fell from S$52.80 to S$48.00. The no-purchase runs kept their spend at S$0.
- **Leads:** five leads changed wording, and no lead went from right to wrong.

### UC1–UC3 and the public presets (`comparison.json`)

- **UC1–UC3:** both sets (`uc`, `uc-frozen`) have identical purchases, spend, refunds and every decision row in 6 of 6 runs. The story-bible policy did not change.
  - *Why:* the title preference and the subject ranking apply to protocol questions only.
  - *Why:* the new stop rule never touches a requirement that a story-bible cue rule grades.
- **Presets:**
  - XRPL1 and XRPL2 are identical.
  - XRPL3 buys the same article for the same S$0.40, with the same lead. One unselected row changed: `xrpl-multisign` went from eligible to "title and topics do not cover", because the topic rule now keeps the first specific family the question names.
- **Bank runs:**
  - The purchased set changed where a redundant second or third article is no longer bought, and where a right article now comes first.
  - The strict comparison lists 41 of 109 runs as different. The runs in a bank share one reputation store, so one changed purchase shifts the trust values of the later runs in that bank. This is also why the differences come in contiguous runs.

## The round-8 judge questions (`r8-judge-questions.json`)

These are 19 of the judges' own questions, with fixture models and requested facts taken from the fixture extraction. The hosted demo plans with a live model, so its requested facts are worded differently.

| Judge question | Before | After |
| --- | --- | --- |
| A2 "What does an x402 402 response contain, and can my agent pay it with XRP on Testnet?" | Testnet servers, x402-on-XRP, RLUSD vs XRP (**2 wrong**, the exact-title article skipped) | **"What does an x402 402 Payment Required response contain?"**, then "Can an agent pay x402 with XRP on Testnet…" (one per clause) |
| C5 "How much does one key-reveal purchase cost in XRPL network fees?" | nothing (both fee articles skipped as off-topic) | "How do XRPL transaction fees … work?" |
| A3 prompt-injected agent | prompt-injection explainer + 2 more | prompt-injection explainer only |
| B2 MAS licence to pay suppliers in RLUSD | licence explainer + 2 more | licence explainer only |
| A1, A5, B3, C2, E1, E3, F1 | right article | unchanged |
| A4 Singapore Grand Prix (off-topic) | nothing bought | nothing bought |
| D3 token escrow amendment (S$0.50) | generic escrow explainer | **unchanged, still the generic explainer** (see Limits) |
| B1, B5 | 3 articles | unchanged, 3 articles |

`tests/r8-judge-questions.test.ts` pins these outcomes. It also pins:
- that the same question, with the planner's requested facts worded three different ways, buys the same first article;
- the spending guard's keep and reject cases;
- the routing of the five product questions.

## What changed

1. **Topic rule** (`shared/relevance.ts`, H8-01).
   - A network qualifier ("on Testnet", "on XRPL") never stands in for the question's subject. It counts only when the question names nothing else.
   - The first specific family the question names still leads, as before.
   - A broad family the question names (fees, finality, x402, digital payment tokens) now also counts. This is what admits the fee article for C5.
   - Among eligible articles, a specific family ranks before a broad one.
   - A requested fact that names only a qualifier keeps the question's subject. "Can my agent pay it with XRP on Testnet" no longer admits a Testnet server list.
2. **The question's own explainer** (`server/agents/decision.ts`, H8-05).
   - For a protocol question, an article whose public title states the question (`titleMatches`) is admitted and ranked first among eligible articles, whatever wording the planner gave the requested fact.
   - Under the fixture judge it is also scored against the question, and the higher score counts. **The threshold is unchanged.**
   - Finance questions keep the old value order.
3. **Over-buying** (`server/agents/loop.ts`, H8-06).
   - Under the fixture coverage judge, a requested fact is not bought for again once the run has a verified article whose title states that fact (`titleCovers`).
   - The coverage the reader sees is unchanged, and live coverage judges are unaffected.
   - The question splitter now also separates ", and can …" clauses, so a two-part question gets one requested fact per part.
4. **Spending guard** (`server/agents/spending-guard.ts`, `server/agents/scope.ts`, H8-04).
   - The guard rejects purchase instructions and spending authority:
     - "buy the … article", "pay for …", "spend the remaining balance";
     - "… now", "raise the budget";
     - any budget or S$ the user did not mention;
     - "transfer 5 XRP to …".
   - It no longer rejects a payment word from the user's own question. Before this change, it discarded every live plan for a question containing buy, pay, price or purchase (6 of 6 in round 8).
   - The run's plan label now names the reason: `fixture · scope-fixture · spending guard | subject guard | planner unavailable`.
5. **Chat routing** (`server/agents/scope.ts`, H8-03).
   - Questions about XRPL, x402, agent payments, or how ResearchAgent pays, decides and refunds always go to research.
   - "What are you?" gets one fixed, reviewed statement, labelled `fixed · About ResearchAgent`. The statement says the decision model only scores, policy code makes every payment within the budget, and the writer is paid only by publishing the key.
   - A chat reply that drifts into product mechanics is replaced with the same statement.

## Limits

- **Fixture models only.** The hosted demo plans and writes with DeepSeek and decides with the fixture model. Its requested facts differ from the fixture extraction used here. A live consistency run (the same questions twice on a local `HOSTED=1` stack) was not done in this lane.
- **D3 is still a miss.** For "Which XRPL amendment and issuer flag does token escrow need?", entity precision prefers the generic escrow explainer, because its facets list every escrow transaction name. Its title does not state the question, so the new title rule does not apply.
- **B1 and B5 still buy three articles.** The fixture coverage judge grades their facts "missing", and no bought title states the fact. Live decisions (owner item #265 B0) are the real fix for over-buying.
- **Lead slot.** When the requested fact is the whole two-part question, the lead slot can be empty even after the right purchase. Splitting ", and can …" fixes A2. The general fallback is lane R8-B's (`shared/lead-finding.ts`).

## Reproduction

```
OFFSET=4500 LLM_PROVIDER=fixture DECISION_PROVIDER=fixture SETTLEMENT_RAIL=simulated SEARCH_EMBEDDINGS=off LANGFUSE_ENABLED=0 npx tsx scripts/k5-dev-measure.ts <dir>
npx tsx scripts/k5-compare-runs.ts <before-dir> <after-dir> comparison.json
npx vitest run tests/r8-judge-questions.test.ts
```

The dev-measure run takes about two minutes. Running the first command on `0c12748e` reproduces `before-summary.json`.
