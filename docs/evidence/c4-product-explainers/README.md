# C4 agent-payment and product explainers

14 additions through the existing C3 writer. Disclosure remains **team-authored explainer · sources cited · not an independent writer · Testnet**. Every article costs 40 minor units (S$0.40 display accounting), has four exact passages, answers first, cites primary sources and is 209–235 words. Fixture models and faucet-funded XRPL Testnet; no real value or live model provider.

Topics were chosen from round 7's observed Q1–Q4, P2 and Claude Code questions, H7-08, and the owner's generic product FAQ. No evaluation bank informed authoring. No v4 or v5 bank was opened or evaluated. The routine upstream schema/hash regression for v5 is part of the unchanged shipping gate and does not print question text.

The additions cover the x402 challenge and retry, native XRP facilitation, injection containment, payment finality, budgets/caps, delivery versus refund trust, no-show cancellation, receipt verification, answer anchors, writer Credentials, RLUSD/XRP/TEST-SGD, MCP, the AI Starter Kit and micropayment pricing/fees. `inventory.json` maps each article to its source and selection origin. Numbered citations map to the ordered public `sources` metadata; project statements use public commit-pinned repository docs/code URLs. Paid bodies contain no internal paths or engineering instructions. Author interpretation is explicit.

No runtime, search, lead, guard, scoring, decision or payment-policy files changed. No embeddings or self-boost. K4 owns retrieval and answer quality. The exact package comparison in `artifacts.json` proves the candidate adds 14 article members while all 300 original members remain byte-identical.

## Intended pins and checks

The current corpus pin is intentionally advanced only for these 14 additions: 147 → 161 explainers and 220 → 234 paid articles. `corpus-golden.json` records the current content hashes; the C3 and earlier historical pins are preserved. The fact-menu regression now points to the C4 pin, retains exact automatic derivation outside each authored first-passage menu, and retains exact-passage binding and schema checks. No test, threshold, leak rule, timeout or budget is loosened.

Targeted corpus, signature, exact delivery, public metadata and fact-menu tests pass. Paid-body lint passes with 234 articles and zero internal-text violations. The FAQ regression checks all 14 articles, 150–300 words, four exact passages, paragraph citation bounds, existing writer/price and pinned project source URLs. Initial authoring failures (a digit in a fact-menu label and an attribution not recognized by the named-source checker) were corrected in content without changing validation.

## Development measurements

Only v1, v3, v3-dev and v3-negatives run before/after. Full gates and CPU-heavy acceptance use the shared heavy lock. Initial bank invocations also used it under the original brief. The orchestrator corrected that rule during measurement: I/O-bound Testnet banks must run without the lock. The candidate v1 invocation was stopped, its owned packed process terminated, and resumed with the identical state/output directories and J1_RESUME=1. Its completed rows and original log were preserved; remaining banks run without the lock. The baseline is the immutable package from `ce9a83a2215f195587cafae48dcf859925572c10`; its source/data snapshot is retained privately for running the audit against the matching corpus. Candidate measurements use the matching unchanged runtime with the 14 additions. Ports use offset 2100 where assigned; packed MCP services use OS-assigned ephemeral ports. Wallet state is private and excluded from this evidence.

Reproduction uses `npm run build:sdk` and `node scripts/release-artifacts.mjs`, then the unchanged `scripts/judge-bank-testnet.ts` runner with `RA_ACCEPT_TESTNET=1`, the selected `JUDGE_BANK`, a fresh `JUDGE_OUT_DIR`, private `J1_STATE_DIR`, and the pinned MCP package. Baseline code/data came from `git archive ce9a83a2215f195587cafae48dcf859925572c10`; the candidate changes only the 14 inventoried article members. Resume uses those same directories and artifact with `J1_RESUME=1`. Never commit wallet state or select a held-out bank for this recipe. The bank runner intentionally exits nonzero for any negative purchase, including the retained baseline failures; that assertion is unchanged.


| Bank | Paid candidate found | Buy-and-cite | answersIt | Negative buys |
|---|---|---|---|---|
| v1 | 20/20 → 20/20 | 17/20 → 19/20 | unavailable → unavailable | unavailable → unavailable |
| v3 | 18/20 → 18/20 | 11/20 → 14/20 | 5/20 → 5/20 | unavailable → unavailable |
| v3-dev | 16/20 → 17/20 | 8/20 → 10/20 | 1/20 → 2/20 | unavailable → unavailable |
| v3-negatives | 5/10 → 5/10 | 2/10 → 2/10 | unavailable → unavailable | 2/10 → 2/10 |

All 140 completed runs passed online receipt verification and report zero raw gate-audit violations. Negative buys remain 2/10, the same N03/N08 failures; both negative runner exits remain failures under the unchanged zero-negative assertion. This meets the requested non-increase, not a zero-negative claim. Original results, decision values and logs are retained; archive/member hashes are in `receipt-archives.json`. Independent offline verification after archive extraction is recorded in `offline-verification.json`. No v4/v5 measurement was run.

These are isolated C4 development measurements on the pinned pre-integration runtime. They are not new measurements of subsequent K4 or other upstream runtime changes. Shipping admission is separately run on the final integrated PR and exact merged commit.


Initial integrated shipping gate: 186 unit files / 1,526 tests passed. The app browser suite passed 26/27; its exact decline-match count expected 2 but two intended additions now produce 4. Both exact count assertions are re-pinned 2 → 4; the policy-decline, no-false-answer, publishing-link and loading-state checks remain. Original failed receipt: `1794328511399-94363-23f66f67-06ec-4425-966f-d58b75ea71ae.json`. No threshold is relaxed.
