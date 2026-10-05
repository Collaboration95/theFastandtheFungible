# Agent rules for the October 10 demo sprint

- [prompt.md](prompt.md) is the source of truth for the product, scope,
  packages, and workflow. It overrides `docs/plans/october-10/*`,
  `docs/AGENT-DEVELOPMENT.md`, `docs/PRODUCT-ROADMAP-2026.md`,
  `docs/PRESENTATION-READINESS.md`, and the bodies of issues #59–#78.
- The product is Perplexity with a wallet. LLMs on DeepSeek write (answer,
  report), a Cloudflare Clef decision model chooses what to buy, and code pays
  within the per-prompt budget. There is no per-purchase approval modal.
- Never break the five hard gates in prompt.md §2:
  - no premium bytes before a grant;
  - the budget is the only spending authorization, and only policy code can
    initiate a purchase, never the LLM;
  - one charge per intent;
  - real citations;
  - everything simulated or substituted is labelled.
- Merge gate: `npm run check:fast` passes and one review pass reports no
  blockers. There is no second review. A small bug gets fixed by the next
  agent.
- Stay inside your package's write scope (prompt.md §6).
- Do not bind ports 5100, 8788, or 8790 and do not run Playwright unless you
  are the orchestrator; use ephemeral ports in tests.
- Never use real money, create cloud resources, or log API keys.
- Runs are unattended (prompt.md §12). Never wait for a human: decide, record
  the decision, and continue. A blocked package gets the `blocked` label and a
  note in `STATUS.md`.
