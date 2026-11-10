# Running ResearchAgent

The README has the fast path (`make setup && make run`). This page has the rest.

## Make targets

| Target | What it does |
|---|---|
| `make setup` | `npm ci` and create `.env` from `.env.example` |
| `make run` | Offline fixture demo (no keys) |
| `make live` | Live demo: DeepSeek, decision model, XRPL Testnet, Langfuse |
| `make doctor` | Node, deps, `.env` drift, ports, provider keys |
| `make keys` | One real DeepSeek, Clef and OpenAI Decisions call; shows latency |
| `make preflight` | Stage check before the slot: a live decision round, quota, leftover trust and runs, XRPL |
| `make fault` | Fixture demo with the "fail next delivery" switch |
| `make corpus` / `make embeddings` | (live) Generate and embed the writer corpus |
| `make smoke` | (live, spends calls) UC1–UC3 end to end on port offset 300; `ARGS="--only UC2"` or `"--probe"` |
| `make reset` | Stop the demo; wipe `data/*.db` and generated reports |
| `make check` | Lint, typecheck and unit tests (pre-commit and CI) |
| `make verify` | `check`, serial browser tests and a build |
| `make` | List every target |

To run a second checkout beside a running demo, shift every port: `make run OFFSET=100` serves 5200/8888/8890.


## Using the demo

One screen holds the run: steps on the left, the answer in the middle, and budget, purchases and decisions on the right. A run finishes faster than anyone can follow, so the screen replays its trace at stage pace and labels the replay.

| Key or URL | Effect |
|---|---|
| `.` | Presenter menu: pace, skip replay, skip clarifying questions, reset writer reputation, fail-next-delivery (under `make fault`) |
| `W` | Show work: raw trace, wire, full policy table, receipts |
| `?pace=real` | Skip the replay and show the true speed |
| `?run=<id>` | Reopen a past run |

With a S$0 budget, the agent builds a would-buy table and spends nothing. When Chromium is unavailable, the report endpoint returns labelled printable HTML instead of a PDF.

The corpus has 8 fictional writers and 83 synthetic articles (20 free, 63 paid), served by one local publisher host. `tests/scenarios` runs the three demo use cases end to end.


## Docker (venue laptop)

Three Alpine containers (web · api · publisher), no Node needed on the host. Images are built from one commit with `git archive`, so `.env` and `node_modules` never enter the build context.

```sh
make docker-build            # or scripts/docker-build.sh <commit>
make docker-run              # fixture demo on http://127.0.0.1:5100
make docker-live             # live providers, keys read from .env at runtime
TAG=<sha> make docker-live   # a specific commit's images
make docker-logs
make docker-down             # V=1 also wipes the ledger and report volumes
```

Only the web port is published, on 127.0.0.1. `WEB_PORT=5200` (or `OFFSET=100`) runs it beside a host demo.

The 10 Oct live demo ran on Google Cloud Run. That deploy (`make cloudrun`, `docker/cloudrun/`) was removed after the talk and the Google Cloud project was shut down. The last commit that has it is `ce77f59`.


## Publish the explainers site

`site/` on main owns the published pages and brand assets. From a clean,
up-to-date main checkout run `python3 scripts/site-publish.py`; it fetches
`gh-pages`, checks for conflicting edits, copies the site into a temporary
worktree, commits and pushes. It leaves branch-only files and `evolution/data.js`
untouched, including the evolution refresh tools. Reconcile any reported conflict
before retrying. Removed source files are not deleted from the deploy branch.
Slides and notes reserve room for the shared header while retaining presentation controls.

## Retained history and response bounds

Operational startup/recovery/drain select run IDs in SQLite; they do not hydrate historical snapshots. Metrics remain an all-run O(n) response. SSE snapshots are throttled to 4/s, with initial and terminal snapshots immediate. A stalled stream or snapshot exceeding 256 KiB is disconnected; resynchronize with GET of the existing run. Publisher delivery/free bodies are limited to 2 MiB, and registry/search/challenge bodies to 256 KiB, including chunked responses. Limits are currently fixed constants.

Durable signed obligations retain their reservations during Stop/recovery. Late refund candidates are pending until exact ledger verification succeeds; confirmed refunds never replenish gross budget authority. See `docs/evidence/round2-a` for local synthetic evidence and limitations.

### Compatible engine profiles

See [BYOK engine configuration](byok.md) for `LLM_PROVIDER=openai-compatible`,
`DECISION_PROVIDER=compatible`, the local bearer-protected connection test,
reviewed endpoint limits, unknown costs, and `ACTIVE_WORK_LIMIT` (default 4).
One inference key works with explicitly SIMULATED payments; Testnet still needs
its separate wallet. The UNCALIBRATED generic judge buys nothing.

## Exact local release artifacts

`make release-artifacts` builds the SDK tgz, Python wheel/sdist and MCPB once,
then tests the installed bytes with fixture models and simulated settlement.
`dist/release/manifest.json` records independent versions, source SHA, runtimes,
bytes and SHA-256; `consumer-results.json` records acceptance separately.
The npm consumer installs declared dependencies normally in a temporary project;
the wheel uses a new venv; MCP starts from the extracted MCPB. Each asks twice
with the same key and checks delivered citations, one receipt/intent and caps.
No registry publication is performed. Python offline verification is independent of Node and works from the wheel alone;
see [independent verifier evidence](evidence/round2-k/README.md). Minimum supported Node is 22.13 and Python
3.10; hosted artifact acceptance uses those runtimes.

See [release artifact evidence](evidence/round2-d/README.md).

## Platforms and prerequisites

| Entry point | Requirements and limits |
|---|---|
| Zero-clone app/MCP and TS SDK | Node ≥22.13/npm, macOS/Linux/Windows PowerShell command variants in SDK/MCP guides; actual native Windows/Linux acceptance not yet measured |
| Python client / offline verifier | Python ≥3.10; no Node for offline verification; the local research engine still needs Node |
| Source `make` / shell scripts / Docker recipes | POSIX shell, Git and Make (Windows: WSL); Docker daemon for Docker targets |
| Native DMG, Keychain, signing, desktop smoke | macOS only; see desktop/README.md prerequisites; no native Windows/Linux desktop package |

For Linux `app --open`, install `xdg-utils` if `xdg-open` is absent, or paste the printed UI URL into a browser. A headless shell does not need an opener. Do not confuse the UI URL with the printed bearer-protected SDK engine URL.

Headless source install (macOS/Linux/WSL): `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`. PowerShell: `$env:ELECTRON_SKIP_BINARY_DOWNLOAD="1"; npm ci`. This skips Electron's large GUI download, not app dependencies; desktop build uses its verified downloader separately. `npm ci`, `npm run build`, `npm run build:sdk` are shell-neutral; `make` recipes require POSIX. SDK release packaging additionally uses Python ≥3.10 with venv/pip/build; Linux may need its distribution's python3-venv package. The maintainer release-artifacts script is POSIX (uses bin/python); Windows consumers use the published wheel/tgz or WSL for source packaging.

Fresh-install warning ledger (audit, 10 Nov, Node 26/npm 11; counts are historical, not a current security assessment):

- npm reported 31 vulnerabilities including three critical entries in dev test tooling (Vitest/coverage/tinypool). Dependency/security ownership is separate; no dependencies upgraded here. Keep `npm audit` output visible; do not use `audit fix --force` without compatibility work.
- Deprecated transitive packaging/test dependencies and allowScripts notices for electron-winstaller/protobufjs do not mean installation failed. Do not blindly enable scripts. A source archive can print Husky's `.git can't be found`; use a real clone for development/gates.
- Node's experimental SQLite warning is expected on supported runtimes. Vite can report removed PURE annotations in zod; npm/pip can show upgrade notices. Preserve real failures and exit codes; these notices are not test evidence.
- electron-builder warns about missing author metadata, duplicate dependencies, disabled asar and skipped signing. Asar is deliberately off for engine cwd; unsigned builds are labelled. Follow desktop/SIGNING.md for explicit signing.

Codespaces is a separate cloud path, not native Linux acceptance. If a forwarded tab is blank, inspect `/tmp/researchagent-fixture.log` (fixture) or `/tmp/researchagent-testnet.log` (Testnet), check the startup exit/error and the API `/api/health` on the forwarded offset, then rerun the devcontainer startup command. See the exact log paths in `.devcontainer/*/devcontainer.json`; do not infer readiness from an open forwarded tab.
