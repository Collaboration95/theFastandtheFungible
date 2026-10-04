# October 10 presentation readiness

Target: Saturday, 10 October 2026, AI Tinkerers Singapore. This is the planned
execution and rehearsal plan, updated 2 October. The old October 1 milestone
is superseded. The broader implementation sequence is in
[the roadmap](PRODUCT-ROADMAP-2026.md); technical tasks and acceptance are in
[the implementation plan](plans/october-10/README.md), with worker rules in
[the agent guide](AGENT-DEVELOPMENT.md). Planned features remain unimplemented
until their evidence gates pass.

Success means the audience sees a working research system acquire evidence
through a real HTTP boundary, enforce its mandate, and explain a supported
change in the answer. Use a five-minute core demo; keep deeper internals and
extra scenarios for questions.

## Event logistics

The following was confirmed from the
[event page](https://singapore.aitinkerers.org/p/ai-tinkerers-singapore-saturday-demo-meetup-with-joe-heitzeberg-oct-10)
on 4 October:

- **When and where:** Saturday 10 October 2026, 09:30–12:30, at Singtel
  8George, 8 George St, Singapore 049144. Capacity is 70.
- **Running order:** doors open at 09:30. Lightning demos run from 10:40,
  five minutes each plus Q&A.
- **Listing:** the demo is accepted and listed as "ResearchAgent: Evidence
  Procurement Guard".
- **Science Fair table:** organizers may assign some projects to a table
  during networking for deeper walkthroughs. Bring the recovery demo, the
  scenario tests and the build log for that.
- **Sponsor prize:** Google Cloud Run sponsors the event. Google will select
  three demos deployed on Cloud Run, and each receives US$100 in credits.

Still to confirm with the organizers: slot order, the display connection and
venue Wi-Fi. Carry a phone hotspot.

The organizers' [demo guide](https://aitinkerers.org/p/what-makes-a-great-demo-at-ai-tinkerers)
asks for running code, visible internals, and how it was built: the stack,
workflow, and agentic process. It explicitly rules out decks, pitches and
videos of the thing running.

## Select and freeze the demonstrated mode

Preferred mode: live Groq LLM, live Cloudflare Clef decisions, local HTTP publisher,
simulated settlement, durable local state. Cloud Run publisher hosting is
optional and only used if it is ready before the freeze. AgentCore and XRPL
Testnet are removed.

| Mode | What is real | What is simulated |
| --- | --- | --- |
| Primary (`npm run demo:live`) | Groq answers and report, Clef decisions, HTTP search/402/delivery, budget enforcement, citations, persisted recovery | Publishers, corpus, settlement |
| Offline fallback (`npm run demo`) | Local services, HTTP boundary, ledger, citations, policy code | LLM output (extractive), decision probabilities (fixture heuristics), settlement |
| Recorded fallback | A clearly labelled capture of a previously verified run | It is not a live execution |

Opening line: “Publishers are starting to answer AI agents with HTTP 402. This
is the buyer side. The publishers and articles are fictional and settlement is
simulated; the agents, HTTP calls, budget enforcement and evidence trail are
running here.”

When a provider falls back, the mode badge shows it. Never hide a fallback.

## Five minute script

The timed story is in [prompt.md §1](../prompt.md#stage-story-5-minutes):

1. ask with a S$2 budget;
2. the free cited answer, ending with its open gap;
3. the decision table with Clef's probabilities and the policy;
4. 402 → settle → verified delivery → answer v2 with the change highlighted;
5. the agent stops on its own;
6. the PDF report;
7. pop the hood.

Keep the S$0 "would buy" run, the open-sufficient variant, the fault demo and
the injection trap for questions or the Science Fair table.

## Technical questions to prepare

Have concise, inspectable answers for:

- Why does a decision model choose purchases instead of an LLM, and what are
  the limits of decision models (no counting or date arithmetic, sensitivity
  to adversarial text)? How did clef-flash and clef compare on our own
  decisions?
- How does a preview justify buying text the agent has not yet read?
- How were the policy threshold and the question wording calibrated?
- Why are two articles sometimes only one evidence family?
- What if the paid article is unhelpful or contradicts the answer?
- What stops prompt injection inside an article from spending money?
- What prevents a retry from spending twice?
- Can the citation be structurally valid yet fail to support the claim?
- How did coding agents build this, and what broke along the way?
- Which missing pieces are commercial integration versus engineering?

Use a real trace, a small state machine, and a failing/passing evaluation
example. The engineering lesson should be concrete, such as discovering
that recording idempotency only after settlement leaves a crash window.

## Release gates

### Functional and evidence gate

Require an open-only answer, appropriate no-purchase outcome, useful purchase,
derivative skip, over-cap rejection, exact approval cancellation, and an
evidence-bound result. The citation drawer must show the approved source
version and exact span. The answer diff may say unchanged; it must not
manufacture purchase value.

The same canonical corpus supports live and deterministic modes, with modes
labelled separately. Generality claims require held-out scenarios.

### Backend and recovery gate

Run independent tests for quote mutation, duplicate/concurrent attempts,
unknown settlement, process interruption, corrupted/wrong-version delivery,
and delivery retry. Verify database rows and settlement attempt counts, not
only success messages. Inspect a receipt after reload and after catalog
updates to prove historical fields remain stable.

Prebuild a recovery scenario that can fail delivery on demand. After payment,
stop the publisher, observe delivery pending/failed, restart it, retry
delivery, and verify unchanged spend and purchase identity. For the timed
demo, a deterministic fault hook is acceptable when described as fault
injection and confined to the simulator.

### Automated gate

Current aggregate, executed in an environment that permits local listeners:

~~~sh
LLM_PROVIDER=fixture XRPL_MODE=fixture APP_MODE=fixture npm run verify
~~~

This is the existing command. Additional transaction checks, the eight-case
scenario scorecard, rehearsal runner and doctor in the verification module are
planned work. Once implemented, the release gate must include them. A new
property-testing framework or general coding controller is not required.

Record the exact commit, runtime/lockfile/corpus versions, exit status, counts,
and artifact paths in the implementation task or PR. Do not copy historical
test counts as proof of current readiness. Live/cloud/Testnet qualification
is separate from fixture test success.

### UI and presentation gate

Prioritize a large readable answer, clear evidence change, explicit price/cap,
and the safe next action. Keep detailed protocol/trace fields in secondary
inspection. Use the existing neutral workspace rather than redesigning the
whole product.

Inspect the actual projector/laptop viewport plus 390px mobile and 200% zoom.
Check keyboard navigation, approval focus/cancel/return, citation focus,
error messages, and reduced motion. Axe scans must cover later interaction
states as well as the first screen.

### Operational gate

The proposed launcher/doctor must identify its own processes, check ports,
verify the corpus hash and database schema, check the selected model/runtime,
and provide a safe fresh-run command. Test startup from the documented
lockfile installation on the presentation machine.

Keep immutable completed receipts. A fresh demo resets only the designated
demo run/database namespace; it must not erase unrelated user history.

Feature freeze is Thursday 8 October at 20:00 SGT. Rehearse and tag the
frozen build on 9 October. A necessary late fix
reruns affected tests and the timed story.

## Rehearsal matrix

| Scenario | Expected result | Stage fallback |
| --- | --- | --- |
| Clean start | New run, correct corpus, no inherited access/spend | Launch isolated known-good mode |
| No external network | Local publishers and deterministic research work | Announce offline mode |
| Provider/AgentCore timeout | Bounded wait and visible recovery without invalid final answer | Local qualified model/fixture path |
| Browser reload | Same persisted run, spend, grants, and receipt | Reopen run by ID |
| Process restart after submission | Unknown state reconciles; no new payment | Show persisted outcome/trace |
| Publisher unavailable after settlement | Paid receipt retained, delivery can retry | Resume delivery when service returns |
| Quote expires or changes | No transaction; require current review | Refresh the quote |
| Presentation process fails | Restart from frozen scripts within 60 seconds | Labelled recording/screenshots |

Require three clean timed rehearsals on the final machine and one recovery
rehearsal. Record durations and interruptions; three successes are a release
check, not a statistically established reliability rate.

## Offline artifacts

Prepare one current screenshot of the final impact view, saved answer/receipt
artifacts from the verifier, a short labelled recording of the five-minute flow, and the
architecture/state diagram used in questions. Keep them accessible without
the network and open each once before travel. A polished user-facing export or
research library is outside the required scope.

The old UO-10 images document the September UI. Replace presentation exports
only after the new flow passes. Do not imply those images show new publisher
or AgentCore capabilities.

## Event day and follow-up

Run preflight before departure and after connecting the display. Open the
app, publisher page, and one useful trace; hide unrelated terminals/accounts.
Use the frozen corpus and qualified runtime. Confirm the fresh run has no
inherited purchases.

Capture technical feedback on whether the purchase rationale, evidence
independence, changed conclusion, and receipt are understandable. Useful
next validation is a small set of researcher sessions comparing the agent
with an open-only baseline. Payment completion alone is not product value.
