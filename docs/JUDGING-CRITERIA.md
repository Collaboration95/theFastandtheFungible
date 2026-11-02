# Ripple track judging criteria (SingHacks finals, SFF 2026)

We're in the Ripple track. Judges score the submission and demo video before the event, then again at the live pitch. Weights are verbatim from Tenity; they add up to 105% in the source. Every PR names the criterion it serves in its first line (see `.github/pull_request_template.md`).

| Weight | Criterion | What judges look for |
|---|---|---|
| **25%** | Reachability | Potential for broad adoption across customers, sectors and use cases, including interoperability, developer accessibility, scalability and compliance readiness. |
| **20%** | Creativity | How innovative the AI-native products, workflows or business models built with the XRPL AI Starter Kit and x402 are. |
| **20%** | Feasibility | How practical it is to run in production: cost, performance, infrastructure readiness, reliability and operations. |
| **20%** | Technical depth | Quality of the XRPL, x402 and AI-agent integrations: architecture, security, autonomy, testing and safeguards. |
| **10%** | UX & design | Clarity, usability and polish end to end, especially how agent actions, payments and on-chain transactions are communicated. |
| **10%** | Builder feedback | Quality and usefulness of feedback on building with XRPL, including the AI Starter Kit, implementation problems and mainnet readiness. |

## What this means for planning

- **Reachability is the biggest weight (25%).** Easy ways in matter: MCP server, desktop app, SDK, one-command install, interoperating with other agents.
- **Builder feedback (10%) is cheap points.** Write a real feedback doc on the Starter Kit, x402 on XRPL, and the gaps before mainnet. Keep a running log while building.
- **Feasibility needs numbers:** cost per query, latency, uptime, and a live deployment.
- **For technical depth, show the five hard gates and the tests that enforce them.**
- **For UX, the product must show clearly when the agent pays:** the plan, the budget, the transaction hash.
