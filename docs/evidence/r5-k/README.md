# Round 5 Lane K: answers and honest declines

Fixture research and decision models; real team-authored content; identity unverified; XRPL Testnet public-faucet funds only. No real value, cloud resources, live model calls or independent-writer claim.

## Measurement

Pre-A shipping snapshot: V1 development **9/20 answers-it**, **17/20 buy-and-cite**, **gate audit 0**. V3 held-out **0/20 answers-it**, **2/20 buy-and-cite**, **gate audit 0**. The ≥12/20 V3 target is missed. Ledger verification passed 17/20 and 2/20 respectively, with failures confined to missing abstention anchors in this pre-A artifact.

The shipping artifact is `/tmp/r5-k-shipping-artifact/researchagent-mcp-1.0.0.tgz`. `shipping-v1/results.json` and `shipping-v3/results.json` pin its SHA-256 and each bank SHA-256. V3 arrived on main in #401 before the final runs. V1 is development data and has no upstream gold field: `v1-gold.json` states this lane's literal key phrases. V3 uses its frozen `gold` fields without changes. No policy, question, threshold or timeout was tuned.

Historical commands (retired tools; run from the complete `b0a67ffa` tree in a separate checkout, with its dependencies and packed artifact):

```
RA_ACCEPT_TESTNET=1 J1_STATE_DIR=<private-state> JUDGE_OUT_DIR=docs/evidence/r5-k/shipping-v1 JUDGE_BANK=eval/questions/judge-xrpl.v1.json npx tsx scripts/r5-k-bank-testnet.ts <tgz>
RA_ACCEPT_TESTNET=1 J1_STATE_DIR=<private-state> JUDGE_OUT_DIR=docs/evidence/r5-k/shipping-v3 JUDGE_BANK=eval/questions/judge-xrpl.v3.json npx tsx scripts/r5-k-bank-testnet.ts <tgz>
npx tsx scripts/r5-k-score.ts docs/evidence/r5-k/shipping-v1/results.json
npx tsx scripts/r5-k-score.ts docs/evidence/r5-k/shipping-v3/results.json
```

For a new measurement, use `scripts/judge-bank-testnet.ts` as documented in `docs/eval-judge-banks.md`. Original v1 legacy acceptance requires `JUDGE_ACCEPTANCE=1` and retains ≥12/20 buy-and-cite. The historical scorer mutates `results.json` with v1-gold fallback; the current lead scorer emits separate display scoring. They are not interchangeable: do not overwrite these frozen results with a new scorer.

The scorer uses the final screen/export lead selector on purchased, cited claims in the exported receipt bundle. It checks literal case-insensitive gold inclusion in the first two sentences and a purchased citation. `capturedLead` retains the original harness extraction. Receipt/verification files retain all misses. This measures reading the purchased evidence, not independent semantic truth. Earlier diagnostic artifacts are retained in `v1/`, `v1-final/` and `v3/`; they are not the shipping result. Disclosure cleanup and complementary-sentence extraction happened during those diagnostics. No V3 question or gold was changed and no content was added to fit V3.

## Content and UI checks

`content-sources.json` records the original repo-doc sources and the stale IOU correction (#384). Template filler is 50 → 0 across the ten notes. Three remaining paid-body authorship-disclosure sentences were also removed; the public publisher/writer metadata retains the disclosure. Article versions are v2. Fact menus are derived with `shared/fact-menu.ts`; the existing publisher manifest pipeline signs those exact revised passages at startup. Corpus validation and the signed manifest/menu/leak suite pass without changing limits.

Updated goldens: `src/fixtures/uc/{uc2,uc3,uc4}.json` (stance only) and `corpus-golden.json` (rewritten prose hash). The historical bank and constructed coverage hashes remain pinned in the fact-menu test. Recorded `demo/traces/` is untouched.

`decline-state.png` is an explicitly synthetic three-row Tickets fixture, not a live writer submission. It shows the best value 0.16 vs threshold 0.20, each actual decision verdict/value/reason, and 5.0 seconds measured from the pre-draft start. Separate tests retain the zero-candidate message and publishing link. `popover-1440.png` and `popover-1280.png` come from Playwright bounding-box and axe checks; no intersection with Ask and no axe violations at either size.

Four static demo replay checks and live fixture UC3 purchase → failed proof → refund → replacement purchase pass. The UC3 numeric supporting claim stays under Supports; introductions are withheld from Disputes. All on-bank paid citations are to team-note passages; the keyword relevance floor and introduction filter prevent unrelated fictional prose from appearing in the stance groups.

## Limits retained

The requested V3 target is ≥12/20. A miss remains a miss. Source coverage and deterministic purchase policy bound how many questions can have a purchased answer; Lane K does not change either the frozen decision policy or the bank. Online ledger verification of a no-purchase run fails without an anchor in the evaluated artifact. Lane A owns that correction; its failed checks are retained here rather than changing verifier rules or the assertion. The acceptance harness deliberately exits nonzero when its buy/cite or verification assertions fail. Passing the fast gate does not make a failed live acceptance target pass.

## Follow-up after lane A (#403)

Rebased onto `e4ba5e9a`, preserving A's anchor-wait change in `mcp/tools.ts`. The old missing-anchor failures above are historical evidence, not the current anchor contract.

The orchestrator reported A's fresh UC3 full-state audit hit. The conservative static scan found nine overlapping eight-word windows across two notes: the refund cooperation disclosure in `team-recovery`, and the TEST-SGD asset label in `team-rlusd`. `public-label-before.json` retains all nine matches. Only paid passages were paraphrased; public disclosures and the existing gate detector were preserved. Derived fact menus and the corpus hash golden were regenerated. `tests/team-note-public-labels.test.ts` checks all ten paid notes and has a deliberately contaminated recovery body to prove the exact eight-word oracle still detects the refund sentence. The source scan covers runtime TS/JS literals and template segments, JSX text, public JSON metadata, and static HTML text (excluding generated assets and paid bodies).

The corrected immutable packed tgz is pinned in `fresh-uc3-artifact.json`. Extracted into a separate consumer directory, its **fresh UC3 try passes in 67.8 s**, verifies the create/finish/refund/re-buy/anchor chain online and prints one RESULT PASS. **The raw full-state gate audit is 0** across all rules, including premium_leak (`fresh-uc3-try.gate-audit.json`, one run). `fresh-uc3-try.log` retains the public refund disclosure and transaction links. The static scan checks **1,892 potential public strings**, with **zero overlaps** (`public-label-scan.json`).

Rebased fast gate: **164 files, 1,384 tests passed**, 20 chaos iterations and zero invariant violations. An earlier pre-commit attempt passed all tests but exited on an unrelated EPIPE; the complete gate was rerun and passed. Browser coverage includes the changed two-candidate decline contract plus a separate zero-candidate publishing invitation; existing assertions were replaced with the new specified behavior, not removed. The matched case accepts both truthful low-value and policy summaries because prior trust history can change the verdict.

Fresh post-A packed MCP banks are in `post-a-v1/` and `post-a-v3/`; all previous artifact runs remain labelled diagnostics. No question, gold, policy, threshold, verifier or timeout was changed.

## Final bank results after A and the label fix

| Bank | Answers-it | Buy-and-cite | Online verification | Full-state gate violations | Fictional Supports/Disputes |
|---|---:|---:|---:|---:|---:|
| V1 development | 9/20 | 17/20 | 20/20 | 0 | 0 |
| V3 held-out | 0/20 | 2/20 | 20/20 | 0 | 0 |

**The requested ≥12/20 V3 answers-it target is missed.** Eighteen V3 questions supplied no purchased evidence; the two purchased results lacked their frozen gold phrases in the lead. No policy or bank change was made to turn these misses into passes. The V3 harness retains its nonzero exit at the unchanged buy-and-cite acceptance assertion. V1 completes successfully. Results pin the same corrected tgz as the successful UC3 try. `post-a-*/full-state.gate-audit.json` audits raw persisted snapshots and every event; `ui-audit.json` renders each actual run and checks the stance groups.

The final display/export extraction supplies delivered cited passages directly to `leadFinding`; it does not rank a model's paraphrase as if it were source text. Its added regression uses a paraphrased claim with a real passage, and verifies exact passage extraction and withholding when no delivered passage is supplied. The final scorer reconstructs this display from each packed-MCP receipt bundle; `capturedLead` retains the earlier harness extraction. This final display-only call-site change follows the pinned network artifact; payment/corpus/anchor behavior is unchanged. Local report tests (20), lead/stream tests, all four static demo replays, and both viewport/axe plus decline checks pass after that change.


After #405 landed, the final results were rescored with its canonical `answersIt` helper (`Intl.Segmenter` for the first two sentences, normalised gold, exact purchased citation identity). The counts remain 9/20 and 0/20. V1's 9/20 uses this lane's explicitly declared development rubric in `v1-gold.json`; the upstream V1 bank has no frozen gold, so this is not an official frozen-gold benchmark or held-out score. V3's 0/20 uses its original frozen gold. #405 changes measurement tooling only; no decision threshold changed on integration.
