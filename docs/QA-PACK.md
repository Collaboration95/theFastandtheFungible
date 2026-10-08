# Q&A pack (10 Oct)

One page of numbers to answer from. Open it on request only; the talk itself
has no slides.

**Every benchmark number below is SYNTHETIC.** It comes from the decisions
benchmark: 160 generated scenarios, 64 held out (× 3 repeats) in 28 topic
families. Say "on our synthetic benchmark" every time you quote one.

Sources, shortened in the tables:

- **[R]** the benchmark paper, [`bench/decisions/out/README.md`](https://github.com/Collaboration95/theFastandtheFungible/blob/bench/decisions-vs-clef/bench/decisions/out/README.md) on the `bench/decisions-vs-clef` branch
- **[CSV]** [`out/results-test.csv`](https://github.com/Collaboration95/theFastandtheFungible/blob/bench/decisions-vs-clef/bench/decisions/out/results-test.csv), rows with `question = decision`
- **[REL]** [`out/reliability.md`](https://github.com/Collaboration95/theFastandtheFungible/blob/bench/decisions-vs-clef/bench/decisions/out/reliability.md)
- **[COST]** [`out/cost.json`](https://github.com/Collaboration95/theFastandtheFungible/blob/bench/decisions-vs-clef/bench/decisions/out/cost.json)
- **[OR8]** [OVERNIGHT-REPORT-OCT8.md](OVERNIGHT-REPORT-OCT8.md), **[ST]** [STATUS.md](../STATUS.md)

## 1. Calibration: the thesis

The decision model scores each candidate; policy code multiplies the scores
into a value and buys the best value per dollar within the budget. A score of
0.4 only helps if it means "true about 40% of the time". That is what
calibration buys: a threshold that means the same thing on every question.

| Claim (SYNTHETIC) | Number | Source |
|---|---|---|
| Clef-flash's raw "covers what's missing" score ranks candidates well | held-out AUROC 0.820 | [R] final held-out per-question table |
| …but its middle scores are not probabilities | predictions of 0.27–0.50 come true 24–31% of the time | [REL] Clef-flash bins 5–9 |
| Clef-flash as production ran it (raw, threshold 0.15) | purchase F1 0.505, recall 0.37, four-question Brier 0.186 | [CSV] `test-baseline,flash,baseline,raw-policy` |
| Clef-flash with the calibration package (tuned wording, fitted calibrators) | F1 0.783 [0.643, 0.898], Brier 0.075 | [R] "Final held-out results"; [CSV] `final-test,flash,evidence,calibrated-policy` |

**Why we did not ship the calibrator:** it was fitted on synthetic data, and
on the real UC2 it would buy the MarketPulse rewrite (it lifts the rewrite's
"original" probability from 0.26 to 0.99). Calibration has to be fitted on
in-domain data, last (#207). Never say a model "is calibrated" without saying
what that buys (above) and on what data.

## 2. The model choice

Decided after the live comparison on the real corpus (#214,
[result](https://github.com/Collaboration95/theFastandtheFungible/issues/214#issuecomment-6064805198)):
the demo uses OpenAI Decisions.

### Outcome A: SWITCHED to OpenAI Decisions (`gpt-6-luna`)

- We benchmarked two decision models under a preregistered rule
  ([commit 9eede4d](https://github.com/Collaboration95/theFastandtheFungible/commit/9eede4d); [R] "Decision").
- On held-out SYNTHETIC data, Luna beat Clef-flash:
  - purchase F1 0.983 [0.947, 1.000] vs 0.783; Brier 0.015 vs 0.075 ([R] final table);
  - raw and uncalibrated, Luna still scores F1 0.915, Brier 0.031 ([CSV] `final-test,luna,batch-evidence,raw-policy`);
  - injection lift: mean −0.014 vs +0.025 ([R] attack-pair table);
  - one batched request per round instead of 1 + N ([R] "Tuning and architecture experiments");
  - about the same cost: US$0.48 vs US$0.44 per 1,000 rounds ([R] final table).
- It failed one of five criteria: our own demo story. UC3 needed a judge that
  gets fooled ([R] "Decision", criterion 4). We fixed the story (#204: The
  Fab Floor's Penang article is now a S$0.40 data deep-dive, so AlphaLeak
  at S$0.30 wins round 1 on price as well), not the judge, and switched.
- The whole study cost about US$0.96 ([R] "Cost and latency"; [COST]).
- Clef-flash stays selectable as the revert (`DECISION_PROVIDER=cloudflare`).

**LIVE (real corpus, XRPL Testnet, 9 Oct; a small sample, separate from the SYNTHETIC numbers above):**
- Clef-flash as production ran it told the UC3 story in 0 of 2 runs (The
  Fab Floor scored under the 0.15 bar).
- OpenAI Decisions with the plain gap question ("The open gap is part of what
  the question asks."): UC3 story 3 of 3, UC2 bought NotFT 3 of 4, 0
  refusals, 3 of 5 new real-corpus questions right.
- The gap-question wording, not the model, was the main fix: with the
  benchmark's gap sentence, the same model scored on-question gaps anywhere
  from 0.06 to 0.94 and bought NotFT in only 4 of 10 UC2 runs.
- Since #208, a gap that is one of the question's frozen requested facts is
  not scored at all: it counts as fully material.

## 3. Injection: the known weak spot

- **What reaches the decision model from a writer:** title, abstract, tags
  and the writer's claimed relevance (`server/agents/clef.ts:47-50`), plus the
  LLM-written description of what is missing.
- **Measured attack lift** (84 attack pairs, SYNTHETIC; [R] attack-pair
  table):
  - Clef-flash: mean +0.025, max +0.246; 48 of 84 pairs scored higher than their clean twin.
  - Luna: mean −0.014, max +0.021. A negative mean is not immunity.
- **What bounds the loss:**
  - the S$1 per-source cap;
  - the per-prompt budget, the only spending authorization;
  - at most 3 rounds;
  - after the fact: proofs, `/challenge`, refunds and the writer's track record.
- **The structural fix is planned:** the decision model will judge the
  requested facts, frozen before any evidence is read, instead of text a
  source can influence (#194).
- **One sentence, only if asked:** "the LLM can name what's missing, but only
  policy code can pay."

## 4. How agents built it

Two anecdotes, both recorded:

1. **Every writer claimed 1.0.** Search normalised relevance to each
   response's top hit, so every writer's best hit claimed 1.0. AlphaLeak's
   "inflated" 0.96 became the lower claim, and UC3 bought the wrong source
   first ([OR8] §3, item 3).
2. **The leak gate caught the corpus writer.** The LLM reused each writer's
   persona openers word for word across free and paid posts, and the site
   leak gate turned `main` red. We reworded 13 free posts; the gate stayed
   unchanged ([OR8] §3, item 2; [ST] WP-C3 line).
3. **A US$0.96 preregistered benchmark** led to the model decision in §2.

## 5. The writer's track record (reader-facing name)

On screen and in the talk, the trust score is the writer's **track record**
(#165). It is earned, not claimed: promises kept on checked deliveries,
times how accurate the writer's relevance claims turned out to be. It is
keyed to whoever sells the article (D21). The code keeps its own names (H, C,
T, `reputation`); never say those on stage.

UC3 on 8 Oct, live ([ST] "Demo check"): AlphaLeak's track record fell from
0.80 to 0.40 after one failed proof and refund, and it was quarantined.
At today's prices the run buys AlphaLeak for S$0.30 (refunded) and The Fab
Floor for S$0.40: S$0.70 spent, S$0.40 net.
