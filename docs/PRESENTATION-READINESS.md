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

## Event logistics still to confirm

The [event page](https://singapore.aitinkerers.org/p/ai-tinkerers-singapore-saturday-demo-meetup-with-joe-heitzeberg-oct-10)
was not directly retrievable during the initial research. The
[chapter listing](https://singapore.aitinkerers.org/?tab=home)
identified October 10, 2026 but indexed times conflicted. Confirm venue,
arrival time, presenter acceptance, demo slot, display connection, and
whether questions are inside the allotted time.

The official [global events page](https://aitinkerers.org/all_cities)
summarizes the organizers' [demo guide](https://aitinkerers.org/p/how-to-run-demos)
as a five-minute technical, working-code format. Do not carry the
previous five-to-seven-minute assumption into a confirmed five-minute slot.

## Select and freeze the demonstrated mode

Preferred mode: live model, local HTTP publisher simulation, durable local
application state. One publisher service exposes three logical profiles. Use
AgentCore hosting or existing Testnet settlement only after the required local
route passes and their separate gates pass before the October 8 candidate.
Optional qualification cannot delay rehearsal or reduce required checks.

| Mode | What is real | What is simulated |
| --- | --- | --- |
| Primary target | Model inference, HTTP discovery/402/delivery, budget enforcement, citations, persisted recovery | Publisher businesses, authored premium scenarios; settlement if using simulation |
| Optional Testnet | Above plus validated test-network transaction | Publisher partnership and economic value of test assets |
| Offline fallback | Actual local services, deterministic decisions, HTTP boundary, ledger, citations | Model behavior and settlement |
| Recorded fallback | A clearly labelled capture of a previously verified run | It is not a live execution |

Opening disclosure:

“I'm demonstrating a research agent that decides whether more evidence is
worth paying for. These publisher profiles are ours, with a small frozen synthetic corpus
and simulated premium reports. The research, HTTP requests, budget checks,
and evidence trail are running here. Settlement is [simulation / XRPL
Testnet / the specifically qualified alternative].”

If model execution falls back, make that change visible. Never switch a
pending transaction to another settlement adapter to keep the presentation
moving.

## Five minute script

Keep setup prefilled in a fresh run; one concise review still demonstrates
the mandate. Avoid spending the first two minutes completing forms.

| Time | Screen and action | Point to make |
| --- | --- | --- |
| 0:00–0:25 | Question, mode, maximum spend | Can announced AI data-centre investment translate into operating capacity by 2028? |
| 0:25–1:10 | Approve plan, show open-evidence answer and missing grid evidence | The system can answer without buying; this particular uncertainty remains |
| 1:10–1:55 | Compare useful, derivative, and over-ceiling previews | Explain why one additional evidence family may matter and why the others do not |
| 1:55–2:50 | Inspect exact quote, approve, show publisher challenge/delivery progress | The purchase crosses an actual HTTP boundary and spends only the approved amount |
| 2:50–3:45 | Before/after claims and exact source span | Show the concrete fact that changed, weakened, or qualified the conclusion |
| 3:45–4:35 | Show stop reason and one concise trace or qualified budget variation | The agent can finish without another purchase; decisions follow evidence and constraints |
| 4:35–5:00 | Receipt and one engineering lesson | What worked, what remains simulated, and the next question for the room |

Use one premium purchase in the timed story. Keep the two-purchase canonical
fixture as regression coverage and a question-time path. The default fixture
S$2.00 mandate/S$1.00 ceiling is useful for simulation; Testnet displays exact
drops separately without pretending the fixture conversion is a live rate.

Keep live recovery and longer counterfactuals for questions. A concise verified
trace can explain retry integrity without interrupting the main evidence story.
Label a recorded trace accurately.
Prepare a 90-second compressed version and a deeper seven-minute version
only for an explicitly longer slot.

## Technical questions to prepare

Have concise, inspectable answers for:

- What decisions are model-driven versus deterministic?
- How does a preview justify buying text the agent has not yet read?
- Why are two articles sometimes only one evidence family?
- What if the paid article is unhelpful or contradicts the hypothesis?
- What prevents a retry from spending twice?
- Can the citation be structurally valid yet fail to support the claim?
- What did AgentCore improve, and which responsibilities remain in the app?
- How was the coding agent's work evaluated independently?
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

No new independent feature after October 7. Cut the release candidate on
October 8 and freeze the rehearsed code on October 9. A necessary late fix
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
