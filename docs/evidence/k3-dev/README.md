# K3: answer composition and bounded buying policy

Fixture research/decision models, XRPL Testnet and public faucet funds only.
No v4 or v5 bank was opened or run. No corpus/article content changed.
All 70 baseline and 70 final questions completed DONE with online receipt
verification and zero gate-audit violations. Lead text is at most 40 words;
all final conclusions are at most 120. This is development evidence, not a
new held-out score, live-model test or production claim.

| Dev bank | Buy and cite | Answers it | Negative buys | Conclusion words (mean / max) | Purchases per question |
|---|---|---|---|---|---|
| v1 | 16/20 -> 16/20 | n/a (0/0) | 0 -> 0 | 418.40 / 621 -> 85.15 / 120 | 1.10 -> 1.10 |
| v3 | 7/20 -> 7/20 | 4/20 -> 3/20 | 0 -> 0 | 136.65 / 650 -> 44.75 / 119 | 0.35 -> 0.35 |
| v3-dev | 6/20 -> 6/20 | 2/20 -> 2/20 | 0 -> 0 | 159.75 / 754 -> 40.75 / 120 | 0.30 -> 0.30 |
| v3-negatives | 2/10 -> 2/10 | n/a (0/0) | 2 -> 2 | 351.60 / 702 -> 37.10 / 120 | 0.20 -> 0.20 |

Full per-question counts, spend, word counts and verification flags are in
`summary.json`. `runs.tar.gz` preserves exact results, all decision-value rows
and every exported receipt bundle. Wallet state and seeds remain outside Git. The archive also retains the completed audit-directed diagnostic artifact (6c8683fe...), including its v3 3/20 answers-it miss: a transaction-type bonus incorrectly applied to a why-question about fees. The final selector restricts that bonus to naming questions; the diagnostic is not the final score. The final v3 score remains 3/20 versus 4/20 before: V10 still chooses a wallet/transaction-fee caveat instead of the owner-reserve explanation. Its longer cited conclusion includes reserve evidence; the shorter displayed lead does not meet the frozen answer phrase. This regression is retained and reported, not rescored as a pass.
The negative runner's zero-buy assertion remains unchanged and fails on both
sides for the two pre-existing negative purchases (N03/N08); this is not a clean
negative-bank pass. K3 must not increase that count.

## Frozen inputs and reproduction

Baseline source: `2d3999f82dacc3cbcfdee46f1c599e64a7ba2042`.
Baseline MCP tgz SHA-256:
`72f32ec541a4faa742ce19a51bc91d2ffdccfc01d8ef8122e5a44518590b777f`.
Final MCP tgz SHA-256:
`40e360335957443a95897ca72d2990a95ceded1fcac256dfcafed3ac534196f9`.
Bank byte hashes are retained in `summary.json` and the raw results. The final
artifact contains all audit-directed implementation changes; later edits add this evidence, the SFF changelog line, a legacy report citation-number guard and its regression, and a stricter assertion that UC fixture claim bodies are unchanged. Those edits do not change answer selection or purchase policy. Measurements isolate K3 on the pre-C3 corpus; independently merged corpus/UI work is not attributed to K3 scores. The integration gate covers the rebased PR head.

Built with `npm run build:sdk` then `node scripts/release-artifacts.mjs`.
For each of v1, v3, v3-dev and v3-negatives, use the documented runner:

```sh
RA_ACCEPT_TESTNET=1 JUDGE_BANK=eval/questions/judge-xrpl.v1.json JUDGE_OUT_DIR=/tmp/k3-shipped-v1 npx tsx scripts/judge-bank-testnet.ts /tmp/k3-shipped-artifact/researchagent-mcp-1.0.2.tgz
```

Use distinct output/private-state directories per bank. No .env is loaded.
Before answers-it scores are reconstructed with the original selector from the
baseline commit and the unchanged canonical scorer. Final scores use the stored
`answer.lead`, which the web, MCP and SDKs present. v1/negatives have no gold
phrases, so answers-it is unavailable. No gold, scorer, threshold or negative-buy
assertion was changed to improve a result.

## Composition and provenance

The fixture previously chose broad claims across retrieved tags; citation
validation then joined all of those entire passages into the conclusion. That
attached unrelated finance/Johor material and made word limits impossible.
Composition now filters unrelated evidence before either provider, binds exact
passages, and selects a separate lead/conclusion. Purchased delivered passages
win over free evidence. Whole sentences are preferred; a long sentence can lose
a trailing explanatory clause only at a safe boundary, preserving negation and
conditional premises. Remaining detail is under collapsed Show work.

Named transaction/field/header/scheme/permission coverage precedes breadth;
identifier-only answers need no numeral. Quantity facts retain their numeric
requirement. The first frozen requirement contributes to lead ranking. Model
conclusions are never displayed unbound. Offline verifiers reject fabricated
lead text. Existing stance heuristics remain detail metadata and never prefix a
verified purchased lead. The RLUSD preset replay now starts with the delivered
AllowTrustLineLocking sentence. Reports and writer Contact derive provenance
from source metadata instead of declaring all real/team-authored text fictional.

## Policy exception and unchanged stories

The value threshold remains 0.20. One new-writer probe may bypass it only for
the top search hit, relevance >=0.40, an entity-matching facet, price <=S$0.30,
zero recorded prior sales, and the prompt cap/budget. Trust quarantine, rewrites,
scope/fact-menu checks and settlement verification still apply. A wallet-keyed
SQLite reservation prevents another probe across concurrent runs, questions,
restarts and pruning. Its exact receipt/UI label is
`probe purchase · new writer`. The plan discloses the possible probe.

`uc-decisions.json` retains both packed UC1-UC3 runs. All decision fields are
identical after excluding per-instance wallet/manifest/URL/advisory-verification
metadata. Spend remains UC1 S$0, UC2 S$0.90 and UC3 S$0.70. No story decision-row
exception was needed. The unscoped README margins question intentionally gains
a S$0.30 Kopi probe before buying the missing NotFT margin evidence. Its test
explicitly checks both articles and the label.

Changed tests reflect the intended 40-word lead and collapsed detail: UC1 keeps
its rate change in the lead and yield fact in full claims; Q07's former miss with
the old passage selector disabled becomes an exact cited lead recovery, while
Q48 retains that miss. Browser stance/visibility assertions follow the new UI.
No hard gate, spending cap, leak check, timeout or bank assertion was weakened.

## Follow-ups outside K3

- Engine audit A12: `server/publisher-client.ts` still needs full signed free-body
  delivery verification before ingestion, including salts/leaves/word count,
  rather than signature/identity checks alone. Unsigned legacy free-source
  policy must remain explicit. This file was not changed by K3.
- A09 routing: technical research vs chat and payment-terminology handling in
  `server/agents/scope.ts` remain a separate change. K3 fixes selection and bleed.
- V10 answer-first recall remains a development miss after the 40-word cap (4/20 -> 3/20 on v3); it needs a general causal-answer ranking improvement, with no bank-specific phrase rule.
- Corpus coverage and cleaning article bodies remain C3's lane. No new blind
  score is claimed; only the orchestrator may run the untouched held-out banks.

## Validation

- Full local gate passed before evidence finalization: unit, Python, browser
  app/demo/judge/perf, SDK packaging, chaos and desktop build. The final clean PR
  head and exact merged SHA receive published local-gate statuses separately.
- `npx vitest run tests/report.test.ts src/fixtures/presentation.test.tsx`:
  24 tests passed, including a legacy lead absent from old findings receiving a
  real numbered appendix citation, and unchanged UC fixture claim bodies.
- Python offline verification passed on the final J01 and D14 Testnet receipt
  bundles; online ledger checks are deliberately skipped offline. The official
  runner separately verified every question online.
