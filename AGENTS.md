# Agent rules for the October 10 demo sprint

- **Read [FINAL-PUSH.md](FINAL-PUSH.md) first (6 Oct direction).** It holds the
  product, scope and decisions D1–D24. Do not reopen a decision; only the open
  items in §15 are open. [prompt.md](prompt.md) holds the hard gates and the
  workflow. `docs/archive/` is the replaced 4 Oct direction: never use it as
  guidance. The work is specified as GitHub issues (milestone "10 Oct 2026 —
  AI Tinkerers demo"); [OVERNIGHT-OCT7.md](OVERNIGHT-OCT7.md) is the run plan.
  Never implement an issue labelled `deferred` ("DO NOT IMPLEMENT").
- The product is a neutral search engine for agent-readable expertise, with a
  wallet. Writers search their own articles; DeepSeek clarifies, plans and
  writes; a Cloudflare Clef decision model judges what is worth buying; trust
  scores weight it; deterministic policy code pays over x402 on XRPL Testnet
  within the per-prompt budget. The 5 s action modal confirms the plan before
  any spending; there is no per-purchase approval modal.
- Never break the five hard gates in prompt.md §2 (clarified in FINAL-PUSH §12):
  - no premium bytes before a grant;
  - the budget is the only spending authorization, and only policy code can
    initiate a purchase, never the LLM;
  - one charge per intent;
  - real citations;
  - everything simulated or substituted is labelled.
- Merge gate: `npm run check:fast` passes and one review pass reports no
  blockers. There is no second review. A small bug gets fixed by the next
  agent.
- Stay inside your stream's write scope (FINAL-PUSH §13).
- Do not bind ports 5100, 8788, or 8790 and do not run Playwright unless you
  are the orchestrator; use ephemeral ports in tests.
- Never use real money, create cloud resources, or log API keys or wallet seeds.
- Runs are unattended (prompt.md §12). Never wait for a human: decide, record
  the decision, and continue. A blocked package gets the `blocked` label and a
  note in `STATUS.md`.
