**Why:** every decision-quality change (Q2–Q5, #194) moves UC outcomes, yet the only labelled set we have is the benchmark's synthetic one. Its limits:
- The prose is templated.
- The generator comes from the same vendor as the challenger it scored.
- 119 preview/body overlaps would fail our own leak gate.
- 156 of 160 gaps are material.
- The 30 gold items have not been human-reviewed.

Nothing measures the product claim either, that buying improves the answer compared with free-only. `docs/PRESENTATION-READINESS.md` notes that payment completion alone is not product value.

**Do:**
- **A question bank over the v2 corpus.**
  - At least 40 questions, including UC1–UC3 variants.
  - Each lists its requested facts and the articles that establish them, planted by construction.
  - The generator's vendor must differ from the judged model's.
  - Use scripted checks, plus human review of a sample.
- **A label flywheel from real runs.** Export from the store what is already there (decision rows, REPUTATION events, intents) and add only what is missing. Per purchase:
  - the pre-purchase Clef row (gap, addresses-gap, originality, credibility, value);
  - the post-purchase observed score;
  - the proof outcome;
  - whether the re-answer gained a supported requested fact.
  - No premium bytes may leave the grant path.
- **An offline eval command** comparing free-only with with-purchase answers on:
  - requested facts supported;
  - citation validity;
  - purchases per question;
  - wasted spend.

  It also needs a live mode that reuses the `bench/decisions` harness, on a separate Cloudflare account.

**Write scope:**
- `eval/` (new files)
- an export script under `scripts/`
- `server/store.ts`, read accessors only
- tests

**Acceptance:**
- `npm run eval:decisions` runs offline in fixture mode.
- The demo path's behaviour is unchanged.
- The eval set is versioned, and its generator and vendor are recorded.

**Depends on:** nothing. It is step 1 of the decision-quality epic.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- Work in `../tftf-wt/<id>`.
- Never run batch jobs on the demo Cloudflare token.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
