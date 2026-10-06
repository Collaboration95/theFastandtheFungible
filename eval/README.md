# Search tuning eval (orchestrator, 8 Oct overnight)

Reproduce (offline once the vectors exist):

    npx tsx eval/run-eval.mts            # baseline grid
    npx tsx eval/run-eval.mts '<json>'   # custom grid: [["name", {mode, boost, w, sim, rel, bm25?, body?}], ...]

- `queries.json`: 162 eval queries (2 per article: a 3–7 word keyword query and a natural question), written by
  DeepSeek (8 calls) from title + abstract + tags + first 600 chars, told not to copy the title.
- `query-vectors.json`: bge-base-en-v1.5 vectors for those queries (2 Workers AI calls).
- Metrics: MRR and R@1 of the target article inside its own publisher (what one writer's search returns), and AUC of
  the `relevance` value: target article in its publisher vs. the top hit of every *other* publisher for the same query
  (rewrite families excluded). AUC answers "does relevance mean the same thing across writers?", which calibration
  (Brier, §7) and AlphaLeak's inflated claim both depend on.

## Starting point → result (8 Oct, 02:00–03:00 SGT)

| Config | MRR | R@1 | AUC across writers |
|---|---|---|---|
| Start: hybrid text/vector 0.5/0.5, boosts title 3 · abstract 2 · tags 2 · body 1, relevance = score ÷ top hit | 0.978 | 0.957 | **0.478** |
| Keyword only (same boosts) | 0.964 | 0.932 | 0.466 |
| Vector only | 0.994 | 0.988 | 0.494 |
| Hybrid 0.5/0.5, relevance = blended hybrid score (the #142 quick fix) | 0.978 | 0.957 | 0.760 |
| Hybrid 0.5/0.5, relevance = query–article cosine | 0.978 | 0.957 | 0.985 |
| Hybrid 0.2/0.8, cosine | 0.991 | 0.981 | 0.984 |
| Hybrid 0.1/0.9, cosine | 0.994 | 0.988 | 0.983 |
| **Chosen: hybrid 0.2/0.8, body boost 0.5, cosine** | **0.997** | **0.994** | **0.984** |
| Keyword fallback: body 1, BM25 saturation | 0.964 | 0.932 | 0.902 |
| Keyword fallback: boosts 1/1/1/1 | 0.955 | 0.920 | 0.843 |
| Keyword fallback: boosts 4/3/2/0.5 | 0.968 | 0.938 | 0.926 |
| Keyword fallback: body 0.25 | 0.968 | 0.938 | 0.928 |
| Keyword fallback: no body at all | 0.972 | 0.944 | 0.926 |
| BM25 k1 1.2→2.0, b 0.75→0.3 (any combination) | ±0.005 | ±0.006 | ±0.003 |

Findings:
1. **The relevance definition mattered far more than any BM25 knob.** Normalising to the top hit made every writer promise
   1.0 for its best hit (AUC 0.48, a coin flip), so calibration (Brier) would punish honest off-topic writers and
   AlphaLeak's "inflated" 0.96 was the *lower* claim. Cosine on a fixed scale fixes both.
2. Vector weight 0.8 helps paraphrased queries; a 0.2 text share keeps exact names and figures (TSMC, N3P, 10-year).
3. Body boost 0.5: whole-body BM25 matches on stock phrases every post in a writer's voice shares. Removing the body
   entirely scores slightly better but breaks D1's promise (writers search their *full* text), so it stays at 0.5.
4. BM25 k1/b: no measurable effect at 8–15 articles per writer, so Orama's defaults stay.
5. **Content beat parameters for the golden path.** The UC1 golden post ranked #4–#7 in Basis Points under *every*
   config (10 BoJ posts look alike). Retitling it to say what UC1 asks ("what the Bank of Japan changed and how 10-year
   JGB yields reacted") moved it to #1 on all three UC1 queries.
6. Bug found: the embeddings cache keyed on the body hash only, so a retitled article kept a stale vector. It now keys on
   the hash of the embedded text (title, abstract, tags, body head).

Caveats: the eval queries are LLM-written from the head of each article, which favours title/abstract matches; within a
writer there are only 8–15 candidates, so MRR saturates. The cross-writer AUC is the number to watch.
Relevance scale: hybrid cosine 0.65 → 0, 0.90 → 1 (target median ≈ 0.83, other writers' median best hit ≈ 0);
keyword `bm25 / (bm25 + 12)` (target median ≈ 0.70, other writers' median best hit ≈ 0.44).
