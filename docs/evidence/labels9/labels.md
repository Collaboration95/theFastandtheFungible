# Code to display label

Display only. The event and reason codes are unchanged in saved runs.

| Code | Label |
| --- | --- |
| `CLARIFY` | Clarify |
| `PLAN` | Plan |
| `SEARCH` | Search |
| `READ_FREE` | Read free |
| `ANSWER` | Write answer |
| `ANSWER_PROGRESS` | Writing |
| `ANSWER_READY` | Answer ready |
| `FREE_DRAFT` | Free draft |
| `DECIDE` | Choose article |
| `BUY` | Pay writer |
| `READ_PAID` | Read purchased |
| `DONE` | Done |
| `FAILED` | Failed |
| `STOPPED` | Stopped |
| `PROOF` | Check promises |
| `CHALLENGE` | Request refund |
| `REFUND` | Refund |
| `REPUTATION` | Writer trust |
| `COVERAGE` | Check facts |
| `FOLLOW_UP` | Search again |
| `GRANT` | Access granted |
| `PURCHASE` | Payment |
| `MODEL_FALLBACK` | Model substitute |
| `MODEL_USAGE` | Model usage |
| `DECISION_UNAVAILABLE` | Buying unavailable |
| `MANIFEST_DROPPED` | Source excluded |
| `RECOVERY` | Recovery |
| `REPORT` | Report |
| `SNAPSHOT` | Saved |
| `TRACE` | Trace link |
| `WIRE` | Request |
| `XRPL` | Ledger |
| `PROGRESS` | Progress |
| `LEDGER_DRY_RUN` | Ledger preview |
| `LEDGER_PRE_CHECK` | Ledger check |
| `ROYALTY_UNRESOLVED` | Royalty unresolved |
| `DECIDED` | Purchase chosen |
| `QUOTED` | Price received |
| `RESERVED` | Budget reserved |
| `SUBMITTING` | Payment being confirmed |
| `NOT_FOUND` | Not found |
| `SETTLED` | Payment settled |
| `DELIVERY_PENDING` | Waiting for the article |
| `VERIFIED` | Article verified |
| `SKIPPED` | Skipped |
| `FAILED_NOT_SETTLED` | Payment failed before settlement |
| `DELIVERY_FAILED` | Article delivery failed |
| `CLAIM_FAILED` | A promised detail failed its check |
| `CHALLENGED` | Refund requested |
| `REFUNDED` | Refunded |
| `CHALLENGE_REJECTED` | Refund request rejected |
| `CHALLENGE_REFUSED` | Refund refused or timed out |
| `complete` | All requested facts answered |
| `no-eligible-purchase` | No source worth buying for the remaining facts |
| `budget-exhausted` | Budget used up |
| `round-limit` | Three-round limit reached |
| `decision-unavailable` | Could not judge sources; nothing bought |
| `stopped` | Stopped by you |
| `faucet_unavailable` | Testnet faucet unavailable |
| `validation_timeout` | Ledger confirmation took too long |
| `wallet_cache_unavailable` | Saved Testnet wallet unavailable |
| `network_unavailable` | Testnet network unavailable |
| `SKIP_REWRITE` | Already acquired or repeats existing evidence |
| `SKIP_OVER_CAP` | Over the article price limit |
| `SKIP_OVER_BUDGET` | Over the remaining budget |
| `SKIP_LOW_VALUE` | Not enough useful new evidence |
| `SKIP_NO_GAP` | No missing fact to fill |
| `SKIP_LOW_TRUST` | Writer trust too low |
| `MODEL_FALLBACK / guard` | No supplied passage matched closely enough; used offline extracts without calling the model. |
| `MODEL_FALLBACK / timeout` | The model took too long; used offline extracts instead. |
| `MODEL_FALLBACK / http` | The model provider returned an error; used offline extracts instead. |
| `MODEL_FALLBACK / cap` | The model allowance for this question was used up; used offline extracts instead. |
| `MODEL_FALLBACK / invalid` | The model output did not pass validation; used offline extracts instead. |
| `MODEL_FALLBACK / unavailable` | The model was unavailable; used offline extracts instead. |
| `keyword only (embeddings unavailable)` | Keyword search (semantic search not used) |
| `hybrid` | Keyword and semantic search |

Promise pairs such as `client requirements` retain the existing shared promise renderer: “Mentions client and requirements”.
