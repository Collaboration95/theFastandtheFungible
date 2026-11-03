# Short description: three lengths

For the SingHacks finals form (Ripple track). Pick the tier that fits the field.
Every claim here is merged and dated in [the evidence files](../evidence/); the
precise labels are below each tier. Facts as of **3 Nov 2026**; refresh the
numbers on 11 Nov if a later release changes them.

## ~50 words

ResearchAgent is research with a wallet. It answers from free sources first,
then buys the one missing article straight from its writer over x402 on XRPL,
inside a budget you set. Only policy code can spend, never the LLM. Broken
promises are refunded. It runs on XRPL Testnet with fictional writers.

## ~150 words

ResearchAgent is an AI agent that does research with a wallet. You set a budget; it
answers from free sources first, then buys only the article that fills the
gap, paying the writer directly over x402 on the XRP Ledger. The model judges
what is worth buying, but only deterministic policy code can spend, and never
past your budget. Each article is checked against the writer's signed
promises; a broken promise is refunded, optionally enforced by native XRPL
Escrow.

Since SingHacks we shipped five tagged releases: an MCP server for Claude Code
and other agents, a Mac app, a TypeScript SDK, one-command publishing for
writers, and "hire the agent", where other agents pay ResearchAgent and it pays
royalties to every writer it cites.

Payments settle on **XRPL Testnet** (no real money). The writers and articles
are fictional. The offline demo labels its simulated payments.

## ~300 words

ResearchAgent is an AI agent that researches with a wallet. You ask a question and set a
budget (S$0 to S$5). It answers from free sources first. Then it buys the one
article that fills the gap, paying the writer directly over x402 on the XRP
Ledger. A decision model judges what is worth buying. Only deterministic policy code can make a purchase, and
never beyond your budget. Five hard gates hold on every run: no premium bytes
before payment, the budget is the only spending authority, one charge per
intent, real citations, and labels on anything simulated. Tests and a
read-only audit enforce them (0 violations across 10 runs on 3 Nov).

Each delivered article is checked against the writer's signed promises. A
broken promise is refunded. With native XRPL Escrow the ledger enforces that
refund, not the writer's goodwill: on Testnet a failed proof cancelled the
escrow and returned the full amount with the writer offline.

Since SingHacks we shipped five tagged releases and more than 40 merged pull
requests:

- an MCP server, so Claude Code or any agent can buy research inside caps that
  a human sets;
- a Mac app;
- a TypeScript SDK;
- per-agent allowances from one wallet;
- one-command publishing, which turns a Markdown folder into a paid writer in
  under 19 seconds;
- "hire the agent", where another agent pays ResearchAgent over x402 and it
  pays a citation royalty to every writer it cites, free writers included.

Settlement works in XRP and in an issued test-USD token. We also keep a
dated log of 35 builder-feedback items and a mainnet-readiness checklist.

What is real and what is not: payments settle on **XRPL Testnet**, with no real
money. The eight writers and their articles are fictional. The offline demo
simulates payments and says so. The test USD is a stand-in, because the
official RLUSD Testnet faucet required authentication. Mainnet is disabled in
code.

## Label check (for whoever pastes these)

| Claim | Label | Source |
|---|---|---|
| x402 payments, escrow, hire, test USD, agent allowances | XRPL Testnet, real validated transactions; fixture research | [evidence](../evidence/) |
| "0 violations across 10 runs" | Live decision/coverage models, fixture research, simulated payments; 48 fresh questions, 568 observations, 3 Nov | [README scorecard](../../README.md#proof) |
| "under 19 seconds" | 18.90 s, one Testnet run, synthetic starter content | [publish-site-277](../evidence/publish-site-277.md) |
| "five tagged releases", "more than 40 PRs" | v0.1.0–v0.5.0; 40 merged 2–3 Nov SGT | `gh release list`, `gh pr list --state merged` |
| "35 items" | 20 findings from building plus 15 September research submissions | [BUILDER-FEEDBACK](../BUILDER-FEEDBACK.md) |
