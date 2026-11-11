# R9-C evidence: it answers questions about itself

Lane R9-C (11 Nov 2026). Base: `main` at `e90bda32` (R9-A and R9-B merged).
Everything here is regression data on questions we have already seen. None of it
is a held-out result.

Runs use fixture research and decision models, SIMULATED payments and keyword
search (`SEARCH_EMBEDDINGS=off`). The live decision model (`gpt-6-luna`, Clef)
was not measured.

## Files

| File | What it holds |
| --- | --- |
| `corpus-golden.json` | Corpus pin for `tests/fact-menu.test.ts`: content hash, 182 explainers, 255 paid, and the three added articles |
| `bank-hashes.json` | Question-bank hashes used by the dev-bank run (equal to R9-A's) |
| `metrics.json` | Per-bank metrics before and after, plus every run whose purchases, lead or flags changed |
| `comparison.json` | `scripts/k5-compare-runs.ts` strict diff (every decision row) |
| `r9-judge-questions.json` | Round-9 judges' recorded live plans replayed on `main` and on this branch, modal and run wording |

## Acceptance: judges' product questions

Recorded live-planner wordings (`tests/fixtures/r9-live-plans.json`) replayed
through `tests/fixtures/r9-live-shaped.ts`. Pinned in
`tests/r9c-product-questions.test.ts`.

| Question | Wording | `main` | This branch | Lead (branch) |
| --- | --- | --- | --- | --- |
| B5 how it decides what to buy | modal, run | nothing bought | `product-how-it-decides`, S$0.40 | "ResearchAgent decides which article is worth buying in two steps…" |
| C1 how the writer gets paid / what stops reading without paying | modal | 3 articles, S$1.20, no lead | `product-writer-paid`, S$0.40 | "the writer gets paid by publishing the article's key on the XRP Ledger…" |
| C1 | run | 2 articles, S$0.80, no lead | `product-writer-paid`, S$0.40 | same |
| C4 what a writer earns / the fee | modal, run | nothing bought | `product-writer-earnings`, S$0.40 | "a writer earns the full price they set per sale, S$0.40 or 40,000 drops…" |
| F1 (writer earnings, follow-up) | modal, run | nothing bought | `product-writer-earnings`, S$0.40 | same |
| D4 writer never reveals the key | run | `product-escrow-no-show`, no lead | same article | "If the writer never completes delivery, policy waits for the validated deadline and submits cancellation…" |

The other 17 recorded questions per wording are unchanged (same purchases, same
lead).

Fixture-planner wordings (the plan `fixturePlan()` makes, used when the live
planner is off):

| Question | Bought | Open gaps |
| --- | --- | --- |
| How does ResearchAgent decide which article is worth buying? | `product-how-it-decides` | none |
| How does the writer get paid, and what stops the agent from reading the article and then refusing to pay? | `product-writer-paid` | none |
| How much does a writer earn per sale, and what does ResearchAgent take as a fee? | `product-writer-earnings` | none |
| How does the writer get paid? | `product-writer-paid` | none |

## Off-topic chat (H9-11)

Out-of-scope chat ("Give me a recipe for banana bread", "Who won the 2023
Singapore Grand Prix?", "How big is the Sun?", "Write me a haiku") now gets one
fixed line, labelled `fixed · Off-topic`:

> I only research XRPL, x402 and agent payments, so I can’t help with that here.
> Try asking how a writer gets paid for an article.

Greetings and thanks still get a short model reply. "What are you?" still gets
the fixed statement from #460. Pinned in `tests/r9c-product-questions.test.ts`
and `tests/scope.test.ts`.

## Dev-bank regression (R9-A table, rerun)

Before = `main` `e90bda32`; after = this branch. Same bank hashes as R9-A.

| Bank | N | Buy & cite | Answers it | Negative buys | Articles per buying run | Spend |
| --- | --- | --- | --- | --- | --- | --- |
| v1 | 20 | 19 → 19 | 0 → 0 | 0 → 0 | 1.00 → 1.00 | S$7.60 → S$7.60 |
| v3 | 20 | 20 → 20 | 18 → 18 | 0 → 0 | 1.45 → 1.45 | S$11.60 → S$11.60 |
| v3-dev | 20 | 18 → 18 | 9 → 9 | 0 → 0 | 1.17 → 1.17 | S$8.40 → S$8.40 |
| v3-negatives | 10 | 0 → 0 | 0 → 0 | **0 → 0** | n/a | S$0.00 → S$0.00 |
| v5 (used) | 20 | 19 → 20 | 17 → 18 | 0 → 0 | 1.26 → 1.25 | S$9.60 → S$10.00 |
| v5-negatives (used) | 10 | 0 → 0 | 0 → 0 | **0 → 0** | n/a | S$0.00 → S$0.00 |
| UC1–UC3 (`uc`) | 3 | 2 → 2 | 0 → 0 | 0 → 0 | 1.50 → 1.50 | S$1.60 → S$1.60 |
| UC1–UC3 (`uc-frozen`) | 3 | 2 → 2 | 0 → 0 | 0 → 0 | 1.50 → 1.50 | S$1.60 → S$1.60 |
| Presets | 3 | 3 → 3 | 0 → 0 | 0 → 0 | 1.33 → 1.33 | S$1.60 → S$1.60 |

Policy violations 0 and verification failures 0 in every bank, before and after.
No run lost a result.

One run changed: v5 H03 (AP2) now buys `c5-ap2-agent-payments-protocol` and
answers. Its question says "payment" and the article says "pay"; the topic check
now counts those as the same word.

`comparison.json` lists 82 policy differences out of 109 runs. 68 differ only in
decision values, because three more articles shift the keyword index's
statistics. 11 have a different unbought candidate row, and 3 (v3-dev D02, D12
and v5 H03) a different verdict on an unbought row. Purchases, spend and leads
match in all of them except H03.

## Root causes

- **C1.** The writer-paid question has two clauses. The answer guard compared the
  whole question with each article, and "pay", "paid" and "payment" counted as
  three different words, while "then" counted as a topic word. Every escrow
  article scored 0.25–0.38 against the 0.5 floor, so the run bought articles it
  could not lead with. The topic check now folds those word forms and drops
  "whether" and "then" as stop words.
- **D4 run wording.** "final" made the broad `finality` family the only required
  topic, and no escrow article says "finality", so the lead was dropped. When
  every required family is a predicate (`finality`, `transaction cost`,
  `digital payment token`), an article now passes if it names at least two of
  the question's subject words and half of them.
- **B5 and C4.** No article answered them. The three new team-written product
  explainers do.
