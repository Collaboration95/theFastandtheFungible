# Historical proof tools

These twelve dated executables were retired together. Their results remain frozen;
retirement does not establish that old probes pass on today's runtime.
Some old experiments have no exact current rerun equivalent.

## Whole-tree recovery

Use the complete tree at `b0a67ffac38701956bd979316d9b139b11c316c7` (`b0a67ffa`), including its
`package.json`, `package-lock.json`, relative imports, fixtures and configuration.
Do not copy an individual old script into current main. From a separate historical
checkout, use `git switch --detach b0a67ffac38701956bd979316d9b139b11c316c7` then `npm ci`.
The pinned package requires Node >=22.13; use its locked dependencies (including
xrpl.js 4.7.0) and recorded runtime where available. The round2-q record specifies
Node 22.13.1 / Python 3.14.7; exact original runtime versions for the other probes
were not uniformly recorded. A tree pin cannot restore external providers,
Testnet history after resets, local journals, funding or private provisioning.
Keep existing private recovery state; never create replacement intents to retry
uncertain payments or copy secrets into evidence. The commands below are historical
recipes, not instructions to run on main or regenerate committed measurements.

## Inventory

Every row uses the **full-tree pin** `b0a67ffac38701956bd979316d9b139b11c316c7` and its original lock/runtime contract above.
Output paths below are retained public evidence unless explicitly marked local.

| Retired path | Original command(s), in pinned tree only | Historical outputs | Evidence labels / limits |
| --- | --- | --- | --- |
| `scripts/evidence/agents-280.mjs` | `OFFSET=2000 node --import tsx scripts/evidence/agents-280.mjs` | docs/evidence/agents-280.md, agents-280.json, agents-280-receipts.csv / .jsonl | XRPL TESTNET; synthetic corpus; fixture research/decisions; agent authority |
| `scripts/evidence/escrow-273.ts` | `OFFSET=1600 node --import tsx scripts/evidence/escrow-273.ts` | docs/evidence/escrow-273.md / .json; escrow-273-audit.json | XRPL TESTNET; SYNTHETIC mini-corpus; proof release/cancel, no model calls |
| `scripts/evidence/numbers-v7-testnet.mjs` | `OFFSET=700 node --import tsx scripts/evidence/numbers-v7-testnet.mjs` | docs/evidence/numbers-v7-testnet.md / .json | XRPL TESTNET; LIVE DeepSeek/Luna; synthetic corpus; dated costs and partial UC3 result |
| `scripts/evidence/rlusd-275.mjs` | `OFFSET=1900 node --import tsx scripts/evidence/rlusd-275.mjs` | docs/evidence/rlusd-275-refund-310.md / .json | XRPL TESTNET; test USD substitute for RLUSD; fixture research; component audit failures retained |
| `scripts/evidence/rlusd-uc2-275.mjs` | `OFFSET=1900 node --import tsx scripts/evidence/rlusd-uc2-275.mjs (spawned by previous command)` | same rlusd-275-refund-310.json, uc2IssuedPurchase | XRPL TESTNET; custom issuer test USD, not official RLUSD; synthetic/fixture UC2 |
| `scripts/evidence/rlusd.mjs` | `OFFSET=1400 node --import tsx scripts/evidence/rlusd.mjs --testnet` | docs/evidence/rlusd.md / .json; rlusd-uc2-receipts.json; rlusd-uc3-receipts.json; rlusd-uc{2,3}-verification.json | Official RLUSD on XRPL TESTNET; synthetic articles; fixture research/decisions; no real value |
| `scripts/evidence/token-escrow.ts` | `node --import tsx scripts/evidence/token-escrow.ts; node --import tsx scripts/evidence/token-escrow.ts --no-show` | docs/evidence/round3-e/runs.json; tests/fixtures/receipt-conformance/iou-*.json; docs/evidence/round3-r2/README.md | XRPL TESTNET; TEST-SGD IOU stand-in; synthetic happy/no-show key-reveal probes, not official RLUSD escrow |
| `scripts/evidence/verify-278.mjs` | `OFFSET=2200 node --import tsx scripts/evidence/verify-278.mjs` | docs/evidence/verify-278.md; verify-278/{before,receipts,tampered,report,summary}.json, report.pdf, {offline,testnet,tampered}.txt | XRPL TESTNET; synthetic/fixture research; injected delivery HTTP failure; offline/online verification and tamper rejection |
| `scripts/spikes/escrow-poc.mjs` | `node --import tsx scripts/spikes/escrow-poc.mjs` | docs/spikes/escrow.md; docs/spikes/escrow-testnet.json | Standalone XRPL TESTNET spike; SYNTHETIC proof; validated negative probes retained; not product escrow acceptance |
| `scripts/app-mcp-proof.mjs` | `OFFSET=900 node --import tsx scripts/app-mcp-proof.mjs` | docs/evidence/app-mcp-http.md (embedded ledger JSON) | XRPL TESTNET; fictional corpus; fixture research/decisions; HTTP agent path, not packaged Keychain acceptance |
| `scripts/publish-demo.ts` | `node --import tsx scripts/publish-demo.ts --testnet; OFFSET=800 LOCAL_WRITERS_DIR=scratch/published-final-277 node --import tsx scripts/publish-demo.ts --testnet; omit --testnet for simulated mode` | docs/evidence/publish-site-277.md / .json; scratch/published-final-277/publish-demo-testnet/demo-public-receipt.json (private/local output) | XRPL TESTNET or explicitly SIMULATED; fixture policy/research; real retrieval; dated timing, not a current benchmark |
| `docs/evidence/round2-q/retime.mjs` | `node --import tsx docs/evidence/round2-q/retime.mjs; Q_CODESPACES=1 node docs/evidence/round2-q/retime.mjs` | docs/evidence/round2-q/{README.md,timings.json,launcher-timings.json}; stdout and temporary ask.txt/python.txt/quickstart.txt | Local warm npm cache; fixture models; SIMULATED SGD; not real Codespaces or controlled benchmark |

## Supported entry points

Use the maintained `npm run verify:answer`, `npm run agents`, `npm run publish:init`
and `npm run publish:site`, writer-testnet-proof and the current bank/consumer tools
for supported workflows. Their semantics and measurements differ from these dated
experiments; none silently replaces a retired recipe. Current receipt-conformance,
escrow/key-reveal/RLUSD, MCP HTTP/admission and publishing assertions remain intact.
