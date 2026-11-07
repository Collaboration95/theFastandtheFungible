# v4 held-out measurement (7 Nov 2026)

Fixture decision model · team-authored writers · XRPL Testnet with faucet funds. No real money.

## What was run

- **v4** is the blind held-out bank, written blind by #406 (`eval/questions/judge-xrpl.v4.json`, SHA-256 `0b770536bca16340d322f9697658671802facad0c46c80dec37650a1e6949ce1`).
- **v4-negatives** is its off-topic companion (`eval/questions/judge-xrpl.v4-negatives.json`, SHA-256 `d3c4738a9feb17a4a8f4c4a8c204c893633d862aabbaf22b45b9ff35447dae3b`).
- It ran **once**, on `main` at `bdc30f97b378c209d97e465b1907b3e2cb17af89`, against the packed MCP tgz (artifact SHA-256 `7fcdc66577f55abd046e2c4b66cbf2a21354774ac61383ca74676a5052bb2891`).
- The decision model was the fixture model at threshold 0.20, unchanged after the constrained sweep in #413.
- Settlement was on XRPL Testnet with faucet funds. The writers are team-authored, not independent.
- The runner is `scripts/judge-bank-testnet.ts` (see [docs/eval-judge-banks.md](../../eval-judge-banks.md)).

## Results

| Bank | Measure | Result |
| --- | --- | --- |
| v4 held-out (20 questions) | bought and cited | **7/20** |
| v4 held-out | the key fact leads the answer (`answersIt`) | **2/20** |
| v4 held-out | terminal gate violations | 0 |
| v4-negatives (10 questions) | purchases | **0/10**: all ten abstained |
| v4-negatives | terminal gate violations | 0 |

Each run's `*.verification.json` reports `ok: true` (20/20 and 10/10); its online-only checks are recorded as SKIP in those files.

Misses are measurements, not failures to hide: 13 of 20 held-out questions did not end in a cited purchase.

## Files

- `bank-sha256.txt`, `main-sha.txt`: the pinned inputs.
- `v4.log`, `v4-negatives.log`: the runner's per-question output.
- `v4/`, `v4-negatives/`: `results.json`, `values.jsonl` (every decision row), and per-question `*.receipts.json` and `*.verification.json`.

Copied verbatim from the run's output directory. It was scanned for seeds, secrets, private keys, API keys and local paths first; nothing was found, so nothing was excluded.

## Status

**v4 is now used.** Any future held-out claim needs a new blind bank (v5). The v1, v2, v3, v3-dev and v3-negatives banks are observed development data and are never reported as held-out.
