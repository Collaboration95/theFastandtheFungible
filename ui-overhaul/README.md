# UI overhaul — start here

This is a self-contained handoff for redesigning ResearchAgent into a calm deep
research product with optional paid articles and precise spending control.
All eleven user-supplied screenshots, both defects and references, are bundled.
A fresh checkout needs no previous conversation, Desktop files, temporary
reports, GitHub login, or private design-tool session to understand the work.

**This package contains the design contract, implementation slices, and their
current verification ledger.** Work remains in progress; existing limitations
and unrun human gates stay recorded rather than being hidden. Read
[STATUS.md](STATUS.md) for the current checkout and rerun the documented lanes
before treating any result as current.

## Use on another computer

1. Clone this repository or pull the branch containing this package. Run commands
   from the repository root, not from `ui-overhaul/`.
2. Read this page and [STATUS.md](STATUS.md). Run
   `node ui-overhaul/verify-package.mjs` to check the document links and all
   original image hashes. This check uses only Node's standard library.
3. Give your coding agent this instruction:

   > Execute `ui-overhaul/ORCHESTRATOR-PROMPT.md`. Use the bundled design brief,
   > implementation plan, screenshots, and testing runbook. Delegate bounded
   > work to DeepSeek Flash or GPT-5.6 Luna where available. Implement and verify
   > the overhaul in order, updating STATUS.md and evidence as you go.

4. The agent begins with UO-00 preflight, not a blind visual rewrite. Follow
   [TESTING.md](TESTING.md) for Node/npm/browser installation, deterministic
   fixture configuration, isolated run data, and actual test commands.
5. If you also want that implementation agent to push its future commits, state
   that explicitly in the new session. This package does not authorize paid
   provider usage, wallet transactions, or deployment.

## Reading map

| Document | Purpose | When to read |
| --- | --- | --- |
| [DESIGN-BRIEF.md](DESIGN-BRIEF.md) | Confirmed design direction, screens, interaction rules, acceptance criteria, embedded originals | Before design decisions |
| [EVIDENCE.md](EVIDENCE.md) | All nine current screens and two reference images, with interpretation | During audit and visual review |
| [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) | Ordered local work packages, dependencies, file ownership, tests, gates | Before assigning work |
| [ORCHESTRATOR-PROMPT.md](ORCHESTRATOR-PROMPT.md) | Ready-to-run autonomous coordinator instructions | Start of implementation |
| [WORKER-PROMPT.md](WORKER-PROMPT.md) | Small, bounded subagent assignment template | Every delegation |
| [TESTING.md](TESTING.md) | Fresh-machine setup, regression matrix, visual QA, accessibility, demo rehearsal | Before execution and each gate |
| [STATUS.md](STATUS.md) | Resume ledger and honest current progress | Start/end of each session |
| [evidence/RESULT-TEMPLATE.md](evidence/RESULT-TEMPLATE.md) | Per-work-package evidence record | After each slice |
| [assets/manifest.json](assets/manifest.json) | Original names, dimensions, lengths and SHA-256 hashes | Asset verification |

## Non-negotiable outcome

The audience is a general deep-research user, not just a finance analyst. The
first minute should make the question, allowed sources, spending cap, and next
action understandable. Preferred setup is Question → Sources → Budget → Review,
then a focused research/answer workspace. Payment is an optional, explicit
branch. The working app uses neutral sans-serif typography and one restrained
accent; a separate home/demo may be more expressive.

The app must stop presenting unrelated fixture evidence as an answer and must
allow a cited open-only answer without a purchase. Keep server-owned source
scope, plan approval, quote binding, spending limits, protected access, and
citation checks. Simplifying the UI does not weaken those controls.

## What gets tackled first

1. **Preflight:** fix the 5100/5173 browser harness mismatch and stale-process
   cleanup, isolate fixture data, and record baseline checks.
2. **Correctness:** truthful unsupported-scope handling, optional paid sources,
   honest runtime labels, and regression evidence.
3. **Interaction design:** review a complete screen/state map and prototype,
   including mobile, unpaid completion, errors, and purchase cancellation.
4. **Implementation:** shared foundations, guided setup/review, calm workspace,
   exact purchase/recovery, readable cited answer, then full visual and demo QA.

The implementation plan expands this order into independently reviewable work.
Existing GitHub issue numbers are context mappings. No issue creation or GitHub
fetch is necessary to execute; the local work contracts state the actual scope.
Live adapters, authentication, production payments, and a complete library are
not prerequisites for a truthful and polished fixture demo.

## Portability and precedence

- Repository-relative links and standard PNG/Markdown/JSON files work offline.
  Optional method citations are background, not required external dependencies.
- Installation may need network access for npm/browser binaries. Fixture runs
  must not require paid keys. No secrets or runtime history are bundled.
- Source code still contains machine-portability defects. The runbook describes
  macOS/Linux setup and known Windows cleanup limits rather than claiming all
  operating systems already pass.
- Confirmed requirements in this package supersede old presentation restrictions
  in the legacy UX documents and wireframes. Server trust contracts remain in
  force. Apply later explicit user changes and record them in STATUS.md.
- `canvas/excalidraw/scene.excalidraw` and its existing export PNGs are historical
  artifacts preserved for continuity, not the new approved design.
- Keep `assets/current/` and `assets/references/` immutable. Put newly captured
  implementation evidence in `evidence/<work-id>/` so before/after comparisons
  remain valid.

No plan can promise zero defects. Completion requires observed passing gates
and honest unresolved limitations, not a “looks modern” claim or green tests
without a rendered-browser review.
