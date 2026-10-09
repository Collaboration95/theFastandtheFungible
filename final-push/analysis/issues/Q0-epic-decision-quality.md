**One queue, starting now (owner decision, 8 Oct).** Nothing is postponed by date. Work is ordered only by dependency and by file conflicts. Lanes run in parallel.

**Revert points:**
- the tag [`known-good-2026-10-08`](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/known-good-2026-10-08) (`cb04be4`, CI green);
- `DECISION_PROVIDER=cloudflare` for the decision model.

**Lane A: stage robustness** (start now; the files are disjoint)
- [ ] #197 H3 No decision fallback: if live Clef fails, the round fails *(decision.ts, loop.ts)*
- [ ] #195 H1 Clef resilience: account lookup, 429 stall, timeout *(clef.ts)*
- [ ] #198 H4 Golden-path corpus contradictions + golden-fact check *(corpus)*
- [ ] #199 H5 On-stage strings *(RunTape, Answer, report template)*
- [ ] #196 H2 Stage preflight *(scripts; after H1; M1 adds the OpenAI check)*

**Lane B: decision model**
- [ ] #204 Q2 Neutral tie-breaks + UC3 price fix, so a good judge still triggers the refund *(after H3; required for M1)*
- [ ] #214 M1 Switch to OpenAI Decisions (`gpt-6-luna`), plus a live comparison on the real corpus *(after H3 and Q2)*
- [ ] #200 H6 Q&A pack *(after M1's live comparison)*

**Lane C: measurement** (start now)
- [ ] #203 Q1 In-domain eval set and label flywheel
- [ ] #212 R1 Decisions bench v2 on the real corpus *(uses Q1)*

**Lane D: evidence sufficiency (#194)**
- [ ] #211 E4 UC4 corpus case where a focused free search finds the missing fact *(corpus work can start now; after H4, since they share the story bible)*
- [ ] #208 E1 Requested facts frozen before evidence, coverage checklist, model judges the requirement *(after M1)*
- [ ] #209 E2 Next unresolved requirement + explicit stop reason *(after E1)*
- [ ] #213 R2 Coverage judge: writer vs decision model *(parallel with E1; uses Q1)*
- [ ] #210 E3 One focused free follow-up search before buying *(after E1, E4 and R2)*

**Lane E: integrity and calibration**
- [ ] #205 Q3 Trust calibration that measures the promise *(after Q2 and M1)*
- [ ] #206 Q4 Decision robustness and latency *(after M1)*
- [ ] #207 Q5 Production calibration layer *(last: after Q1 and E1)*

**Ops:** #201 H7 checklist, ongoing.

**Delivery: 7 bundled PRs, at most 3 running at once.** Each PR merges automatically when CI is green. No review agent runs; the owner reviews after everything merges. The run instructions are in `final-push/analysis/prompt.md`.

| PR | Bundle | Wave | Starts after |
|---|---|---|---|
| 1 | Stage UI and Q&A: v1.2 UI work, #199, #200 | 1 | — (merge by Fri 10:00 SGT) |
| 2 | Decision-path hardening: #197, #195, #196, plus #204's tie-breaks | 1 | — |
| 3 | Corpus: #198, plus #204's UC3 price and tests, plus #211's UC4 content | 1 | rebases after PR 2 |
| 4 | Measurement: #203, plus the harnesses for #212 and #213 | 1 | when a slot frees |
| 5 | Decision-model switch: #214, #205, #206 | 2 | PRs 2 and 3 |
| 6 | Requested facts and free re-search: #208, #209, #210, plus #211's UC4 test | 3 | PR 5 |
| 7 | Calibration and research write-ups: #207, #212, #213 | 4 | PRs 4 and 6 |

**Merge order for shared files:**
- `decision.ts`: PR 2 → 5 → 7
- `loop.ts`: PR 2 → 5 → 6
- the corpus: PR 3 only
- `Answer.tsx`: PR 1 → 6

**Stage cut:** Sat 10 Oct by 08:30 SGT. If preflight and a live smoke pass on the latest `main`, tag it `demo-oct10`; otherwise present `known-good-2026-10-08`.

**Background** (decisions benchmark on [`bench/decisions-vs-clef`](https://github.com/Collaboration95/theFastandtheFungible/tree/bench/decisions-vs-clef/bench/decisions); synthetic data):
- Production Clef-flash (raw, 0.15) scores held-out purchase F1 0.505.
- Luna with batch-evidence wording scores 0.915 raw and 0.983 calibrated.
- The UC3 regression "failure" came from a story that needs a fooled judge.

**Explicitly not doing:**
- porting the benchmark's thresholds (0.38 / 0.05) to raw production scores;
- batching for Clef-flash (measured worse);
- judgment caching (no evidence it would hit).
