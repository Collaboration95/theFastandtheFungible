# R8-A2: buy the article that states the fact, and stop when a further one adds nothing (11 November 2026)

These are local development measurements: **fixture research and decision models, SIMULATED payments and keyword search**. They are not Testnet, live models, the hosted demo or a held-out bank. The harness, bank hashes (`bank-hashes.json`), scorer, gold phrases and thresholds are the same as [R8-A](../r8-a/README.md), [K5](../k5-dev/README.md) and [C5](../c5-coverage/README.md).

## Read this first: this is a regression check

Every bank below is **used development data**: v1, v3, v3-dev, v3-negatives, v5 and v5-negatives. The questions this lane fixes come from the round-8 mock judges (`notes/review-nov10/12-mock-judges-r8.md` §1), and the rules were checked against these banks while they were written. **None of these numbers is a held-out improvement.** The aim was to fix the judges' misses without losing anything on the banks.

## Result on the development banks (`metrics.json`)

The before run is `main` at `8f925b6f`, which has R8-A, R8-B and v1.1.0 merged (`before-summary.json`). The after run is this branch, rebased on it (`after-summary.json`). The same pair on `4107ebab` gave identical metrics. R8-B changed only the lead finder, so its effect shows up in both runs: v3-dev D07 now answers in both.

| Bank | Buy and cite | Lead states the key fact (`answersIt`) | Negative purchases | Articles per purchase run | Runs buying 3 | Spend |
| --- | --- | --- | --- | --- | --- | --- |
| v1 (20) | 19 → 19 | n/a (no gold strings) | n/a | 1.47 → **1.21** | 2 → **0** | S$11.20 → S$9.20 |
| v3 (20) | 20 → 20 | 17 → **18** | n/a | 1.65 → **1.45** | 5 → **1** | S$13.20 → S$11.60 |
| v3-dev (20) | 18 → 18 | 8 → 8 | n/a | 1.50 → **1.22** | 3 → **0** | S$10.80 → S$8.80 |
| v3-negatives (10) | 0 → 0 | n/a | **0 → 0** | n/a | n/a | S$0 → S$0 |
| v5, used (20) | 19 → 19 | 16 → 16 | n/a | 1.68 → **1.26** | 5 → **1** | S$12.80 → S$9.60 |
| v5-negatives, used (10) | 0 → 0 | n/a | **0 → 0** | n/a | n/a | S$0 → S$0 |

- **Runs:** every run finished `DONE`, with zero gate violations and zero offline verification failures, before and after.
- **Spend:** spend on the four positive banks fell from S$48.00 to S$39.20; articles bought fell from 120 to 98 over the same 76 purchase runs.
- **Leads:** nine leads changed wording. None went from right to wrong; one went from wrong to right:
  - v3 V11, "Which transaction must the subject of a Credential submit to accept it?", now buys CredentialAccept, not CredentialDelete.
  - v3-dev D05, "Which EscrowCreate field stops an escrow being released before a given time?", now buys the EscrowCreate reference alone, not three escrow articles. Its lead still misses FinishAfter, as before.
- **Still buying 3:** v3 V16 (unchanged) and v5 H05. H05 ("Which XRPL amendment lets escrows hold issued tokens, not just XRP?") is a retrieval miss: neither TokenEscrow article reaches its candidate pool (see Limits).

### UC1–UC3 and the public presets (`comparison.json`)

- **UC1–UC3:** both sets (`uc`, `uc-frozen`) are policy-identical in 6 of 6 runs. Purchases, spend, refunds, every decision row and every lead match. The story-bible policy did not change.
- **Presets:** XRPL1, XRPL2 and XRPL3 are policy-identical, with the same leads.
- **Bank runs:** the strict comparison lists 62 of 109 runs as different.
  - The runs in a bank share one reputation store, so one changed purchase shifts the trust values of every later run in that bank.
  - Later rounds now record the new skip reason.

## The round-8 judge questions (`r8-judge-questions.json`)

These are the same 19 judge questions R8-A pinned, with fixture models and requested facts taken from the fixture extraction. The before run is `main` at `8f925b6f`; `4107ebab` gave the same purchases and leads.

| Judge question | Before | After |
| --- | --- | --- |
| D3 "Which XRPL amendment and issuer flag does token escrow need?" (S$0.50) | the generic escrow explainer; lead about conditions and time windows | **"What does the TokenEscrow amendment (XLS-85) let an XRPL escrow hold?"**; lead names the TokenEscrow amendment, and the article states the issuer's AllowTrustLineLocking flag |
| B1 "How do I make an XRPL escrow release only when a secret is revealed? Which condition type and fields?" | 3 articles: the crypto-condition explainer, then the EscrowCreate and EscrowCancel references (S$1.20) | **1 article**: the crypto-condition explainer (S$0.40); lead "the only supported crypto-condition type is PREIMAGE-SHA-256", then the Condition and Fulfillment fields |
| B5 "What does an XRPL Credential prove, and which transactions create and accept one?" | 3 articles, CredentialDelete first (S$1.20) | **2 articles**: CredentialCreate, then CredentialAccept (S$0.80); same lead |
| C3 "What's the difference between EscrowFinish and EscrowCancel, and who can submit each one?" | 2 articles: the EscrowCancel reference, then the writer no-show article (S$0.80) | **1 article**: the EscrowCancel reference (S$0.40). See Limits. |
| A1, A2, A3, A4, A5, B2, B3, C1, C2, C4, C5, D2, E1, E3, F1 | — | unchanged purchases and leads |

`tests/r8-judge-questions.test.ts` pins:
- D3, at S$0.50 and S$2.00, buys only the TokenEscrow article;
- B1 buys only the crypto-condition explainer;
- B5 buys CredentialCreate and CredentialAccept, never CredentialDelete;
- for each of the three, two or three different planner wordings of the requested facts buy the same first article and no more than the question needs;
- the ranking and stop rules directly, including the cases that must still buy (TrustSet, SignerListSet) and a live decision provider, which is never affected.

## What changed

1. **Ranking: a sibling transaction name the question never says adds no precision** (`server/agents/precision.ts`).
   - Entity precision used to count every word the protocol glossary adds to a question. For an escrow question that includes "create", "finish" and "cancel", from EscrowCreate, EscrowFinish and EscrowCancel.
   - The generic escrow explainer, whose topics list all three, therefore outranked the TokenEscrow article, which names the "amendment" the question asks about (D3).
   - CredentialDelete outranked CredentialAccept for an accept question (v3 V11) the same way.
   - Now only the question's own words, and glossary vocabulary that is not a CamelCase transaction name, count. Synonyms such as "payment required" for an x402 402 question still count, and that is why the presets are unchanged.
   - The narrative short-circuit also accepts plural answer types: "which transactions…" no longer zeroes precision for every candidate.
2. **Coverage stop: a further purchase must add part of the requested fact** (`server/agents/decision.ts`, fixture decision provider and protocol questions only).
   - A candidate gets the new verdict `SKIP_LOW_VALUE`, "Its title and topics name no part of the requested fact that a bought article does not already name", when the run has already verified a purchase and the candidate's public metadata adds nothing to the fact.
   - Two things count as new:
     - a word of the fact that no purchase names (CredentialAccept's "accept" after CredentialCreate);
     - a protocol identifier in the title, related to the fact, that no purchase names.
   - For a fact asking for a named thing, any family member counts unless the fact already names the members it wants. The TrustSet reference therefore still follows the trust-line explainer for "What must a holder submit…". CredentialDelete does not count for "which transactions create and accept one".
   - For any other fact, an identifier counts only while no purchase names a member of its family. SignerListSet follows the multi-signing explainer. EscrowCreate does not follow an article naming EscrowFinish.
   - A first purchase is never affected.
   - Live decision providers and story-bible cue rules are never affected.
   - The coverage the reader sees is unchanged.
3. **Plumbing.**
   - `server/agents/loop.ts` passes the public metadata of the run's verified purchases to the decision round, and R8-A's title stop reads the same list.
   - Its comment now says the logic uses the bought article's title, not a passage.
   - `shared/relevance.ts` exports the glossary helpers: aliases, identifiers, identifier family and member words.

## Limits

- **Fixture models only.** The hosted demo decides with the fixture model, so these rules apply there. Its planner is DeepSeek, so its requested facts are worded differently. The planner-wording tests cover the shapes seen so far, not every wording. No live run was made in this lane.
- **v5 H05 is a retrieval miss.** "Which XRPL amendment lets escrows hold issued tokens, not just XRP?" never names token escrow. The glossary expands "issued tokens" to trust-line words and "escrows" to the escrow transaction names. That pushes the TokenEscrow article to 8th place in its writer's hits, outside the decision pool. Its purchases are unchanged: 3 articles, and the lead misses the amendment. The fix belongs in retrieval (publisher search ranking or a token-escrow glossary family) and needs its own regression run.
- **C3's fixture lead slot is empty.**
  - C3 now buys only the EscrowCancel reference: the writer no-show article named nothing the first purchase did not.
  - Its four claims cite that reference, and the conclusion says any account may submit the cancellation.
  - The fixture coverage judge left "What's the difference between EscrowFinish and EscrowCancel" open, and the answer lists it as an open gap.
  - Before, the second article's refund sentences filled the lead slot. The empty two-part lead is the case lane R8-B's lead fallback (`shared/lead-finding.ts`) covers.
  - The EscrowFinish reference never reaches C3's candidate pool.
- **B5 still buys two.** The fixture coverage judge needs a figure or an exact identifier in a cited sentence, so "Which transactions create and accept one" stays open after both references. Live coverage judges (owner item #265 B0) remain the real fix for coverage-driven over-buying.

## Reproduction

```
LLM_PROVIDER=fixture DECISION_PROVIDER=fixture SETTLEMENT_RAIL=simulated SEARCH_EMBEDDINGS=off LANGFUSE_ENABLED=0 npx tsx scripts/k5-dev-measure.ts <dir>
npx tsx scripts/k5-compare-runs.ts <before-dir> <after-dir> comparison.json
npx vitest run tests/r8-judge-questions.test.ts
```

The dev-measure run takes about two minutes. On `8f925b6f` the first command reproduces `before-summary.json`.
