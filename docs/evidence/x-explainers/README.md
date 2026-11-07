# XRPL explainers: content and dev measurements

The writer is **ResearchAgent builders · XRPL explainers (team-authored)**.
Disclosure: **team-authored explainer · sources cited · not an independent writer · Testnet**.
Identity is unverified; ordinary reputation, policy, price, signed manifests,
fact menus and delivery apply. No addition to `real-writers.json`, policy edit,
threshold adjustment or self-boost.

There are 22 focused, original explainers. They use the explicitly permitted
150–3,000-word non-synthetic writer limits rather than padding to a benchmark
length. Public search metadata supplies each URL and access date; numbered
body citations refer to that ordered list. Factual exposition is separated
from author recommendations. Source selection came from the task's general
topic list, not individual bank questions. `sources.json` lists every article
and its primary sources, accessed 2026-11-07. No v4 bank was opened or run.
No activation date is asserted for Hooks, TokenEscrow or other amendments
without network evidence. Singapore coverage distinguishes the September
2026 consultation from enacted permissions. Legal discussion scopes checks;
it does not invent approvals, bank partners or exemptions.

## Verification and provenance

`npm run check:fast`: 166 files, 1,393 tests passed / one skipped;
20 chaos iterations, zero invariant violations. The new regression validates
all 22 manifests and deliveries and verifies source metadata survives the
public search boundary without body or passages. The unchanged eight-word
search oracle and expanded public-label scan pass. Roster/count assertions
and the current corpus hash are updated for this authorized addition;
historical goldens and frozen bank/constructed-coverage hashes are retained.

Initial local work encountered missing dependencies, followed by a temporary
invalid menu vocabulary entry while baseline audits were running. Baseline
runs resume their original packed artifact and private state with unchanged
intent keys; successful earlier results are retained. Failed early candidate
startup logs are diagnostics only; their package lacked its executable due
to overlapping local artifact builds. Final builds are sequential and use a
separate immutable tgz. No test, gate, timeout or threshold was relaxed.

The first search-leak check detected URL sequences duplicated between public
source metadata and paid reference lists. Paid bodies now use numbered
references; URLs stay public. The title-discovery regression exposed the
existing DID acronym/stop-word interaction; the title uses “Decentralized
identifiers”, without modifying retrieval or calibration.

## Reproduction

Fixture research and decision models, packed stdio MCP, real XRPL Testnet
settlement, public faucet funding only. No real money or live model calls.
Private wallet and journal state is retained outside the repository.

```
npm run build:sdk
node scripts/release-artifacts.mjs
RA_ACCEPT_TESTNET=1 JUDGE_BANK=eval/questions/judge-xrpl.v3-dev.json JUDGE_OUT_DIR=<fresh-output> J1_STATE_DIR=<private-state> npx tsx scripts/judge-bank-testnet.ts <immutable-tgz>
npx tsx scripts/gate-audit.ts --db <private-state>/researchagent/testnet/app.db
```

The same runner measures v1, v2, v3 and v3-negatives with separate directories.
`results.json` pins exact bank/artifact hashes and retains per-question misses;
`values.jsonl` records unchanged decision values. `full-state.gate-audit.json`
checks raw persisted snapshots and events. A negative bank intentionally
exits nonzero when any purchase occurs; such exits remain failures.
V1 and v2 have no frozen gold: answersIt is unavailable (0/0).

Final measurements are recorded in `summary.json` and the table below.

| Bank | Buy-and-cite before → after | answersIt before → after | Online verification before → after | Raw gate audit |
|---|---|---|---|---|
| v1 | 17/20 → 16/20 | unavailable → unavailable | 20/20 → 20/20 | 0 → 0 |
| v2 | 8/20 → 9/20 | unavailable → unavailable | 20/20 → 20/20 | 0 → 0 |
| v3 | 2/20 → 7/20 | 0/20 → 1/20 | 20/20 → 20/20 | 0 → 0 |
| v3-dev | 1/20 → 6/20 | 1/20 → 2/20 | 20/20 → 20/20 | 0 → 0 |
| v3-negatives | 2/10 → 2/10 | unavailable → unavailable | 10/10 → 10/10 | 0 → 0 |

Negative buys remain 2/10: N03 and N08; no newly buying negatives. Both negative-bank exits remain failures. The answer-quality target is missed: v3 answersIt is only 1/20 and v3-dev only 2/20. Coverage gains do not establish general answer quality or live-model performance. No threshold tuning is included.
