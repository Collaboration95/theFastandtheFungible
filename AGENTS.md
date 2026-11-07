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
- Current push (SFF finals, Nov 2026): if you need a reference, start with
  [docs/SFF-PUSH.md](docs/SFF-PUSH.md), the tracker and changelog. Add one line
  there when you ship something significant.
- Never break the five hard gates ([README](README.md#hard-guarantees),
  clarified in FINAL-PUSH §12):
  - no premium bytes before a grant;
  - the budget is the only spending authorization, and only policy code can
    initiate a purchase, never the LLM;
  - one charge per intent;
  - real citations;
  - everything simulated or substituted is labelled.
- Merge gate: `npm run gate -- --publish` passes for the current clean PR head
  (GitHub commit status `local-gate`). Hosted CI is a sanity/nightly/release
  backstop; it does not block routine merges. Ship with the
  `ship-pr` skill. PR bodies follow `.github/pull_request_template.md`, which
  opens with the judging criterion the PR serves
  ([docs/JUDGING-CRITERIA.md](docs/JUDGING-CRITERIA.md)).
- You may loosen a gate check, leak threshold or test when the fix belongs
  elsewhere, but say what was loosened and why in the PR description. Never
  loosen one silently.
- Do not bind ports 5100, 8788 or 8790 in tests; use ephemeral ports.
- Never use real money, create cloud resources, or log API keys or wallet seeds.

- Visuals use a restrained geometric icon/illustration system: light palette,
  consistent grid and stroke, legible at 16–24 px. No cartoon mascots or generic
  entrance motion; short motion must explain money or refund state changes.
  One exception, requested by the owner (7 Nov): the pixel-art agent
  in `design/character/` may appear in the README hero, the explainers site,
  the pitch deck and app loading/empty states. Its motion shows a state (search, pay, key reveal,
  verified, refund), respects reduced motion, and it never stands in for a
  real receipt, label or ledger link. No other mascots.
- Needs-human items belong in pinned issue #265, not in docs.

## How work is run (SFF push)

- Append XRPL, x402, Starter Kit, Testnet or tooling friction to
  `docs/BUILDER-FEEDBACK.md` on the day it happens: date, evidence path/commit,
  workaround, suggested fix, severity and mainnet impact. Distinguish observed
  incidents from code-derived failure modes and historical research.

- The project runs hands-off: agents plan, build, ship and merge in loops. Agents
  have full authority to merge to `main` once the merge gate passes.
- **Coding is about 70–80% GPT-6.1 Sol (Codex)** for bigger features, and **GPT-6.1 Terra** for small, well-scoped changes; the rest is Claude Sonnet.
- **Claude Opus (medium) orchestrates:** it holds context, decides next steps, reviews direction, and only plans large re-architecture itself. It delegates all code.
- If Codex usage runs out, Sonnet takes over coding.
- Prefer fewer, larger PRs: bundle related issues into one PR rather than
  splitting for parallelism. Many small PRs mean more CI waits and rebases.
  Run at most about three lanes at once.
