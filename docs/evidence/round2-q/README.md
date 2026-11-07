# Lane Q: first run, 4 November 2026

The three examples now use RA_URL (default http://127.0.0.1:8788), budget, and the same analyst question. The TypeScript example buys one S$0.90 article and prints its simulated receipt and structural contribution; Python reports 2 of 2 requested facts answered. Codespaces opens the fixture UI automatically, with no keys or .env creation. **Not run in a real Codespace.**

## Timed judge path

Historical reproduction only: run the retired generator in the complete `b0a67ffa` tree; see [pin, runtime and recovery](../../historical-tools.md). All generator commands on this page use that tree.

Before: mock-judge report section 0 at f3902008, warm npm cache, same Mac. After: clean temporary clone with the staged changes, Node 22.13.1, Python 3.14.7, warm npm cache, ephemeral UI/API/publisher ports. These are observations with different runtimes and machine load, not a controlled speed benchmark. `retime.mjs` reproduces the install/demo/example steps; `timings.json` records the result. Normal `make run` uses UI 5100, API 8788, publisher 8790; tests never bind these ports.

| Step | Before | After | Result |
|---|---:|---:|---|
| npm ci | 4.00 s | 6.388 s | success; Electron binary skipped |
| make run → ready | 1.70 s | 1.030 s | fixture, SIMULATED SGD |
| examples/ask.ts | 0.95 s | 0.558 s | one receipt, S$0.90; paid passage retained in contribution |
| fresh Python venv | not timed | 1.767 s | isolated environment |
| pip install SDK | 2.60 s | 1.537 s | local source install |
| Python example | 0.63 s | 0.326 s | one receipt, 2 of 2 facts |
| sdk-quickstart | not timed | 0.412 s | same question, URL and budget argument |
| MCP initialize + tools/list | 0.83 s | 1.058 s | 7 tools (local Node 26.3.1 run) |
| make release-artifacts | 16.8 s | 17.11 s | 3/3 installed consumers pass (Node 26.3.1) |
| demo production build | 0.8 s | 1.15 s | fixture replay build (Node 26.3.1) |

The sequential install → first paid TypeScript answer is 7.976 s (before: 6.65 s to an answer with no purchase). Fresh venv through Python answer adds 3.630 s. A second clean Node 22 clone validated the actual devcontainer launcher: npm ci 5.562 s, ready 1.748 s, TypeScript 0.701 s, Python 0.329 s; see `launcher-timings.json` and run `Q_CODESPACES=1 node docs/evidence/round2-q/retime.mjs`. This does not measure network clone time or Codespaces provisioning. The under-three-minute cold Codespace target remains unmeasured. No live ledger lookup, Testnet, providers, funds, or cloud resources were used. Replay interaction timing and the independent no-Node verifier timing from section 0 were not remeasured; the wheel consumer verifies its exported receipt offline.

## Relevance and coverage

Punctuation normalisation applies NFKC, converts dash variants to word boundaries, strips possessives, and handles straight/curly quotes identically in fixture planning, requirement entities and keyword index/query text. Signed bodies and delivered passages remain byte-identical.

The keyword floor requires at least half of the non-stopword query terms in a document, and every explicitly requested uppercase acronym. Unknown terms stay in the denominator. It applies before the top-k cut and before a publisher can inflate its claimed relevance; hybrid vector ranking is unchanged. This corpus-independent fraction avoids the publisher-size and query-length sensitivity of an absolute BM25 floor. Calibration/acceptance uses all **83 corpus titles**, six near-miss variants (dash/quotes/possessives, BoJ yields, Penang electricity), and four unrelated topics (RLUSD trust lines, Kubernetes scheduling, CRISPR, sourdough). All title lookups and near misses survive; all unrelated controls abstain. No frozen benchmark question was used to choose the floor. This remains a lexical fixture safeguard, not a semantic relevance guarantee for arbitrary prose.

An empty result says **“No listed writer covers this; nothing bought”**, with zero claims, citations, receipts and spend. The engine regression tests check this through the SDK, including dash variants and a paid structural contribution.

The original Python requirement combined pricing and margins into one fact. Raw token overlap failed on pricing/price and margins/margin; one supporting passage alone could not express both measures. The fixture matcher now handles those word forms, requires quantitative pricing and margin evidence for the combined request, and can combine separately cited passages. Tests reject a filing that withholds figures, a price-only answer, and an absent dividend measure. Answer selection retains passages for each clarified angle. A phrase-overlap bonus preserves direct requested statements (such as a board vote) over commentary after retrieval changes the evidence pool. This fixed the Q07 retention regression without changing its bank label or assertion.

The old generic benefit question can still buy the cheap hype article before the useful analyst article (S$1 gross); coverage now becomes 1 of 1 after the evidence is cited. The shared first-run question explicitly asks for the analyst outlook, buys the useful S$0.90 article once, and reports 2 of 2. Structural contribution use does not claim independently assessed semantic value; purchase waste has not been relabelled as useful.

## Goldens and published numbers

`frozen-pre-first-run.json` preserves the previous general inputs. `frozen.json` is re-frozen as v9-first-run; publisher search sources are now included in the input hash. `frozen-first-run-bank-v1.json` pins the changed v1 coverage snapshots while retaining the exact bank/prose comparisons. The search evaluator mirrors production normalisation and floor. Scenario goldens change because UC4's renewable-power article is found in the first search (3 of 3 free immediately), and the UC2 audit has two evidence states rather than an unrelated free follow-up state. Plan goldens split dash compounds. Python and release-consumer smoke inputs use the same analyst question as the examples; their one-receipt, idempotency, grant, citation and cap assertions remain.

The new fixture result is in `fixture-scorecard.json` (base SHA plus dirty working changes, not an assertion that the base commit contained them). No live eval was run. General fixture inputs changed, so this is a new baseline, not an improvement claim against a prior frozen set. The historical LIVE fresh benchmark, `latest.json`, historical history rows, and all published README numbers remain unchanged; one new fixture baseline row is appended so the v9 regression check has a matching baseline. The README scorecard is therefore still the dated historical run; no headline was raised or replaced by fixture numbers.

## Devcontainer validation and checks

The config selects the official Node 22 Bookworm devcontainer image, skips Electron download, runs npm ci and launches an equivalent fixture engine plus Vite in the background. The devcontainer-only launcher retains the exact derived Codespaces HTTPS origin/hostname, which the normal make run localhost launcher overwrites; wildcard hosts/origins are never allowed, and Vite env-file loading is disabled. It forwards only UI 5100 with openBrowser. Explicit simulated rail, keyword search and disabled telemetry accompany fixture providers; UI and receipts label the simulation.

Validated JSON against the official devcontainers base and VS Code Codespaces JSON schemas with Ajv 2019 (schemas read using authenticated gh). Docker CLI exists but its daemon is unavailable. The same npm ci and make run commands and all three examples passed in a clean temporary clone, including a second run under Node 22.13.1. A local HTTP regression test supplies the actual forwarded Host and HTTPS Origin headers, admits a fixture question through the token-injecting proxy, and rejects other hosts/origins. This does not validate Linux image build, real port forwarding or browser auto-open in Codespaces.

Required: npm run check:fast, python3 -m pytest packages/sdk-python, npm run hygiene. Additional: make release-artifacts (3/3 clean installed consumers), npm run build:demo, npm run readme:check; all fixture/simulated. The browser SSE recovery test now explicitly injects a >256 KiB fixture event into its isolated ledger, preserving the existing size assertion independently of corpus ranking. No gate or leak threshold is loosened. Exact snapshot/evidence-count changes are explained above.
