# October 1 presentation readiness

Status: **planned and in progress**. This document is an execution and rehearsal
plan, not a claim that the presentation is ready.

Target: a reliable five-to-seven-minute local ResearchAgent demonstration on
1 October 2026. The primary path uses deterministic fixture research and
fixture settlement. Optional provider or XRPL Testnet modes must never be a
single point of failure.

## Success criteria

The audience should leave with four clear ideas:

1. ResearchAgent can answer from accessible evidence without forcing a payment.
2. It can identify a material evidence gap and explain why a premium source may
   help.
3. A user-approved mandate, exact quote, and server guard constrain every
   purchase.
4. Final claims are linked to accessible evidence, while fixture and live modes
   remain honestly labelled.

## Authority and baseline

The current implementation includes unsupported-scope handling, an open-only
answer path, guided setup, exact purchase review, server-side citation
validation, mutually exclusive workspace tabs, and isolated Playwright storage.
The UO-10 owner run recorded 22 unit tests, 17 E2E tests, one focused axe test,
responsive captures, reduced-motion coverage, 200% zoom coverage, and keyboard
tab checks on 20 September.

Those results are useful baseline evidence only. The presentation gate requires
fresh runs on the final checkout and the presentation machine. The qualitative
pilot and full demo rehearsal were not run as part of UO-10 and remain planned.

## Execution order

Work in this order so later evidence is not invalidated by subsequent changes:

1. Freeze product claims and the canonical environment.
2. Finish repository cleanup and resolve all verification failures.
3. Run automated gates on the final checkout.
4. Inspect responsive, keyboard, and content truthfulness manually.
5. Capture only the final evidence and fallback artifacts.
6. Rehearse the scripted path and recovery paths.
7. Freeze presentation code and repeat the final-machine check.

Do not add optional features after step 3 unless they fix a presentation
blocker. Any late code change restarts the affected verification and rehearsal
gates.

## Workstream A — product truth and narrative

Owner outcome: every spoken and visible claim matches the runtime.

Planned checks:

- Use the canonical data-centre question for the primary demonstration.
- Show the unsupported-scope state briefly or keep it ready for questions.
- Describe source profiles as “allowed to read,” not as verified truth.
- Call the corpus synthetic and the default LLM behavior deterministic fixture
  behavior.
- Call fixture payment a simulation; never imply a publisher received funds.
- Present Groq and XRPL Testnet as optional server-side modes only if they were
  exercised on the final machine.
- Explain that maximum spend is a cap, not wallet balance, source price, or
  purchase consent.
- Separate plan approval from exact purchase approval.
- State that an open-only answer is valid when accessible evidence is usable.
- Avoid claims of live web search, production security, mainnet readiness,
  history/library completeness, or real publisher licensing.

Gate A passes when the README, slides, app labels, and spoken script make the
same claims and one reviewer finds no fixture/live ambiguity.

## Workstream B — repository and environment

Owner outcome: the demo starts predictably from a clean local state.

Planned checks:

- Use Node 20.19+ or 22.12+ and record the exact version.
- Run `npm install` from the final lockfile.
- Copy `.env.example` to a local ignored `.env`.
- Pin `LLM_PROVIDER=fixture` and `XRPL_MODE=fixture` for the primary path.
- Confirm the client uses port 5100 and the API uses 8788.
- Confirm the stop script clears every port it starts.
- Confirm Playwright uses `.playwright/runs.json`, not `data/runs.json`.
- Run `npm run seed`, then start `npm run dev` and open the app once.
- Confirm no local secret, wallet seed, provider key, or temporary artifact is
  tracked.

Gate B passes when a new shell can install, reset, start, and reach a healthy
app using only the documented fixture instructions.

## Workstream C — automated verification

Owner outcome: code, API, browser, accessibility, and build checks are green.

Run from the repository root on the final checkout:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:a11y
npm run build
npm run verify
```

Required coverage:

- Supported and unsupported fixture questions.
- Plan approval before execution.
- Open-evidence synthesis without a purchase.
- Premium preview locked before access.
- Exact quote and side-effect-free cancel.
- Duplicate skip and over-ceiling block.
- Idempotent purchase and unknown-outcome reconciliation.
- Dossier rejection when citations reference inaccessible sources or spans.
- Fixture fallback passing the same citation validator as provider output.
- Pause, resume, stop, reload, and reset-safe receipts.
- Browser tests on the actual client port using isolated persistence.

Record the command, date, commit, test count, duration, and failure output in
the presentation task or pull request. Do not create a new repository status
document for each run.

Gate C passes only when every command exits zero on the final checkout. A prior
green run does not waive a new failure.

## Workstream D — interaction, responsive, and accessibility review

Owner outcome: the primary path remains understandable without presenter
workarounds.

Planned manual matrix:

| Check | Required view/state |
| --- | --- |
| 360 and 390 CSS px | Setup, source row, exact purchase modal, answer |
| 768 and 1024 CSS px | Guided setup, workspace tabs, citation drawer |
| 1440 CSS px | Presentation layout and readable centered workspace |
| 320px reflow | No body overflow or hidden critical action |
| 200% text zoom | Consent, price, cap, errors, and recovery remain visible |
| Reduced motion | No information depends on animation |
| Keyboard only | Setup, tabs, modal, purchase cancel, citation open/close |
| Screen-reader spot check | Labels, errors, live regions, modal name, focus restore |

Specific acceptance points retained from UO-10:

- Overview, Sources, and Activity are mutually exclusive accessible tabs.
- The purchase modal traps focus, closes safely, and restores the trigger.
- Cancel has no spending side effect.
- Unknown purchase outcome disables blind retry.
- Citation inspection shows an exact accessible span and evidence mode.
- History and Library remain absent or explicitly unavailable, not dead links.

Gate D passes when no critical action is clipped, no horizontal body overflow
appears, focus is never lost, and all evidence/payment states have text labels.

## Workstream E — demo data and artifacts

Owner outcome: the presenter has a stable live path and a credible static
fallback.

Planned artifacts:

- Architecture image: `assets/research-agent-architecture.png`.
- Desktop workspace:
  `ui-overhaul/evidence/UO-10/workspace-1440.png`.
- Mobile workspace:
  `ui-overhaul/evidence/UO-10/workspace-390.png`.
- Editable architecture diagrams indexed from `diagrams/README.md`.
- Official UX views in
  `canvas/excalidraw/exports/official-researchagent-views.svg`.
- A printed or saved canonical dossier produced on the final machine.
- A short plain-text copy of the key fixture decisions and limitations.

Retain one or two current screenshots per narrative need. Do not preserve a
numbered screenshot sequence merely because it was once used as work evidence.

Gate E passes when every artifact opens offline, is legible at presentation
resolution, and reflects the final fixture labels and user flow.

## Demo script

### 0:00–0:45 — problem and trust boundary

- State the research question.
- Explain the synthetic fixture corpus and S$2 maximum-spend mandate.
- Say that the default run uses no live website or real publisher payment.

### 0:45–1:45 — guided setup

- Select approved source profiles and show the maximum research spend.
- Review the readable plan.
- Say explicitly: “Approving this plan starts research; it does not approve a
  purchase.”

### 1:45–3:00 — evidence and open answer

- Start research and show evidence families.
- Point out the material grid/interconnection gap and duplicate reporting.
- Generate the cited open-evidence answer before buying anything.

### 3:00–4:30 — optional premium decision

- Compare the useful, duplicate, and over-ceiling candidates.
- Open the exact purchase review and show source, amount, mode, and remaining
  authority.
- Cancel once if time allows to prove no side effect; reopen and confirm.
- Call the resulting settlement a fixture simulation.

### 4:30–5:45 — answer impact and evidence

- Show the updated cited conclusion.
- Open one citation and its exact accessible span.
- Distinguish model prose, source evidence, and receipt metadata.

### 5:45–6:30 — close

- Summarize: accessible evidence first, optional spend, deterministic guard,
  explicit consent, validated citations.
- Name the next milestone: user validation, then one bounded live source and
  one protected-resource Testnet proof.

## Recovery and rollback

### Before the session

- Keep a known-good Git commit and lockfile recorded.
- Keep the fixture `.env` and presentation artifacts local and offline-ready.
- Stop unrelated processes using 5100 or 8788.
- Disable sleep, notifications, automatic updates, and unstable VPN/proxy
  behavior for the presentation window.
- Start the app at least 15 minutes early and complete one reset run.

### During the session

| Failure | Recovery |
| --- | --- |
| App page unavailable | Run `npm run dev:stop`, restart `npm run dev`, reload |
| Stale or confusing run | Use the in-app fresh reset; if needed run `npm run seed` and restart |
| Groq/provider unavailable | Return to fixture mode and use validated fixture synthesis |
| Testnet unavailable | Do not retry blindly; show fixture purchase and explain the live seam |
| Unknown payment outcome | Reconcile receipt/status; never submit a second payment blindly |
| Browser layout problem | Use the verified presentation browser and 100% zoom |
| Local process cannot recover | Switch to the saved evidence workspace, dossier, and architecture artifacts |

Rollback means returning to the recorded known-good commit and fixture
environment—not editing code live. Never use a destructive Git operation on a
workspace that contains uncommitted work.

## Rehearsal schedule

- **T-7 to T-5 days:** freeze claims, finish verification fixes, run the first
  complete technical rehearsal.
- **T-4 to T-3 days:** run one reviewer rehearsal and one keyboard/responsive
  pass; capture final artifacts.
- **T-2 days:** run three consecutive clean-reset demonstrations and time the
  script.
- **T-1 day:** freeze code, copy artifacts, verify adapters are fixture by
  default, and run once on the actual presentation setup.
- **Presentation day:** start early, run health/reset checks, then avoid
  unnecessary dependency or environment changes.

## Definition of ready

The presentation is ready only when all of the following are true:

- Gates A through E pass on the final checkout.
- The canonical fixture path succeeds three consecutive times after reset.
- The presenter completes the script in seven minutes without hidden setup.
- One reviewer can explain the product, spend boundary, fixture boundary, and
  evidence proof after watching it once.
- Open-only, paid, blocked, unsupported, and fallback states are truthful.
- All citations shown in the final answer resolve to accessible exact spans.
- A static offline fallback is available and recently opened.
- No material work remains scheduled for the morning of the presentation.
