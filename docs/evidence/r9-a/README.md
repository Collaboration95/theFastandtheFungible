# R9-A: the first click is right (11 November 2026)

Round 9 of the mock judges (`notes/review-nov10/13-mock-judges-r9.md`) found the hosted demo's first preset, "RLUSD escrow", buying three articles (S$1.20) and leading with "EscrowCreate locks funds…", where round 8 bought one and led with AllowTrustLineLocking (H9-01). The hosted demo plans with the live model and decides with the fixture model. Earlier lanes measured "presets identical" only with the fixture planner, so the live wording was never tested. This lane fixes that path and measures it with the planner's own wording.

Everything below is **regression data on questions already seen**, never a held-out result.

## 1. The live-planner path, replayed (`r9-judge-questions.json`)

The round-9 judges recorded both live DeepSeek plans for each question: the plan the visitor confirmed in the 5 s modal (`modal`) and the plan the hosted run re-planned at start (`run`, H9-04). `tests/fixtures/r9-live-plans.json` holds them, and `tests/fixtures/r9-live-shaped.ts` replays them through the real engine: fixture decisions and research, SIMULATED payments, keyword search. On `main` it reproduces the hosted results: the RLUSD preset bought `team-rlusd` → TokenEscrow → EscrowCreate and led with EscrowCreate, the fee question bought the key-reveal delivery note first, and E5 bought two off-topic articles.

| Question | Wording | Main (3157fe41) | This branch |
| --- | --- | --- | --- |
| A1/E1 RLUSD preset | modal and run | 3 · S$1.20, lead "EscrowCreate locks funds…" | **1 · S$0.40** (`team-rlusd`), lead "The team documented official RLUSD as blocked until its issuer enables **AllowTrustLineLocking**." |
| A3 "How much does one key-reveal purchase cost in XRPL network fees?" | run / modal | `team-delivery` first, lead "XRPL transaction fees destroy XRP…" | **`team-fees` first**, lead "EscrowFinish with a fulfillment cost **423 drops**…" (run 1 buy, modal 2) |
| E5 "Which XRPL validators are run by Singapore banks?" | modal / run | 3 · S$1.20 / 2 · S$0.80 | **0 · nothing bought** |
| D4 "…the writer never reveals the key…" | modal (now runs) | 3 · S$1.20 | 2 · S$0.80, **includes `product-escrow-no-show`** |
| C5 reserves | modal | 3 · S$1.20 | 2 · S$0.80 |
| A2/F2 x402 402, A4 token escrow, D1 travel rule, D2, D3, B1, E2, E4 | both | — | **unchanged purchases and leads** |

The full table, with leads, is in `r9-judge-questions.json`.

## 2. Local hosted stack with the live planner (`hosted-live-acceptance.json`)

A local `HOSTED=1` stack in one process: the real hosted gateway, `POST /api/scope` then `POST /runs` with one Idempotency-Key (as the web app does), the live DeepSeek planner and research writer from the owner's `.env` (never printed), fixture decisions, SIMULATED payments, an in-process writer server and ephemeral ports. Each question got a fresh live plan, so the wording differs from round 9's.

| Question | Bought | Lead (first sentence) | PLAN = modal plan |
| --- | --- | --- | --- |
| x402 402 (preset 1) | `product-x402-response` · S$0.40 | "an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; …retries with PAYMENT-SIGNATURE." | yes |
| RLUSD escrow (preset 2) | `team-rlusd` · S$0.40 | "The team documented official RLUSD as blocked until its issuer enables AllowTrustLineLocking." | yes |
| Account reserves (preset 3) | `xrpl-reserves`, `xrpl-tx-trustset` · S$0.80 | "An XRPL wallet needs a base reserve plus applicable owner reserves…" | yes |
| A3 fee question | `team-fees`, `team-recovery` · S$0.80 | "EscrowFinish with a fulfillment cost 423 drops in our observed XRPL Testnet conditional finish…" | yes |
| D4 writer never reveals the key | `product-escrow-no-show` · S$0.40 | "a buyer can recover an unfinished key-reveal escrow with EscrowCancel after CancelAfter; …" | yes |
| E5 Singapore bank validators | nothing · S$0 | (decline) | yes |
| D1 travel rule | `c5-fatf-recommendation-16-travel-rule` · S$0.40 | "Recommendation 16, the travel rule, applies to virtual-asset transfers: …" | yes |
| A4 token escrow (S$0.50) | `c5-xrpl-token-escrow-xls85` · S$0.40 | "the proposed TokenEscrow amendment…" | yes |
| B2 "Can the language model … spend money on its own?" | `product-prompt-injection` · S$0.40 | "The decision model can recommend whether evidence is useful, but recommendations pass through independent spending checks." | yes |
| A5 EscrowFinish vs EscrowCancel | `xrpl-escrow` · S$0.40 | "EscrowCreate establishes the obligation, EscrowFinish releases it…" | yes |

Every run has exactly one `PLAN` event, and its plan and requested facts equal what `/api/scope` returned to the modal. About 50 live DeepSeek calls in total, a few US cents; no Testnet and no real money.

## 3. Development banks (`metrics.json`, `comparison.json`)

The same harness, bank hashes (`bank-hashes.json`, unchanged since R8-A3), scorer and gold phrases as [R8-A3](../r8-a3/README.md): fixture research and decision models, SIMULATED payments, keyword search. Before is `main` at `3157fe41`; after is this branch.

| Bank | Buy and cite | Lead states the key fact (`answersIt`) | Negative purchases | Articles per purchase run | Runs buying 3 | Spend |
| --- | --- | --- | --- | --- | --- | --- |
| v1 (20) | 19 → 19 | n/a (no gold strings) | n/a | 1.21 → **1.11** | 0 → 0 | S$9.20 → S$8.40 |
| v3 (20) | 20 → 20 | 18 → 18 | n/a | 1.45 → 1.45 | 1 → 1 | S$11.60 → S$11.60 |
| v3-dev (20) | 18 → 18 | 8 → **9** | n/a | 1.22 → **1.17** | 0 → 0 | S$8.80 → S$8.40 |
| v3-negatives (10) | 0 → 0 | n/a | **0 → 0** | n/a | n/a | S$0 → S$0 |
| v5, used (20) | 19 → 19 | 17 → 17 | n/a | 1.26 → 1.26 | 1 → 1 | S$9.60 → S$9.60 |
| v5-negatives, used (10) | 0 → 0 | n/a | **0 → 0** | n/a | n/a | S$0 → S$0 |

- **No question lost a result.** Every run finished `DONE` with zero gate violations and zero offline verification failures, before and after.
- **Changed purchases (4):**
  - v3-dev D08 "Besides the XRP Ledger, which other blockchain was RLUSD launched on?" no longer buys the micropayment pricing note first; its lead now names the seven networks (answersIt 0 → 1);
  - v1 J17 (Credentials) and J19 (manifest checks) stop after the article titled with the question (2 → 1);
  - presets XRPL2 is now a different question (below).
- **UC1–UC3** (`uc`, `uc-frozen`) are unchanged.
- **Strict comparison:** 82 of 109 runs are policy-identical. The other 27:
  - the 4 above;
  - 21 with the same purchases, verdicts on bought rows, spend and lead, but small value differences on decision rows (the bank shares one reputation ledger, so an earlier question that bought less leaves a writer's trust slightly different), or a non-bought row now skipped by the entity rule (v3 V08 and v5 H14, the RLUSD currency-code questions);
  - the two other presets, whose order changed, which changes trust in the same way.
- **Presets:** XRPL2 was "What HTTP headers does x402 use on XRPL…" before and is the x402 402 question after. With the fixture planner it buys the 402 response explainer and the XRP-on-Testnet explainer, the design R8-A pinned, and leads with PAYMENT-REQUIRED. XRPL1 and XRPL3 keep their purchases and leads.

## What changed

1. **Stop rule** (`server/agents/loop.ts`, `answeredByPurchase`, fixture coverage judge only): once the bought titles name every clause of the question (`titlesNameQuestion`), no further fact is bought for, whatever the planner's wording.
   - Each clause with two or more subject words needs half of them in the titles together. A clause naming only the network ("can my agent pay it with XRP on Testnet") counts all its words, so the x402 question can still buy its XRP-on-Testnet explainer.
   - A question that asks for a named thing ("which transaction type…") is left to R8-A2's per-purchase rule. A first version without this exception cost v3 V12, v5 H09 and v5 H10 their answers, so it was not shipped.
   - The finance story-bible cues ("change", "react") no longer exempt a protocol question from this rule. "Who can vote to change it" stops after AMMCreate and AMMVote.
   - It only withholds spending. Coverage shown to the reader is unchanged.
2. **"How much" questions prefer the title naming the measure and unit** (`server/agents/decision.ts`, `measureRank`, H9-06): it ranks first among eligible rows, after a title matching the question. It makes nothing eligible.
3. **A place or organisation must be matched with the subject** (`decision.ts`, `namesEntityAndSubject`, H9-08). For a technical question with no glossary family that names an entity ("Singapore"), a candidate's title and topics must name that entity and one more subject word.
4. **Lead for a contents question** (`shared/lead-finding.ts`, H9-13): for "What does X contain/include/carry", a sentence naming an identifier ranks up, and a caution naming none ("A 402 challenge is an offer to pay; it does not itself authorize spending.") ranks down. With the fixture planner the x402 question had led with the caution.
5. **The hosted run uses the confirmed plan** (`server/hosted/routes.ts`, H9-04):
   - `POST /runs` runs the plan this server stored for the question's scope (same Idempotency-Key; never the client body), with its label, and appends a `PLAN` event (plus `CLARIFY`), as the local route does;
   - a clarify answer re-plans, as locally;
   - this removes one planner call per question.
6. **Guard-refused scope plans** (`routes.ts`, `scopeWithPlanner`, H9-12): when the scope's live plan was refused by the spending or subject guard, one dedicated planner call is made before the labelled fallback stands.
   - The guard is unchanged and checks that plan too.
   - Live probe: the scope model wrote "budget" itself in 2 of 2 calls for B2, so without this the confirmed plan would be the fallback, and running it declined.
7. **Presets** (`shared/contracts/examples.ts`): x402 402 first (replacing the overlapping "x402 headers" preset under the same id, `XRPL2`), RLUSD escrow second, account reserves third.
8. **Per-network start limit** 3 → 6 a minute (`server/hosted/limits.ts`, H9-09). Daily per-address question and money caps are unchanged.

## Reproduction

```
LLM_PROVIDER=fixture DECISION_PROVIDER=fixture SETTLEMENT_RAIL=simulated SEARCH_EMBEDDINGS=off LANGFUSE_ENABLED=0 npx tsx scripts/k5-dev-measure.ts <dir>
npx tsx scripts/k5-compare-runs.ts <before-dir> <after-dir> comparison.json
LLM_PROVIDER=fixture DECISION_PROVIDER=fixture SETTLEMENT_RAIL=simulated SEARCH_EMBEDDINGS=off LANGFUSE_ENABLED=0 npx tsx tests/fixtures/r9-live-shaped.ts out.json modal   # or: run
npx vitest run tests/r9-judge-questions.test.ts tests/r8-judge-questions.test.ts tests/k4-presets.test.ts
```

## Limits

- **Fixture decisions only.** The live decision model (owner item: rotate the OpenAI key) was not measured. Measure the presets with it before switching.
- **Live plans vary.** Section 2 is one fresh plan per question; section 1 is the two recorded wordings. The tests pin the recorded wordings.
- **Not fixed here:**
  - H9-10 (open gaps): PR-B;
  - H9-05 (product explainers): PR-C;
  - the busy line beside a rate-limit notice (needs `src/App.tsx`, owned by R9-B);
  - capitalising a lead server-side (the lead must stay an exact quote; the web view capitalises it).
- **D4 with the round-9 run wording** still buys only the key-reveal trust explainer. With the confirmed plan, which now runs, it buys the no-show article.
