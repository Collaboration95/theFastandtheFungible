# ResearchAgent: buy evidence with a purpose

## What we are building

ResearchAgent helps people reach better-supported conclusions while spending
only when additional evidence is likely to matter. It researches from open
material, identifies an unresolved question, evaluates premium sources,
requests approval for an exact purchase, and shows what the acquired evidence
changed.

The October 10 demonstration will make that entire journey visible.

## Planned features

- **A useful answer before spending.** Start with accessible evidence and make
  the remaining uncertainty explicit. Finish without a purchase when the
  evidence is sufficient.
- **Deliberate source selection.** Recommend sources that address a real gap;
  skip repeated reporting and reject purchases outside the mandate. Decisions
  respond to changes in evidence, price, and budget.
- **A working publisher boundary.** One local publisher service will expose
  previews, exact quotes, locked content, and verified delivery across three
  publisher profiles. The commercial relationships and settlement are simulated
  and labelled; the application and HTTP interactions run for real.
- **Controlled, recoverable purchases.** Require exact approval, enforce spend
  on the server, preserve receipts, and retry interrupted delivery without a
  second charge.
- **Visible evidence impact.** Compare the answer before and after acquisition,
  with each material change linked to its supporting passage. New evidence can
  strengthen, qualify, contradict, or leave a conclusion unchanged.
- **A repeatable demonstration.** Use a small, frozen research corpus, a clear
  fresh-run flow, visible execution modes, and an offline rehearsal path.

## How we build

We apply the 80/20 rule to integration and verification cost. Each feature must
improve a research decision, make its value visible, or protect a critical
guarantee. We build one complete flow early, then strengthen it with cases that
can expose incorrect behavior.

Coding agents work on bounded tasks with explicit acceptance criteria. A small
automated verification loop checks decisions, spending, access, citations, and
recovery. Independent checks determine completion. More generated code is not
our measure of progress; more verified product behavior is.

The interface prioritizes a readable answer, understandable purchase rationale,
visible spending, and an obvious evidence change. We retain the current stack
and focus on one research domain. AWS AgentCore is a bounded operational
experiment, admitted only when it improves the working system. General crawling,
additional domains, a marketplace, and production payments remain outside this
demo's scope.

## What success looks like

The audience sees the agent recognize what it does not know, acquire useful
evidence within an approved budget, and explain what it learned. The same system
can decline an unnecessary purchase. Every demonstrated outcome can be traced
and repeated.

Implementation details: [October 10 task plan](plans/october-10/README.md).
