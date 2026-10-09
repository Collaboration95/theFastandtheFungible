Research for #194. Must finish before E3 ships.

**Why:** #194's two research comments disagree on who judges coverage:
- **Comment 1:** the research LLM assesses coverage in its existing answer call, with no extra call.
- **Comment 2:** Clef-flash checks every requirement in one multi-question request.

Writer-only coverage is LLM self-assessment: the same call writes the answer and grades it. Clef coverage fits the talk ("the decision model decides when to stop and when to buy"), but it is unvalidated. In the 8 Oct benchmark, Clef-flash's discrimination on the similar addresses-gap task was only AUROC 0.82.

**Do:**
- **Labels:** on the `bench/decisions` harness, build requirement-level labels (supported / partial / missing / conflicting) over identical evidence snapshots. Use Q1's question bank where possible.
- **Arms:**
  - current free-text gaps;
  - writer coverage, as in E1;
  - one Clef-flash multi-question request per evidence state.
- **Metrics:**
  - false-complete rate, the most important;
  - false-missing rate;
  - status confusion matrix;
  - p50/p95 latency;
  - cost.
- **Include the hard cases:**
  - the right topic present but the answer absent (UC2's company-vs-analyst margins);
  - forecasts presented as facts;
  - the wrong date or entity;
  - conflicting sources.

**Constraints:** never use the demo token, and make no production change.

**Output:**
- a recommendation on whether E1's coverage source becomes Clef;
- a coverage rubric;
- a calibration plan for it.
