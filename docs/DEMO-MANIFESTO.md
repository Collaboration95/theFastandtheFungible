# ResearchAgent: a search engine for agent-readable expertise

Direction and decisions: [FINAL-PUSH.md](../FINAL-PUSH.md). This manifesto
summarises it for the team; where the two differ, FINAL-PUSH wins.

## What we are building

Agents are the new readers. Experts should get paid when an agent uses their
thinking.

We are building a neutral search engine for agent-readable expertise, with a
wallet. You ask a question and set a budget for that prompt. Independent
writers run search over their own articles. The agent answers from free
sources first, with citations, and names what it still doesn't know. A
calibrated decision model (Cloudflare's Clef, on Workers AI) judges which
paywalled article is worth buying for that gap. Code pays the writer directly
over x402 on XRPL Testnet, within your budget. After delivery the agent checks
every promise the writer made. A broken promise is challenged and costs the
writer trust.

**LLMs write. A decision model chooses. Code pays.** The LLM can name what is
missing but cannot buy, pick a purchase or change the budget, so instructions
hidden in an article cannot spend money. In the talk, that is one sentence in
Q&A. We lead with Clef and calibration.

How we position it:

- Pay Per Crawl prices pages.
- Pay Per Use trusts the buyer's word.
- We price evidence: a calibrated model decides what is worth buying, the
  writer sets the price, and every promise is checkable.

The three promises (writers, readers, the engine) are in
[FINAL-PUSH §1](../FINAL-PUSH.md#1-what-we-are-building). We say we reduce
the buyer's information problem (Arrow's paradox). We do not say we solve it,
and the ledger cannot enforce refunds.

The October 10 demonstration makes that entire journey visible.

## Features (as built, 8 Oct)

From the v1 build, kept in the final push:

- **A free answer that always works.** A cited answer from free sources. A S$0
  budget means this layer alone.
- **A budget per prompt.** The budget is the only spending authorization. The
  agent buys on its own inside it, never above a per-source cap. A Stop button
  halts it immediately.
- **Decisions you can audit.** A decision table shows every paywalled
  candidate with its price, the model's probabilities, the computed value and
  a verdict. With S$0 it still shows what the agent would have bought.
- **Recoverable purchases.** One charge per intent, durable receipts, and a
  retried delivery never charges twice. Settlement is on XRPL Testnet.
- **Visible evidence impact and internals.** Answer v1 against v2, a live
  trace and the raw 402 exchange.
- **A deep-research PDF** with cited findings, what the purchases changed and
  the decision table.

Built in the final push (7–8 Oct overnight run; see the decision IDs and STATUS.md):

- **Federated search** (D1–D3). Each writer searches its own full text. Search
  results carry an abstract, signals and a signed manifest, never paid bytes.
- **Signed manifests** (D4). The buyer can recompute the proofs after delivery.
- **Real x402 v2 with a writer-run facilitator** (D7).
- **Challenges and refunds** (D5). A failed proof triggers `/challenge`, the
  writer refunds on Testnet, and trust drops either way.
- **A public trust matrix** (D6). A trust score per writer, shown in the UI and
  multiplied into Clef's value.
- **Clarify, then a 5-second action modal** (D8). Up to two short questions,
  then a plan the user can edit or cancel. It confirms the plan, not a
  purchase.
- **Free-text gaps** (D10). Questions are no longer limited to one fixed topic.
- **A roster of fictional, labelled writers** (§10), one per decision it
  exercises. The Vertex corpus is removed (D18); the offline backup is the fixture demo on the new corpus.

Every feature must reinforce one pillar: calibrated buying, a verifiable
purchase, fairness to both sides, or the hard gates (D12).

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

We retain the current stack and focus on three topic lanes: Asia rates and
bonds, data centres and power, and semiconductors. Hosting the publisher on
Google Cloud Run (the event sponsor's platform) is an optional
experiment, admitted only once the local route works. AWS AgentCore, general
crawling, additional domains, a marketplace and production payments are
outside this demo's scope.

## What success looks like

The audience sees Clef and its calibration first, then the trust matrix. Three
runs show the product:

- **UC1: free sources are enough.** A question about a Bank of Japan decision
  is answered from free sources with citations. Clef finds no gap worth paying
  for, and S$0 is spent.
- **UC2: paid evidence changes the answer (main case).** Free sources cover
  the headline; the gap is insurer-level flow data. A rewrite and a low-credibility
  op-ed are skipped, a credible article is bought, and answer v2
  qualifies v1, with a Testnet receipt.
- **UC3: a bad actor is caught and pays back.** A writer with inflated
  relevance and a low price wins round one. Its proof fails, `/challenge`
  refunds on Testnet, trust drops from 0.8 to 0.4 and the writer is
  quarantined. Asking again shows it skipped for low trust.

Every outcome can be traced and repeated. The room also leaves knowing how it
was built: LLMs write, a decision model chooses, code pays; and a team of
coding agents produced the system in a week, as recorded in the build log.
Questions are drafts until the corpus exists; see
[FINAL-PUSH §11](../FINAL-PUSH.md#11-demo-use-cases-questions-are-drafts-until-the-corpus-exists)
and open items O1–O3.

Build instructions: [prompt.md](../prompt.md).
