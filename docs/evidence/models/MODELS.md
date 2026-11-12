# Local embedding qualification — 12 November 2026

## Status

Local BGE-small CPU embeddings are opt-in. The calibrated decision provider was rejected and remains removed. Container qualification and Node 22 merge admission are in progress; no deployment or paid-note lift claim is made here.

## Retrieval choice and Mac cost

BGE-small is selected: recall ties MiniLM, with better MRR matching the recorded remote model. These are within-publisher results on `eval/queries.json`, including keyword and natural-language forms through production hybrid ranking. This is a tuning bank, not independent generalisation evidence. Existing downstream RRF and its query-dependent hash tie-break are unchanged.

| Mac CPU cost, one inference thread | BGE-small | MiniLM-L6 |
|---|---:|---:|
| Weights and tokenizers, bytes | 34,727,605 | 23,685,780 |
| Cold pipeline load and warm-up, ms | 1,236.59 | 111.85 |
| RSS increase after warm-up, bytes | 155,287,552 | 117,669,888 |
| Query embed p50 / p95, ms | 2.58 / 4.16 | 1.22 / 1.84 |

Measured in separate Node 22.23.4 processes on this Mac: Apple M5, 10 cores, 32 GiB RAM, macOS 26.6.2, arm64, under the shared heavy lock. Cold means a new process, not cleared OS caches; BGE ran first. Latency excludes search and includes actual inference without query-cache hits. JSON files retain unrounded values. No API calls were used for retrieval. Hosted latency and memory remain unmeasured.

Build acquisition pins revisions and writes SHA-256 manifests. Runtime sets `allowRemoteModels=false` and `local_files_only=true`. Missing weights fail publisher readiness. Corpus vectors have text hashes; stale vectors fall back to labelled keyword search. Remote vectors are never mixed into the local embedding space. Discovery embeds public metadata only. No client module imports Transformers; server bundles externalise it.

## Negative result: learned policy rejected

The logistic fit on 988 historical rows yielded 778 usable open-fact decisions (497 train / 132 validation / 149 test), grouped by question. Held-out Brier **0.036947**, ECE **0.058718**, AUC **0.971429** were worse than fixture rules (**0.035478 / 0.044411 / 0.982540**). The calibrated provider, weights and UI label have been removed. Hosted keeps policy rules. This is a historical, question-heldout retrospective with reconstructed metadata, not an unseen-writer or live policy result. The provider, fit tooling and eval results are excluded from this embedding change.


## Flags and reproduction

`EMBEDDING_PROVIDER=local` opts into offline CPU inference and hybrid ranking, even with `SEARCH_EMBEDDINGS=off`. Unset retains existing keyword/explicit remote behavior. `EMBEDDING_MODEL_DIR` defaults to `data/models`. Existing `DECISION_PROVIDER=fixture` remains unchanged. Hosted promotion and redeployment belong to the orchestrator.

```sh
export PATH="$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH"
node --import tsx scripts/bake-embedding-model.mjs
EMBEDDING_PROVIDER=local node --import tsx scripts/build-embeddings.mjs
```

Runtime never acquires models. Build-time acquisition pins model revision `ea104dacec62c0de699686887e3f920caeb4f3e3` and records SHA-256 hashes. Additive Docker targets `api-models` and `publisher-models` retain the original target names and defaults. Models use glibc/Node 22 and a CPU-only dependency closure; the original images use Alpine/Node 24. Image delta includes that base/runtime difference.

No live model calls or XRPL transactions are required for this qualification. Prior lane cost remains US$0.671020182 maximum accounted exposure; it belongs to the separate eval evidence.
