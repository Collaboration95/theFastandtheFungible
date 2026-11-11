# Install and run ResearchAgent

Every way in, from no install at all to a full checkout. Everything here runs on
**XRPL Testnet or a labelled SIMULATED rail: no real value**. Models are fixtures
unless you add your own keys. The commands below install release v1.1.0 from
[GitHub Releases](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v1.1.0):
release · not yet on npm/PyPI/MCP Registry.

| You want to | Use | Needs |
|---|---|---|
| Click around with nothing installed | [Hosted sandbox](#in-your-browser) (13–19 Nov 2026) or the [recorded run](https://collaboration95.github.io/theFastandtheFungible/demo/) | a browser |
| See the whole money path once | [`try --testnet`](#one-line-no-clone) | Node ≥ 22.13 |
| Give Claude Code or Codex a research wallet | [MCP server](#mcp-claude-code-codex-claude-desktop) | Node ≥ 22.13 |
| Call it from your own code | [TypeScript or Python SDK](#sdks) | Node ≥ 22.13; Python ≥ 3.10 for the Python client |
| A desktop app | [Mac app](#mac-app) (unsigned) or the [zero-clone web app](#zero-clone-web-app) | macOS, or Node ≥ 22.13 |
| Sell your own notes | [Writers](#writers) | Node ≥ 22.13 |
| Hack on it | [From a clone](#from-a-clone) | Node ≥ 22.13, Make |

## In your browser

**Hosted sandbox, 13–19 Nov 2026:** <https://ra-front-651013803640.asia-southeast1.run.app>.
A shared XRPL Testnet sandbox with no real value: no account and no install. Every visitor
has a small per-question and daily cap; payments come from one pre-funded Testnet payer,
and each answer says whether its models were live or a labelled fixture fallback. Owner
controls (settings, keys, faucet, fault switches) are disabled there. How it is run:
[hosted-web.md](hosted-web.md).

**Recorded run, any time:** the [replay](https://collaboration95.github.io/theFastandtheFungible/demo/)
plays a recorded XRPL Testnet run in the real UI: a key published on the ledger, a broken
promise, a writer-signed refund and a second key reveal. No backend and no keys; the
browser re-checks the hashes itself. Tabs also replay a plain payment, a writer no-show
and the simulated cases.

## One line, no clone

Run the whole judge path and exit (Node ≥ 22.13):

```sh
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz try --testnet
```

`try` makes faucet wallets, asks the demo question with a S$2 cap, buys by key reveal,
catches a broken promise, gets a writer-signed refund, re-buys, anchors the answer on
the ledger and verifies every transaction read-only. It prints six Testnet links and
`RESULT PASS`. One cold run took <!--f:try_s-->84.2<!--/f--> s from an empty npm cache;
<!--f:try_misses-->2 of 4<!--/f--> cold runs overran the 90 s limit
([evidence](evidence/round4-j2/README.md)). If the faucet fails you get a labelled
SIMULATED run with its reason, never silence.

**Agent hires agent:** append `--hire` to the `try --testnet` line above (v1.1.0 and later), or run
`make try-hire OFFSET=1900` from a clone. One timeline across client
agent → ResearchAgent → writer, with royalties and change payments: [hire.md](hire.md).

## MCP: Claude Code, Codex, Claude Desktop

Fixture models and simulated payments:

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz
```

Real XRPL Testnet payments: faucet wallets are made on first use, key-reveal escrow and
an answer anchor are on, models and writers are fixtures. `ask_expert` returns explorer
links for create, finish, refund and anchor; `wallet_status` shows `rail: xrpl-testnet`.

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz --testnet
```

TEST-SGD, our Testnet IOU and a stand-in for RLUSD (no real value):

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz --testnet --iou
```

The first cold IOU call took 134.1 s, including 102.9 s of issuer and trust-line
provisioning; the cache is reused after that ([7 Nov review](evidence/r5-r/review-timings.txt)).

The environment caps authorize up to S$2 per question and S$5 per UTC day. Without them
the caps stay zero, and the calling model cannot raise them. Seven tools:
`search_expertise`, `ask_expert`, `get_run`, `pause_spending`, `wallet_status`,
`verify_answer`, `hire`. Codex, Claude Desktop (`ResearchAgent.mcpb` on each release),
app-hosted HTTP with per-agent allowances and Windows wrapping: [mcp.md](mcp.md).

From a checkout instead:

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- node --import "$PWD/node_modules/tsx/dist/loader.mjs" "$PWD/mcp/server.ts"
```

## Zero-clone web app

The full app on real Testnet, served on `127.0.0.1`. It prints the payer address, how
to point the SDK at it and a daily cap (S$5.00 on Testnet). Add `--open` to launch your
browser, `--iou` for TEST-SGD; drop `--testnet` for the labelled SIMULATED rail
([details](testnet.md#zero-clone-testnet-app-v110)).

```sh
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz app --testnet
```

## SDKs

```sh
npm i https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-sdk-1.1.0.tgz
pip install https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-1.1.0-py3-none-any.whl
```

Complete two-terminal **start engine → connect → ask → verify** quickstarts from an
empty folder: [TypeScript/Node](sdk.md#start-engine--connect--ask--verify) ·
[Python](sdk-python.md#start-engine--connect--ask--verify). They set operator caps, read
the private token file, and export and verify receipts. Use the printed **engine** URL,
not the UI port. Plain HTTP: [api/README.md](api/README.md).

## Mac app

Unsigned DMG: [Apple Silicon](https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/ResearchAgent-1.1.0-arm64.dmg)
or [Intel](https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/ResearchAgent-1.1.0-x64.dmg).
Drag it into Applications, then System Settings → Privacy & Security → Open Anyway
([signing notes](../desktop/SIGNING.md)). It starts offline with simulated payments,
keeps keys in the macOS Keychain, and shows a recovery screen instead of crashing.
[Guide](../desktop/README.md).

## Writers

Turn a Markdown folder into a searchable, payable writer. On Testnet this makes a
faucet wallet (key saved at mode 0600, never printed), a Testnet writer Credential and
key-reveal escrow; a cold `init` + `publish` took <!--f:writer_s-->33.9<!--/f--> s in one
measurement ([J3](evidence/round4-j3/README.md)). Zero clone (macOS, Linux, PowerShell):

<!-- BEGIN generated:writer-install -->
```sh
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz init my-notes
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz publish ./my-notes --testnet
```
<!-- END generated:writer-install -->

From a clone: `cp -R examples/writer-starter my-notes && npm run publish:site -- ./my-notes --rail simulated`
(or `--testnet`). Replace the generated SYNTHETIC templates with your own notes before
calling yourself a real writer, and keep the publisher running. Guide:
[publishing.md](publishing.md); posture: [COMPLIANCE.md](COMPLIANCE.md).

## Verify an exported answer

Export → Download receipts.json (in the app or the live sandbox), then:

```sh
pip install https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-1.1.0-py3-none-any.whl
researchagent verify receipts.json --ledger
```

Use v1.1.0 or later: v1.0.2 cannot recompute the answer commitment of newer exports and reports
`FAIL anchor binding` on them. Without Python, the same checks in TypeScript:

```sh
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz verify receipts.json --ledger
```

The Python verifier needs no Node and prints `PASS testnet N/N (read-only, s.altnet)`, `PASS audit anchor`
with the ledger number, and `RESULT PASS`. A refunded key reveal passes only when a
validated writer refund exists. A simulated export prints `Skipped audit anchor: simulated
run (no ledger)`; an export that claims an anchor, or a Testnet run without one, fails.
Checkout equivalent: `npm run verify:answer -- receipts.json --ledger`. Format:
[receipt-spec.md](receipt-spec.md).

## From a clone

Node ≥ 22.13 and Make. No keys needed.

```sh
git clone https://github.com/Collaboration95/theFastandtheFungible && cd theFastandtheFungible
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
```

Choose one (each stays running):

```sh
make run       # http://127.0.0.1:5100 · offline fixture · simulated payments
make testnet   # port 5100+OFFSET (default OFFSET=1800 → :6900) · fixture models · faucet wallets · XRP Testnet
```

Provisioning failures select a labelled SIMULATED fallback with a reason class. To call
the SDKs against `make testnet`, start it with a token and operator caps (otherwise the
token is random and the caps are zero). The UI is on port 5100+OFFSET and the API on
8788+OFFSET (default :6900 and :10588):
`RA_API_TOKEN=dev-token MCP_MAX_BUDGET_MINOR=200 MCP_DAILY_CAP_MINOR=500 make testnet`,
then `RA_URL=http://127.0.0.1:10588 RA_API_TOKEN=dev-token npx tsx examples/ask.ts`, or
the same variables with `python examples/python/ask.py` after
`pip install ./packages/sdk-python`. For offline `make run` (API :8788) use the same
variables without `RA_URL`.

Live providers: add keys from `.env.example` to your ignored `.env`, run `make doctor`,
then `make live`. Live model calls can incur provider fees; settlement uses XRPL Testnet
when a payer seed is configured and is otherwise labelled simulated. Every make target,
Docker and operation: [running.md](running.md). Codespaces: the repo has a default and
an XRPL Testnet devcontainer (`.devcontainer/testnet`).

## Platforms

Zero-clone `npx` lines work in macOS and Linux shells and Windows PowerShell. Clone
commands that use `make`, `export`, `$PWD` or `cp` need a POSIX shell and Make (Windows:
WSL). The DMG and Keychain steps are macOS only.
[PowerShell, Linux and prerequisites](running.md#platforms-and-prerequisites).
