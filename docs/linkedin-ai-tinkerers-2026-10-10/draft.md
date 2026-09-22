# LinkedIn draft

AI agents can do a lot nowadays, but we still arent sure about giving them a wallet and spending ability. 

Now imagine a research agent that isn’t limited to open-web sources — one that can responsibly access authorized paywalled research when the evidence is worth the cost.

I’m excited to share that I’ll be demoing **ResearchAgent: An Evidence Procurement Guard** at the AI Tinkerers Singapore meetup with Joe Heitzeberg on **October 10, 2026**.

ResearchAgent is a project we’re actively evolving. The demo is not a polished “look what we built” pitch. It is a live walkthrough of the control boundary we’re trying to make useful:

`research mandate → open evidence → evidence-family clustering → named gap → premium-source comparison → human approval → evidence unlock → impact diff`

The agent starts with a question, approved sources, and a budget. It retrieves and clusters the open evidence, identifies what is still missing, and compares a candidate source by expected evidence impact—not price alone. In the canonical flow, it skips a redundant source, blocks one above the per-source ceiling, and only unlocks the approved evidence before showing how the answer changed.

If you work on retrieval, agents, evaluation, or AI systems that take real-world actions, I’d especially value your critique on three questions:

- Is marginal evidence value a defensible way to rank what an agent should buy?
- Is a self-issued evidence receipt enough accountability, or does it need independent verification?

Heres the landing site: 
https://tftf-research.gpyes44.chatgpt.site/

Learn more and register for the event on Oct 10:
https://singapore.aitinkerers.org/p/ai-tinkerers-singapore-saturday-demo-meetup-with-joe-heitzeberg-oct-10


## Before publishing

- Replace the homepage placeholder.
- Confirm “SingHacks” versus “Singax” and the exact finalist wording, then add it only if verified.
- Confirm which runtime modes are live and label fixture/synthetic/Testnet behavior accurately.
- Add the final screenshot/diagram only after checking that it contains no secrets, private URLs, or misleading live-payment signals.
