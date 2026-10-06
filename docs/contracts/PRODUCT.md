# Product contract

A neutral search engine for agent-readable expertise, with a wallet. Direction
and decisions: [FINAL-PUSH.md](../../FINAL-PUSH.md). This file keeps the promises.

A reader's agent asks a question. Writers search their own articles. Clef, a
calibrated model, picks the paywalled article worth buying. Code pays the
writer over x402 on XRPL Testnet, inside the budget, and the agent then checks
every promise ([§1](../../FINAL-PUSH.md#1-what-we-are-building)).

## Three promises

- **Writers:** found by relevance, not by who pays. You set your price. Your
  abstract never gives the article away. You are paid directly in seconds.
- **Readers:** you never pay for what you can read free, and never for a
  rewrite. A broken promise is challenged and the writer loses trust.
- **The engine:** ranking ignores price. We never hold the money. Every
  writer's trust score is public.

Decisions: federated search D1–D3, manifests D4, challenges and refunds D5,
trust D6, x402 v2 D7, clarify D8, free-text gaps D10. Hard gates:
[prompt.md §2](../../prompt.md) and
[FINAL-PUSH §12](../../FINAL-PUSH.md#12-hard-gates-promptmd-2-unchanged-with-clarifications).

## Demo use cases

UC1 spends S$0 because free sources suffice. UC2 (the main case) buys a paid
article that changes the answer. UC3 catches a bad actor, refunds it on Testnet
and quarantines it. Questions are drafts until the corpus exists
([§11](../../FINAL-PUSH.md#11-demo-use-cases-questions-are-drafts-until-the-corpus-exists), O1–O3).

## Limits

- We reduce the buyer's information problem (Arrow's paradox); we do not solve
  it. The ledger cannot enforce refunds.
- Writers and articles are fictional and labelled SYNTHETIC. Testnet XRP has
  no value. Nothing here is investment advice.
- `main` today is v1: one synthetic corpus and an x402-shaped flow. The
  promises above are the target, not shipped behavior.
- Local, single-user. Mainnet, licensing and a central index are out (D11).
