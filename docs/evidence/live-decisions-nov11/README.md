# LIVE-DEC: live purchase decisions (gpt-6-luna) vs the fixture, on the hosted path (11 November 2026)

The hosted judge demo plans and writes with live DeepSeek, but its purchases are decided by the labelled fixture
decision model (chip: "live answers, rule-based buying"). The owner's OpenAI key works again (`make keys`: gpt-6-luna
answered in 2.6 s). Round 9 of the mock judges asked us to measure the presets with live decisions **before**
switching the hosted demo to `DECISION_PROVIDER=openai`. This is that measurement.

Predecessor measurement base: `main` at `374743dd` (v1.1.1). Resumed on `bd52beff` after #477/#478; see
[resumed verification and evidence audit](RESUMED.md) for the fresh capped comparison, corrected spend bound,
partial-lead qualification and receipt-label follow-up. Everything here is used regression data, never held out.

## Recommendation: DON'T SWITCH

**Final result:** the resumed capped comparison and stricter lead-completeness review supersede the historical
headline numbers below. See [RESUMED.md](RESUMED.md): 19/19 fixture runs complete vs 6/19 live; complete leads
7/18 vs 6/18. Historical 'lead states the key fact' counts are keyword-pattern proxies, not full answers.

1. **On today's `main`, every live decision fails on hosted.** The hosted meter adds `max_output_tokens` to every
   OpenAI Decisions request. The Decisions API rejects it with HTTP 400 ("Unknown parameter: 'max_output_tokens'"; it
   also rejects `max_tokens`). Measured: 3 of 3 presets end FAILED with "Decision model unavailable (HTTP 400); nothing
   bought" (`main-as-is.raw-results.json`). `make keys` passes because it does not go through the hosted meter.
   **Fixed in this PR** (`server/hosted/execution.ts`).
2. **With that fix, half the hosted runs still fail.** The per-question decision input ceiling (50,000 tokens,
   counted as request bytes, `server/hosted/limits.ts`) refuses the second decision round. Each round sends two
   parallel 18-question requests that each carry the whole round state: about 23,000 "tokens" by bytes, about 6,000
   real tokens. Result: **15 of 29** live runs end FAILED, including **8 of 9 presets**. Each shows a red "Decision
   model unavailable (transport failure); nothing bought" under an answer that had already bought the right article.
   One request per round is not enough either: 2 of 3 presets still hit the ceiling by round 3
   (`one-request-per-round.raw-results.json`).
3. **With the ceiling lifted (measurement only), live decisions are not better than the fixture.**
   - Purchases and leads are tied: right article first 27/27 vs 27/27, and the lead states the key fact 25/27 vs 25/27.
   - Every off-topic question still buys nothing: 22/22 and 20/20 when forced through the planner.
   - Live buys more on the presets: 17 articles vs 12, S$6.80 vs S$4.80 over 9 runs. It brings back three-article runs
     (RLUSD preset once, A5 twice) of the kind round 9 flagged. R9-A's "titles name every clause, stop buying" rule runs
     only with the fixture coverage judge.
   - Live is slower: the run takes p50 4.9 s / p95 11.4 s vs 2.4 s / 6.3 s. On Testnet each extra purchase adds
     settlement time on top.
   - It adds a dependency: 1 OpenAI HTTP 503 in the 328 calls of the two measured runs.

The switch criteria were: live at least as good on purchases and leads, negatives at 0, latency fit for the hosted
UX. Negatives pass once the ceiling is lifted; simulated run latency increases and does not establish Testnet UX acceptance. Purchases are not at least as good: same accuracy, 42% more
preset spend. And the switch is not possible today without the H7 limit change. Keep `DECISION_PROVIDER=fixture` on
the VM for judge week. The chip already says so truthfully.

## Comparison (scope then run, as the web app does)

Arms (one HTTP gateway each, same process, same writers, same DeepSeek plan per repetition; see Method):

- **fixture**: the labelled fixture decision model, what the hosted demo runs today;
- **openai**: gpt-6-luna exactly as the VM would run it after this PR (19 questions per request, hosted meter and
  caps, 5 s × 2 attempts);
- **openai-uncapped**: measurement only, identical to `openai` but the per-question decision token ceiling is lifted
  so decisions can be measured past round 1. The US$0.05 per-question money envelope still applies.

Questions: presets XRPL2 (x402 402), XRPL1 (RLUSD escrow) and XRPL3 (reserves), 3× each; round-9 judge questions A3,
A4 (token escrow), A5, D1 (travel rule), D3, D4, E5 and R9-C's B5, C1, C4, 2× each (A1 and the x402 question are
the presets); v5 negatives NG01–NG10, 2× each.

| Metric | fixture | openai | openai-uncapped |
| --- | --- | --- | --- |
| Runs (DONE / FAILED) | 30 (30 / 0) | 29 (14 / 15) | 29 (29 / 0) |
| Runs ended "Decision model unavailable" | 0 | **15** | 0 |
| Answerable: right article bought first | 27/27 | 26/27 | 27/27 |
| Answerable: lead states the key fact | 25/27 | 24/27 | 25/27 |
| Should decline (E5 + v5 negatives): bought nothing | 22/22 | 22/22 | 22/22 |
| Answerable: articles beyond the gold article | 6 | 0 | 10 |
| Runs buying 3 articles | 1 | 0 | 3 |
| Spend, all questions | S$14.00 | S$10.40 | S$16.00 |
| Presets: articles / spend (9 runs) | 12 / S$4.80 | 8 / S$3.20 | 17 / S$6.80 |
| Judge questions: articles / spend (20 runs) | 23 / S$9.20 | 18 / S$7.20 | 23 / S$9.20 |
| Decision call latency p50 / p95 (max) | in-process | 0.5 s / 0.8 s (1.4 s) | 0.5 s / 1.2 s (1.4 s) |
| Waiting on decisions per run p50 / p95 | in-process | 1.0 s / 1.4 s | 1.6 s / 4.1 s |
| Run (POST /runs → settled) p50 / p95 | 2.4 s / 6.3 s | 3.7 s / 4.5 s | 4.9 s / 11.4 s |
| Scope + run p50 / p95 | 3.4 s / 7.0 s | 4.0 s / 5.9 s | 5.1 s / 11.7 s |
| Presets, scope + run p50 / p95 | 4.3 s / 6.7 s | 4.9 s / 5.5 s | 10.3 s / 12.8 s |
| Decision call errors | 0 | 1× HTTP 503; 15× aborted after a sibling was refused | 0 |
| Hosted meter refusals | 0 | 29× `question_token_cap` | (29× lifted) |
| Peak decision input estimate per question (ceiling 50,000) | 0 | 47,496 | **75,392** |
| Peak model reservation per question (envelope US$0.05) | US$0.011 | US$0.029 | **US$0.038** |
| OpenAI input tokens per answerable question, mean (max) | 0 | 11,924 (15,818) | 23,958 (40,370) |
| Research writer fell back to extracts (all arms, same plans) | 8 | 9 | 9 |

"Runs" counts runs started. All 20 v5 negative asks in each live arm, and 19 of 20 in the fixture arm, got the
scope's fixed off-topic redirect and never started a run. The fixture arm's NG07 r1 got a plan, ran and declined, so
the fixture arm shows 30 runs and the live arms 29.

**Negatives forced through the planner** (`negatives-direct.*`): the 10 v5 negatives posted straight to `POST /runs`,
as an API client could, so the planner plans them and the decision model judges whatever it finds.

| Metric | fixture | openai | openai-uncapped |
| --- | --- | --- | --- |
| Runs (DONE / FAILED) | 20 (20 / 0) | 20 (20 / 0) | 20 (20 / 0) |
| Bought nothing | **20/20** | **20/20** | **20/20** |
| Runs where the live model judged at least one paid candidate | n/a | 11 | 12 |
| Decision call latency p50 / p95 | in-process | 0.4 s / 1.1 s | 0.4 s / 0.9 s |

### Per question

✓ / ✗: the lead states the question's key fact (pattern per question in the summariser). ⚠: the run ended
"Decision model unavailable" (its answer from round 1 stands).

| Question | Rep | fixture | openai | openai-uncapped |
| --- | --- | --- | --- | --- |
| XRPL2 x402 402 | 1 | product-x402-response · S$0.40 · ✓ | product-x402-response · S$0.40 · ✓ ⚠ | product-x402-response, product-x402-xrpl-settlement · S$0.80 · ✓ |
|  | 2 | product-x402-response · S$0.40 · ✓ | product-x402-response · S$0.40 · ✓ ⚠ | product-x402-response, product-x402-xrpl-settlement · S$0.80 · ✓ |
|  | 3 | product-x402-response · S$0.40 · ✓ | product-x402-response · S$0.40 · ✓ ⚠ | product-x402-response, product-x402-xrpl-settlement · S$0.80 · ✓ |
| XRPL1 RLUSD escrow | 1 | team-rlusd · S$0.40 · ✓ | nothing · S$0.00 · ✗ ⚠ (OpenAI 503, then the ceiling) | team-rlusd, c5-xrpl-token-escrow-xls85 · S$0.80 · ✓ |
|  | 2 | team-rlusd · S$0.40 · ✓ | team-rlusd · S$0.40 · ✓ | team-rlusd · S$0.40 · ✓ |
|  | 3 | team-rlusd · S$0.40 · ✓ | team-rlusd · S$0.40 · ✓ ⚠ | team-rlusd, c5-xrpl-token-escrow-xls85, team-asset-provisioning · S$1.20 · ✓ |
| XRPL3 reserves | 1 | xrpl-reserves, team-rlusd · S$0.80 · ✓ | xrpl-reserves · S$0.40 · ✓ ⚠ | xrpl-reserves, team-asset-provisioning · S$0.80 · ✓ |
|  | 2 | xrpl-reserves, team-rlusd · S$0.80 · ✓ | xrpl-reserves · S$0.40 · ✓ ⚠ | xrpl-reserves, team-asset-provisioning · S$0.80 · ✓ |
|  | 3 | xrpl-reserves, xrpl-tx-escrowcreate · S$0.80 · ✓ | xrpl-reserves · S$0.40 · ✓ ⚠ | xrpl-reserves · S$0.40 · ✓ |
| A3 fees | 1 | team-fees · S$0.40 · ✓ | team-fees · S$0.40 · ✓ ⚠ | team-fees · S$0.40 · ✓ |
|  | 2 | team-fees, team-delivery · S$0.80 · ✓ | team-fees · S$0.40 · ✓ | team-fees · S$0.40 · ✓ |
| A4 token escrow | 1 | c5-xrpl-token-escrow-xls85, xrpl-tx-escrowcreate, xrpl-tx-escrowcancel · S$1.20 · ✓ | c5-xrpl-token-escrow-xls85 · S$0.40 · ✓ | c5-xrpl-token-escrow-xls85 · S$0.40 · ✓ |
|  | 2 | c5-xrpl-token-escrow-xls85 · S$0.40 · ✓ | c5-xrpl-token-escrow-xls85 · S$0.40 · ✓ | c5-xrpl-token-escrow-xls85 · S$0.40 · ✓ |
| A5 Finish vs Cancel | 1 | xrpl-escrow · S$0.40 · ✓ | xrpl-escrow · S$0.40 · ✓ ⚠ | xrpl-escrow, xrpl-tx-escrowfinish, product-escrow-no-show · S$1.20 · ✓ |
|  | 2 | xrpl-escrow · S$0.40 · ✓ | xrpl-escrow · S$0.40 · ✓ ⚠ | xrpl-escrow, xrpl-tx-escrowfinish, team-rlusd · S$1.20 · ✓ |
| D1 travel rule | 1 | c5-fatf-recommendation-16-travel-rule, xrpl-compliance-fatf-travel-rule · S$0.80 · ✓ | c5-fatf-recommendation-16-travel-rule · S$0.40 · ✓ | c5-fatf-recommendation-16-travel-rule · S$0.40 · ✓ |
|  | 2 | same 2 · S$0.80 · ✓ | c5-fatf-recommendation-16-travel-rule · S$0.40 · ✓ | c5-fatf-recommendation-16-travel-rule · S$0.40 · ✓ |
| D3 MAS licence | 1–2 | c5-mas-licence-paying-suppliers-rlusd · S$0.40 · ✗ | same · ✗ ⚠ | same · ✗ |
| D4 key never revealed | 1–2 | product-escrow-no-show · S$0.40 · ✓ | same · ✓ | same · ✓ |
| E5 Singapore bank validators | 1–2 | nothing | nothing ⚠ | nothing |
| B5 how it decides | 1–2 | product-how-it-decides · S$0.40 · ✓ | same · ✓ | same · ✓ |
| C1 how the writer is paid | 1–2 | product-writer-paid · S$0.40 · ✓ | same · ✓ | same · ✓ |
| C4 writer earnings | 1 | product-writer-earnings · S$0.40 · ✓ | same · ✓ | same · ✓ |
|  | 2 | product-writer-earnings · S$0.40 · ✓ | same · ✓ | product-writer-earnings, product-micropayment-pricing · S$0.80 · ✓ |
| NG01–NG10 | 1–2 | nothing (scope redirect; NG07 r1 ran and declined) | nothing (scope redirect) | nothing (scope redirect) |

The extra purchases, by title:

- **openai-uncapped:**
  - x402 preset, 3×: "Can an agent pay x402 with XRP on Testnet, and who confirms settlement?" This answers the
    question's second clause, the design R8-A pinned for the fixture planner.
  - RLUSD preset: TokenEscrow (XLS-85) 2×, "Agent payment assets…" 1×.
  - Reserves preset: "Agent payment assets…" 2×.
  - A5: the RLUSD note 1× (**off-topic**).
  - C4: the micropayment cost note.
- **fixture:**
  - Reserves preset: the RLUSD note 2× (**off-topic**), EscrowCreate 1×.
  - A4: EscrowCreate and EscrowCancel.
  - A3: the key-reveal delivery note.

The leads match across arms whenever the first purchase matches. D3's lead ("Licensing becomes a likelier question if
the company moves tokens for other parties…") is the same in every arm, so it is a lead-selection miss, not a decision
difference.

## Cost against the hosted caps (`server/hosted/limits.ts`)

- **What the OpenAI Decisions API reports:** `output_tokens: 0` on every call (it returns probabilities), so the cost is
  all input.
- **Cost per hosted question with live decisions:** about 24,000 input tokens on average (max 40,370) once rounds 2–3
  run. At the VM's conservative decision rate (US$0.25 per million input tokens, above list price), that is
  **≈ US$0.006 per question, sampled maximum US$0.010 for successful usage**.
- **All model calls settled by the hosted meter:** US$0.0083 per question, research included.
- **Against the caps:**
  - US$0.05 per question: actual cost is far below it. But the reservation peaks at **US$0.038**, because each decision
    attempt reserves `HOSTED_DECISION_OUTPUT_TOKENS` = 8192 output tokens (US$0.008) that are never used, and a round
    reserves two at once.
  - US$15 a day: the hosted demo admits at most 300 questions a day, so about US$1.80/day for successful decision usage at that sample mean (not a maximum).
  - US$105 in total: at most 2,100 questions; about US$13 at the sampled mean, not a worst-case bound.
- **The binding limit is the token ceiling, not money:** 50,000 decision input tokens per question, counted as request
  bytes (the meter's strict upper bound; pretty-printed state runs about 3.6 bytes per real token). Live rounds 1–3
  need a peak estimate of up to **75,392**.
- **This lane's OpenAI spend:** 368 calls, 1,372,322 input tokens, 0 output tokens, **US$0.34 reported-usage estimate** at that rate. This excludes unknown-usage attempts and some probes;
  the conservative combined bound including resumed work is in RESUMED.md.
  The cap was US$3.

## Labels when `DECISION_PROVIDER=openai`

Checked on the running gateways (`chipModels` and `labels` in the raw results) and in code. The hosted chip and run labels name live decisions. Receipts omit the decision provider; that omission does not meet
the requested explicit decision label and is a cross-lane follow-up (see RESUMED.md):

- **`GET /api/demo/status`** returns `live research and purchase decisions · per-answer fallback labelled`. The web chip
  maps that to "Shared XRPL Testnet demo · live models · no real value", pinned in `src/hosted.test.tsx`.
- **Environment popover:** "Live models plan, judge what to buy and write. If one is unavailable, that answer says so."
- **Show work:** "Decide · OpenAI Decisions · gpt-6-luna"; decision rounds read "Decided by OpenAI Decisions ·
  gpt-6-luna".
- **Report:** "Decided by OpenAI Decisions · gpt-6-luna".
- **Proof page:** "model-judged buying".
- **Receipts** (`receipts.json`) name the rail and research model in `label`, but omit the decision provider.
  Follow-up: `server/receipt-bundle.ts` should include the run's decision label; not changed in this lane.
- **MCP:** run results forward the backend labels through `sdk/present.ts` and `mcp/tools.ts`. The separate zero-clone
  `--testnet` / app modes force fixture models; the hosted switch does not reach those modes.

Copy notes for other lanes, not changed here:

- **QUAL (`server/agents/**`):**
  - When the hosted ceiling refuses a decision attempt, the visitor reads "Decision model unavailable (**transport
    failure**)". The meter's `HostedError` is mapped to that status; "the per-question model allowance was used" would
    be true and plain.
  - A run whose first decision round fails keeps the label "OpenAI Decisions · gpt-6-luna **(pending)**" in Show work.
- **After a switch** (FIN-prep, H7): the dated captions ("11 Nov … live answers, rule-based buying") in `README.md`,
  the deck and the video kit stay true for the captures they describe. `docs/hosted-web.md:607` ("runs as the labelled
  fixture until the OpenAI key is rotated") would need a new sentence.

## Path to a switch later (not recommended for judge week)

1. Merge this PR: the HTTP 400 fix.
2. **H7** (`server/hosted/limits.ts`):
   - Size the per-question decision input ceiling for live rounds. The measured peak estimate is 75,392, so about
     120,000 gives room for three rounds of 12 candidates.
   - Lower `HOSTED_DECISION_OUTPUT_TOKENS` in `env.local` (already allowlisted) from 8192 to about 512. Decisions
     reports 0 output tokens, and this keeps two parallel attempts far from the US$0.05 envelope.
3. **QUAL:**
   - Apply R9-A's stop rule with the live coverage judge too, so presets buy one article.
   - Name the allowance refusal plainly.
4. Re-run this harness, one command (below). Switch only if the presets buy one article with unchanged leads and no
   decision failures.

## Method

- **Gateways:** one Node process runs three `HOSTED=1` gateways (`createApiApp`, the real hosted router, session
  cookie + CSRF, its own SQLite each). Each arm has its own trust ledger, as separate deployments would.
- **Visitors:** each question is a new visitor with its own `X-Forwarded-For` address. `GET /api/demo/status`, then
  `POST /api/scope`, then `POST /runs` with the same Idempotency-Key and the scope's plan, exactly as the web app sends
  it. Clarify questions are skipped (Go on the plan), and a scope chat reply ends the ask with no run, as in the app.
  The run is polled to a settled phase.
- **Configuration:** the VM's `docker/hosted/env.template` plus its operator `env.local`:
  - `LLM_PROVIDER=deepseek` (deepseek-flash);
  - `SEARCH_EMBEDDINGS=off`;
  - meter rates research 0.40/1.60 and decision 0.25/1.00 US$ per million tokens, `HOSTED_DECISION_OUTPUT_TOKENS=8192`;
  - `ACTIVE_WORK_LIMIT=2`;
  - no `DECISIONS_MAX_QUESTIONS` (19), `DECISION_TIMEOUT_MS` or `LLM_TIMEOUT_MS`.

  Local `.env` development values (`DECISIONS_MAX_QUESTIONS=25`, `LLM_TIMEOUT_MS=30000`) are overridden. Keys come
  only from `.env` via dotenv and are never printed or stored.
- **Settlement and writers:** `SETTLEMENT_RAIL=simulated` and no anchors, against the in-process writer server (the
  same corpus as the VM's). End-to-end times leave out Testnet settlement: add a few seconds for each purchase on the
  live demo.
- **Pairing on the same live plan:** every DeepSeek call goes through a loopback record/replay proxy. For each question
  and repetition the fixture arm runs first and its DeepSeek responses are recorded. The live arms get the recorded
  response for a byte-identical request, replayed with the recorded chunk timing, so time stays comparable. Any other
  request goes live. 81 of 98 arm pairs ran the identical confirmed plan; the other 17 got a fresh live plan (their
  scope request differed). Each repetition starts a fresh plan.
- **Gold** (`scripts/evidence/summarise-live-decisions.mjs`): the right article ids per question come from
  R9-A/R9-C's accepted purchases. "Lead states the key fact" is a per-question pattern on the lead block, e.g.
  AllowTrustLineLocking, a fee in drops, EscrowFinish…EscrowCancel. The same yardstick is used for every arm.
- **Decision latency:** a timing wrapper around the provider's transport records every OpenAI attempt: milliseconds,
  status and reported tokens, never bodies. "Waiting on decisions" sums each round's slowest parallel call.
- **Hosted meter:** a wrapper around `HostedLimits.attempt` records every reservation, the per-question peak and every
  refusal. In `openai-uncapped` only, it re-admits a decision attempt refused by `question_token_cap`, keeping the money
  check.

## Files

| File | What it holds |
| --- | --- |
| `raw-results.json` | Main run: 147 rows (arm × question × repetition) with plan, purchases, lead, decision rounds, calls, meter and events (types and times) |
| `summary.json` | Per-arm metrics (all, presets, judges, negatives) and per-question outcomes |
| `negatives-direct.raw-results.json`, `negatives-direct.summary.json` | v5 negatives posted straight to `POST /runs` |
| `main-as-is.raw-results.json` | Presets once on `main`'s meter: every live decision HTTP 400 |
| `one-request-per-round.raw-results.json` | Presets once with an extra `openai-batch` arm (49 questions per request) |

Secrets scan: no key, bearer token or seed pattern in any file (`grep -E 'sk-…|Bearer |…_API_KEY'`), and no request
bodies or headers are stored.

## Reproduce

```
ln -s <owner checkout>/.env .env          # never print it
node --import tsx scripts/evidence/live-decisions.ts <out> --reps 3 --judge-reps 2 --cap-usd 2.5
node --import tsx scripts/evidence/live-decisions.ts <out-neg> --sets negatives --judge-reps 2 --direct
node scripts/evidence/summarise-live-decisions.mjs <out>/raw-results.json <out>/summary.json
npx vitest run tests/hosted-decisions-meter.test.ts tests/hosted-limits.test.ts
```

The historical main run took about 25 minutes and reported US$0.26 of successful OpenAI usage; unknown usage costs extra. `--arms fixture,openai` measures
only what would ship.

## Limits

- Simulated settlement and keyword search. Testnet latency and escrow behaviour were not part of this comparison.
- Two to three repetitions per question; live plans vary between repetitions (and 17 arm pairs had different plans).
- The gold patterns are this lane's own, the same for every arm. D3's ✗ is shared by all arms.
- 59 of 60 negative asks on the web path never reached a decision model (scope redirect), hence the forced pass.
- `openai-uncapped` is not a shippable configuration: it shows what the decision model does once the ceiling is
  sized, not what the hosted demo would do today.
