# ResearchAgent: Perplexity with a wallet

## What we are building

You ask a question and set a budget for that prompt. A research agent answers
from free sources first, with citations, and names what it still doesn't know.
A decision agent then judges whether any paywalled source is worth its price.
It buys what clears the bar within your budget, and the answer updates to show
what the purchase changed. One click turns the result into a deep-research PDF.

**LLMs write. A decision model chooses. Code pays.**

Choosing whether to buy a source is not a writing task, so no LLM makes that
call. A decision model (Cloudflare's Clef, on Workers AI) returns calibrated
probabilities:
does this source address the gap, is it original reporting or a rewrite, and
is the gap material? A short, visible policy in code turns those probabilities
into a purchase decision. The LLM cannot trigger a purchase, so instructions
hidden in an article cannot spend money.

The October 10 demonstration makes that entire journey visible.

## Planned features

- **A free answer that always works.** Perplexity-style search, reading and
  streaming of a cited answer from free sources. A S$0 budget means this layer
  alone. It is deliberately boring and must never fail on stage.
- **A budget per prompt.** The budget is the only spending authorization. The
  agent buys on its own inside it, never above a per-source cap. A Stop button
  halts it immediately.
- **Decisions you can audit.** A decision table shows every paywalled
  candidate: its price, the decision model's probabilities, the computed value and a verdict
  (buy, rewrite, over cap, low value). With a S$0 budget it still shows what
  the agent would have bought.
- **A working publisher boundary.** One local publisher service exposes search,
  previews, x402-shaped 402 challenges, quotes and verified delivery across
  three publisher profiles. Commercial relationships and settlement are
  simulated and labelled; the application and its HTTP traffic run for real.
- **Recoverable purchases.** The server enforces the budget, keeps receipts,
  and retries an interrupted delivery without a second charge.
- **Visible evidence impact.** Answer v1 and answer v2 are compared side by
  side, with each change linked to its supporting passage. New evidence can
  strengthen, qualify, contradict or leave a conclusion unchanged.
- **Visible internals.** A live activity trace, the decision table, and a wire
  panel showing the raw 402 → settle → verified-delivery exchange.
- **A deep-research report.** One click produces a PDF with the cited
  findings, what the purchases changed, open questions, and an appendix with
  the decision table and receipts.
- **A repeatable demonstration.** A small, frozen corpus: a fictional company
  with realistic articles about one concrete, local question. Fresh runs,
  visible execution modes, and an offline fixture path.

## How we build

We apply the 80/20 rule to integration and verification cost. Each feature must
improve a research decision, make its value visible, or protect a critical
guarantee. We build one complete flow early, then strengthen it with cases that
can expose incorrect behavior.

Coding agents work in parallel on bounded packages. A package merges after a
fast check and one review pass. We would rather the next agent fix a small bug
than stall in a review loop. Five hard gates are never traded for speed:

- protected content stays locked until it is bought;
- spending stays inside the budget, initiated only by policy code;
- each purchase is charged once;
- citations are real;
- everything simulated is labelled.

More generated code is not our measure of progress; more working product
behavior is.

We retain the current stack and focus on one research domain. Hosting the
publisher on Google Cloud Run (the event sponsor's platform) is an optional
experiment, admitted only once the local route works. AWS AgentCore, general
crawling, additional domains, a marketplace and production payments are
outside this demo's scope.

## What success looks like

The audience sees a free answer arrive instantly. They watch a decision model
work out what that answer is missing and buy one source within budget, then
see exactly how the answer changed. The same system declines purchases that
aren't worth it. Every outcome can be traced and repeated. The room also
leaves knowing how it was built: LLMs write, a decision model chooses, code
pays; and a team of coding agents produced the system in a week, as recorded
in the build log.

Build instructions: [prompt.md](../prompt.md).
