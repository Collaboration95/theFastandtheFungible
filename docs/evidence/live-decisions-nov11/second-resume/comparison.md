| Metric | fixture | openai |
| --- | --- | --- |
| Runs (DONE / FAILED) | 6 (6 / 0) | 6 (4 / 2) |
| Runs ended "Decision model unavailable" | 0 | 2 |
| Answerable: right article bought first | 5/5 | 5/5 |
| Answerable: right article bought at all | 5/5 | 5/5 |
| Answerable: articles off the gold list | 0 | 0 |
| Answerable: lead matches key-fact pattern (not full completeness) | 5/5 | 5/5 |
| Should decline (E5 + v5 negatives): bought nothing | 1/1 | 1/1 |
| Articles per question | 0.83 | 0.83 |
| Spend (all questions) | S$2.00 | S$2.00 |
| Decision call latency p50 / p95 | in-process | 0.5 s / 2.6 s |
| Estimated decision wait per run p50 / p95 | in-process | 0.8 s / 2.9 s |
| End-to-end (scope + run) p50 / p95 | 4.1 s / 5.2 s | 5.1 s / 7.7 s |
| Decision call errors | 0 | 2× aborted (sibling failed) |
| Hosted meter refusals | 0 | 4× decision: question_token_cap |
| Peak decision input estimate per question (cap 50,000) | 0 | 45624 |
| Peak model reservation per question (cap US$0.05) | US$0.0081 | US$0.0286 |
| Settled decision cost per started run (configured rates) | US$0.0000 | US$0.0077 |
| Settled model cost per started run, all providers (configured rates) | US$0.0017 | US$0.0094 |
| Research writer fell back to extracts | 2 | 2 |

**presets**

| Metric | fixture | openai |
| --- | --- | --- |
| Runs (DONE / FAILED) | 1 (1 / 0) | 1 (0 / 1) |
| Right article first | 1/1 | 1/1 |
| Lead matches key-fact pattern (not full completeness) | 1/1 | 1/1 |
| Bought nothing when it should | 0/0 | 0/0 |
| Articles / spend | 1 / S$0.40 | 1 / S$0.40 |
| End-to-end p50 / p95 | 5.0 s / 5.0 s | 7.7 s / 7.7 s |

**judges**

| Metric | fixture | openai |
| --- | --- | --- |
| Runs (DONE / FAILED) | 5 (5 / 0) | 5 (4 / 1) |
| Right article first | 4/4 | 4/4 |
| Lead matches key-fact pattern (not full completeness) | 4/4 | 4/4 |
| Bought nothing when it should | 1/1 | 1/1 |
| Articles / spend | 4 / S$1.60 | 4 / S$1.60 |
| End-to-end p50 / p95 | 4.1 s / 5.2 s | 5.1 s / 6.2 s |

**negatives**

| Metric | fixture | openai |
| --- | --- | --- |
| Runs (DONE / FAILED) | 0 (0 / 0) | 0 (0 / 0) |
| Bought nothing when it should | 0/0 | 0/0 |
| Articles / spend | 0 / S$0.00 | 0 / S$0.00 |
| End-to-end p50 / p95 | n/a / n/a | n/a / n/a |

| Question | Rep | fixture | openai |
| --- | --- | --- | --- |
| XRPL2 | 1 | product-x402-response · S$0.40 · lead ✓ | product-x402-response · S$0.40 · lead ✓ ⚠ decision unavailable |
| D4 | 1 | product-escrow-no-show · S$0.40 · lead ✓ | product-escrow-no-show · S$0.40 · lead ✓ |
| E5 | 1 | nothing · S$0.00 | nothing · S$0.00 ⚠ decision unavailable |
| B5 | 1 | product-how-it-decides · S$0.40 · lead ✓ | product-how-it-decides · S$0.40 · lead ✓ |
| C1 | 1 | product-writer-paid · S$0.40 · lead ✓ | product-writer-paid · S$0.40 · lead ✓ |
| C4 | 1 | product-writer-earnings · S$0.40 · lead ✓ | product-writer-earnings · S$0.40 · lead ✓ |
