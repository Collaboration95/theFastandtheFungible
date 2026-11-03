# Judge Q&A prep

Ten likely questions, each with a short answer to say aloud (about 20 seconds)
and the facts behind it. Numbers are as of 3 Nov 2026; check the
[tracker](../SFF-PUSH.md) on 17 Nov for anything newer.

## 1. Is this ready for mainnet?

**Say:** "No, and we say so in writing. Mainnet is disabled in code. We have a
mainnet-readiness checklist that lists the gaps: payer keys need a KMS or
external signer, pricing needs the official RLUSD issuer and live FX quotes,
writers need KYB and sanctions screening, and the facilitator needs an SLA and
multi-instance storage. The money-safety parts are done and tested: persist
before submit, a pending state, exact delivery checks, and one charge per
intent."

**Behind it:** [BUILDER-FEEDBACK · mainnet checklist](../BUILDER-FEEDBACK.md#mainnet-readiness-checklist), [COMPLIANCE](../COMPLIANCE.md).

## 2. What about compliance? Are you a payment service?

**Say:** "It's a Testnet prototype, and no lawyer or regulator has reviewed it.
What we did build is the plumbing a compliance team asks for. There's a
hash-chained audit log written in the same transaction as every spend decision,
CSV and JSONL receipt export, read-only re-verification against the ledger, a
fail-closed payee denylist, and data pruning. Research purchases are
non-custodial: the operator pays writers directly. Hire-the-agent is
receive-and-forward custody, and we say exactly that."

**Behind it:** [COMPLIANCE · custody](../COMPLIANCE.md#custody-what-we-never-hold-funds-means). The denylist is an integration point, not a sanctions provider.

## 3. Why XRPL?

**Say:** "Three native features we'd otherwise need contracts for. Escrow with
crypto-conditions gives us proof-or-refund. Issued currencies let us pay
writers in a stablecoin. InvoiceID and memos bind each payment to its quote.
Fees are 12 drops, and ledgers close in seconds, which is what makes paying per
article viable. There's no contract to deploy or audit."

**Behind it:** [escrow-273](../evidence/escrow-273.md), [rlusd-275](../evidence/rlusd-275-refund-310.md), [x402-xrpl](../x402-xrpl.md). An escrow finish with a fulfilment costs 423 drops (B19).

## 4. What are the unit economics?

**Say:** "Model cost is about four-tenths of a US cent per question, and the
network fee is 12 drops per payment. Article prices are set by writers, around
S$0.10 to S$0.90 in our corpus, and capped at S$1 per source. In hire mode the
caller pays the research budget plus a fixed 20-cent service fee, a quarter of
which goes to cited writers as royalties. The real cost driver is buying the
wrong article, which is why we measure wasted spend."

**Behind it:** US$0.0043/query (README scorecard, LIVE models, 3 Nov). Hire split: [hire-274](../evidence/hire-274.md). The SGD↔drops rate is a fixed, labelled demo rate, not an FX claim.

## 5. What's real and what's simulated?

**Say:** "Real: every payment in our evidence settled on XRPL Testnet, and you
can click each hash. That covers article purchases, escrow finish and cancel,
the five-hop hire chain, test-USD payments and agent allowances. Simulated: the
offline demo and Mac app use a labelled simulated rail, and our quality
evaluations simulate payments. Fictional: the eight writers and their
articles. Substituted: test USD stands in for RLUSD, because the official
Testnet faucet needed authentication."

**Behind it:** [docs/evidence](../evidence/); hard gate 5 (label anything simulated).

## 6. How is this different from other agent-payment projects?

**Say:** "Most show that an agent *can* pay. We focus on whether it *should*,
and what happens when it's wrong. The LLM never holds spending authority; only
policy code inside a human budget can pay. We verify what was delivered and
refund broken promises, enforced by escrow. And we built a business model on
top: agents hire agents, and citations pay writers. We also measure purchase
quality on held-out questions and publish the misses."

## 7. Can the LLM be tricked into spending, for example by prompt injection?

**Say:** "It can be tricked into *recommending* a purchase, but it can't make
one. The SDK and MCP tools have no purchase method. Policy code checks the
budget, the S$1 per-source cap, the daily wallet cap and the per-agent
allowance. Model inputs are capped and treated as untrusted, and we ship an
adversarial injection test pack. The read-only gate audit found zero violations
in 10 runs and 728 observations."

**Behind it:** #286, `tests/purchase.test.ts` gate cases, `scripts/gate-audit.ts`.

## 8. Does it actually buy the right things?

**Say:** "Better, but not good enough yet, and we publish that. On 92 held-out
questions, wasted spend fell from 52.9% to 40.7%. The confidence interval is
wide, and we missed our 25% target. We classified every wasted purchase into
four causes; the biggest is buying an adjacent fact, like the right figure for
the wrong country. Signed fact menus from writers are our main lever."

**Behind it:** [waste analysis](../evidence/waste-analysis-2026-11-03.md). LIVE decision and coverage models, synthetic corpus, simulated payments.

## 9. What happens if a payment times out or the server crashes mid-payment?

**Say:** "We persist the signed transaction before submitting it, so a restart
reconciles the same hash and never signs twice. A missing transaction is
*pending*, not failed, until a validated ledger proves it expired. A reconciler
recovers in-flight payments every 15 seconds. Retries with the same
idempotency key return the same run and charge."

**Behind it:** [payment-ops-287](../evidence/payment-ops-287.md), [RUNBOOK](../RUNBOOK.md), builder-feedback items 1–2. The chaos/soak run is in open PR #317 (TODO: cite once merged).

## 10. Who are the customers, and how does it spread?

**Say:** "On the demand side, anyone running an agent that needs facts behind
paywalls: analysts, procurement, and other agents through MCP or x402 hire. On
the supply side, any expert with a Markdown folder, who can publish in one
command and get paid per read and per citation. It already plugs into Claude
Code and any MCP client, a TypeScript SDK and a Mac app. We haven't run
customer pilots yet; that's next."

**Behind it:** [mcp.md](../mcp.md), [sdk.md](../sdk.md), [publish-site-277](../evidence/publish-site-277.md). No traction claims: there are no real users or pilots yet.

## Curveballs

- **"Why S$, not XRP?"** People budget in their own currency. The ledger
  settles in drops or issued units at a fixed, labelled demo rate. Real FX is
  on the mainnet list (#163).
- **"Who built it?"** A small team directing AI coding agents in parallel lanes;
  a PR merges only after the check suite passes. Every PR, release and decision is public in the repo.
- **"Can a writer cheat the escrow?"** No: they're paid only if the proof
  passes. A buyer could read and refuse to release, so writers opt in. We
  state that hashlock isn't fair exchange (B17).
