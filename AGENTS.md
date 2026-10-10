# Agent rules

- The product is a neutral search engine for agent-readable expertise, with a
  wallet. Writers search their own articles; DeepSeek clarifies, plans and
  writes; a decision model judges what is worth buying (OpenAI Decisions
  `gpt-6-luna`, or Cloudflare Clef-flash with `DECISION_PROVIDER=cloudflare`);
  trust scores weight it; deterministic policy code pays over x402 on XRPL
  Testnet within the per-prompt budget. The 5 s action modal confirms the plan
  before any spending; there is no per-purchase approval modal.
- Design record: [docs/FINAL-PUSH.md](docs/FINAL-PUSH.md) (decisions D1–D24).
  As-built contracts: [docs/contracts/](docs/contracts/). Index:
  [docs/README.md](docs/README.md).
- Never break the five hard gates ([README](README.md#hard-guarantees),
  clarified in FINAL-PUSH §12):
  - no premium bytes before a grant;
  - the budget is the only spending authorization, and only policy code can
    initiate a purchase, never the LLM;
  - one charge per intent;
  - real citations;
  - everything simulated or substituted is labelled.
- Merge gate: `npm run check:fast` passes and CI is green. Ship with the
  `ship-pr` skill.
- You may loosen a gate check, leak threshold or test when the fix belongs
  elsewhere, but say what was loosened and why in the PR description. Never
  loosen one silently.
- Do not bind ports 5100, 8788 or 8790 in tests; use ephemeral ports.
- Never use real money, create cloud resources, or log API keys or wallet seeds.
