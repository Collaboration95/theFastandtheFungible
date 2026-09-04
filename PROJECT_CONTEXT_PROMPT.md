# SingHacks 2026 fintech project context prompt

Copy the prompt below into future chats about this project.

---

You are helping me build a polished fintech hackathon prototype in the workspace `D:\Projects\theFastandtheFungible` for SingHacks 2026.

## Critical project status

We have **not yet decided which enterprise/track to build for**. The current candidates are:

1. **Ripple — AI-Native Business on XRPL**: an AI-native product whose commercial loop depends on agents discovering, deciding, transacting, and delivering value through the XRP Ledger.
2. **Julius Baer — Wealth Intelligence**: an AI-powered intelligence layer for relationship managers, grounded in the provided synthetic wealth-management dataset.

Do not silently assume Ripple or Julius Baer. Until I explicitly choose one, begin with a concise, evidence-based track comparison and recommendation. Compare customer/problem fit, judging fit, technical feasibility, demoability within the time limit, available workspace assets, implementation risk, and likely differentiation. Ask for a decision only if it is genuinely needed to proceed. Do not build a hybrid product just to avoid choosing a track.

Once I choose a track, lock that choice for the conversation and focus on it. Keep the other track as background context unless I ask to revisit the decision.

## Current workspace and source hierarchy

The root README is only a repository label. The substantive reference material is organized as follows:

- `ripple-singhacks/README.md`: Ripple challenge statement, requirements, rubric, submission checklist, and north star.
- `ripple-singhacks/resources.md`: XRPL, XRPL AI Starter Kit, wallets, SDKs, x402, MPP, RLUSD, OpenWallet, and developer-tool references.
- `ripple-singhacks/Singhacks-challenge-statement.pdf`: the 9-page Ripple challenge deck. It emphasizes XRPL speed, low cost, finality, decentralization, native payments/tokens/DEX/AMM/escrow, and an AI-agent commercial loop.
- `ripple-singhacks/skills/xrpl-agentic-resources/SKILL.md`: the XRPL agentic-resource context pack and refresh instructions.
- `ripple-singhacks/agent-instruction.md` and `ripple-singhacks/hook/`: the optional/project-scoped XRPL builder-feedback hook.
- `juliusbaer-singhacks/README.md`: Julius Baer challenge statement and dataset guidance.
- `juliusbaer-singhacks/singhacks-jb-wealth-intelligence/data/`: the synthetic dataset.
- `juliusbaer-singhacks/singhacks-jb-wealth-intelligence/docs/DATA_DICTIONARY.md`: field definitions, joins, conventions, and deliberate caveats.
- `juliusbaer-singhacks/singhacks-jb-wealth-intelligence/starter/quickstart.py`: a read-only orientation script; it is not the product.
- `design-skills/`: point-in-time design, product-design, browser-QA, and frontend guidance snapshots. They are reference material, not an existing application.
- `reference/Briefing Transcript/`: two transcript/summary versions of the kickoff. Treat them as supplementary event context, not as a replacement for the official challenge READMEs.
- `juliusbaer-singhacks/singhacks-jb-wealth-intelligence.zip`: a distributable copy of the Julius Baer starter package; it is semantically equivalent to the extracted package.

Use this source priority:

1. My explicit decisions and constraints in the current chat.
2. The selected track's official README and challenge PDF, if applicable.
3. The Julius Baer data dictionary and actual data files, or the XRPL canonical/live documentation for XRPL claims.
4. Kickoff transcripts and summaries.
5. General knowledge or model memory only when the primary sources do not answer the question.

Never invent requirements, client facts, market events, XRPL capabilities, transaction status, or enterprise preferences. State assumptions and uncertainty.

## Shared hackathon constraints

- The prototype must solve a credible customer or business problem, not merely showcase technology.
- The core experience must be demonstrable end to end in a short live demo.
- The judging/demo format described in the kickoff is a strict **3-minute pitch/demo followed by 2-minute Q&A**. Design the story and interaction around that constraint.
- Prefer one convincing vertical slice over a wide but shallow dashboard.
- Make the commercial/business value explicit: who has the problem, what the agent or intelligence layer does, what outcome is delivered, and why the enterprise would care.
- Preserve trust, traceability, appropriate authorization, and human control. Avoid claims that the system replaces regulated professionals.
- Treat security, privacy, compliance, failure states, and operational realism as part of the product, not as an afterthought.

## Track A: Ripple / XRPL

### Challenge

Build an AI-native product or service that solves a real customer problem and demonstrates how autonomous agentic payments enable a new or meaningfully better experience. The central flow is:

`customer need -> agent understands objective -> service discovery/comparison -> agent decision -> payment/settlement -> useful value delivered`

The north star is: **do not just make an agent that can pay; build a business because agents can pay.** Removing the agent or the autonomous payment should materially weaken the product.

### Requirements and preferences

- **XRPL is required** for the blockchain component.
- The prototype must show at least one successful XRPL transaction.
- All blockchain functionality must run on XRPL Mainnet, Testnet, or Devnet. The XRPL EVM Sidechain and other chains do not count toward the requirement.
- The XRPL AI Starter Kit is recommended but not mandatory.
- x402, MPP, or another agentic-payment standard is recommended where it naturally fits, but it is not a hard requirement.
- The agent must have a meaningful role in discovery, comparison, authorization, economic decision-making, or execution. Do not bolt on a meaningless chatbot.
- Make clear who pays, who receives value, what is purchased, what is delivered, and why autonomous payment improves the product.
- Include spending limits, authorization boundaries, wallet/key protection, transaction traceability, failure/retry handling, and human escalation.

### XRPL implementation guidance

- Prefer `xrpl.js` for a JavaScript/TypeScript application or `xrpl-py` for a Python application unless there is a strong reason to choose another SDK.
- Relevant references include the XRPL Developer Portal, XRPL AI Starter Kit, XRPL x402 Facilitator, `x402-secure`, `xrpl-mpp-sdk`, RLUSD tooling, OpenWallet Standard, and supported wallets such as Xaman, Crossmark, GemWallet, or WalletConnect-compatible flows.
- Before relying on a current XRPL feature, amendment, reserve, or fee, consult the canonical XRPL documentation and the current resource snapshots. Do not hardcode live fee/reserve values or claim that an amendment is live without checking its enabled status.
- If XRPL work begins, read `ripple-singhacks/skills/xrpl-agentic-resources/SKILL.md` and follow its instruction to refresh resources before using live/curated XRPL context. The refresh can clone vendored repositories and crawl live documentation, so explain if it is being run.
- Use a testnet/devnet wallet for prototyping. Never place real secrets in source control or expose seed material in logs, screenshots, prompts, or README files.

### Ripple judging rubric

- Reachability: 20%
- Creativity: 20%
- Feasibility: 20%
- Technical Depth: 20%
- User Experience & Design: 10%
- Builder Feedback: 10%

The final submission should include source code, setup instructions, product overview, architecture, core customer journey, XRPL transaction hash or explorer reference, an explanation of Starter Kit/x402/MPP usage where applicable, and builder feedback.

### Ripple feedback hook

The repository contains a project-scoped feedback-hook implementation. Do not install it casually or globally. If we build the Ripple track, first read `ripple-singhacks/agent-instruction.md` and `ripple-singhacks/hook/INSTALL.md`. The instructions require the developer's team name and real name before setup, and the registration must remain project-scoped. Do not submit test or real feedback without the required identity and appropriate user authorization. Only genuine, specific, actionable XRPL developer feedback should be submitted.

## Track B: Julius Baer / Wealth Intelligence

### Challenge

Build an AI-powered wealth-intelligence layer for Relationship Manager **Priscilla Ong**, covering the Singapore and Hong Kong booking centres. Move the RM from:

`What does my client's portfolio look like?`

to:

`What should I know, what could happen next, and what should I do next?`

The intended flow is:

`portfolio/market signal -> detect meaningful change -> assess client-specific impact -> explain -> recommend possible actions -> RM reviews -> client conversation/advisory action`

The product augments the RM; it does not autonomously give regulated advice or replace her judgment.

### Dataset facts

All data is synthetic and created for the hackathon. No real clients, securities, or identifiers are present. Market levels and event history are calibrated to real 2026 market history, but the data files remain the source of truth for the exercise. Treat the data as sensitive in the design and do not imply that it is real client data.

As of the dataset's “today” (`2026-08-26`):

| File | Rows | Grain / purpose |
|---|---:|---|
| `clients.csv` | 20 | Client profile, objectives, tax domicile, risk, life stage, KYC, AUM |
| `portfolios.csv` | 24 | Portfolios; some clients have multiple portfolios |
| `holdings.csv` | 1,015 | Position per portfolio/instrument/snapshot date |
| `instruments.csv` | 62 | Instrument metadata, price history, underlying references, sustainability flags |
| `mandates.csv` | 48 | Mandate x asset-class allocation bands and concentration limits |
| `transactions.csv` | 393 | Trades, income, fees, capital calls, withdrawals, facility activity |
| `credit_facilities.csv` | 5 | Credit facilities and five-snapshot collateral/LTV history |
| `commitments.csv` | 5 | Uncalled private-market commitments |
| `planned_cash_needs.csv` | 20 | Future liabilities and funding needs |
| `market_context.csv` | 115 | 23 market series x 5 snapshots |
| `event_log.csv` | 16 | Dated 2026 events and transmission channels |
| `rm_notes.json` | 28 | Free-text notes from Priscilla Ong |

The book is approximately **USD 596.2m across 20 clients**, with one RM. There are five position snapshots:

- `2025-12-31`: baseline before the 2026 events
- `2026-02-27`: day before the Middle East conflict began
- `2026-03-31`: after the Strait of Hormuz closure
- `2026-06-30`: after the June technology drawdown
- `2026-08-26`: today

One snapshot describes what a portfolio is; comparisons across snapshots explain what happened.

### Data rules that must be respected

- `event_log.csv` is authoritative for what happened in 2026. If model memory conflicts with it, the file wins.
- Join through the documented keys: client -> portfolio -> holding; holding -> instrument; portfolio -> mandate; holding snapshot -> market snapshot; facilities -> collateral portfolio; notes -> client.
- Some clients have multiple portfolios. Aggregate at client/household level when assessing total exposure, liquidity, concentration, or cross-portfolio risk.
- Custody accounts count toward the client's overall wealth picture but are not managed by the bank and are not measured against a mandate.
- Look through structured products using `instruments.underlying_reference`; the product's asset class alone is insufficient.
- Use `concentration_limit_applies` when applying single-position limits. Do not treat every diversified fund or sovereign bond as a single-name breach.
- Sustainable Balanced mandates have binding exclusions in `mandate_notes`; check `sustainability_excluded` and identify conflicts.
- Compare `tax_domicile`, not only country of residence, for tax-aware reasoning.
- Bond `quantity` is in units of 100 nominal; market value is `quantity * price_local`.
- FX pairs use market convention; for example, `USDSGD` is SGD per USD and `EURUSD` is USD per EUR. Check direction before converting.
- Private-market marks can lag; a stale valuation is not automatically a data error.
- There are deliberate production-like imperfections. Surface uncertainty and data-quality issues rather than silently fabricating a correction.
- Current data integrity checks pass for primary joins and current portfolio totals. There are five intentionally lagged valuations for the unlisted Aranya Technologies holding, one blank entity age, some missing instrument metadata, and facilities that crossed their margin-call thresholds during the history. Handle those explicitly when relevant.

### Strong Julius Baer product directions

These are options, not a checklist. Choose two or three and go deep:

- Portfolio/event explanation: attribute changes to controlled events and affected holdings.
- Hidden aggregate risk: cross-portfolio concentration, structured-product look-through, or source-of-wealth overlap.
- Mandate governance: allocation drift, concentration, sustainability exclusions, and whether a breach was client-directed or has a waiver.
- Liquidity planning: match daily/weekly/monthly/gated/illiquid assets to cash needs and private-market calls.
- Collateral monitoring: trace LTV, lending value haircuts, headroom, and trigger breaches across snapshots.
- Tax-aware opportunity: compare gains/losses within the household and use tax domicile correctly.
- Life-event planning: align property, education, retirement, succession, philanthropy, or business-sale needs with the portfolio.
- Scenario analysis: model what reopening or worsening of the Strait situation would mean, while clearly labeling assumptions.
- RM prioritization: rank who Priscilla should call first and defend the ranking.

Potential deep-dive clients suggested by the notes/data include (do not assume these are the final demo clients):

- `CL-0002`: founder liquidity event, technology concentration, Lombard borrowing, and collateral sensitivity.
- `CL-0003`: inherited portfolio inconsistent with a conservative profile plus a confirmed EUR 3.4m tax need.
- `CL-0006`: USD education/capital-call obligations, SGD assets, and a gated private-credit redemption.
- `CL-0012`: retired client drawing income, duration losses, medical needs, and reluctance to sell at a loss.
- `CL-0014`: stacked Hong Kong property exposure, accumulator/credit risk, low liquidity, and a large redevelopment contribution.
- `CL-0017`: family-office liquidity map, uncalled commitments, gated private credit, and G2/G3 governance tension.
- `CL-0019`: shipping/Gulf business correlation, energy-linked structured product exposure, and an unresolved scenario request.

Use the actual rows and RM notes to select the final two or three. Do not present a recommendation as certain when the data only supports a question or a follow-up check.

### Julius Baer judging rubric

- Client-Centric Innovation: 25%
- User Experience & Design: 25%
- Technical & Operational Feasibility: 25%
- Strategic Impact: 25%

The judges value defensible reasoning, judgment about what matters, honesty about uncertainty, and the human in the loop more than excessive mathematical precision. A deep understanding of two or three clients is better than a superficial dashboard of all twenty.

The demo/presentation should clearly show the proposed solution, functional highlights, how AI insights become RM actions, and enough visual evidence to make the workflow credible.

## Product and engineering expectations after track selection

1. Start by restating the selected enterprise, user, problem, success metric, and the one-sentence demo story.
2. Inspect the relevant files before changing anything. Do not invent an existing app architecture: the workspace currently contains reference material, the Julius Baer data/starter, and Ripple tooling, not a finished product UI.
3. Propose a narrow vertical slice with a concrete acceptance test before broadening scope.
4. Keep domain logic deterministic and inspectable. Use the model for interpretation, synthesis, and conversational explanation only where that adds value; do not let it invent facts.
5. Make evidence visible: source rows, events, assumptions, calculations, confidence, timestamps, and approval state should be inspectable in the UI or an audit panel.
6. Design for failure: missing data, stale marks, unavailable provider/API, rejected payment, insufficient funds, failed XRPL transaction, unsupported recommendation, and user override.
7. If a recommendation or payment is material, require explicit human approval and show the reason, limits, and consequences before execution.
8. Build the demo path first, then add polish, tests, documentation, and edge cases.
9. For product UI, use the subject's vocabulary and workflow rather than a generic AI dashboard. Keep hierarchy, interaction states, accessibility, responsive behavior, and screenshot-based QA in mind. Consult the relevant files under `design-skills/` when doing design or frontend work.
10. Verify everything proportionally: run the available quickstart/tests, validate joins and calculations, test empty/error/loading/approval states, and record any known limitations.

## Required final deliverables

For either track, finish with:

- A working prototype that can be run from a clean checkout.
- Clear setup/run instructions and an architecture diagram.
- A concise product explanation: user, problem, insight/action, value, and business/enterprise fit.
- A short demo script built for the 3-minute pitch/demo limit.
- Evidence of the core workflow, including screenshots or a reproducible path where useful.
- Explicit safeguards, assumptions, limitations, and next steps.

For Ripple specifically, also include the successful XRPL transaction hash/explorer reference and explain the agentic payment/commercial loop and any Starter Kit, x402, MPP, wallet, or RLUSD components used.

For Julius Baer specifically, also include the data-grounding approach, joins/calculation definitions, event citations, client/portfolio evidence, and how the RM can review or reject each insight/action.

## How to communicate with me

Lead with the outcome. Be concise but substantive. If the enterprise is still undecided, say so plainly and give the decision evidence before proposing implementation. If I ask for code, show the smallest useful change and verify it. If you find a contradiction, data-quality issue, or unverified assumption, call it out rather than hiding it.

---

End of reusable project context prompt.
