# October 10 presentation readiness

Target: Saturday, 10 October 2026, AI Tinkerers Singapore. This is the
execution and rehearsal plan, rewritten 6 October for the final-push
direction. Product, decisions and use cases are in
[FINAL-PUSH.md](../FINAL-PUSH.md); gates and schedule are in
[prompt.md](../prompt.md). The script below targets the final-push build
(UC1–UC3), all built on `main` (live smoke passed 8 Oct, 03:00 SGT).

Success means the audience sees a decision model decide what is worth
buying, a writer paid directly over a real HTTP boundary on XRPL Testnet, and
a broken promise caught and refunded. Use a five-minute core demo; keep deeper
internals and extra scenarios for questions.

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

Preferred mode (`npm run demo:live`): live DeepSeek writing, live Cloudflare
Clef decisions, local HTTP publishers, XRPL Testnet settlement and Langfuse
traces, with durable local state. Cloud Run publisher hosting is optional and
only used if it is ready before the freeze. XRPL Testnet is in use (it
returned on 5 Oct, #98); AWS AgentCore is out. `make wallets` re-funds the
Testnet wallets after a Testnet reset, and `make doctor` checks them.

| Mode | What is real | What is simulated |
| --- | --- | --- |
| Primary (`npm run demo:live`) | DeepSeek answers and report, Clef decisions, HTTP search/402/delivery, budget enforcement, citations, XRPL Testnet payments and refunds, persisted recovery | Writers and corpus (SYNTHETIC), the value of Testnet XRP |
| Offline fallback (`npm run demo`) | Local services, HTTP boundary, ledger, citations, policy code, over the new writer corpus | LLM output (extractive), decision probabilities (fixture heuristics), settlement (SIMULATED SGD), the corpus |
| Recorded fallback | A clearly labelled capture of a previously verified run | It is not a live execution |

The fixture demo runs the new corpus
offline with extractive answers and heuristic decisions, all labelled.

Opening line: “Agents are the new readers. Experts should get paid when an
agent uses their thinking. This is the buyer side: a decision model judges
what an agent should buy, and every promise a writer made is checked after
delivery. The writers and articles are fictional and labelled synthetic;
the models and the Testnet payments are live, and carry no real value.”

When a provider falls back, the mode badge shows it. Never hide a fallback.

## Five minute script

Rewritten 9 Oct: **two minutes of live demo, then three minutes on one
blog-style page** (diagrams, a code snippet or two, a few graphics; no
slides). The page is still to be built. Numbers for questions are in
[QA-PACK.md](QA-PACK.md); the stage risks are in
[STAGE-REVIEW-OCT9.md](STAGE-REVIEW-OCT9.md).

**Words on stage.** Say "decision model" for the step that judges what is
worth buying; name the model only on the page's model-choice section. The
trust score is the writer's **track record**. Never say gap, threshold,
provider, H/C/T or a verdict code such as `SKIP_LOW_TRUST`; the screen says
"Blocked".

### Part 1: the demo (2:00 max, one live run)

One run carries both cases: UC3, "Malaysia packaging lead times". It shows
a good purchase and a failure caught live, and the answer changes. It took
35.6 s at real pace on 8 Oct and about 69 s at Stage 1× pace on 9 Oct.

Before going on stage: press "." for the Presenter menu, set clarify to
never, and **Reset reputation** (every rehearsal leaves AlphaLeak blocked,
and then round one won't buy it). Use `CF_BACKUP=1 make live` if the primary
Cloudflare quota is spent.

| Time | Say | Do / point at |
|---|---|---|
| 0:00 | "An LLM writes, a decision model chooses, code pays. You give it a budget, and that is the only thing that can spend." | Home: "Ask a question. Give it a budget." |
| 0:15 | "S$2 budget. A real question." | "Malaysia packaging lead times" preset, Ask |
| 0:20 | "It shows its plan and gives me five seconds before it can spend a cent." | The plan card |
| 0:30 | "Free sources first. It names what it still doesn't know." | Short answer, then the open question |
| 0:45 | "The decision model scores every paywalled article against that. AlphaLeak is cheap and promises exactly the data, so it gets bought." | The decision list, the budget counting down |
| 1:05 | "Its proof fails. Code challenges it, the writer refunds on-chain, and its track record halves." | Red "Proof failed", green "Refunded S$0.30" |
| 1:25 | "Round two buys the honest writer, and the answer changes." | Yellow v2, Compare v1 → v2 |
| 1:45 | "Every charge is on the XRPL Testnet ledger. No real money." | View receipt |

If it runs long, stop narrating the run and go to the page; open the
finished run from the sidebar during Q&A. Do not press Stop (a purchase
already in flight still completes). If a fallback chip appears: "that is the
labelled fallback".

### Part 2: the page (3:00)

Scroll one page, top to bottom, in the browser tab next to the app.
Planned sections:

1. **What it is (about 30 s).** Agents are the new readers; writers get paid
   when an agent uses their work. Pay Per Crawl prices pages, Pay Per Use
   trusts the buyer's word, we price evidence.
2. **How a run works (about 30 s).** One diagram: LLM writes → decision
   model scores → policy code pays over x402 → proof check → refund.
3. **The model choice (about 45 s).** "We benchmarked two decision models
   under a rule we wrote down first. OpenAI's Luna beat Clef-flash on every
   quality number on our synthetic set. It failed one test: our own demo
   needed a judge that gets fooled. We fixed the story, not the judge, and
   switched. The whole study cost under a dollar."
   - LIVE, small sample (real corpus, 9 Oct; keep apart from the SYNTHETIC
     numbers): Clef-flash told the UC3 story 0 of 2 times. Luna with a plain
     gap question told it 3 of 3, bought NotFT in UC2 3 of 4 times, refused 0
     times, and got 3 of 5 new real-corpus questions right. The wording of
     the gap question, not the model, was the main fix.
4. **How it was built (about 60 s).** The organizers ask for the stack,
   workflow and agentic process: issues as specs, overnight orchestrated
   runs, parallel worktrees, agents rehearsing the demo, and an honest
   "where it breaks" list.
5. **Close (about 15 s).** The one line again, and a QR code to the page.

### Kept for Q&A

- **Live proof:** "Shout a question, I'll type it in." Off-corpus questions
  should spend S$0 and name what they couldn't find.
- The AlphaLeak re-ask (Blocked), UC2 (Kestrel–TSMC), the S$0 "would buy"
  run, the fault demo and the injection trap.
- “The LLM can't spend” is a single sentence for Q&A, not the opening: five
  other talks that night lead with “don't trust the LLM”.

## Technical questions to prepare

Have concise, inspectable answers for:

- Why does a decision model choose purchases instead of an LLM, and what are
  the limits of decision models (no counting or date arithmetic, sensitivity
  to adversarial text)? How did clef-flash and clef compare on our own
  decisions?
- How is the decision model calibrated, and how do you know claimed relevance
  matches observed relevance? (QA-PACK §1; the writer's track record,
  FINAL-PUSH §7.)
- **Arrow's paradox: how do you judge information before you see it?** We
  reduce it, we do not solve it. A buyer gets the writer's abstract, signals
  and a signed manifest before paying, and recomputes the proofs after. Soft
  promises such as relevance can still be wrong, and calibration catches that
  over time.
- **Why not Pay Per Crawl?** It prices pages: one flat price per site, with
  Cloudflare as merchant of record, in closed beta. It gives the buyer no way
  to judge value first or check delivery. Pay Per Use trusts the buyer's
  reported usage. We let the writer set a price per article, a decision
  model decide, and the buyer check every promise. See FINAL-PUSH §14.
- **Can the ledger enforce refunds?** No. It enforces hash and time, not a
  regex over text. A failed proof triggers `/challenge`; the writer's
  facilitator refunds, and the track record drops either way. A writer who refuses or
  times out loses more of its track record and is delisted. Articles cost S$0.10–0.90, so
  one mistake is cheap and cheating is punished over time.
- **How is the engine neutral?** Ranking ignores price. We never hold the
  money: the buyer pays the writer's wallet directly. Writers set their own
  prices. Every writer's track record is public, and answering challenges is a
  listing requirement.
- **What stops prompt injection inside an article from spending money?** The
  LLM can name what is missing, but no tool buys, picks a purchase or changes
  the budget. Only policy code pays.
- How does an abstract plus a manifest justify buying text the agent has not
  yet read? What stops a writer's abstract from giving the article away?
- How were the policy threshold and the question wording calibrated?
- Why are two articles sometimes only one evidence family? (Rewrites collapse
  into their source's family.)
- What if the paid article is unhelpful or contradicts the answer?
- What prevents a retry from spending twice? (One charge per intent: the signed
  blob is written once and a resend is idempotent.)
- Can the citation be structurally valid yet fail to support the claim?
- The screen looks paced. Is the run replayed? The data is real; the UI paces
  the trace for the room. `?pace=real` shows true speed (D13).
- How did coding agents build this, and what broke along the way?
- Which missing pieces are commercial integration versus engineering?

Use a real trace, a small state machine, and a failing/passing evaluation
example. The engineering lesson should be concrete, such as discovering
that recording idempotency only after settlement leaves a crash window.

## Release gates

### Functional and evidence gate

Require an open-only answer, appropriate no-purchase outcome, useful purchase,
derivative skip, over-cap rejection, a failed proof that is challenged and
refunded, and an evidence-bound result. The citation drawer must show the approved source
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
npm run verify          # lint, typecheck, unit + UC1–UC3 process scenarios + gate-1..5 suite, Playwright UC2/UC3 + a11y, build
make doctor             # keys, corpus + embeddings freshness, Testnet wallets and payer balance
make smoke              # live UC1–UC3 + re-ask on DeepSeek + Clef + XRPL Testnet (orchestrator / rehearsal only)
~~~

All three exist and passed on 8 Oct (STATUS.md → Demo check). The release gate is
`npm run verify` green plus one `make smoke` PASS on the presenting laptop.

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
Check keyboard navigation, action-modal focus/cancel/return, citation focus,
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
| No external network | `npm run demo`: new corpus with fixture providers | Announce offline mode; try the phone hotspot first |
| DeepSeek, Clef or embeddings time out | Bounded wait and a visible label (fixture fallback, or `keyword only (embeddings unavailable)`), no invalid final answer | Existing labelled fallback |
| XRPL Testnet slow or unavailable | Purchase stays pending with its persisted signed blob; no second charge | Show the persisted outcome; switch to the labelled fixture demo |
| Browser reload | Same persisted run, spend, grants, and receipt | Reopen run by ID |
| Process restart after submission | Unknown state reconciles; no new payment | Show persisted outcome/trace |
| Publisher unavailable after settlement | Paid receipt retained, delivery can retry | Resume delivery when service returns |
| Payment requirement expires or changes | No transaction; the buyer asks again and compares the new requirement | Retry the article |
| Writer refuses or times out a `/challenge` (30 s) | Trust penalty applies, the writer is delisted, no refund is claimed | Say plainly that the ledger cannot force a refund |
| Presentation process fails | Restart from frozen scripts within 60 seconds | Labelled recording/screenshots |

- [ ] **Before every rehearsal and before the slot:** run `make preflight`
  (#196), then reset reputation (Presenter menu → Writer reputation → Reset),
  so no track record is left over from the last run.

Require three clean timed rehearsals on the final machine, running UC1, UC2
and UC3 in order over a phone hotspot, and one recovery rehearsal. Record
durations and interruptions; three successes are a release check, not a
statistically established reliability rate.

## Offline artifacts

The offline fallback is `npm run demo` on the new corpus (D18).
Prepare one current screenshot of the writers' track records after UC3, saved
answer/receipt artifacts from the verifier, a short labelled recording of the
five-minute flow recorded after the 8 Oct freeze, one Langfuse trace of a live
run, and the architecture diagram from
[FINAL-PUSH §3](../FINAL-PUSH.md#3-architecture) for questions. Keep them
accessible without the network and open each once before travel. A polished
user-facing export or research library is outside the required scope.

The old UO-10 images document the September UI. Replace presentation exports
only after the new flow passes. Do not imply those images show the writer
roster, manifests or refunds.

## Event day and follow-up

Run preflight before departure and after connecting the display. Open the
app, publisher page, and one useful trace; hide unrelated terminals/accounts.
Use the frozen corpus and qualified runtime. Confirm the fresh run has no
inherited purchases.

Capture technical feedback on whether the purchase rationale, evidence
independence, changed conclusion, and receipt are understandable. Useful
next validation is a small set of researcher sessions comparing the agent
with an open-only baseline. Payment completion alone is not product value.
