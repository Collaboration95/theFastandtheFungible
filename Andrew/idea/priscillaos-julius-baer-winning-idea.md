# PriscillaOS: Client Conversation Risk Radar

## One-line pitch

PriscillaOS helps a Julius Baer Relationship Manager decide who to call first, why it matters, what evidence supports the insight, and what client-ready conversation should happen next.

This is not a portfolio dashboard and it is not an autonomous investment advisor. It is an intelligence workbench that turns portfolio data, market events, mandate constraints, liquidity needs, and RM notes into defensible advisory conversations.

## Why this idea fits the Julius Baer challenge

The Julius Baer challenge asks teams to move from portfolio monitoring to wealth intelligence:

```text
What does my client's portfolio look like?
-> What should I know, and what should I do next?
```

Most portfolio tools already show valuation, performance, allocation, and market data. The gap is not another chart. The gap is judgment: an RM has many clients, limited time, and must decide which conversations matter most.

PriscillaOS focuses on the RM's real morning workflow:

```text
20 clients
-> rank the 3 most urgent advisory conversations
-> explain what changed
-> connect the change to client context
-> show evidence
-> draft next-best RM action
-> keep the RM in control
```

This directly supports the challenge's three building blocks:

1. Intelligent Portfolio Explanations: explain what changed across snapshots and which events or holdings drove it.
2. Proactive Risk and Opportunity Detection: surface liquidity, mandate, concentration, collateral, tax, and life-event risks before the client asks.
3. RM Intelligence Workbench: convert insights into talking points, follow-up questions, rebalancing options, stress tests, and client-ready notes.

## Data sources used in this idea

The examples below come from the Julius Baer synthetic dataset in:

```text
juliusbaer-singhacks/singhacks-jb-wealth-intelligence/data/
```

The most important files for this idea are:

| File | Why it matters for PriscillaOS |
| --- | --- |
| `clients.csv` | Client identity, age, country, tax domicile, life stage, source of wealth, risk profile, liquidity needs, stated objectives, KYC date. |
| `portfolios.csv` | Which portfolios belong to each client, mandate code, service model, base currency, and AUM across the five snapshots. |
| `holdings.csv` | Position-level data at five dates. This is where portfolio movement, asset exposure, liquidity tier, lending value, and unrealised PnL come from. |
| `instruments.csv` | Instrument metadata: asset class, sector, region, currency, liquidity tier, structured product underlying reference, sustainability exclusion flag, concentration flag. |
| `mandates.csv` | Target/min/max allocation bands, concentration limits, and mandate notes. Used to detect mandate drift or unsuitable exposure. |
| `transactions.csv` | Trades, income, fees, capital calls, credit drawdowns. Useful for explaining whether a change came from market movement or client action. |
| `credit_facilities.csv` | Lombard and term loan data, drawn amounts, lending value, LTV, headroom, and margin-call thresholds. Used for collateral risk cases. |
| `commitments.csv` | Outstanding private market commitments and expected call windows. Used for future liquidity pressure. |
| `planned_cash_needs.csv` | Known future liquidity needs: tax, tuition, property purchase, annual drawdowns, capital calls, family office funding. |
| `market_context.csv` | Market series at the same five dates: FX, yields, equity indices, gold, Brent, volatility, and rates. |
| `event_log.csv` | The authoritative 2026 event timeline. Use this instead of LLM memory when explaining why markets moved. |
| `rm_notes.json` | Priscilla's relationship notes. This often contains the human context that turns a portfolio fact into a client conversation. |

Dataset joins used by the idea:

```text
clients.client_id -> portfolios.client_id -> holdings.portfolio_id
holdings.instrument_id -> instruments.instrument_id
portfolios.mandate_code -> mandates.mandate_code
rm_notes[].client_id -> clients.client_id
planned_cash_needs.client_id -> clients.client_id
commitments.client_id -> clients.client_id
credit_facilities.client_id -> clients.client_id
event_log.primary_transmission -> interpreted against instrument sector / region / asset class
```

Important implementation note: `event_log.csv` should be treated as the source of truth for 2026 market/geopolitical events. The product should not let the LLM invent market causes from memory.

## What makes this different from ordinary ideas

A common hackathon solution will be an "AI portfolio assistant" that summarizes a client portfolio or answers questions in a chat window. That is too generic and easy to copy.

PriscillaOS is different because it is built around the RM's decision, not the portfolio report.

### 1. It ranks conversations, not assets

The first screen should answer:

```text
Who should Priscilla call first today?
```

A normal dashboard waits for the RM to choose a client. PriscillaOS proactively ranks the book and explains why each client deserves attention.

Example queue:

```text
1. Margarethe Voss-Brenner
   Reason: inherited portfolio conflicts with conservative profile + near-term EUR 3.4m tax need
   Action: prepare de-risking conversation

2. Nguyen Thi Bao Tran
   Reason: USD tuition and PE capital calls collide with SGD-heavy assets and gated private credit
   Action: prepare liquidity bridge plan

3. Ravi Chandrasekaran
   Reason: tech volatility plus Lombard drawdown created collateral stress
   Action: review facility risk before next draw
```

### 2. It connects portfolio facts to human context

The README says the winning team is not the team that only calculates percentages. The winning team understands the client.

Ordinary insight:

```text
CL-0003 has 71% equity exposure and is down 5.7% year-to-date.
```

PriscillaOS insight:

```text
Margarethe recently inherited a portfolio she does not understand, describes herself as conservative, and has a confirmed EUR 3.4m inheritance tax instalment due before year-end. The issue is not only performance. It is suitability, liquidity, and trust. The next RM action is a careful transition conversation, not an automated rebalance.
```

That is a private-banking insight, not a spreadsheet summary.

### 3. It is evidence-backed and compliance-friendly

Every insight should open an evidence drawer showing:

- the client profile and stated objectives from `clients.csv`;
- RM notes from `rm_notes.json`;
- holdings and exposure changes from `holdings.csv`;
- portfolio and mandate context from `portfolios.csv` and `mandates.csv`;
- market events from `event_log.csv`;
- liquidity needs from `planned_cash_needs.csv` and `commitments.csv`;
- credit pressure from `credit_facilities.csv`, where relevant.

This matters because private banks cannot rely on an LLM that sounds plausible. The RM must be able to defend the recommendation in a client meeting and in a compliance review.

### 4. It preserves the RM's central role

PriscillaOS does not tell the client what to buy or sell. It prepares options for the RM:

- what happened;
- why it matters;
- what is uncertain;
- what questions to ask;
- what options to discuss;
- what needs specialist review;
- what language can be used in the client conversation.

The RM reviews, edits, and approves the final client note. This makes the system operationally realistic inside a regulated private bank.

### 5. It uses contradictions as a product feature

The dataset deliberately contains messy real-world signals. PriscillaOS should detect these tensions:

- client says they are conservative, but the inherited portfolio is equity-heavy;
- client believes the portfolio is sustainable, but hidden holdings may conflict with the mandate;
- client needs USD liquidity, but the portfolio and cash needs are currency-mismatched;
- client wants to wait out bond losses, but their drawdown horizon may not allow that;
- individual portfolios look acceptable, but aggregate household exposure reveals concentration.

Most teams will summarize clean data. A stronger team will show that wealth advice lives in the contradictions.

## Why this can win

The idea maps cleanly to all four Julius Baer judging criteria.

### Client-Centric Innovation, 25%

The product is built around the client conversation, not around internal analytics. It connects portfolio changes to life stage, objectives, tax domicile, cash needs, risk profile, and RM notes.

This shows empathy for the actual private-banking relationship: clients do not ask for attribution math; they ask what it means for their life, family, liquidity, and plans.

### User Experience and Design, 25%

The UI can be a single polished screen:

```text
Left: RM call queue
Middle: selected client intelligence brief
Right: next-best actions and client-ready note
Drawer: evidence trail
```

This is easy to understand in a 3-minute pitch. It avoids the common hackathon mistake of building many shallow pages.

### Technical and Operational Feasibility, 25%

The system can be implemented using the provided synthetic dataset and deterministic rules:

- compare five portfolio snapshots;
- aggregate exposure across multiple portfolios;
- detect mandate breaches;
- match planned cash needs and commitments against liquid assets;
- cite event_log as the authoritative source;
- generate natural-language RM briefs from structured evidence.

This is feasible in a bank because high-risk actions remain human-approved and every recommendation is traceable.

### Strategic Impact, 25%

Private banking scales through trusted relationships. PriscillaOS helps Julius Baer make every RM more timely, prepared, and explainable without replacing the RM.

The strategic message is:

```text
We are not optimizing portfolios.
We are optimizing the next trusted conversation.
```

That is aligned with Julius Baer's relationship-driven model and digital transformation goals.

## Recommended demo story

The demo should not attempt to cover all 20 clients. The README explicitly says to go deep on two or three clients rather than shallow across the whole book.

### Main case: CL-0003 Margarethe Voss-Brenner

Why this case is strong:

- recently inherited wealth, from `clients.csv` fields `life_stage` and `source_of_wealth`;
- client is grieving and says she does not understand the portfolio, from `rm_notes.json` note `N-005`;
- risk profile is Conservative, from `clients.csv` field `risk_profile`;
- current portfolio appears equity-heavy, from `holdings.csv` joined to `instruments.csv` at snapshot `2026-08-26`;
- EUR 3.4m German inheritance tax instalment is due before year-end, from `planned_cash_needs.csv` row `CN-004`;
- client asked for something safe and boring, from `rm_notes.json` note `N-006`;
- the RM must preserve trust and handle suitability carefully.

Source trail to show in the evidence drawer:

```text
clients.csv:
- client_id = CL-0003
- client_name = Margarethe Voss-Brenner
- life_stage = Recently inherited - transition
- risk_profile = Conservative
- risk_tolerance_score = 2
- objectives = Understand and de-risk the inherited portfolio; secure a stable income; German inheritance tax planning

rm_notes.json:
- N-005 says the client is grieving, does not understand the portfolio, and describes herself as someone who has never taken risk with money.
- N-006 says she asked whether Middle East news affects her portfolio and prefers "something safe and boring".

planned_cash_needs.csv:
- CN-004: German inheritance tax instalment, EUR 3.4m, due 2026-10-01 to 2026-12-31, Confirmed.

holdings.csv + instruments.csv:
- Use snapshot_date = 2026-08-26 to compute current exposure by asset_class.
- The analysis found this client is heavily exposed to Equity despite a Conservative profile.

event_log.csv:
- Use Middle East and rate/yield events as authoritative context when explaining portfolio stress.
```

Demo message:

```text
Most systems say Margarethe is down 5.7%.
PriscillaOS says the real issue is a suitability and trust conversation.
```

Suggested RM action:

- prepare a transition review;
- separate tax-liquidity funding from long-term risk assets;
- explain what changed using event_log evidence;
- propose a phased de-risking plan;
- involve tax or wealth planning specialists before irreversible action.

### Second case: CL-0006 Nguyen Thi Bao Tran

Why this case is strong:

- confirmed USD university fees for two children, from `planned_cash_needs.csv` row `CN-007`;
- likely USD private equity capital calls, from `planned_cash_needs.csv` row `CN-008` and `commitments.csv` row `COM-003`;
- many assets are SGD-denominated, from `clients.csv` base currency and `holdings.csv` / `instruments.csv` currency exposure;
- private credit redemption is gated, from `rm_notes.json` note `N-009` and private-credit context in `event_log.csv`;
- the client thought a conservative fund could be redeemed easily, from `rm_notes.json` note `N-009`.

Source trail to show in the evidence drawer:

```text
clients.csv:
- client_id = CL-0006
- client_name = Nguyen Thi Bao Tran
- base_currency = SGD
- liquidity_needs = Medium
- objectives = Meet USD-denominated private equity capital calls and US university fees for two children; grow capital at a moderate pace

planned_cash_needs.csv:
- CN-007: US university fees, USD 5.0m, from 2026-09-01 to 2030-09-01, Confirmed.
- CN-008: Private equity capital calls, USD 3.0m, from 2026-10-01 to 2028-03-31, Likely.

commitments.csv:
- COM-003: Meridian Private Equity Fund VII, USD 4.5m committed, USD 3.0m uncalled, expected call window 2026 Q4 to 2028 Q1.

rm_notes.json:
- N-009 says the client needs USD liquidity, submitted a redemption on a private credit fund, was warned about the gate, and has SGD assets against USD obligations.

holdings.csv + instruments.csv:
- Use snapshot_date = 2026-08-26 to compute liquidity by `liquidity_tier` and exposure by `instrument_ccy`.
- This supports the liquidity and currency mismatch story.

event_log.csv:
- 2026-06-30 mentions non-traded private credit redemption stress.
```

Demo message:

```text
This is not just a liquidity issue. It is timing, currency, and client-expectation risk.
```

Suggested RM action:

- prepare USD liquidity bridge plan;
- show what can actually be sold daily;
- stress test USD/SGD movement;
- flag private credit gating risk;
- prepare client explanation and follow-up checklist.

### Third case: CL-0002 Ravi Chandrasekaran

Why this case is strong:

- pre-liquidity event entrepreneur, from `clients.csv` fields `life_stage`, `source_of_wealth`, and `objectives`;
- wants to avoid selling tech holdings, from `rm_notes.json` note `N-003`;
- drew additional Lombard credit after tech drawdown, from `rm_notes.json` note `N-004` and `credit_facilities.csv` row `CF-0001`;
- collateral value is volatile, from `credit_facilities.csv` LTV/headroom changes and `holdings.csv` technology exposure;
- LTV stress creates urgency, from `credit_facilities.csv` row `CF-0001`.

Source trail to show in the evidence drawer:

```text
clients.csv:
- client_id = CL-0002
- client_name = Ravi Chandrasekaran
- life_stage = Pre-liquidity event
- risk_profile = Growth
- liquidity_needs = High
- objectives = Bridge liquidity until the secondary sale of founder shares expected Q4 2026; build diversified portfolio post-event; establish a family trust

rm_notes.json:
- N-003 says the client wants to avoid selling listed positions and is comfortable increasing the Lombard line.
- N-004 says the client was agitated about the technology drop, drew a further USD 1.7m, and needs monitoring.

credit_facilities.csv:
- CF-0001: Lombard Credit Facility for CL-0002.
- drawn amount increases from USD 4.8m to USD 6.5m by 2026-06-30.
- LTV reaches 75.64% at 2026-06-30 against a 75.0% margin-call threshold.
- LTV is still high at 73.71% on 2026-08-26.

event_log.csv:
- 2026-06-05: US megacap technology complex briefly sheds around USD 2tn on AI capex concerns.
- 2026-06-17 and 2026-06-19: rates/yields move, affecting collateral and growth valuations.

holdings.csv + instruments.csv:
- Use current and prior snapshots to identify technology/growth exposure supporting the collateral-volatility story.
```

Demo message:

```text
The issue is not that Ravi likes tech. The issue is that he increased borrowing exactly when collateral volatility rose.
```

Suggested RM action:

- review facility risk;
- test another tech drawdown scenario;
- prepare options before further drawdown;
- document client-directed decisions and RM warnings.

## Product scope for the hackathon

Build only one excellent vertical slice.

### Must build

- RM call queue ranking top 3 clients.
- Client detail panel for 2 to 3 selected cases.
- Explanation of portfolio movement across the five snapshots.
- Evidence drawer with citations to dataset rows/files.
- Next-best RM actions.
- Client-ready talking points.
- Human review/approve/edit state.

### Should build if time allows

- Simple stress test for one scenario.
- Mandate breach detector.
- Liquidity coverage indicator.
- Contradiction detector between RM notes and portfolio facts.
- Exportable RM briefing note.

### Cut if time is tight

- Login/authentication.
- Full client CRM.
- Chatbot as the main interface.
- Large dashboard with many KPI tiles.
- Portfolio optimization engine.
- Real trading or order execution.
- Analysis across all 20 clients beyond the priority ranking.

## Suggested architecture

```text
Data loader
-> portfolio snapshot comparator
-> exposure and liquidity calculators
-> mandate and contradiction rules
-> evidence pack builder
-> LLM brief generator
-> RM workbench UI
```

The LLM should summarize and draft RM-ready language. Deterministic code should own calculations, rules, ranking inputs, and evidence references.

Do not let the LLM invent market events. For 2026 events, `event_log.csv` is authoritative.

## Work plan

### First 60 to 90 minutes

- Pick the two primary demo clients.
- Define the ranking formula.
- Build a small JSON evidence pack for each chosen client.
- Decide UI layout and exact demo script.

### Next 2 to 4 hours

- Implement data loading and calculations.
- Build the RM call queue.
- Build selected-client insight panel.
- Add evidence drawer.
- Write deterministic fixtures if live calculations slow the UI.

### Next 2 hours

- Add client-ready talking points.
- Add RM approve/edit state.
- Polish visual hierarchy.
- Prepare pitch script and screenshots.

### Final hours

- Freeze feature scope.
- Test a clean run.
- Prepare README and architecture diagram.
- Practice 3-minute pitch.
- Prepare answers for compliance, hallucination, suitability, and bank integration questions.

## Suggested 3-minute pitch

### 0:00 to 0:25 - Problem

Priscilla manages 20 clients across Singapore and Hong Kong. Her tools show what portfolios look like, but they do not tell her which client conversation matters most today.

### 0:25 to 1:10 - Product

PriscillaOS ranks the RM's book by advisory urgency. It identifies the top client conversations, explains why each matters, and connects every insight to portfolio snapshots, market events, mandates, cash needs, and RM notes.

### 1:10 to 2:15 - Demo

Open Margarethe. Show that the system does not stop at "portfolio down 5.7%." It identifies a suitability and trust conversation: conservative inherited client, equity-heavy portfolio, near-term tax liquidity need, and client anxiety about market events. Open evidence. Generate RM talking points.

Switch briefly to Nguyen. Show liquidity and FX mismatch: USD fees and capital calls against SGD assets and gated private credit.

### 2:15 to 2:45 - Trust and feasibility

Calculations and rules are deterministic. The LLM drafts the RM explanation from an evidence pack. All recommendations are reviewable, editable, and approved by the RM before client use.

### 2:45 to 3:00 - Strategic close

Julius Baer does not need AI to replace Relationship Managers. It needs AI to make every RM more timely, more prepared, and more explainable.

## Anticipated judge questions

### Is this giving investment advice automatically?

No. The system prepares RM intelligence and suggested conversation options. The RM remains responsible for advice and must review or approve the final client communication.

### How do you prevent hallucinations?

The LLM only receives a structured evidence pack generated from the dataset. Market events come from `event_log.csv`, which is treated as authoritative. Every generated insight links back to source rows and can be inspected.

### Why not show all 20 clients in detail?

The challenge README says a demo that genuinely understands two or three clients is more convincing than a dashboard that summarizes twenty. We rank the full book, then go deep only where the RM needs action.

### How would this fit in a real bank?

It can sit above portfolio, CRM, mandate, credit, and market data systems as an advisory intelligence layer. It does not execute trades. It creates auditable recommendations, conversation briefs, and escalation prompts for specialist review.

## Final positioning

PriscillaOS should be presented as a trusted conversation engine for private banking.

Avoid saying:

```text
We built an AI financial advisor.
```

Say:

```text
We built the intelligence layer that helps Relationship Managers know who to call, why now, and what evidence-backed conversation to have next.
```
