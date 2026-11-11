| Metric | fixture | openai |
| --- | --- | --- |
| Runs (DONE / FAILED) | 19 (19 / 0) | 19 (6 / 13) |
| Runs ended "Decision model unavailable" | 0 | 13 |
| Answerable: right article bought first | 18/18 | 17/18 |
| Answerable: right article bought at all | 18/18 | 17/18 |
| Answerable: articles off the gold list | 3 | 1 |
| Answerable: lead matches key-fact pattern (not full completeness) | 17/18 | 16/18 |
| Should decline (E5 + v5 negatives): bought nothing | 11/11 | 11/11 |
| Articles per question | 0.76 | 0.62 |
| Spend (all questions) | S$8.80 | S$7.20 |
| Decision call latency p50 / p95 | in-process | 0.5 s / 0.9 s |
| Estimated decision wait per run p50 / p95 | in-process | 0.9 s / 2.0 s |
| End-to-end (scope + run) p50 / p95 | 3.6 s / 6.6 s | 4.4 s / 5.9 s |
| Decision call errors | 0 | 13× aborted (sibling failed) |
| Hosted meter refusals | 0 | 26× decision: question_token_cap |
| Peak decision input estimate per question (cap 50,000) | 0 | 48368 |
| Peak model reservation per question (cap US$0.05) | US$0.0096 | US$0.0296 |
| Settled decision cost per started run (configured rates) | US$0.0000 | US$0.0126 |
| Settled model cost per started run, all providers (configured rates) | US$0.0020 | US$0.0144 |
| Research writer fell back to extracts | 4 | 5 |

**presets**

| Metric | fixture | openai |
| --- | --- | --- |
| Runs (DONE / FAILED) | 9 (9 / 0) | 9 (1 / 8) |
| Right article first | 9/9 | 9/9 |
| Lead matches key-fact pattern (not full completeness) | 9/9 | 9/9 |
| Bought nothing when it should | 0/0 | 0/0 |
| Articles / spend | 12 / S$4.80 | 9 / S$3.60 |
| End-to-end p50 / p95 | 3.9 s / 7.0 s | 4.9 s / 5.9 s |

**judges**

| Metric | fixture | openai |
| --- | --- | --- |
| Runs (DONE / FAILED) | 10 (10 / 0) | 10 (5 / 5) |
| Right article first | 9/9 | 8/9 |
| Lead matches key-fact pattern (not full completeness) | 8/9 | 7/9 |
| Bought nothing when it should | 1/1 | 1/1 |
| Articles / spend | 10 / S$4.00 | 9 / S$3.60 |
| End-to-end p50 / p95 | 4.2 s / 6.5 s | 4.8 s / 6.3 s |

**negatives**

| Metric | fixture | openai |
| --- | --- | --- |
| Runs (DONE / FAILED) | 0 (0 / 0) | 0 (0 / 0) |
| Bought nothing when it should | 10/10 | 10/10 |
| Articles / spend | 0 / S$0.00 | 0 / S$0.00 |
| End-to-end p50 / p95 | 0.9 s / 1.1 s | 0.9 s / 1.1 s |

| Question | Rep | fixture | openai |
| --- | --- | --- | --- |
| XRPL2 | 1 | product-x402-response · S$0.40 · lead ✓ | product-x402-response · S$0.40 · lead ✓ ⚠ decision unavailable |
|  | 2 | product-x402-response · S$0.40 · lead ✓ | product-x402-response · S$0.40 · lead ✓ ⚠ decision unavailable |
|  | 3 | product-x402-response · S$0.40 · lead ✓ | product-x402-response · S$0.40 · lead ✓ ⚠ decision unavailable |
| XRPL1 | 1 | team-rlusd · S$0.40 · lead ✓ | team-rlusd · S$0.40 · lead ✓ |
|  | 2 | team-rlusd · S$0.40 · lead ✓ | team-rlusd · S$0.40 · lead ✓ ⚠ decision unavailable |
|  | 3 | team-rlusd · S$0.40 · lead ✓ | team-rlusd · S$0.40 · lead ✓ ⚠ decision unavailable |
| XRPL3 | 1 | xrpl-reserves, team-rlusd · S$0.80 · lead ✓ | xrpl-reserves · S$0.40 · lead ✓ ⚠ decision unavailable |
|  | 2 | xrpl-reserves, xrpl-tx-trustset · S$0.80 · lead ✓ | xrpl-reserves · S$0.40 · lead ✓ ⚠ decision unavailable |
|  | 3 | xrpl-reserves, team-rlusd · S$0.80 · lead ✓ | xrpl-reserves · S$0.40 · lead ✓ ⚠ decision unavailable |
| A3 | 1 | team-fees · S$0.40 · lead ✓ | team-fees · S$0.40 · lead ✓ |
| A4 | 1 | c5-xrpl-token-escrow-xls85 · S$0.40 · lead ✓ | c5-xrpl-token-escrow-xls85 · S$0.40 · lead ✓ ⚠ decision unavailable |
| A5 | 1 | xrpl-escrow · S$0.40 · lead ✓ | xrpl-escrow · S$0.40 · lead ✓ ⚠ decision unavailable |
| D1 | 1 | c5-fatf-recommendation-16-travel-rule, xrpl-compliance-fatf-travel-rule · S$0.80 · lead ✓ | c5-fatf-recommendation-16-travel-rule · S$0.40 · lead ✓ |
| D3 | 1 | c5-mas-licence-paying-suppliers-rlusd · S$0.40 · lead ✗ | c5-mas-licence-paying-suppliers-rlusd · S$0.40 · lead ✗ ⚠ decision unavailable |
| D4 | 1 | product-escrow-no-show · S$0.40 · lead ✓ | product-payment-finality · S$0.40 · lead ✗ ⚠ decision unavailable |
| E5 | 1 | nothing · S$0.00 | nothing · S$0.00 ⚠ decision unavailable |
| B5 | 1 | product-how-it-decides · S$0.40 · lead ✓ | product-how-it-decides · S$0.40 · lead ✓ |
| C1 | 1 | product-writer-paid · S$0.40 · lead ✓ | product-writer-paid · S$0.40 · lead ✓ |
| C4 | 1 | product-writer-earnings · S$0.40 · lead ✓ | product-writer-earnings · S$0.40 · lead ✓ |
| NG01 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
| NG02 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
| NG03 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
| NG04 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
| NG05 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
| NG06 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
| NG07 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
| NG08 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
| NG09 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
| NG10 | 1 | nothing · S$0.00 (chat reply (no run)) | nothing · S$0.00 (chat reply (no run)) |
