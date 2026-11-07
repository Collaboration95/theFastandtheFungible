# Fixture threshold development sweep

Outcome: keep 0.20. No threshold is promoted. The required dev waste ceiling fails at every grid point.

Only v1, v2, v3, v3-dev and v3-negatives are development inputs. Neither v4 file is opened, read or executed by this lane. Threshold grid: 0.10, 0.15, 0.20, 0.26, 0.281, 0.30. The grid brackets the observed negative values 0.2592 and 0.2807242360210443 and covers the low-value positive distribution. Historical distributions come from #405/#407; see grid-basis.json.

Each candidate changes only the metadata-fixture buy threshold and labels the model metadata-fixture@2. Artifacts are independently built with the release pipeline, then retained immutable in private scratch. The source is restored after building; no formula, scope/value/requirements policy, live threshold, test or gate changes. The #405 packed stdio runner uses real XRPL Testnet and faucet funds only, isolated state and ephemeral ports. This is fixture-model evidence, not live-model evidence. Negative-buy runner failures remain failures.

UC1–UC3 decision rows (including UC3 rounds 1 and 2) serialize byte-identically across all six thresholds: SHA-256 a80b6cc28e83eb36db94fce83225a3a4d47755ef63c3d4af4f4cf91ffca46ec7. Round-level model/threshold metadata is deliberately excluded from the row comparison; rows themselves are unmodified. See uc-rows.json and scripts/p1-uc-rows.ts.

The fixture scorecard requested-fact flow uses ONLY the 48 devIds from receipt-split.json, never its historical heldoutIds. All six points spend 1650 displayed SGD minor with 500 wasted (30.3030303030% gross), above 18.75%. This is a dev-split measurement, not a claim about the complete historical scorecard. No frozen-input hash is rewritten and no scorecard baseline is replaced. No threshold meets the required dev waste ceiling; keep 0.20. See fixture-scorecard-dev.json and scripts/p1-scorecard.ts. Payments here are simulated, separately labelled from the packed Testnet runs.

The final product retains metadata-fixture without @2 because no fitted version is adopted. Sweep candidate receipts carry metadata-fixture@2 to distinguish experimental artifacts. Existing defaults for luna, Clef and Clef-flash remain unchanged.

## Constraint decision

- Zero negative buys: 0.281 and 0.30 clear the observed dev negatives; 0.10/0.15/0.20 have 2/10, and 0.26 has 1/10 (N03).
- UC1–UC3 rows: all six points pass the byte comparison.
- Fixture-scorecard gross waste: all six fail 18.75%, measuring 30.30% on the dev split. No constraint is relaxed. Keep 0.20, despite its known negative purchases; this fallback does not certify the default as passing.
- Five hard gates: inspect per-bank full-state.gate-audit.json. Online verification remains a separate requirement.

## Reproduction and hygiene

`sweep.py` records the exact build/mutation/run procedure. It is an experimental driver, not production code. It changes only the fixture model label and fixture-specific threshold during sequential artifact builds, restoring the original file in a finally block. Never run it over existing private state or evidence; use new directories. It runs up to three bank processes concurrently. Artifact hashes are in artifacts.json; each results.json pins exact bank and artifact bytes. The measured source starts at ed1dbaa81cac81b1a06f9a07882bde1b89ccf61a (#407).

`python3 scripts/p1-threshold-summary.py` packages finished-bank receipts and verification reports with member hashes, retaining originals in private scratch. `values.jsonl` and the results histogram preserve every candidate row in every round; relevant/negative are question-bank groups, not human relevance annotations. Full 30-bank detail is in sweep-table.md and sweep-summary.json.

`npx tsx scripts/p1-uc-rows.ts` asserts byte equality. `npx tsx scripts/p1-scorecard.ts` evaluates only historical scorecard devIds, with fixture models and simulated settlement. These are diagnostics and do not rewrite frozen baselines. The fixture scorecard dev gold and test runner are not the unseen v4 banks.

No v4 file is read, hashed, run or used to select the grid. The orchestrator owns the later single-use measurement after reviewing this result. Do not execute the following command in this lane.

```sh
npm run build:sdk
node scripts/release-artifacts.mjs
# Run once, only after orchestrator approval; unique fresh directories per bank.
for bank in v4 v4-negatives; do
  state=$(mktemp -d /tmp/p1-heldout-state-XXXXXX)
  output=$(mktemp -d /tmp/p1-heldout-output-XXXXXX)
  RA_ACCEPT_TESTNET=1 J1_STATE_DIR="$state" JUDGE_OUT_DIR="$output" \
    JUDGE_BANK="eval/questions/judge-xrpl.$bank.json" \
    npx tsx scripts/judge-bank-testnet.ts dist/release/researchagent-mcp-1.0.0.tgz
done
```

## Retained-default consumer and checks

`try --testnet` on the retained-default packed artifact passes in 70.0 seconds: create, finish, writer-signed cooperative refund, re-buy create/finish, and validated audit anchor. Online verification passes (12/12 Testnet ledger checks). Gross displayed S$0.70 / net S$0.40 is faucet Testnet accounting, not real-money spend. See try.log and try-exit.json.

Final `npm run check:fast` passes: 167 files, 1,400 tests passed / one skipped; 20 chaos iterations and zero invariant violations. See check-fast.log. No merge performed.

All 540/540 packed Testnet questions complete and pass online verification; all 30 raw-state audits report zero violations. The four negative-bank failure exits are retained (0.10, 0.15, 0.20 and 0.26). All other bank runners exit zero.
