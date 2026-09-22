# Context capture

Captured on September 20, 2026 (Singapore time).

## Event facts visible on the Singapore page

- Event: **AI Tinkerers Singapore — Saturday Demo Meetup with Joe Heitzeberg (Oct 10)**.
- Date/time: Saturday, October 10, 2026, 9:30 AM–12:30 PM (GMT+8).
- Location: Singapore; exact venue is shared with accepted attendees.
- Capacity: 70 builders; attendance is application-based.
- Joe Heitzeberg is listed as the special guest and founder of AI Tinkerers.
- The event page lists **ResearchAgent: Evidence Procurement Guard** in the demo lineup.
- The event is for active builders working with foundation models and generative AI.
- The page explicitly says: working code, live demos, implementation details, and no pitch decks.
- The agenda describes five-minute lightning demos plus Q&A and a possible Science Fair table for deeper walkthroughs.
- The submission guidance asks for code, traces, orchestration graphs, agent setups, data flows, decisions, trade-offs, failure modes, and reusable lessons.

The page's embedded demo metadata gives the registered title as **“ResearchAgent: An Evidence Procurement Guard for AI Research”** and describes the live flow as: set a research mandate, retrieve and cluster open evidence, identify the unresolved gap, then buy, skip, or block sources according to policy. It says the demo ends with a before/after conclusion and an Evidence Receipt containing authorization, quote, settlement, access state, and exact claim-level citations.

## What AI Tinkerers says makes a strong demo

The guidance page is unusually direct:

1. Show the implementation live; do not lead with a market overview or pitch.
2. Expose the internals: code, configuration, workflow graphs, prompts, APIs, or agent setup.
3. Go deep enough to teach a technical audience something they can reuse.
4. Explain decisions and trade-offs, including what failed or remains fragile.
5. Focus the demo on one technically interesting aspect rather than the whole product.
6. Keep visuals readable and use a diagram only when it clarifies the build.
7. Half-baked work is welcome if the audience can learn from it.

The key editorial implication is that the LinkedIn post should preview a builder lesson, not merely announce a speaking slot.

## Project facts verified in the repository

ResearchAgent is described in the repository as a budget-aware research prototype. Its core loop is:

1. set a research question, decision context, approved sources, and budget;
2. retrieve open evidence;
3. cluster sources into evidence families so repeated reporting is not counted as independent corroboration;
4. identify an unresolved evidence gap;
5. compare premium candidates by likely evidence impact, not price alone;
6. require explicit purchase approval;
7. unlock only the purchased evidence; and
8. produce a cited dossier and explain what changed.

The canonical local demo story uses a S$2 total budget and a S$1 per-source ceiling. It recommends an S$0.80 Grid Operators Report, skips a redundant source, blocks a S$1.40 over-ceiling source, and makes the conclusion more cautious after the approved evidence is unlocked.

The repository also documents an important truth boundary: the default corpus and settlement are synthetic/fixture-based; Groq and XRPL Testnet are optional paths. Public copy must label those modes honestly and must not imply a real publisher relationship or real-money purchase.

## Claims to resolve before publishing

- The user’s note says “finalist from Singax.” The repository says “SingHacks 2026 Ripple/XRPL-track prototype.” Confirm the competition name and the exact finalist wording.
- Confirm whether the October 10 event is the same milestone described locally as the “secondary demo target.”
- Confirm whether the homepage will be public, private, or replaced by the repository/demo link. The roadmap says hosting is out of scope before October 31, so a homepage URL may not be ready by October 10.
- Confirm which of fixture settlement, live Groq, and XRPL Testnet will be enabled during the actual demo.
- Confirm whether the evidence-impact comparison is live in the version being shown or still a planned surface.
- Do not publish synthetic source names as real partners or imply that premium articles are actually purchased from publishers.
