# Round-10 routed QUAL findings

Original MJ10 report: local main 564e317a. Its raw sessions were deleted. `r10-routed-before.json` instead contains six new local HOSTED=1 live-DeepSeek samples on QUAL 7237044b, before these additional routed fixes. Readiness is stubbed healthy; decisions are fixture, settlement simulated, search keyword-only. No hosted questions or ledger writes. Frozen plans are recorded in tests/fixtures/r10-routed-plans.json. Live-provider billing is not measured; article spend is simulated accounting.

The 21 deterministic after cases retain the captured plans byte-for-byte: three question wordings for each routed subject, plus three RLUSD wordings with its previously captured plan. Paraphrases are labelled fixture paraphrases. These are used development cases, not MJ10's deleted sessions or a blind bank. The 18-case before artifact was captured before the routed fixes; the additional RLUSD cases are counter/trace guards, not paired before measurements.

| Route | Exact-question before (fresh live capture) | After (same-plan fixture replay) |
| --- | --- | --- |
| H10-01 reserves | One S$0.40 reserve article, figures already fixed by P1 | One S$0.40 reserve article, 1 XRP base and 0.2 XRP per object, 3/3 supported |
| H10-02 Credentials | Acceptance only, falsely 3/3 and no gaps | CredentialAccept + CredentialCreate, S$0.80; meaning/contents honestly missing, 2/3 |
| H10-03 x402 | One S$0.40 article, P1 already supplies header and XRP/Testnet | One S$0.40 article; header leads, XRP/Testnet follows, 2/2 |
| H10-04 injection | Empty lead despite a direct cited claim | Direct budget/policy/no-model-signing lead; narrower planner-added network claim remains missing |
| H10-05 submitters | P1 already supplies eligible submitters, generic authorization gap remains | Any account may submit either; destination/owner receive principal; generic gap remains, 2/3 |
| H10-07 no-show | Two wrong-focus articles, S$0.80; recovery missed | Correct no-show article, S$0.40; CancelAfter/EscrowCancel recovery leads; 1/4, other plan claims remain missing |

The checklist, persisted gaps, COVERAGE event and purchase loop now use the stored coverage judgment. Display-only lead promotions were removed. Each missing fact remains missing unless its own cited evidence supports it; a matching purchased title supplies no coverage. Semantic checks reject creation inferred from acceptance, meaning inferred from a transaction name, quantities inferred from unrelated digits, missing eligible submitters, missing vote mechanics and activation dates inferred from dated status observations. Conflicts and provider errors remain unchanged.

The existing normalized half-word rule now also recognizes nonnumeric fixture facts. Its numeric threshold is unchanged; explicit capability and named-action rules recognize the supported protocol facts. Search vocabulary adds key non-delivery and malicious-instruction terms. Quantity rank precedes broad title matching; the frozen fact's title and transaction actions rank before unrelated members. A planner-added network can no longer veto a direct answer to the question. The exception is confined to purchase eligibility: broadening publisher retrieval was reproduced to crowd AMMVote out of bounded search, then reverted. A prevention question prefers the constraint over surrounding process detail. The no-show guide is versioned v2, with a clearer cited first sentence and its corrected fact-menu entity.

`tests/r10-routed-judge-questions.test.ts`: 38 checks, including three wordings per subject, captured-plan identity, the acceptance-only negative evidence, unknown dates, and empty evidence. The existing r8/r9/r10, entity, requested-fact and scenario assertions passed unchanged, except the new P1 display-only expectation was superseded by the shared stored-judgment contract. 294 focused tests passed, followed by 38/38 routed checks including three additional eligibility negatives. The derived promise-label snapshot records the corrected no-show fact-menu entity; historical corpus pins and all bank scorers remain unchanged.

Fresh after live samples and final bank/gate evidence follow once completed.
