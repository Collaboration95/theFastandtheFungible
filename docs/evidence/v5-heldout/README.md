# v5 held-out measurement (11 Nov 2026)

Fixture decision model · team-authored writers · XRPL Testnet with faucet funds. No real money.

## What was run

- **v5** is the blind held-out bank, written blind to the corpus, writers, evidence, explainers and team notes and frozen on 10 Nov (#422) (`eval/questions/judge-xrpl.v5.json`, SHA-256 `1095c9fac057a85ee59a34a63cb72ea69a0ec909f430c845357958bf38c1701b`).
- **v5-negatives** is its off-topic companion (`eval/questions/judge-xrpl.v5-negatives.json`, SHA-256 `a381c46f85676bce13c8f9183370fe4989cc9f38c50dd118702c48bb55067c4b`).
- It ran **once**, on `main` at `a9584014181bd87df759c408c373767ecbffbb51`, after the answer and coverage lanes had merged (K3 #429, C3 #425, C4 #437, K4 #442). It ran against the MCP tgz packed from that tree (artifact SHA-256 `35b85e40c2031a018682073e43a92c74d4e7cc7364a086a491e07dfcc06e1d1a`).
- The method is the same as v4's:
  - the runner is `scripts/judge-bank-testnet.ts` ([docs/eval-judge-banks.md](../../eval-judge-banks.md));
  - fixture research and decision models, with the threshold unchanged;
  - XRPL Testnet with faucet funds;
  - budget S$2 per question;
  - fresh private state per bank, and no `.env`.
- The method and the report format were written down before the run. Only the orchestrator ran it. No implementer opened the bank, and nothing was retried or re-tuned.

## Results

| Bank | Measure | v5 (11 Nov) | v4 (7 Nov, for reference) |
| --- | --- | --- | --- |
| held-out (20 questions) | bought and cited | **16/20** | 7/20 |
| held-out | the key fact leads the answer (`answersIt`) | **7/20** | 2/20 |
| held-out | terminal gate violations | 0 | 0 |
| held-out | receipt verification `ok` | 20/20 | 20/20 |
| off-topic negatives (10 questions) | purchases | **0/10**: all ten abstained | 0/10 |
| off-topic negatives | terminal gate violations | 0 | 0 |

The 16 cited purchases spent S$12.40 in total (31 purchases at S$0.40–S$1.20 per question), all on Testnet. The run took 12.3 min for v5 and 2.0 min for the negatives.

### Caveats (decided before the run)

- **Overlap with the used v4 bank.** Some v5 questions resemble v4 questions, and v4's miss topics were public in the round-6 report. The closest pairs by token Jaccard are v5 H15 ~ v4 H08 (0.73), v5 H06 ~ v4 H15 (0.46), NG05 ~ v4 NG07 (0.75) and NG06 ~ v4 NG01 (0.56).

  | Scope | Bought and cited | `answersIt` |
  | --- | --- | --- |
  | all 20 | 16/20 | 7/20 |
  | excluding H15 | 16/19 | 7/19 |
  | excluding H15 and H06 | 15/18 | 6/18 |

  Excluding NG05 and NG06 from the negatives leaves 0/8 purchases.
- **Weak gold phrases** (flagged by the bank author; the bank is frozen and unedited): `10 drops` (H01), `AP2` (H03), `250` (H12), `verif` (H19), `80%` (H20). A manual check agrees with the automatic score on all five:
  - H01's lead states the 10-drop reference cost (counted);
  - H19's lead describes the 402 headers, not what the facilitator does (correctly not counted);
  - H20's lead is about sidechains, not the consensus threshold (correctly not counted);
  - H03 and H12 bought nothing.

  Manual `answersIt` is therefore also 7/20.
- **Possibly shaky golds:** `TokenEscrow` (H05) and `5 business days` (H16). Both match current public sources, so neither is reported as a bank flaw. H05's lead is wrong (it describes an escrow fee), and H16 bought nothing.

### Misses, reported as measured

- **No purchase (4):**
  - H03 (AP2) and H16 (MAS redemption window): no listed writer covers the topic;
  - H12 (ticket limit) and H15 (GENIUS Act): the matched articles had no citable answer.
- **Bought and cited, but the key fact is not in the lead (9):**
  - H02, H04, H05, H09, H13, H14, H18, H19 and H20.
  - Typically the lead states a correct but generic sentence about the transaction type, rather than the specific flag, condition type, amendment, currency code or recommendation number asked for.

## Paid versus free (Arm B, run once)

Also decided before the run: the same 20 v5 questions, the same tgz (`35b85e40…1d1a`) and the same fixture models, with **a zero budget**. The MCP schema accepts `budget_sgd: 0`. The only change is a runner setting, `JUDGE_BUDGET_SGD` (default 2; see `v5-free-runner.diff`, now in `scripts/judge-bank-testnet.ts`). The product artifact is untouched. It ran once, after Arm A, in 3.6 min.

| Measure (20 v5 questions) | S$2 budget (Arm A) | zero budget (Arm B) |
| --- | --- | --- |
| bought and cited | 16/20 | 0/20 |
| the key fact leads the answer (`answersIt`) | 7/20 | 0/20 |
| the gold phrase appears anywhere in the answer | 9/20 | 0/20 |
| median answer length | 98 words | 9 words |
| gate violations | 0 | 0 |

With no budget, every answer is "Matched articles supplied no citable answer · nothing bought" (or "No listed writer covers this yet") and nothing is spent.

**Caveat:** in fixture mode the corpus is the listed writers' paid notes, and no open web search runs. So this shows that the facts sit in the paid passages the agent bought. It does not compare against a free web search.

Files: `v5-free/` (results, values, receipts, verification) and `v5-free.log`.

## Files

- `bank-sha256.txt`, `main-sha.txt`: the pinned inputs.
- `v5.log`, `v5-negatives.log`: the runner's per-question output.
- `v5/`, `v5-negatives/`: `results.json`, `values.jsonl` (every decision row), and per-question `*.receipts.json` and `*.verification.json`.

These were copied verbatim from the run's output directory. They were scanned for seeds, private keys, API keys and local paths first. The only matches were the `key` fields: the decryption keys that key-reveal escrow publishes on the ledger by design, the same fields as in the committed v4 receipts. Ed25519 `pubKey` values are public keys. Nothing was excluded.

## Status

**v5 is now used.** Any future held-out claim needs a new blind bank. v1, v2, v3, v3-dev, v3-negatives and v4 are observed development data and are never reported as held-out.
