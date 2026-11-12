# In-process model evidence — 12 November 2026

| Retrieval, 162 existing queries | Recall@5 | MRR |
|---|---:|---:|
| Keyword baseline | 0.993827 | 0.972222 |
| Recorded Cloudflare BGE-base vectors | 1.000000 | 0.993827 |
| Local q8 BGE-small | 1.000000 | 0.993827 |
| Local q8 MiniLM-L6 | 1.000000 | 0.990741 |

BGE-small is selected: both small models recover every target in the top five;
BGE-small gives the better reciprocal rank and matches the recorded remote model.
These are within-publisher results on `eval/queries.json`, including both keyword
and natural-language forms, using the production hybrid ranking. They are tuning
bank results, not independent generalisation evidence. Existing downstream RRF
and its query-dependent hash tie-break are unchanged.

| Mac CPU cost (one inference thread) | BGE-small | MiniLM-L6 |
|---|---:|---:|
| Weights and tokenizers, bytes | 34,727,605 | 23,685,780 |
| Cold pipeline load and warm-up, ms | 1,236.59 | 111.85 |
| RSS increase after warm-up, bytes | 155,287,552 | 117,669,888 |
| Query embed p50 / p95, ms | 2.58 / 4.16 | 1.22 / 1.84 |

Measured in separate Node 22 processes on this Mac under the shared heavy lock.
Cold means a new process, not cleared OS disk caches; BGE ran first. Query latency
excludes search and includes actual inference on every query, without query-cache hits.
JSON summaries alongside this file retain unrounded results. No API calls or model
spend were used. These are local Mac measurements, not hosted measurements.

## Reproduce retrieval and bake the runtime

```sh
export PATH="$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH"
node --import tsx scripts/bake-embedding-model.mjs
node --import tsx scripts/bake-embedding-model.mjs Xenova/all-MiniLM-L6-v2
node --import tsx eval/local-embeddings.ts
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh node --import tsx eval/local-embeddings.ts Xenova/bge-small-en-v1.5
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh node --import tsx eval/local-embeddings.ts Xenova/all-MiniLM-L6-v2
EMBEDDING_PROVIDER=local node --import tsx scripts/build-embeddings.mjs
```

Build acquires pinned model revisions and writes a SHA-256 manifest. Runtime sets
`allowRemoteModels=false` and `local_files_only=true`. Missing baked weights fail
publisher readiness. Corpus vectors include text hashes; stale vectors fall back
to labelled keyword search. Private Cloudflare vectors are not mixed into the
local embedding space. The runtime never embeds paid bodies for discovery.

Opt-in: `EMBEDDING_PROVIDER=local` enables CPU inference regardless of the legacy
`SEARCH_EMBEDDINGS` switch. Default remains the legacy provider, with embeddings
off unless `SEARCH_EMBEDDINGS=live`. `EMBEDDING_MODEL_DIR` defaults to `data/models`.
No client module imports Transformers; the Docker server bundle externalises it.

The additive `api-models` / `publisher-models` Docker targets use Debian/glibc for
ONNX, bake weights and corpus vectors, and preserve the existing Alpine targets.
Hosted compose/default promotion belongs to the orchestrator. Image size and
offline-container validation are pending measurement.

## Calibrated decisions and live two-arm evaluation

Pending implementation and measurement. No quality lift, live-model cost or
zero-violation result is claimed yet. No XRPL transactions were made in retrieval
measurements.

Model references: [BGE-small model](https://huggingface.co/Xenova/bge-small-en-v1.5),
[server inference and local-only settings](https://huggingface.co/docs/transformers.js/tutorials/node).
