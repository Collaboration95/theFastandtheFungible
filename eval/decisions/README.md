# Measurement harnesses (#203, #212, #213)

Everything here runs offline by default. Nothing reaches a provider unless the
command gets `--live` **and** the shell sets `EVAL_LIVE=1`. Live runs read only
`EVAL_*` credentials (`EVAL_CLOUDFLARE_API_TOKEN`, `EVAL_CLOUDFLARE_ACCOUNT_ID`,
`EVAL_OPENAI_API_KEY`, `EVAL_DEEPSEEK_API_KEY`), so the demo token is never
used. Spend stops at `EVAL_SPEND_CAP_USD` (default US$2). Output goes to
`eval/decisions/out/`, which is gitignored.

| Command | What it does |
|---|---|
| `npm run eval:bank` | Verifies the question bank against the corpus. `-- --show Q09` prints one question's passages for human review. |
| `npm run eval:decisions` | Free-only vs with-purchase answers for every bank question (fixture mode). |
| `npm run eval:labels -- --db data/app.db --out labels.jsonl` | Exports per-purchase label rows from a store, read-only. |
| `npm run eval:coverage` | Coverage labels over evidence snapshots, scored by the offline overlap baseline. |
| `npx tsx eval/decisions/run.ts --arms fixture --split all` | Decisions bench v2 on real-corpus scenarios. |
| `npx tsx eval/decisions/analyze.ts` | Analyses the saved bench runs. Makes no calls. |
| `npx tsx eval/decisions/offline.ts --flow requested` | The post-#221 flow (requested facts as frozen gaps, one free follow-up search), fixture judge. |
| `npx tsx eval/decisions/offline.ts --sweep` | The calibration sweep (one round per requested fact, nothing bought), fixture judge. |
| `DECISION_PROVIDER=openai npx tsx eval/decisions/offline.ts --decision production --plan [--sweep]` | Prints the exact live call count (sweep) or its bounds (flow), and the estimated cost. No calls. |
| `npm run calibration:fit -- --data <dataset.jsonl>` | Fits the #207 calibrator per (provider, model, prompt version); writes `data/calibration/*.json` when accepted and a report in `eval/decisions/out/`. |

## Production path and calibration data (#207, #212)

`--decision production` builds the provider the demo runs from `DECISION_PROVIDER` (`openai` or `cloudflare`)
and the same env (`DECISION_MODEL`, `DECISIONS_GAP_WORDING`, `DECISIONS_WORDING`, `DECISIONS_MAX_QUESTIONS`), as
`server/routes.ts` does. Its requests go through the harness transport: the double opt-in, the spend cap, the cache,
and the `EVAL_*` credential (`EVAL_OPENAI_API_KEY` for `openai`; `EVAL_CLOUDFLARE_API_TOKEN` and
`EVAL_CLOUDFLARE_ACCOUNT_ID` for `cloudflare`). The per-attempt timeout is `EVAL_DECISION_TIMEOUT_MS` (default
20 s; set 5000 for the demo's). The default flow is `requested`: each round judges the next open requested fact
(`requested[].need`) with gap_material fixed at 1. Coverage is the bank's scripted needle check, so the flow makes
no coverage calls, and production's embedding trust check is not asked of the decision model.

Every decide() round writes per-candidate rows to `--dataset <file.jsonl>` (default
`eval/decisions/out/dataset-<arm>.jsonl`): the raw scores, verdict, provider, model and prompt version, the
question and topic family (for grouped CV), and three labels (1, 0 or null for unknown):
`addressesGap` (a listed source, or its passages hold the needles), `original` (no derivedFrom, family not read)
and `buy` (open fact, PAID listed source, original; the avoid list is 0). Datasets are always collected on raw
scores: the harness clears `DECISION_CALIBRATION` unless `--calibration on`.

## Question bank (`eval/questions/bank.v1.json`)

- 48 questions over `data/corpus/v2`, with 53 requested facts. 10 are UC1–UC3
  variants and 8 are hard cases.
- Each fact has three parts:
  - `need`: the frozen request text, without the answer. This is what judges see.
  - `text`: the planted answer.
  - `needles`: strings that must all appear in one passage of a listed source
    article.
- The scripted check resolves passages by article id at load time. A corpus edit
  that keeps the fact therefore keeps the question valid.
- Generator: hand-written by an Anthropic model (Claude Code). The judged
  models are OpenAI (Luna) and Cloudflare (Clef), a different vendor. No model
  call wrote or labelled the bank.
- Human review is still pending, for the sample listed in the bank file.

## Live runs (coordinator only)

| Run | Command | Calls |
|---|---|---|
| Bench, per-candidate wording, all 48 scenarios, one arm | `run.ts --arms luna --configs baseline --split all --live` | 497 (48 × 9 + 65 paid probes) |
| Bench, batch-evidence wording, one arm | `run.ts --arms luna --configs batch-evidence --split all --live` | 113 (48 + 65) |
| Held-out test, 3 repeats, per-candidate, one arm | `run.ts --arms luna --split test --repeats 3 --lock` then `--live` | 759 |
| Offline eval with a live judge | `offline.ts --decision luna --live` | at least 432 (48 × 9); up to about 1,440 over three rounds, plus 1 per verified purchase |
| Coverage, per arm | `eval/coverage/run.ts --arms writer,flash,luna --live` | 116 per arm (one per snapshot) |

Use `--plan` on `run.ts` and `eval/coverage/run.ts` to print the exact counts
without calling anything.

To measure latency at production topology, set `EVAL_CONCURRENCY=9`.

## Limits

- Search is keyword-only. Query embeddings would need a live call.
- Purchases are simulated. The delivery proof check is the real planted-claim
  check.
- With a live writer, needle matching in claim text can miss paraphrased figures.
- The requested-fact flow scores coverage with the needle check, not the decision model (#213 measured that judge).
- The sweep gives every fact its own follow-up search; production runs one, for the first open fact.
