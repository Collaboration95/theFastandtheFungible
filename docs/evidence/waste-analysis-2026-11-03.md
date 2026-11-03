# Why our agent wastes money, in four categories

Observed on the final #307 LIVE dev + heldout runs, 3 November 2026.
Synthetic articles, keyword search, fixture planner/writer, simulated payments.
Gross cost includes refunds. These are not customer purchases.

| Primary cause | Purchases | Gross wasted S$ | Examples and evidence |
|---|---:|---:|---|
| Adjacent or incomplete fact | 4 | 1.70 | Q38 buys Vietnam issuance for Singapore; Q37 buys general customer capacity for a CoWoS comparison; Q44 buys Kestrel queues for QFN/BGA OSAT queues; Q21 digest omits the commitment date. |
| Broken publisher promise | 3 | 0.90 | Q18/Q44/Q48 buy the deliberately false AlphaLeak lead-times claim. Proof fails; refunded bytes stay quarantined. |
| Answer extraction failure | 2 | 1.15 | Q07 purchased p1 states the allowed 7–2 vote; Q48 purchased p1 states 41 weeks versus 29 weeks. The fixture writer does not return those cited spans. |
| Source-label provenance restriction | 1 | 0.20 | Q16 digest repeats 55.2%/58.5% but the label requires the independent NotFT source. It is not independent new evidence; do not relabel it as success. |
| **Total** | **10** | **3.95** | All final wasted purchases classified, with no label edits. |

`waste-purchases.json` inventories all 21 wasted purchase observations in the
four canonical before/after reports, including IDs, rounds, prices, proof
outcomes, primary causes and explanations. Repeated purchases across runs are
separate observations, not repeated charges within an intent. No within-run
duplicate purchase was found. No free-coverage miss was established in these
requested-fact flows: coverage here is the bank needle oracle, not the LIVE
coverage judge. High model confidence accompanies some errors; that is not an
independently established causal category or a fitted confidence threshold.
Price/value is likewise a contributor, not proven as the primary cause.

Sources: `eval/scorecard/receipt-value-results.json` preserves the raw flow,
sweep and coverage reports for #307. The recovered #307 archive also contains
SQLite API stores and all dev trials. `scripts/export-decision-labels.ts` reads
those stores without accessing grant or receipt bytes. The original #304 flow
store is not present in this checkout/recovered archive: its committed 593-row
sweep and scorecard history establish candidate scores and aggregate outcomes,
but cannot identify individual selected purchases. The integrated #307 Before
reports use the #304 policy/prompt baseline; this is not a claim to have
recovered #304's original per-purchase flow. The trial archive is local ignored
evidence; canonical report data and the concise purchase inventory are committed.

The smallest policy repair targets the observed wrong-country substitution.
For a frozen requirement with an explicit country, a signed menu plus title
that explicitly locates the source in other countries cannot pass an all-high
model score. Missing scope stays unknown. Multi-country comparisons stay
eligible if any requested country matches. This is a rejection rule only;
no new spending authority, content access or completion claim follows from it.
The writer failures and deliberate refund scene remain visible in the metric.
