# UI overhaul testing, visual QA, and demo verification runbook

Portable runbook for verifying the ResearchAgent UI overhaul on any machine.
It records what the current repository actually does, what is verified, what is
broken, and what must be checked by a human.

This is the future implementation runbook. See [README.md](README.md) for the
package map and [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for work order.
Baseline observations below refer to app commit `fc177016430811158d913be12f130f68a49bcc10`;
rerun and update the status after changes. UO-PF-01 and UO-PF-02 below are preflight
finding labels within **UO-00**, not separate backlog items.

**Time box.** The bounded smoke lane in section 4 is designed to finish in about
5 minutes. The full lane (E2E + accessibility + visual + demo rehearsal) is
longer and must be scheduled, not squeezed.

**No guarantee of zero bugs.** Nothing here promises a defect-free build. Every
result in this document has a status of pass, fail, or not run, and "not run" is
not evidence of correctness.

---

## 0. Preflight blocker - read before trusting any E2E claim

**UO-PF-01 (blocking): Playwright is configured for the wrong browser port.**

- `playwright.config.ts` sets `use.baseURL = 'http://localhost:5173'` and
  `webServer.url = 'http://localhost:5173'`.
- The dev client actually listens on **5100** (`package.json` -> `dev:client`
  -> `vite --host 0.0.0.0 --port 5100 --strictPort`, matching `vite.config.ts`
  `server.port = 5100`).
- Nothing in the repository serves the app on 5173. The legacy value survives
  from an earlier port move and was never updated.

**Observed result (this audit, 2026-09-20, macOS, Node v26.3.1, npm 11.16.0):**

```bash
npx playwright test tests/a11y.spec.ts --reporter=line
# Error: Timed out waiting 30000ms from config.webServer.
# exit code 1
```

Playwright starts the `webServer` command, then polls `http://localhost:5173`
until the 30 s timeout. The app is up on 5100 the entire time, so the failure
happens during harness startup. **No test body executes.**

**Consequences - state these plainly in any status report:**

1. `npm run test:e2e` and `npm run test:a11y` cannot pass on this revision.
2. There is **no passing E2E or accessibility evidence** for the current
   repository, and none may be claimed from this configuration.
3. The five Playwright specs in `tests/e2e.spec.ts` and the single spec in
   `tests/a11y.spec.ts` are unexecuted code, not evidence.
4. Any local workaround that edits `tests/` or relaxes assertions to make the
   command exit zero is out of scope and forbidden. The defect is the URL in the
   harness config.

**Exact proposed repair (future slice, not applied here).** Update
`playwright.config.ts` to the real client port, and optionally add a base-URL override only if the actual Vite server port and
readiness URL are configured together. A URL override alone does not change
`dev:client`'s hard-coded port:

```ts
// playwright.config.ts - proposed, NOT implemented
const baseURL = 'http://localhost:5100' // centralize with the actual dev port

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 20_000,
  use: { baseURL, headless: true },
  webServer: {
    command: fixtureWebServerCommand,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
```

Acceptance for that slice: `npm run test:a11y` reaches the app and runs the axe
scan; `npm run test:e2e` executes all five canonical-flow tests. Until that
lands, treat every E2E row in this runbook as **blocked**, not as a product
failure.

### UO-PF-02: how the auto-started servers actually behave

`playwright.config.ts` auto-starts servers. Documented exactly as configured:

| Fact | Value |
| --- | --- |
| Command run by `webServer` | `XRPL_MODE=fixture LLM_PROVIDER=fixture npm run dev` |
| Windows branch in config | `set "XRPL_MODE=fixture" && set "LLM_PROVIDER=fixture" && npm run dev` |
| What `npm run dev` does | runs `dev:stop`, then concurrently `dev:client` + `dev:server` |
| Client port | 5100 (`--strictPort`) |
| API port | 8788 |
| Ready URL polled by Playwright | 5173, which never becomes ready (UO-PF-01) |
| `reuseExistingServer` | `false` |

Because `reuseExistingServer` is `false`, a dev server you already started by
hand does **not** satisfy the harness. Playwright always launches its own, and
`--strictPort` means an occupied 5100 fails the launch rather than falling back
to another port. `npm run dev` therefore depends on `dev:stop` succeeding
first - see UO-00 in section 8.

---

## 1. Verified status at the time of writing

Everything below was observed on 2026-09-20 in this checkout. Re-run before
reusing these results; do not carry them forward as current.

| Lane | Command | Status | Evidence |
| --- | --- | --- | --- |
| Typecheck | `npm run typecheck` | **pass** | `tsc --noEmit`, exit 0 |
| Unit / API | `npm test` | **pass** | 19 tests, 3 files, 2.27 s |
| E2E | `npm run test:e2e` | **not run / blocked** | UO-PF-01 |
| Accessibility | `npm run test:a11y` | **fail (harness)** | `Timed out waiting 30000ms from config.webServer.` |
| Build | `npm run build` | **not run** | not executed in this docs-only pass |
| Visual / screenshot review | section 7 | **not run** | requires manual capture |
| Five-person pilot | section 10 | **not run** | no participants |
| Demo rehearsal | section 11 | **not run** | scheduled activity |

The typecheck and unit suite are the passing automated baseline evidence from this audit. It covers the
domain ranking/clustering contract, the research-plan artifact contract, and
local persistence including restart, reset, and stale or missing quote approval.

---

## 2. Prerequisites and fresh-machine setup

**Runtime.** `README.md` requires Node.js 20.19+ or 22.12+ and npm. The audit
host ran Node v26.3.1 / npm 11.16.0 successfully; treat that as one working
observation, not a supported-version claim.

**Fresh clone to first run:**

```bash
git clone https://github.com/Collaboration95/theFastandtheFungible.git tftf
cd tftf
npm ci                       # lockfile-exact install; use ci, not install
test -e .env || cp .env.example .env  # preserve any existing local config
```

**Browser binaries (required for any Playwright lane):**

```bash
npx playwright install chromium
# Linux CI, when system libraries are also missing:
# npx playwright install --with-deps chromium
```

A fresh machine needs the browser version matching the lockfile-installed Playwright.

**Ports.**

| Port | Service | Source of truth |
| --- | --- | --- |
| 5100 | Vite dev client, strict | `package.json` `dev:client`, `vite.config.ts` |
| 8788 | Express API | `package.json` `dev:server`, `.env.example` `PORT` |
| 5173 / 5174 | Legacy, polled by `dev:stop` and by Playwright | `scripts/stop-dev.mjs`, `playwright.config.ts` |
| 4173 | Vite preview default | Vite default; API proxy parity not verified in this audit |

`vite.config.ts` proxies `/api` to `http://localhost:8788`, so the API must
be running for any client call to succeed. `npm run preview` is **not** verified
as a fixture-parity environment in this audit; do not present preview output as
equivalent evidence to a dev-server run.

**Portability notes.** Primary target is macOS/Linux. Windows is only partially
supported: `playwright.config.ts` carries a `set "VAR=value"` branch, but
`scripts/stop-dev.mjs` shells out to `lsof` and `ps` (section 8). Do not
promise Windows equivalence without new evidence.

---

## 3. Safe environment settings for deterministic verification

The deterministic path is what keeps verification free and non-destructive. Two
switches carry it, and both are set by the Playwright `webServer` command
(section 0).

**Why no paid Groq call can happen.** In `server/llm.ts`, live mode requires
`process.env.LLM_PROVIDER === 'groq'` **and** a non-empty `GROQ_API_KEY`. With
`LLM_PROVIDER=fixture` the provider is never contacted, purchase planning
returns the deterministic `fallback()` plan (`provider: 'fixture'`,
`model: 'fixture-research-v1'`, `status: 'FALLBACK'`), and synthesis uses the
local `fixtureDossier()` in `server/index.ts` instead of Groq.

**Why no real Testnet payment can happen.** In `server/index.ts`,
`xrplMode = process.env.XRPL_MODE === 'live' ? 'live' : 'fixture'`. Anything
other than the exact string `live` yields fixture mode, and live settlement is
separately restricted to `xrplNetwork === 'testnet'` with a matching
`XRPL_PAYER_SEED` / `XRPL_RECEIVER_ADDRESS`. With `XRPL_MODE=fixture` the
settlement record is `SIMULATION_NOT_SETTLED`, `payTo` is `null`, and no
wallet is ever created.

**Precedence works in our favor.** `server/index.ts` begins with
`import 'dotenv/config'`. dotenv does not overwrite variables already present in
the process environment, so the fixture values exported by the Playwright
`webServer` command win over a local `.env` that might say
`LLM_PROVIDER=groq` or `XRPL_MODE=live`. A developer's personal `.env`
cannot turn a test run into a paid run.

**Supported switches (from `.env.example`, plus one test-only variable).** Use
only these. Anything else is unsupported and must not be asserted in this
runbook.

| Variable | Safe verification value | Notes |
| --- | --- | --- |
| `APP_MODE` | `fixture` | `.env.example` default |
| `PORT` | `8788` | API port |
| `PUBLIC_APP_URL` | `http://localhost:5100` | must match the real client port |
| `DATABASE_URL` | `file:./data/research-agent.db` | present in the example; the JSON store is what persistence uses today |
| `LLM_PROVIDER` | `fixture` | `groq` is the only live value |
| `LLM_API_KEY` | empty | not consumed by the live path |
| `LLM_BASE_URL` | empty | live path defaults to the Groq chat-completions endpoint |
| `LLM_MODEL` | empty | live path defaults to `llama-3.3-70b-versatile` |
| `LLM_TIMEOUT_MS` | `30000` | purchase-planning request timeout |
| `LLM_SYNTHESIS_TEMPERATURE` | `0.85` | clamped to 0-2 |
| `GROQ_API_KEY` | empty | server-only; never in the browser, a commit, or a screenshot |
| `OPENAI_API_KEY` | empty | present in the example; unused by the fixture path |
| `SEMANTIC_RANKER` | `precomputed` | matches the server response `semanticRanker` |
| `TRANSFORMER_MODEL` | `Xenova/all-MiniLM-L6-v2` | example default |
| `LIVE_SOURCE_ADAPTERS` | `none` | no live web retrieval exists in this build |
| `XRPL_MODE` | `fixture` | `live` is never used for verification |
| `XRPL_NETWORK` | `testnet` | ignored while `XRPL_MODE=fixture` |
| `XRPL_RPC_URL` | `wss://s.altnet.rippletest.net:51233` | unused in fixture mode |
| `XRPL_PAYER_ADDRESS` / `XRPL_RECEIVER_ADDRESS` | empty | live-only |
| `XRPL_PAYER_SEED` | never set | intentionally absent from `.env.example`; local only |
| `XRPL_EXPLORER_URL` | `https://testnet.xrpl.org/transactions` | live-only display value |
| `RESEARCH_RUNS_FILE` | temp file path | read by `server/index.ts`; used by `tests/persistence.test.ts` to isolate run stores |

Do not invent switches. There is no `TEST_MODE`, no `VITE_` provider switch,
no `PLAYWRIGHT_BASE_URL` (it is a proposal in section 0, not current behavior),
and no `CI`-dependent branch in the harness. Never copy `GROQ_API_KEY` or
`XRPL_PAYER_SEED` into React code, browser storage, a commit, a screenshot, or
persisted run data.

---

## 4. Commands by intent

Before the commands below, set an explicit deterministic environment in this
shell (macOS/Linux). Do not rely on a developer's existing `.env`:

```bash
verification_dir=$(mktemp -d)
export APP_MODE=fixture LLM_PROVIDER=fixture XRPL_MODE=fixture
export PORT=8788 PUBLIC_APP_URL=http://localhost:5100
export RESEARCH_RUNS_FILE="$verification_dir/runs.json"
```

The directory exists, but `runs.json` is intentionally absent so the server can
initialize a valid empty store. Keep this shell for the test/dev commands.
Persistence tests already create their own isolated stores. E2E inherits the
exported path through its launched server. Stop only owned server processes and
remove the temporary data when finished. On Windows, apply equivalent process
environment settings and a unique temp directory; cleanup support remains a
preflight limitation until repaired.

```bash
# --- Fast lane (target: under 5 minutes, safe on any machine) -------------
npm ci                                             # once per machine, lockfile-exact
npm run typecheck                                  # tsc --noEmit
npm test                                           # vitest run, unit/API contract

# --- Full static gate -----------------------------------------------------
npm run check:fast                                 # typecheck + unit
npm run verify                                     # typecheck + unit + build

# --- Browser lanes (currently blocked by UO-PF-01) ------------------------
npx playwright install chromium                    # first run on a machine
npm run test:e2e                                   # BLOCKED - see section 0
npm run test:a11y                                  # BLOCKED - see section 0

# --- Run the app for manual / visual work ---------------------------------
npm run dev                                        # client 5100 + API 8788
npm run dev:client                                 # client only, 5100
npm run dev:server                                 # API only, 8788

# Do not use npm run seed for verification; the isolated store above suffices.
```

Everything runs from the repository root. There is no per-package workspace
layout; the root `package.json` is the only manifest.

---

## 5. What each lane does and does not prove

**Unit / API (`npm test`, Vitest, 19 tests).** `vitest.config.ts` collects
`tests/**/*.test.ts` and the matching `.tsx`, `.js`, and `.jsx` globs, and
explicitly excludes the two Playwright specs. Coverage today:

- `tests/domain.test.ts` (4 tests): fixture catalog ranking and clustering, the
  grid gap ranking above the redundant newsletter, utility separated from price,
  and rejection of invalid access, price, license, family, and span metadata.
- `tests/research-plan.test.ts` (6 tests): distinct priorities per approach, a
  typed versioned plan artifact, observational-only steps that never authorize
  access or payment, canonical defaults without protected bodies, input cloning,
  and rejection of malformed artifacts.
- `tests/persistence.test.ts` (9 tests): real-server integration. It picks a
  free port, spawns `tsx server/index.ts` with `XRPL_MODE=fixture` and an
  isolated `RESEARCH_RUNS_FILE`, waits for `/api/health`, and exercises restart
  persistence, receipt retention across reset, stale and mismatched quote
  approval rejection, and plan-approval gating before discovery.

These tests prove server-side contracts. They do **not** render React, do not
exercise the browser, do not test layout, and do not prove the app is usable.

**E2E (`npm run test:e2e`).** Five tests in `tests/e2e.spec.ts` describe the
canonical fixture journey: question entry, source selection, plan review and
approval, buy/skip/block decisions, protected-body gating, budget arithmetic in
XRP with the SGD approximation, and dossier readiness. All five are blocked by
UO-PF-01. Note also that these specs assert **current pre-overhaul UI copy** (for
example `Approve purchase S$0.20` and `Assemble cited answer`). The overhaul
will legitimately change that copy, so the specs need updating as part of the
overhaul. That is expected maintenance, not a reason to weaken assertions.

**Accessibility (`npm run test:a11y`).** One test in `tests/a11y.spec.ts`
runs `@axe-core/playwright` against `/` and fails on `serious` or
`critical` violations. Even once UO-PF-01 is fixed, this is a single automated
scan of a single route. It cannot detect focus order, dialog focus trapping,
Escape behavior, focus restoration, keyboard-only completion, live-region
quality, or 200% zoom and reflow problems. Those remain manual obligations in
sections 6 and 7.

---

## 6. Regression matrix

Status legend: **pass** = executed here with evidence; **blocked** = harness
defect prevents execution; **not implemented** = no test exists yet;
**manual** = human verification required.

| # | Area | Expected behavior | Current automated coverage | Status now |
| --- | --- | --- | --- | --- |
| R1 | Source truthfulness | An unsupported or arbitrary question must not be answered with unrelated data-centre fixture evidence; it must produce a truthful unsupported-scope state | none | **not implemented** - known defect: free-question entry with data-centre gap and claims |
| R2 | Open-only answer | An approved run with usable open evidence can produce a cited answer with **no purchase** | none | **not implemented** - known client defect: the answer control is gated on a prior BUY |
| R3 | Exact quote approval | Purchase binds to the exact quote; stale, missing, or mismatched approval is rejected without spending or unlocking | `tests/persistence.test.ts` | **pass** server-side; UI-level **not implemented** |
| R4 | No duplicate charge | A retry or repeat submit cannot double-settle or unlock twice; outcome reconciliation precedes retry | partial (quote gating) | **manual**, and **not implemented** for the duplicate-submit UI path |
| R5 | Citations | Claims resolve only to accessible source and evidence-span IDs; protected spans never render before purchase | `tests/e2e.spec.ts` (blocked) | **blocked** |
| R6 | Reload / back / draft | Reload restores last server state or explains an unavailable draft; Back preserves setup values; no silent data loss; new research does not mutate completed runs | `tests/persistence.test.ts` covers restart persistence | **pass** for server restart; **not implemented** for browser reload, Back, and draft UX |
| R7 | Accessibility | Keyboard-only completion of the full path; dialogs trap focus, close on Escape, restore focus to the invoking control; live regions announce material changes only | `tests/a11y.spec.ts` (automated scan only) | **blocked** for the scan; **manual** for all focus and keyboard behavior |
| R8 | Long strings and zoom | Long source names, prices, and identifiers wrap without clipping; 200% text zoom and 320 px reflow produce no horizontal overflow and hide no critical action | none | **not implemented** |
| R9 | Protected content | Premium body text is absent before the matching verified purchase and present after | `tests/e2e.spec.ts` (blocked) | **blocked** |
| R10 | Budget authority | Cap, spent, and remaining stay visible and correct in XRP with a labelled SGD approximation; a cap is never presented as a charge | `tests/e2e.spec.ts` (blocked); no unit coverage | **blocked** |
| R11 | Fixture honesty | Fixture settlement is labelled as simulation; XRP Testnet and synthetic corpus remain separate, truthful facts | none | **not implemented** |

Rows R1 and R2 are pre-existing product defects recorded in the redesign brief,
not regressions introduced by the overhaul. The overhaul is expected to fix both.
Write the regression tests as part of that work and mark them clearly as newly
implemented when they land.

### Proposed tests (NOT implemented)

The following are proposals. None exists in the repository today; do not report
them as coverage.

1. **Truthful unsupported scope.** Submit an out-of-scope question; assert a
   visible unsupported-scope message and assert that no data-centre claim text
   appears in the answer region.
2. **Open-only completion.** Approve a plan, buy nothing, generate the answer;
   assert a cited answer renders and that no disabled state blocks it.
3. **Duplicate-submit safety.** Trigger purchase approval twice in quick
   succession; assert one settlement record and one access grant.
4. **Reload and Back.** Fill setup, reload mid-flow, and navigate Back; assert
   values persist or a truthful unavailable-draft state appears.
5. **Zoom and reflow.** Assert that the document scroll width does not exceed the
   viewport at 320 px and at 200% zoom, with every primary action still
   reachable.

---

## 7. Visual screenshot and manual quality review (REQUIRED)

### Design-phase gate before production UI work (UO-03/UO-04)

These are future artifacts, not files claimed to exist in the package today:

- `ui-overhaul/STATE-MAP.md`: state/transition table with owner, user action,
  failure/recovery, server boundary and responsive/keyboard behavior.
- `ui-overhaul/prototype/`: portable clickable prototype, editable source and a
  README containing exact local launch instructions using installed repo tools.
- Desktop and mobile high-fidelity Question, Review, Research, purchase approval
  and Answer screens, with tokens and component/state inventory. They may be
  captured from the refined prototype rather than a separate design service.

Verify every named state against the design brief. Click the first-run entry,
returning-user resume, complete guided setup, Back/draft, unpaid answer, paid
review/cancel, expiry/block, unsupported prompt, recovery, and citation path.
Confirm the choice of a modest app entry versus a separate expressive marketing
route is recorded; neither choice may force returning users through a sales page.

The prototype must demonstrate states without calling real providers or payment
APIs. Mocked transitions must be labelled as prototype behavior. Reopen the
artifact on a fresh checkout with its README instructions, inspect desktop and
mobile renders, and record acceptance in `evidence/UO-04/` plus STATUS.md. Do not
start UO-05 until state coverage and the high-fidelity set are reviewed. Missing
external design-tool sessions are a portability failure, not an acceptable link.

### Implemented-product visual gate

Automated tests cannot approve appearance, layout, or comprehension. A passing
`npm test`, a passing axe scan, and even a fully passing E2E suite are all
**insufficient** for the overhaul. Somebody must look at the product at the
required widths and record what they saw.

**Required viewports (CSS pixels):** 360, 390, 768, 1024, 1440.

**Required stress checks:** 320 CSS px reflow width, and 200% text zoom at each
required viewport. Both must show no body horizontal overflow, no clipped
critical action, and no hidden purchase consent.

**Required captures per viewport** (at minimum, one file each):

1. Landing / first-run home.
2. Question step.
3. Sources step, including a long source name.
4. Budget step, showing cap, spent, and remaining with the SGD estimate.
5. Plan review with advanced editing collapsed.
6. Research running.
7. Research paused.
8. Source row with an over-ceiling blocked state visible.
9. Exact purchase approval modal open.
10. Duplicate or stale quote recovery state.
11. Answer with citations expanded.
12. Citation detail open.
13. Open-only answer with no purchase made.
14. Unsupported-scope state.
15. Error or connection-lost recovery state.

**Where evidence lives.**

- `ui-overhaul/assets/current/` — immutable original S01–S09 defect screenshots.
- `ui-overhaul/assets/references/` — immutable original S10–S11 inspiration.
- `ui-overhaul/EVIDENCE.md` — original gallery and interpretation; do not replace
  these originals with new passing screenshots.
- `ui-overhaul/evidence/<work-id>/` — new captures and a result record based on
  [RESULT-TEMPLATE.md](evidence/RESULT-TEMPLATE.md). Link before-image IDs and
  give a one-line verdict for each new state/viewport.

The repository also holds two existing, separate evidence sets that must not be
conflated: `screenshots/01-landing.png` through
`screenshots/11-open-only-research.png`, and the audited
`screenshots/audit-01-landing.png` through `screenshots/audit-05-dossier.png`.

**Manual review checklist** - answer pass or fail per item, per viewport:

1. No body horizontal scrollbar at any required width, at 320 px, or at 200% zoom.
2. Every primary action is visible and reachable without zooming out.
3. Purchase consent is never hidden, truncated, or visually downgraded.
4. Budget reads as authority (cap, spent, remaining), never as a balance or a
   charge.
5. Fixture settlement is labelled as simulation wherever money appears.
6. Over-ceiling sources are shown as blocked with the exact reason and a
   continue-without-it route.
7. Long source names, prices, and identifiers wrap instead of clipping.
8. Tab order follows visual order, and focus is always visible.
9. Modal focus is trapped, Escape closes when safe, and focus returns to the
   invoking control.
10. Nothing renders as a third simultaneous desktop column.

---

## 8. UO-00: cleanup portability and the stale Vite problem

`scripts/stop-dev.mjs` stops stale dev processes before `npm run dev` starts.
As written it has two portability problems.

**Problem 1 - the port list omits 5100.** The script uses
`const ports = [5173, 5174, 8788]`. The Vite client now listens on **5100**, so
a stale Vite process on 5100 is never detected or stopped. Because `dev:client`
runs with `--strictPort`, a second `npm run dev` then fails to bind 5100
instead of quietly picking another port. Symptom: the app looks like it "failed
to start" while an older Vite instance is still serving a stale build. The
5173 and 5174 entries are leftovers from the same port move.

**Problem 2 - Unix-only process discovery.** The script shells out to `lsof`
and `ps` and matches the process command line against the project root. Neither
tool exists on a stock Windows host. On a machine without `lsof`, the
`try/catch` swallows the error and the script reports "No ResearchAgent dev
processes found." while the ports are in fact occupied.

**Manual recovery (macOS/Linux).** Inspect before acting:

```bash
lsof -tiTCP:5100 -sTCP:LISTEN        # stale Vite client
lsof -tiTCP:8788 -sTCP:LISTEN        # Express API
ps -p <pid> -o pid=,command=         # confirm it is this project, not something else
```

Only terminate a PID after confirming from its command line that it belongs to
this repository. **Do not blanket-kill ports.** Piping every PID from
`lsof` into `kill -9` destroys unrelated work if another project
owns the port, and this runbook does not authorize it.

**Proposed repair (future slice, not applied here).**

1. Change the port list to the ports actually used, `[5100, 8788]`, keeping the
   project-root command-line check so only this project's processes are killed.
2. Keep the graceful `SIGTERM` path and the existing skip behavior for
   commands that do not match.
3. On platforms without `lsof`, either implement an equivalent check or emit an
   explicit unsupported-platform message instead of a false all-clear.
4. Report which port is occupied when `--strictPort` fails, so the failure is
   self-explaining.

Until then, document the limitation rather than asserting cross-platform cleanup.
The recorded runs were on macOS; Linux is an intended target that still needs its own verification. The
`playwright.config.ts` Windows branch shows intent, but Windows was not
exercised and `stop-dev.mjs` remains Unix-dependent.

---

## 9. Seed and reset are destructive - read before running

`npm run seed` runs `tsx server/seed.ts`, which writes `[]` to
`data/runs.json`. That file is the local persisted run store: research runs,
receipts, purchase decisions, and settlement metadata for every run recorded on
that machine. Seeding **erases that history**. It does not touch the synthetic
source corpus.

**Rules:**

1. Never run `npm run seed` on a machine that holds run history somebody still
   needs. Ask first, and name the consequence: local run history and receipts
   will be permanently deleted.
2. Back up first if the data might matter:
   `cp data/runs.json "$verification_dir/runs.backup.json"` after creating the private temporary directory below. Do not stage that backup.
3. Do not delete the `data/` directory to "start clean"; the seed script
   creates the file it needs, and deleting the directory removes backups and
   anything else stored there.
4. `data/runs.json` is git-ignored, so this data is not recoverable from the
   repository.
5. Prefer the isolated alternative when you only need a clean slate for a test:
   point `RESEARCH_RUNS_FILE` at a unique temporary directory plus a not-yet-created JSON filename, as
   `tests/persistence.test.ts` already does, and leave the real store alone.

The per-run reset API is different from `npm run seed`: it marks the old run
read-only, preserves prior receipts, and creates a fresh run. Verify this
distinction; do not describe either operation as the other.

---

## 10. Five-person qualitative pilot (proposed, not run)

Target: at least five representative deep-research users, one session each,
observed. This is a small qualitative pilot, not statistical validation. No
participants have been recruited and no session has occurred.

**Session tasks (each recorded separately):**

1. Start a supported question with a spending cap.
2. Change sources, leave the step, and return without losing work.
3. Explain the difference between the cap and an actual charge.
4. Finish with open evidence only, making no purchase.
5. Review a paid article, then cancel the approval.
6. Explain an over-limit blocked source.
7. Approve a simulated purchase and find its citation and receipt. Testnet is optional and requires separate explicit authorization.
8. Recover from a stale quote or a network error.
9. Identify that a question is unsupported.
10. Repeat the critical steps keyboard-only, then again at a narrow width.

**Measurable criteria and fail gates:**

| Criterion | Target | Fail gate |
| --- | --- | --- |
| Identify the next action and set question, source scope, and cap | at least 4/5 within the first minute, unaided | 2 or more participants cannot, or need facilitator input |
| Complete basic setup unaided | at least 4/5 | 2 or more stalled |
| Correctly state the exact approval amount, remaining budget, and whether settlement is simulated or Testnet | 5/5 before confirming | any participant confirms without understanding the amount or the settlement mode |
| Back out, resume, or cancel without losing work | 5/5 | any silent data loss, or a stale or double charge path |
| Distinguish open, premium, fixture, and unavailable evidence | 5/5 | any participant believes paid means correct, or believes fixture settlement paid a real publisher |
| Keyboard-only completion of the critical path | 5/5 | focus lost, trapped, or invisible; a critical control unreachable |

Any critical purchase, scope, keyboard, or data-loss confusion is a release
blocker, not an observation to note and move past. Record findings and revise the
design; aesthetic preference is not evidence of usability.

**Session record template:**

```text
Participant:        P<n>  (role / research experience, one line)
Date / machine:     <date>, <OS>, <viewport>
Facilitator:        <name>
Prior exposure:     none / saw screenshots / used the app

Task  Next-action time (s)  Setup done unaided  Cap vs charge correct
1     ___                  Y / N               Y / N
2     ___                  Y / N               n/a
3     ___                  Y / N               Y / N
...
10    ___                  Y / N               n/a

Settlement mode stated correctly (5/5 required):  Y / N
Approval amount stated correctly (5/5 required): Y / N
Critical barrier encountered:                    none / <describe>
Quote (verbatim, one line):
Severity:      blocker / major / minor / preference
Status:        pass / fail / not run
```

---

## 11. Demo rehearsal (scheduled activity, not run)

Rehearsal is a timed, end-to-end run on the machine that will be used for the
demo, with fixture mode confirmed first. Do not rehearse on a machine that still
needs a paid key to look correct, and do not present a rehearsal as a live
settlement.

**Preconditions:**

1. `npm ci` completed on the demo machine.
2. `.env` present, with `LLM_PROVIDER=fixture` and `XRPL_MODE=fixture` for
   the deterministic path.
3. The fixture environment and isolated store from section 4 are exported;
   `npm run dev` is running with the client on 5100 and the API on 8788; stale
   processes cleared per section 8.
4. Browser at the demo viewport, zoom reset to 100%, and one clean capture
   directory ready.

**Rehearsal sequence:** launch, landing, supported question, sources, budget,
plan review, approve, research phases, protected preview, one purchase approval
with an exact quote, duplicate skip, over-ceiling block, answer with citations,
citation detail, receipt in Activity, reset, unsupported-question state.

**Results template - fill with pass, fail, or not run only:**

```text
Run date / machine:            <date>, <OS>, <node -v results>
Mode shown in status bar:      fixture / other: ____
Settlement label seen:         simulation / other: ____
Client port / API port:        5100 / 8788  (or: ____)

Step                          Result              Time (s)   Notes
Launch and landing            pass/fail/not run   __         ____
Question + sources            ...                 __         ____
Budget entry                  ...                 __         ____
Plan review + approval        ...                 __         ____
Research running to complete  ...                 __         ____
Protected preview (no body)   ...                 __         ____
Exact quote approval          ...                 __         ____
Duplicate skip                ...                 __         ____
Over-ceiling block            ...                 __         ____
Answer with citations         ...                 __         ____
Citation detail               ...                 __         ____
Receipt / ledger              ...                 __         ____
Reset behavior                ...                 __         ____
Unsupported question          ...                 __         ____

Total wall time: ___
Blockers:        none / <describe>
Follow-ups:      <owner, if any>
```

The E2E lane is blocked by UO-PF-01, so a rehearsal today demonstrates the app,
not a green test suite. Say so if asked.

---

## 12. Results log

Record each verification pass under `ui-overhaul/evidence/<work-id>/` and link it from STATUS.md. Use pass, fail, or not run verbatim; never leave a status
blank and never restate an unrun check as passing.

```text
Date       Machine + node    Lane                    Result              Evidence
2026-09-20 macOS, node 26.3.1  npm run typecheck    pass                tsc --noEmit, exit 0
2026-09-20 macOS, node 26.3.1  npm test             pass                19 tests / 3 files / 2.27 s
2026-09-20 macOS, node 26.3.1  npm run test:a11y    fail (harness)      webServer 30000 ms timeout, exit 1
2026-09-20 macOS, node 26.3.1  npm run test:e2e     not run             blocked by UO-PF-01
2026-09-20 macOS, node 26.3.1  visual review        not run             section 7
2026-09-20 macOS, node 26.3.1  five-person pilot    not run             section 10
2026-09-20 macOS, node 26.3.1  demo rehearsal       not run             section 11
```

---

## 13. Docs validation available now (no app required)

Because the browser lanes are blocked, the checks that can be automated today are
the fast static lane and the integrity of this runbook. The following verifies
that every path and script this document references still exists, so the runbook
cannot silently rot:

```bash
npm run typecheck && npm test          # fast lane, section 1

for p in package.json playwright.config.ts vite.config.ts vitest.config.ts \
         .env.example README.md docs/UX-REDESIGN-BRIEF-2026-09-20.md \
         scripts/stop-dev.mjs server/index.ts server/llm.ts server/seed.ts \
         src/App.tsx tests/e2e.spec.ts tests/a11y.spec.ts \
         tests/domain.test.ts tests/persistence.test.ts tests/research-plan.test.ts; do
  test -e "$p" || echo "MISSING: $p"
done

rg -n 'ports = \[5173, 5174, 8788\]' scripts/stop-dev.mjs   # UO-00 still open
rg -n '5173' playwright.config.ts                            # UO-PF-01 still open
```

If a search no longer matches, inspect the change and rerun the lane; absence
of the string alone does not prove the defect is repaired.

---

## 14. Scope of verification

This runbook verifies the overhaul; it is not evidence the overhaul has shipped.
Preserve the baseline observations, then append new run records with exact
commits. Finish independent engineering checks when pilot participants are
unavailable, and report the pilot as NOT RUN rather than fabricating results.
