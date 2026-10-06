# UC1–UC3 process scenarios (#157)

Run `npx vitest run tests/scenarios` from the repository root. `check:fast`
includes it, and the suite takes about 10 s.

## What it starts

- A separate publisher process (`driver.ts publisher`) and a separate API
  process, both on OS-assigned ports, each with its own fresh SQLite file.
- The API process is `server/index.ts`, or `driver.ts audit-api` for the
  audited suite.
- The publisher serves the v2 writer corpus on the SIMULATED rail with
  keyword search.
- The scope, plan, answer and Clef steps all run on fixtures.
- No browser runs, and no keys or external network are used.

## Expectations

Expectations come from the story bible (`data/corpus/v2/story-bible.json`)
through `use-cases.ts`. That file exports `USE_CASES` (question, clarify
pick, expected picks, refund) and `askBody(id, budgetMinor)`, the
`POST /runs` body including the clarify answers. Presenter tooling (#154) can
reuse both.

## Corpus changes the harness makes

The scenario corpus (`scenarioCorpus()`) is the v2 corpus with these changes:

- A distinct canary appended to every paid body. It sits outside every
  passage, so it must never appear anywhere.
- `OVER_CAP`: the UC2 Kopi Contrarian decoy is priced at S$1.40, over the
  S$1.00 per-source cap.
- `INJECTION` (injection test only): an instruction passage planted in the
  UC2 free filing.

## Scenarios

| Test | Gate coverage |
|---|---|
| UC1 | Cited answer, no gap, S$0 spent with S$2 authorised; the digest is SKIP_REWRITE |
| UC2 | One clarify question (the angle); NotFT bought once; MarketPulse is SKIP_REWRITE; the S$1.40 decoy is SKIP_OVER_CAP; impact QUALIFIES or STRENGTHENS; CLARIFY event |
| S$0 | No charge; NotFT is would-buy (SKIP_OVER_BUDGET) |
| Injection | Decisions, spend, budget, cap and impact match the UC2 baseline; the instruction is never a claim |
| UC3 | See below |
| Leak gate | See below |
| Stop | Stop during (slowed) Clef scoring: no intent, no spend, the free answer is kept |
| Oracle | Planted leaks and wrong run, article or version grants are detected |

**UC3:**
- AlphaLeak is bought, then CLAIM_FAILED, then REFUNDED (exactly one REFUND
  event).
- H drops 0.80 → 0.40 and AlphaLeak is quarantined (checked via
  `/api/reputation`).
- Round 2 buys The Fab Floor, and AlphaLeak is never cited.
- A re-ask shows SKIP_LOW_TRUST.

**Leak gate:**
- Checks every raw API response, SSE frame, Clef request, LLM request and
  process log.
- The audited API uses the real Clef adapter with a fixture-backed fetch, and
  the real LLM client against a local server. That server returns `{}`, so the
  labelled fixture fallback writes the answers.
- A second S$0 run in the same processes proves one run's grant never
  authorises another run.

## Invariants every run checks

- The budget and cap hold, and there is one intent and one receipt per charge.
- Every citation resolves to an exact passage.
- A paid citation needs a VERIFIED purchase and a grant in the same run.
- Labels: SIMULATED, local, fixture, keyword only.

Leak markers come from every paid article:
- its canary;
- each passage shorter than 8 words, verbatim;
- every 8-word run of its longer passages, which catches partial leaks too.

A marker is dropped only when it also occurs in public text: free bodies,
titles, abstracts, tags or dates. Text that also appears in an article granted
to the same observation is allowed.
