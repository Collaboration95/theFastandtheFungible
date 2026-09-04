# SingHacks 2026 — Agentic AI / Fintech Prep Dossier

Research snapshot: 3 September 2026, Singapore time

## Executive read

SingHacks 2026 is an in-person, Singapore-based fintech and AI hackathon running
from 4–5 September 2026. The event is explicitly about practical agentic-AI
solutions for finance, with a SGD 10,000 prize pool and direct exposure to
industry decision-makers.

The most important operational fact is that the event is not an overnight
48-hour coding marathon. The published schedule gives you roughly 12 hours of
venue-access build time: 3 hours on Friday evening after the challenge reveal,
then 9 hours on Saturday before the 6:00 pm close. Overnight stays are not
permitted. Pre-work therefore has unusually high leverage.

The right preparation is a reusable agentic product spine, not a
track-specific product:

    user intent
      -> structured intake and extraction
      -> specialist research / retrieval
      -> deterministic policy and budget checks
      -> human approval for consequential actions
      -> testnet payment, case creation, quote, or other action
      -> receipt + evidence timeline

Primary pages:

- [Luma event page](https://luma.com/an9krh0p)
- [Official SingHacks 2026 site](https://www.singhacks.com/)

### Published schedule

Friday 4 September:

- 3:00 pm — participant registration
- 4:00 pm — welcome address
- 5:00 pm — challenge statement reveal
- 6:00 pm — hackathon officially commences
- 6:30 pm — Ripple workshop: Building Businesses with the XRP Ledger AI Starter Kit
- 7:00 pm — t54 workshop: Introduction to x402
- 9:00 pm — venue closes

Saturday 5 September:

- 9:00 am — venue reopens
- 6:00 pm — hackathon closes
- 6:10 pm — participant pitching and demo day
- 8:00 pm — prize presentation and closing ceremony
- 9:00 pm — venue closes

The exact address is not public on the event page. Check your Luma
confirmation, email, or participant communications rather than relying on a
search-engine result or an inferred map location.

## 2. Sponsor and challenge signals

There is a meaningful source conflict to resolve at kickoff:

- The current Luma page and recent 2026 announcements foreground Ripple and
  Julius Baer, plus HeyMax, Staple, MISSION+, Unlimit, t54, Singapore Global
  Network, and Claude SG Community.
- The current official website still displays three track labels and partner
  assignments that match the 2025 edition: Julius Baer / RegTech Intelligence,
  Hedera / Empowered Finance, and Ancileo x MSIG / Conversational Insurance.
- The Luma page says the challenge statement will only be revealed at 5:00 pm
  on 4 September.

Treat the three track labels as strong idea-space signals, not as the final
2026 rules. Ask the organizers which sponsor, API, and judging requirements
are authoritative before committing.

### Likely track directions

| Direction | What to prepare for | Why it is promising |
|---|---|---|
| RegTech / private banking | Transaction monitoring, onboarding, KYC/KYB, suitability, policy interpretation, investigation casework, audit evidence | Strong fit for deterministic rules plus an agent that gathers and explains evidence |
| Empowered finance / payments / digital assets | Agent wallets, identity, payment routing, machine-to-machine commerce, impact allocation, verifiable receipts | Directly aligned with the Ripple and t54 workshops, and gives you a visible “agent acts” moment |
| Conversational insurance | Travel itinerary intake, coverage explanation, quote, claims triage, disruption support, human handoff | Easy to demo with a document, a conversation, a decision, and a customer-facing result |
| Cross-track agent infrastructure | Policy-bound agent execution, risk/evidence layer, paid tools, agent-to-agent services, audit trail | Lets agentic AI be the product, rather than an ornamental chatbot layer |

### Partner surfaces worth understanding

#### Ripple / XRP Ledger

Ripple’s [XRP Ledger AI Starter Kit announcement](https://ripple.com/insights/xrpl-ai-starter-kit/)
describes four immediately relevant surfaces:

- an XRPL documentation MCP server for Claude Code, Claude Desktop, Cursor, and
  custom agent frameworks;
- an XRPL Agent Wallet Skill and XRPL Payment Skill for Claude;
- a tutorial for a confirmed testnet payment;
- x402 support using XRP and RLUSD, contributed with t54.

The [XRPL Agentic Transactions guide](https://xrpl.org/docs/agents/agentic-transactions)
frames an agent as needing a wallet, network access, a transaction library,
machine-readable documentation, and a tool interface. It also calls out
deterministic finality, predictable costs, native multi-currency payments,
SourceTag, Memo, escrow, DepositAuth, and multisign as relevant controls.

Use XRPL as an observable, bounded action:

- local sandbox or testnet only;
- test a prepared transaction before execution;
- never put a seed or private key in a prompt, log, repository, or screenshot;
- cap amount, destination, asset, and expiry in code;
- show the final transaction hash or receipt in the demo.

#### t54 / x402

The Luma page includes a t54 x402 workshop. The [x402 protocol](https://github.com/x402-foundation/x402)
is an HTTP-native payment standard: a client requests a protected resource,
receives a 402 response with payment requirements, creates a payment payload,
retries with payment data, and the resource server verifies and settles through
a facilitator.

The [t54 XRPL x402 Facilitator documentation](https://docs.t54.ai/docs/xrpl/x402-facilitator)
describes an XRPL version of that loop using a payer-signed Payment transaction,
invoice binding, exact destination and amount matching, and a settlement
receipt. The [x402-secure repository](https://github.com/t54-labs/x402-secure)
adds risk sessions, agent traces, secure headers, evidence, and pre-payment risk
decisions.

This suggests a strong demo pattern:

    agent receives a bounded user goal
      -> discovers a paid service
      -> checks price, destination, and budget
      -> requests approval if above policy
      -> pays on testnet
      -> verifies the response
      -> displays receipt and evidence

Do not assume the event will provide production credentials or a specific
facilitator. Build the happy path against a local mock first, then swap in the
workshop endpoint or testnet integration.

#### Staple AI

Staple’s [API overview](https://www.staple.ai/platform/connect-operate/api) and
[developer overview](https://www.staple.ai/build-with-staple/apis-and-sdks)
position it as a document-to-structured-data and verification layer. The
interesting part for a fintech agent is not simply OCR; it is the distinction
between extracted, inferred, mapped, and rule-set fields, plus field-level
provenance, confidence, review states, webhooks, redaction, and auditability.

Good use: an intake agent extracts a KYC document, itinerary, invoice, or claim
and passes only structured, provenance-tagged facts to the decision agent.

#### HeyMax

HeyMax describes itself as an AI-powered loyalty and travel-rewards platform.
Its [public site](https://marketing.heymax.ai/) makes it relevant to travel,
card-spend, rewards optimization, and customer journeys. It is a possible
insurance or consumer-finance integration surface, but do not assume an API is
available until the event team confirms it.

#### Unlimit

Unlimit’s [payments page](https://www.baas.unlimit.com/payments/) emphasizes
cross-border payments, pay-ins, payouts, multi-currency acceptance, cards, and
bank-transfer rails. If the revealed brief concerns payment routing or
cross-border acceptance, ask whether a sandbox endpoint is available.

#### MISSION+

MISSION+ describes an [Agentic Engineering Target Operating Model](https://www.mission.plus/)
and works across financial services, insurance, fintech, and Web3. Treat this
partner as a useful source of questions about adoption, operating models,
human accountability, and what an enterprise would actually pilot after the
hackathon.

## 3. What last year tells us

The first SingHacks edition had more than 270 participants and used three
challenge tracks. Tenity’s [official 2025 recap](https://www.tenity.com/tenity-concludes-singhacks-asias-first-fintech-focused-hackathon-for-agentic-ai/)
lists the finalists across Julius Baer, Hedera, and Ancileo x MSIG tracks.
Tenity’s [case study](https://www.tenity.com/cases/singhacks/) says the event
was designed to turn corporate innovation goals into business outcomes and
produce prototypes that partners could explore further.

The winning and finalist examples are useful because they show what “agentic”
looked like in practice:

| 2025 example | Observed shape | Lesson for 2026 |
|---|---|---|
| The Fraudbusters — Julius Baer track winner | Fraud / compliance investigation | A domain-specific decision workflow beats a generic finance chatbot |
| ProvidAI / Synaptica — Hedera track winner | Multi-agent research automation | Parallel specialist work can be a compelling reason to use agents |
| NTU SAARS — Ancileo x MSIG track winner | Conversational travel insurance | Make the user journey concrete and finish it end to end |
| DINNR — Julius Baer finalist / second place reported by the team | Live transaction analysis, explicit regulatory rules, audit trail, document completeness and tamper checks | Combine LLM flexibility with deterministic rules and evidence |
| TripMate / Rep Monkeys — Ancileo x MSIG third-place example | Itinerary and ticket extraction, voice interaction, policy RAG, quote in about two minutes | Multimodal intake is useful, but novelty needs to go beyond “chat over a PDF” |
| Guardian of Agents — Ancileo x MSIG finalist | Proactive travel alerts, coverage recommendations, claims support, and a reported 17-agent MCP design | Agents should coordinate useful actions, not just produce a longer answer |

Supporting examples:

- [Tenity’s 2025 winner recap](https://www.linkedin.com/posts/tenity_singhacks-sff2025-singhacks-activity-7397095611029688320-ju7m)
- [NTU’s TripMate description](https://www.ntu.edu.sg/honours-college/admissions/undergraduate/premier-scholar-programmes/renaissance-engineering-programme/achievements/year-2025/singhacks-%28ancileo-x-msig-challenge%29)
- [DINNR’s team write-up](https://www.linkedin.com/posts/karthik-sivasubramanian-26249b214_we-were-so-close-last-week-we-wrapped-activity-7399277791717998592-5ERJ)
- [Guardian of Agents’ team write-up](https://www.linkedin.com/posts/garrettteoh_singhacks-msig-juliusbaer-activity-7390719031391207424-TRN8)
- [TripMate / insurance finalist write-up](https://www.linkedin.com/posts/nickolaschua_over-the-weekend-my-team-and-i-participated-activity-7391420254687715329-fk9V)

### Inferred judging signals

These are inferences from the event format, sponsor language, last year’s
results, and the planned direct pitching to fintech decision-makers:

1. A real user or operator problem matters more than agent count.
2. One reliable end-to-end path is better than ten half-built capabilities.
3. Sponsor technology should be a meaningful dependency, not a logo in the
   README.
4. A clear approval, policy, or evidence layer will differentiate a fintech
   agent from a consumer chatbot.
5. A visible failure path is a feature: show the agent refusing an unsafe or
   over-budget action.
6. A judge should be able to understand the product in the first 15 seconds.
7. The team should be able to explain what happens when the model is wrong,
   the tool times out, the document is malicious, or the payment settles but
   the downstream service fails.

## 4. The agentic-AI mental model

Anthropic’s [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
guide makes a useful distinction:

- workflows use predefined code paths around LLMs and tools;
- agents dynamically choose tools and steps to achieve a goal.

It also recommends using the simplest architecture that works, starting
directly with the model API when appropriate, and adding complexity only when
flexibility or scale justifies it.

For this hackathon, the best architecture is usually a hybrid:

- let the model classify, extract, explain, route, and select among safe tools;
- let ordinary code enforce amounts, schemas, authorization, budgets, policy
  rules, idempotency, and transaction signing;
- let a human approve payments, irreversible actions, and exceptional cases.

### Recommended runtime shape

    User
      |
      v
    Orchestrator agent
      |
      +--> Intake / extraction tool
      +--> Approved-data retrieval tools
      +--> Specialist analyst agents
      +--> Deterministic policy engine
      +--> Evidence / audit tool
      |
      +--> Human approval gate
      |
      +--> Side-effect tool
             - testnet payment
             - case creation
             - quote generation
             - notification
      |
      v
    Structured result + receipt + evidence timeline

### What each layer should own

| Layer | Good responsibilities |
|---|---|
| LLM / orchestrator | Interpret intent, choose among allowed tools, ask clarifying questions, summarize evidence |
| Specialist agent | Focused research or analysis with a narrow context and tool allowlist |
| Tool | One typed, bounded capability such as get transaction, extract document, prepare payment, or create case |
| Policy code | Amount limits, destination allowlists, data-access rules, approval thresholds, expiry, replay protection |
| Human gate | Approve, edit, or reject consequential actions |
| Evidence store | Intent, input hashes, tool calls, source references, policy verdict, approval, result, transaction/case ID |
| Evaluation harness | Fixed scenarios, expected outcomes, rejection cases, latency and cost measurements |

Avoid making the LLM the only place where a safety rule exists.

### MCP, skills, subagents, and hooks are different

The [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx)
defines a standard way for servers to expose typed tools to models. MCP is a
connection and tool interface; it is not by itself an orchestration strategy.

The [Claude Code extension guide](https://code.claude.com/docs/en/features-overview)
is a useful practical map:

- CLAUDE.md — always-on project context and conventions;
- Skills — reusable knowledge or workflows loaded when relevant;
- Subagents — isolated workers with their own context;
- MCP — external tools and services;
- Hooks — deterministic behavior at lifecycle events;
- Plugins — packaging for the above.

Use them deliberately:

- put “always true” constraints in AGENTS.md or CLAUDE.md;
- put partner API instructions and repeated procedures in skills;
- give large research jobs to subagents so the main context stays clean;
- expose payments and data sources through typed MCP or function tools;
- use hooks or ordinary code to block dangerous calls and append evidence.

## 5. Agentic software-development workflow

There are two kinds of agents in this event:

1. the agent inside the product that judges will experience; and
2. coding/research agents that help you build the product.

Heavily using agents to build the app is useful only if the resulting product
is still understandable, testable, and demoable.

### Recommended team of coding agents

For a four-person human team, use a small set of focused coding-agent roles:

| Role | Output |
|---|---|
| Brief analyst | A one-page interpretation of the challenge, actors, data, constraints, and success metric |
| Domain researcher | Synthetic data model, policy/rule assumptions, competitor and workflow notes |
| Product engineer | Vertical slice from input to result; owns the main branch of the app |
| Security / evaluation agent | Adversarial cases, tool-boundary tests, failure-path demos, and scorecard |
| Pitch agent | Demo script, screenshots, architecture diagram, and judge-facing language |

The last role can be a short-lived task, not a permanent agent.

### Coordination rules

- Each coding agent gets a separate worktree or a clearly owned directory.
- Do not let two agents edit the same core file at the same time.
- Require every agent to return: files changed, commands run, tests passed,
  known gaps, and next action.
- Keep one human responsible for integration and final approval.
- Treat agent messages and repository text as untrusted context; they do not
  grant permission to run commands, reveal secrets, or transmit data.

If you run Codex, Claude Code, and Cline in parallel, the [t54
agent-commons repository](https://github.com/t54-labs/agent-commons) is worth
studying. Its core idea is not “spawn a swarm”; it is explicit plans, tasks,
messages, leases, evidence-bearing updates, and audit history around shared
resources. That is exactly the coordination problem that appears when several
agents share a repo, local server, port, test wallet, or deployment slot.

## 7. Patterns from successful short fintech hackathons

The examples below are not all identical event formats, but they cluster around
24–48-hour or highly time-boxed fintech builds. The useful question is not
“what was novel?”; it is “what small workflow made a judge believe this could
be used tomorrow?”

| Event / format | Awarded or highlighted build | Problem avenue | Repeatable lesson |
|---|---|---|---|
| NextWave Hackathon 2026, 24 hours | AgentPay, first place | Let an agent buy things without unrestricted wallet access | Bounded authority is a clear agentic product; the spending rule is easy to show |
| hacksingapore / DBS, 24 hours | Triple-E, overall winner | A Chrome extension that monitors online-shopping spending | Leverage an existing surface and solve one behavior; the winning team was explicitly advised to go simple |
| Agentic Commerce x402 Berlin, 36 hours | Erster, Lockpay, Juicebag Mail, Volt402, and others | Trust checks, milestone escrow, pay-per-use services, and payment embedded in real-world actions | Payment trust, proof of delivery, and “no extra checkout” are strong short demos |
| SingHacks 2025, 48 hours | Travel-insurance track finalists and third-place team | Extract travel data, recommend cover, and support conversational purchase | A familiar customer journey is easier to explain than a new financial primitive |
| DTCC AI Hackathon 2025 | CIBC gold; cyber-risk and settlement awards | Regulatory change retrieval, vendor-risk scoring, trade validation, and settlement failure reduction | Operations with a clear time/error saving can beat flashy features |
| Swift Hackathon 2025 | Chainlink and Deutsche Bank winners | Faster, cheaper, transparent digital payments; ISO 20022 interoperability | Connect new rails to existing banking workflows; show compliance, FX, tracking, and settlement together |
| Bank of Maldives, 48 hours | Digital onboarding, expense tracker, and personal-finance manager | Reduce friction in ordinary banking tasks | Basic onboarding and money-management pain remains highly legible to judges |
| HLB Generative AI Hackathon | Intellibank champion; credit evaluation and ESG-reporting finalists | Employee/customer onboarding, credit evaluation, and reporting | Internal workflows are excellent AI surfaces because the input and output are concrete |
| IFSCA I-Sprint BankTech | Unified KYC, retail banking products, and buyers-credit optimization | Identity reuse, access to banking products, and financing decisions | Regulators and banks repeatedly ask for KYC, access, credit, and operational efficiency |

### What these winners have in common

1. A specific operator or customer is waiting on something.
2. The input is already available: a document, transaction, policy, payment
   event, or user request.
3. The system produces a decision, draft, route, receipt, or next action—not
   just a paragraph of advice.
4. The improvement is easy to state: fewer minutes, fewer forms, fewer errors,
   fewer abandoned payments, or safer agent authority.
5. The build fits on top of an existing surface: browser extension, claims
   form, payment endpoint, banking message, or dashboard.
6. A human remains in control of money, coverage, identity, or regulated
   decisions.

### Hotpath avenues worth mining

| Avenue | Typical painful moment | Your fit |
|---|---|---|
| Intake and extraction | “I uploaded this document; please turn it into usable facts.” | ClaimReady |
| Policy and evidence | “Is this covered, allowed, or complete? Show me why.” | ClaimReady |
| Exception handling | “This payment or request failed; what should I do next?” | A possible ClaimReady extension, but not an active idea |
| Guarded execution | “Let the agent do this, but only within my rules.” | Agent Spend Guard |
| Trust and verification | “Can I trust this party, document, result, or payment?” | Both ideas |
| Accessibility and financial behavior | “Help me understand or change a routine money action.” | Useful fallback if the reveal is consumer-focused |

The strongest direction for this event is therefore not a general-purpose
financial chatbot. It is a narrow agent that turns one messy input into one
safe next action with evidence.

### Guardrails

Singapore’s [Model AI Governance Framework for Agentic AI](https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches/press-releases/2026/new-model-ai-governance-framework-for-agentic-ai)
is unusually relevant to this event. It emphasizes bounding the agent’s powers,
meaningful human accountability, technical controls and testing, and end-user
transparency.

Implement at least:

- testnet/local-only side effects;
- tool allowlists;
- destination and amount allowlists;
- a budget and maximum step count;
- idempotency keys for actions;
- approval for payment, fund movement, or irreversible changes;
- read-only access to external documents where possible;
- PII minimization and redaction;
- fail-closed behavior on missing or contradictory facts;
- timeout, retry, and duplicate-action handling;
- visible “agent is waiting for approval” state;
- an adversarial test for indirect prompt injection.

Anthropic’s [prompt-injection guidance](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)
recommends least privilege, sandboxing, and narrow permissions. MCP’s tool
specification also says applications should make exposed tools visible and
provide a human ability to deny invocations.



## 9. Agent-runtime and coding-tool options

Use the smallest toolset that makes the behavior obvious.

| Option | Best use | Read first |
|---|---|---|
| Claude Agent SDK | Claude-native tools, in-process MCP, hooks, subagents, and a direct path to Claude Code patterns | [Official Python SDK](https://github.com/anthropics/claude-agent-sdk-python) and [Agent SDK workshop](https://github.com/anthropics/agent-sdk-workshop) |
| LangGraph | Explicit stateful graphs, checkpointing, long-running workflows, and human-in-the-loop pauses | [Human-in-the-loop docs](https://docs.langchain.com/oss/python/langchain/human-in-the-loop) |
| Deep Agents | Planning, filesystem context, subagent delegation, skills, and a harness on top of LangGraph | [Deep Agents](https://github.com/langchain-ai/deepagents) |
| PydanticAI | Fast typed Python tools and validated structured outputs | [PydanticAI agents](https://pydantic.dev/docs/ai/core-concepts/agent/) |
| OpenAI Agents SDK | Handoffs, guardrails, MCP/function tools, and built-in tracing if using OpenAI | [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) |
| MCP | Shared tool interface for docs, data, services, and actions across agent hosts | [MCP tools specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx) |

Do not build a framework comparison project. Pick one runtime, expose five to
ten good tools, and make the control boundary visible.

### Useful evaluation and observability repos

These are optional additions:

- [Promptfoo](https://github.com/promptfoo/promptfoo) — local evals and
  red-teaming, including prompt injection and data-exfiltration scenarios.
- [Langfuse](https://github.com/langfuse/langfuse) — open-source traces,
  datasets, prompt management, and evaluation.
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — OpenTelemetry-based
  tracing and evaluation for LLM calls, retrieval, and tools.

For a one-day MVP, a structured JSON event log plus a small test runner may be
enough. Add a hosted observability platform only if setup is frictionless.

### 90-second demo script

1. 0–10 seconds — state the operator’s problem in one sentence.
2. 10–25 seconds — show the natural-language request and structured intent.
3. 25–45 seconds — show the agent using two or three focused tools or
   specialist agents.
4. 45–60 seconds — show a policy decision, including one blocked or
   approval-required action.
5. 60–75 seconds — show the bounded action: testnet receipt, case, quote, or
   claim draft.
6. 75–90 seconds — show the evidence timeline, metric, and what the human
   remains accountable for.

## 15. Source ledger

Event and organizer:

- [Luma event page](https://luma.com/an9krh0p)
- [SingHacks 2026 official site](https://www.singhacks.com/)
- [Tenity 2025 case study](https://www.tenity.com/cases/singhacks/)
- [Tenity 2025 official recap](https://www.tenity.com/tenity-concludes-singhacks-asias-first-fintech-focused-hackathon-for-agentic-ai/)

Short fintech hackathon examples:

- [Yuno/Nauta NextWave Hackathon 2026 — AgentPay, 24-hour winner](https://y.uno/en/newsroom/yuno-and-nauta-hackathon)
- [SIT / hacksingapore — 24-hour overall winner](https://www.singaporetech.edu.sg/news/24-hours-victory-sitizens-win-overnight-hackathon-competition)
- [Algorand — Agentic Commerce x402 Berlin, 36-hour recap](https://algorand.co/blog/agentic-commerce-x402-hackathon-berlin-recap)
- [NTU — SingHacks 2025 travel-insurance project](https://www.ntu.edu.sg/honours-college/admissions/undergraduate/premier-scholar-programmes/renaissance-engineering-programme/achievements/year-2025/singhacks-%28ancileo-x-msig-challenge%29)
- [DTCC — AI Hackathon winning projects](https://www.dtcc.com/dtcc-connection/articles/2025/april/02/dtcc-announces-winners-from-first-ai-powered-hackathon)
- [Swift — 2025 Hackathon winning teams](https://www.swift.com/news-events/news/swift-hackathon-2025-discover-winning-teams)
- [Bank of Maldives — 48-hour hackathon winners](https://www.bankofmaldives.com.mv/storage/document/1052/5669/bank-of-maldives-announces-the-winners-of-its-hackathon-en.pdf)
- [Hong Leong Bank — Generative AI hackathon winners](https://www.hlb.com.my/en/personal-banking/news-updates/hlb-university-student-win-big-at-malaysia-first-generative-ai-hackathon.html)
- [IFSCA / Government of India — Sprint01 BankTech winners](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1814595&lang=2&reg=48)

Agentic architecture and safety:

- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anthropic — Claude Code extension mechanisms](https://code.claude.com/docs/en/features-overview)
- [Anthropic — Claude Agent SDK Python](https://github.com/anthropics/claude-agent-sdk-python)
- [Anthropic — Agent SDK workshop](https://github.com/anthropics/agent-sdk-workshop)
- [MCP tools specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx)
- [Anthropic — prompt injection guidance](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)
- [IMDA — Model AI Governance Framework for Agentic AI](https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches/press-releases/2026/new-model-ai-governance-framework-for-agentic-ai)

Payments and ledgers:

- [Ripple — XRP Ledger AI Starter Kit](https://ripple.com/insights/xrpl-ai-starter-kit/)
- [XRPL — Agentic Transactions](https://xrpl.org/docs/agents/agentic-transactions)
- [Ripple — xrpl-up](https://github.com/ripple/xrpl-up)
- [Ripple — xrpl-mpp-sdk](https://github.com/ripple/xrpl-mpp-sdk)
- [x402 Foundation — protocol repository](https://github.com/x402-foundation/x402)
- [x402 Foundation — Coinbase developer overview](https://docs.cdp.coinbase.com/x402/welcome)
- [t54 — XRPL x402 Facilitator](https://docs.t54.ai/docs/xrpl/x402-facilitator)
- [t54 — x402-secure](https://github.com/t54-labs/x402-secure)
- [t54 — Agentic Risk Standard](https://github.com/t54-labs/AgenticRiskStandard)

Frameworks and operations:

- [LangGraph human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)
- [Deep Agents](https://github.com/langchain-ai/deepagents)
- [PydanticAI agents](https://pydantic.dev/docs/ai/core-concepts/agent/)
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python)
- [t54 — agent-commons](https://github.com/t54-labs/agent-commons)
- [Promptfoo](https://github.com/promptfoo/promptfoo)
- [Langfuse](https://github.com/langfuse/langfuse)
- [Arize Phoenix](https://github.com/Arize-ai/phoenix)
