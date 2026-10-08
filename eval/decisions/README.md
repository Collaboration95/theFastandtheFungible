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
- After #208 the `requested` gap source becomes production behaviour. Today
  production uses `answer-gap`.
