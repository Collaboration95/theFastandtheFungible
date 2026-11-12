# One useful paid answer · T3-1, 12 Nov 2026

Local `HOSTED=1`, baseline `f3f570fb`; live DeepSeek planning and final writing,
rule-based buying and coverage, keyword search, team-authored writer. Real XRPL
Testnet XRP, no real value. Readiness was stubbed healthy. This is existing T3
measurement evidence, not a fresh hosted ask, held-out test or deployment acceptance.

Question: **How does the writer get paid, and what stops the agent from reading the
article and then refusing to pay?**

| Stage | This run's evidence |
|---|---|
| Free evidence | The initial extractive-fixture draft said “Matched articles supplied no citable answer · nothing bought”. Rule-based coverage: 0/3 requested facts supported. It did not produce a supported free answer. |
| Missing fact | What binds publishing the article key to payment, and prevents reading before paying? |
| Bought passage | `product-writer-paid` p3: “To claim the money, the writer submits EscrowFinish with the fulfillment, which is the key. That one validated transaction releases the payment to the writer and makes the key public, so payment and delivery are a single event.” |
| Final answer | The writer gets paid by publishing the article's key on the XRP Ledger; payment waits in escrow that only that key can open. Final rule-based coverage: 3/3; no recorded open gaps. This is a per-run coverage observation, not an independent quality score. |

**Clarification added 12 Nov (the retained quotation and run are unchanged):** the article’s key is the only thing that opens the writer’s escrow. The app shows the article only after EscrowFinish validates. Signed submission exposes the key before validation; anyone (the writer first) can still claim the payment with that key until CancelAfter. The quoted “single event” describes validated settlement, not secrecy before validation.

One article, four delivered passages, S$0.40 display price = 40,000 Testnet drops
at the fixed demo rate (not FX). Scope-through-answer 29.525 s, including 1.497 s
planning; anchor/verification time is separate. Buyer create 12 drops, writer finish
423; buyer anchor another 12. Fees confirmed by FIN's read-only transaction check
in `ledger.json`; the original T3 card didn't retain individual fee metadata.
**Model cost: unmeasured**; token usage/cost was not retained. Do not substitute
US$0.0026 from the different 3 November synthetic evaluation.

The free draft is labelled `fixture · extractive-fixture`; the final answer is
`DeepSeek · deepseek-flash`. There were no MODEL_FALLBACK events in T3's event list;
that does not turn the initial fixture draft into live output. Browser verification
in T3: 26 passed, 2 not checked, 0 failed; identity and historical origin not checked.

[Summary](summary.json) contains copied measurement fields and the receipt SHA-256;
[receipt export](receipts.json) is byte-for-byte T3-1. Original seven-run context:
[measurements](../../../evidence/t3-presets/README.md). Article:
[team-authored writer-payment explainer](../../../../data/corpus/v2/articles/team-xrpl-explainers/product-writer-paid.json).

- [create 039FFE63…](https://testnet.xrpl.org/transactions/039FFE638582EF411E042F7237B96B29A15442F8AD0070A76D8CE19B18B6A25D)
- [finish BC2B4BAD…](https://testnet.xrpl.org/transactions/BC2B4BAD2D7E7615E3A3B6A74888899F433615EE99D4E0ACD75F5CC9C2BA9F01)
- [anchor 711C5958…](https://testnet.xrpl.org/transactions/711C59581B0FD2623FE53A4316CA62BE99BABC9AC1EA8D228BC481C4D94959E7)
