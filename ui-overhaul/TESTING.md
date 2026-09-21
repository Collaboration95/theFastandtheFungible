# UI overhaul testing, visual QA, and demo verification runbook

Portable runbook for verifying the ResearchAgent UI overhaul on any machine.
It records what the current repository actually does, what is verified, what is
broken, and what must be checked by a human.

This is the implementation and verification runbook. See [README.md](README.md)
for the package map and [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for
work order. Historical baseline observations are labelled as historical; the
current results are recorded in [STATUS.md](STATUS.md). UO-PF-01 and UO-PF-02
below are preflight finding labels within **UO-00**, not separate backlog items.

**Time box.** The bounded smoke lane in section 4 is designed to finish in about
5 minutes. The full lane (E2E + accessibility + visual + demo rehearsal) is
longer and must be scheduled, not squeezed.

**No guarantee of zero bugs.** Nothing here promises a defect-free build. Every
result in this document has a status of pass, fail, or not run, and "not run" is
not evidence of correctness.

---

## 0. Preflight finding and UO-00 resolution

**UO-PF-01 (resolved by UO-00): Playwright had been configured for the wrong browser port.**

The historical defect was that `playwright.config.ts` used 5173 while the dev
client listens on **5100** (`package.json` -> `dev:client` -> `vite --host
0.0.0.0 --port 5100 --strictPort`, matching `vite.config.ts`). The repaired
config now centralizes `clientUrl = 'http://localhost:5100'` and uses it for
both `use.baseURL` and `webServer.url`; the API remains on 8788.

**Historical result before UO-00 (2026-09-20, macOS, Node v26.3.1, npm 11.16.0):**

```bash
npx playwright test tests/a11y.spec.ts --reporter=line
# Error: Timed out waiting 30000ms from config.webServer.
# exit code 1
```

Playwright started the `webServer` command, then polled `http://localhost:5173`
until the 30 s timeout. The app is up on 5100 the entire time, so the failure
happened during harness startup. **No test body executed.**

Those consequences applied only before UO-00:

1. `npm run test:e2e` and `npm run test:a11y` could not pass on that revision.
2. There was **no passing E2E or accessibility evidence** for that repository
   state, and none could be claimed from that configuration.
3. The five Playwright specs in `tests/e2e.spec.ts` and the single spec in
   `tests/a11y.spec.ts` are unexecuted code, not evidence.
4. Any local workaround that edits `tests/` or relaxes assertions to make the
   command exit zero remains out of scope and forbidden.

**UO-00 repair evidence (2026-09-20, Windows, Node v24.19.0, npm 11.17.0):**

- `playwright.config.ts` targets 5100 for both the browser base URL and server
  readiness URL.
- `scripts/stop-dev.mjs` inspects `[5100, 8788]`, keeps project-root command-line
  matching and SIGTERM shutdown, and uses Windows `netstat.exe`/PowerShell
  process inspection in addition to Unix `lsof`/`ps`. Missing inspection tools
  produce an explicit warning and never claim an occupied port is clear.
- `npm run test:e2e` reached the app and executed all six discovered specs: 3
  passed and 3 failed on existing product assertions (see the current status
  table below). This is no longer a harness-timeout result.
- `npm run test:a11y` reached the app and passed its axe scan (1 test).

The repaired shape is:

```ts
const clientUrl = 'http://localhost:5100'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 20_000,
  use: { baseURL: clientUrl, headless: true },
  webServer: {
    command: fixtureWebServerCommand,
    url: clientUrl,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
```

Acceptance for UO-00 is met for harness reachability. The current full browser
lane is recorded separately below; historical assertion failures are retained
as baseline context and are not presented as current failures.

### UO-PF-02: how the auto-started servers actually behave

`playwright.config.ts` auto-starts servers. Documented exactly as configured:

| Fact | Value |
| --- | --- |
| Command run by `webServer` | `XRPL_MODE=fixture LLM_PROVIDER=fixture npm run dev` |
| Windows branch in config | `set "XRPL_MODE=fixture" && set "LLM_PROVIDER=fixture" && npm run dev` |
| What `npm run dev` does | runs `dev:stop`, then concurrently `dev:client` + `dev:server` |
| Client port | 5100 (`--strictPort`) |
| API port | 8788 |
| Ready URL polled by Playwright | 5100, the Vite client URL (UO-PF-01 resolved) |
| `reuseExistingServer` | `false` |

Because `reuseExistingServer` is `false`, a dev server you already started by
hand does **not** satisfy the harness. Playwright always launches its own, and
`--strictPort` means an occupied 5100 fails the launch rather than falling back
to another port. `npm run dev` therefore depends on `dev:stop` succeeding
first - see UO-00 in section 8.

---

## 1. Historical baseline and current status

The original UO-00 baseline below is retained for context. It is not current
release evidence; use the results log and STATUS.md for the latest run.

| Lane | Command | Status | Evidence |
| --- | --- | --- | --- |
| Install | `npm ci` | **pass** | lockfile install completed; npm reported 2 moderate audit findings |
| Fast checks | `npm run check:fast` | **pass** | typecheck + 22 Vitest tests, 4 files |
| Verify | `npm run verify` | **pass** | typecheck + 22 Vitest tests + Vite production build |
| E2E | `npm run test:e2e` | **pass** | 17 tests passed; isolated `.playwright/runs.json` store and one worker |
| Accessibility | `npm run test:a11y` | **pass** | 1 test; no serious or critical axe violations |
| Build | `npm run build` | **pass (via verify)** | Vite production build completed |
| Visual / screenshot review | section 7 | **not run** | requires manual capture |
| Five-person pilot | section 10 | **not run** | no participants |
| Demo rehearsal | section 11 | **not run** | scheduled activity |

The fast and verify lanes cover the domain ranking/clustering contract, the
research-plan artifact contract, and local persistence including restart, reset,
and stale or missing quote approval. The current E2E lane passes its 17-test
fixture suite, including restricted-scope answers, review-draft reload/resume,
and keyboard tab focus. Automated results do not represent the human pilot or
demo rehearsal.

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
| 4173 | Vite preview default | Vite default; API proxy parity not verified in this audit |

`vite.config.ts` proxies `/api` to `http://localhost:8788`, so the API must
be running for any client call to succeed. `npm run preview` is **not** verified
as a fixture-parity environment in this audit; do not present preview output as
equivalent evidence to a dev-server run.

**Portability notes.** The runner and cleanup script now have explicit Windows
branches. Unix uses `lsof`/`ps`; Windows uses `netstat.exe` and PowerShell
process inspection, with warnings and no termination when required inspection
tools are unavailable (section 8).

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
environment settings and a unique temp directory.

```bash
# --- Fast lane (target: under 5 minutes, safe on any machine) -------------
npm ci                                             # once per machine, lockfile-exact
npm run typecheck                                  # tsc --noEmit
npm test                                           # vitest run, unit/API contract

# --- Full static gate -----------------------------------------------------
npm run check:fast                                 # typecheck + unit
npm run verify                                     # typecheck + unit + build

# --- Browser lanes (fixture mode, client 5100 / API 8788) ------------------
npx playwright install chromium                    # first run on a machine
npm run test:e2e                                   # product assertions recorded in section 1
npm run test:a11y                                  # axe result recorded in section 1

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

**Unit / API (`npm test`, Vitest, 22 tests).** `vitest.config.ts` collects
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
- `tests/dossier-validation.test.ts` (2 tests): relational source/span binding;
  a span owned by another source is rejected.

These tests prove server-side contracts. They do **not** render React, do not
exercise the browser, do not test layout, and do not prove the app is usable.

**E2E (`npm run test:e2e`).** The Playwright suite covers the guided setup,
unsupported scope, open-only answer, exact purchase review, protected content,
mutually exclusive tabs, responsive workbench, citation span inspection, and
pause/resume/stop/reload behavior. It runs serially against an isolated
`.playwright/runs.json` store in fixture mode; it must not mutate `data/runs.json`.

**Accessibility (`npm run test:a11y`).** One test in `tests/a11y.spec.ts`
runs `@axe-core/playwright` against `/` and fails on `serious` or
`critical` violations. Even once UO-PF-01 is fixed, this is a single automated
scan of a single route. It cannot detect focus order, dialog focus trapping,
Escape behavior, focus restoration, keyboard-only completion, live-region
quality, or 200% zoom and reflow problems. Those remain manual obligations in
sections 6 and 7.

---

## 6. Regression matrix

Status legend: **pass** = executed here with evidence; **blocked** = a harness
defect prevents execution; **not run** = intentionally unexecuted;
**manual** = human verification required.

| # | Area | Expected behavior | Current automated coverage | Status now |
| --- | --- | --- | --- | --- |
| R1 | Source truthfulness | An unsupported or arbitrary question must not be answered with unrelated data-centre fixture evidence; it must produce a truthful unsupported-scope state | `tests/e2e.spec.ts` | **pass** |
| R2 | Open-only answer | An approved run with usable open evidence can produce a cited answer with **no purchase** | `tests/e2e.spec.ts` | **pass** |
| R3 | Exact quote approval | Purchase binds to the exact quote; stale, missing, or mismatched approval is rejected without spending or unlocking | `tests/persistence.test.ts`, `tests/uo-07-10.spec.ts` | **pass** server + browser review |
| R4 | No duplicate charge | A retry or repeat submit cannot double-settle or unlock twice; outcome reconciliation precedes retry | `tests/persistence.test.ts`; UI recovery path | **partial** — duplicate live-outcome rehearsal remains not run |
| R5 | Citations | Claims resolve only to accessible source and evidence-span IDs; protected spans never render before purchase | `tests/dossier-validation.test.ts`, `tests/e2e.spec.ts` | **pass** |
| R6 | Reload / back / draft | Reload restores last server state or explains an unavailable draft; Back preserves setup values; no silent data loss; new research does not mutate completed runs | `tests/persistence.test.ts`, `tests/guided-setup.spec.ts`, `tests/uo-07-10.spec.ts` | **pass** for covered paths |
| R7 | Accessibility | Keyboard-only completion of the full path; dialogs trap focus, close on Escape, restore focus to the invoking control; live regions announce material changes only | `tests/a11y.spec.ts`, `tests/uo-07-10.spec.ts` | **pass automated; manual screen-reader review not run** |
| R8 | Long strings and zoom | Long source names, prices, and identifiers wrap without clipping; 200% text zoom and 320 px reflow produce no horizontal overflow and hide no critical action | `tests/guided-setup.spec.ts`, `tests/uo-07-10.spec.ts` | **pass automated focused lane** |
| R9 | Protected content | Premium body text is absent before the matching verified purchase and present after | `tests/e2e.spec.ts` | **pass** |
| R10 | Budget authority | Cap, spent, and remaining stay visible and correct in XRP with a labelled SGD approximation; a cap is never presented as a charge | `tests/e2e.spec.ts`, `tests/uo-07-10.spec.ts` | **pass** |
| R11 | Fixture honesty | Fixture settlement is labelled as simulation; XRP Testnet and synthetic corpus remain separate, truthful facts | `tests/e2e.spec.ts`, server runtime contract | **pass fixture path; live Testnet validation not run** |

Rows R1 and R2 were pre-existing product defects recorded in the redesign brief;
the current focused browser lane now covers their repaired behavior.

### Remaining tests and human gates

The following are remaining activities. Do not report them as automated coverage.

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
UO-00 repairs both the stale-port list and the Windows process-discovery gap.

**Repair 1 - inspect the ports that are actually used.** The script now uses
`const ports = [5100, 8788]`. Because `dev:client` runs with `--strictPort`, a
second `npm run dev` still fails safely if an unrelated listener owns 5100, but
a project-owned stale Vite process is now eligible for safe cleanup.

**Repair 2 - platform-aware inspection.** Unix hosts use `lsof` plus `ps`;
Windows hosts use `netstat.exe` plus PowerShell `Get-CimInstance`. Every
candidate is still checked against the normalized project-root command line
before SIGTERM. If inspection itself is unavailable or a process command line
cannot be read, the script emits an explicit warning, leaves that process
untouched, and does not claim the port is clear.

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

On the UO-00 Windows verification run, `npm run dev:stop` completed with
`No ResearchAgent dev processes found.` No disposable project-owned listener
was created, so graceful termination itself was not exercised; unrelated
listeners were not touched.

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

The E2E lane is now reachable after UO-00. The deterministic browser lane and
the focused UO-07–UO-10 workspace lane are current evidence; the demo rehearsal
and qualitative pilot remain separate activities and are not implied by these
automated results.

### UO-07–UO-10 implementation evidence (2026-09-20, Windows)

The centered workspace was reviewed at 360, 390, 768, 1024, and 1440 CSS px.
The focused lane also applied reduced-motion emulation and 200% body zoom.
Screenshots are stored under `evidence/UO-10/`:

- `workspace-360.png`, `workspace-390.png`, `workspace-768.png`,
  `workspace-1024.png`, and `workspace-1440.png` — answer, source rows, tabs,
  and persistent budget strip.
- `workspace-200-percent.png` — readable answer and fixture truth labels with
  reduced-motion emulation.

The focused browser checks in `tests/uo-07-10.spec.ts` cover centered layout and
absence of the old sidebar, no document horizontal overflow at each width,
source-action visibility, cancel side-effect safety, dialog focus containment,
Escape close and focus restoration, reduced motion, and 200% zoom. The five
person pilot is **NOT RUN**; no participant findings are claimed.

---

## 12. Results log

Record each verification pass under `ui-overhaul/evidence/<work-id>/` and link it from STATUS.md. Use pass, fail, or not run verbatim; never leave a status
blank and never restate an unrun check as passing.

```text
Date       Machine + node       Lane                    Result              Evidence
2026-09-20 Windows, node 24.19.0  npm ci               pass                lockfile install; 2 moderate audit findings
2026-09-20 Windows, node 24.19.0  npm run check:fast   pass                typecheck + 22 tests / 4 files (current repair)
2026-09-20 Windows, node 24.19.0  npm run verify       pass                 typecheck + 22 tests + production build
2026-09-20 Windows, node 24.19.0  npm run test:e2e     pass                 17 tests; isolated `.playwright/runs.json`, one worker
2026-09-20 Windows, node 24.19.0  npm run test:a11y   pass                1 axe scan passed
2026-09-20 Windows, node 24.19.0  dev:stop             pass                no project-owned listeners found; no kill path exercised
2026-09-20 Windows, node 24.19.0  visual review        not run             section 7
2026-09-20 Windows, node 24.19.0  five-person pilot    not run             section 10
2026-09-20 Windows, node 24.19.0  demo rehearsal       not run             section 11
2026-09-20 Windows, node 24.19.0  UO-07–UO-10 focused E2E  pass             `tests/uo-07-10.spec.ts`; 4 tests; 6 responsive screenshots + 200% zoom
2026-09-20 Windows, node 24.19.0  five-person pilot    not run             no participants; proposal only
```

---

## 13. Docs validation available now (no app required)

The checks that can be automated today include the fast static lane, browser
reachability, and the integrity of this runbook. The following verifies
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

rg -n "ports = \[5100, 8788\]" scripts/stop-dev.mjs
rg -n "clientUrl = 'http://localhost:5100'" playwright.config.ts
npm run test:e2e                                            # app reaches 5100; product failures remain explicit
npm run test:a11y                                           # app reaches 5100; axe result is recorded above
```

If a search no longer matches, inspect the change and rerun the lane; absence
of the string alone does not prove the defect is repaired.

---

## 14. Scope of verification

This runbook verifies the overhaul; it is not evidence the overhaul has shipped.
Preserve the baseline observations, then append new run records with exact
commits. Finish independent engineering checks when pilot participants are
unavailable, and report the pilot as NOT RUN rather than fabricating results.
