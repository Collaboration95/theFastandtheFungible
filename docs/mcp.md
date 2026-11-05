# Use ResearchAgent from Claude Code, Codex or any MCP client

[Release candidate v1.0.0-rc.2](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v1.0.0-rc.2): release candidate · not yet on npm/PyPI/MCP Registry. Install without cloning.

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.0-rc.2/researchagent-mcp-1.0.0-rc.2.tgz
```


The full reference for the local stdio MCP server (`mcp/server.ts`, shipped in #255). The README has the short version.

After `npm ci` in this checkout, add the local stdio server with one command.
These examples authorize **S$2 per question and S$5 per UTC day** in simulated
fixture mode. Set both caps to `0` for free research / would-buy only (the default).
The operator sets caps in configuration; a calling model's `budget_sgd` is only a
request and cannot raise them. No per-purchase approval is needed.

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- node --import "$PWD/node_modules/tsx/dist/loader.mjs" "$PWD/mcp/server.ts"
```

Or for Codex:

```sh
codex mcp add researchagent --env MCP_MAX_BUDGET_MINOR=200 --env MCP_DAILY_CAP_MINOR=500 -- node --import "$PWD/node_modules/tsx/dist/loader.mjs" "$PWD/mcp/server.ts"
```

The equivalent Codex `~/.codex/config.toml` entry (replace `/absolute/checkout`):

```toml
[mcp_servers.researchagent]
command = "node"
args = ["--import", "/absolute/checkout/node_modules/tsx/dist/loader.mjs", "/absolute/checkout/mcp/server.ts"]
tool_timeout_sec = 60

[mcp_servers.researchagent.env]
MCP_MAX_BUDGET_MINOR = "200"
MCP_DAILY_CAP_MINOR = "500"
```

Configuration fields follow the [official OpenAI MCP documentation](https://developers.openai.com/codex/mcp).
Start a fresh client session, then ask:

> Search the writers, then ask_expert: What's the analyst outlook on Kestrel
> Semiconductor's latest deal with TSMC (pricing & margins)? Request budget_sgd=2,
> idempotency_key="my-uc2". Show citations, purchases and all mode labels.

The question includes UC2's recorded clarification inline: MCP deliberately never
pauses for clarification. `search_expertise({query,k?})` returns only public
metadata. `ask_expert({question,budget_sgd,idempotency_key?})` returns an answer,
exact delivered citation passages with URLs, verified/refunded purchase statuses,
and actual Testnet transaction/explorer links when present (null for simulation).
`get_run({run_id})` reads an existing MCP run; `wallet_status()` shows public payer
address, rail, gross spend, reservations and caps, never credentials.

Run `make mcp` directly, or `make mcp-live` for live providers. Fixture mode forces
fixture research/decisions, keyword search and simulated settlement, even if the
shell has live settings. Every result labels its mode; the writer corpus is
fictional. Local boot uses two ephemeral loopback ports with isolated ledgers in
`data/mcp/`; set `RA_DATA_DIR` to persist them elsewhere. Keep that directory to
preserve idempotency and daily accounting. Separate data directories are separate
allowances; this is an operator boundary, not a wallet-wide cap.

Set `RA_BACKEND_URL` to an existing ResearchAgent API for HTTP-backed tools. That
API **must include the MCP routes from #255** and have its own human caps set at
startup. Client-side cap variables do not override a remote API's caps. The API
is a trusted operator service; protect network access when hosting it remotely.
These caps cover MCP runs, not web UI runs. No cloud resource is created by MCP.

Both caps default to zero. Budgets round down to the existing 5-cent step and
S$5 engine maximum. Each active run reserves its remaining possible charge;
uncertain settlements retain the reservation across shutdown/restart and UTC
midnight. Gross charges are attributed to their receipt's UTC settlement day;
refunds do not replenish authority. A key maps atomically to one run in the
engine's `app.db`; reuse with a different question is rejected. Reuse with a new
requested budget returns the original run. Without a key, each call is a new
intent. `ask_expert` waits up to 45 seconds, then returns the running id for
`get_run`; a timeout does not cancel a purchase or authorize a retry with a new key.

`RA_LIVE=1` enables live providers and, only with `XRPL_PAYER_SEED`, XRPL Testnet.
Provider credentials stay in the engine environment; tools cannot supply keys,
rail, provider, plan, article selection or higher caps. Live provider usage can
incur model fees separately from the article cap. `node scripts/mcp-demo.mjs`
uses a real authenticated Claude Code session with fixture engine providers,
only the four MCP tools, and simulated settlement; it saves a sanitized tool
transcript summary under `eval/mcp/` (or prints manual steps if Claude is absent).
A separate [Testnet MCP purchase proof](../eval/mcp/testnet-2026-11-03.md) records validated settlement and retry evidence.
Run `npx vitest run tests/engine.test.ts tests/mcp-policy.test.ts tests/mcp.e2e.test.ts`
for offline transport, isolation, cap and restart checks.


## One-click Claude Desktop extension

Build with `npm ci && npm run build:mcpb`, then open `dist/ResearchAgent.mcpb`
in Claude Desktop Settings → Extensions → Install extension (or open the release
asset). Node 22.13+ is required. Choose per-question and UTC daily caps in SGD
cents. Defaults are zero; fixture research and SIMULATED payments need no keys.
The optional payer seed is a sensitive field stored in the OS credential store
by Claude Desktop, passed only through the child environment. Never paste seeds
in JSON. Live mode requires explicit opt-in and separate provider configuration.
Data persists in `~/.researchagent/mcp`; keep it for daily accounting and retries.

Pinned formats: [MCPB manifest 0.3](https://github.com/modelcontextprotocol/mcpb/blob/70fe3b34cd6dff1b3bba046638edc72a6467a4fb/MANIFEST.md),
validated using @anthropic-ai/mcpb 2.1.2; [official Registry schema 2025-12-11](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json).
`server.json` is release metadata, not a claim of publication. The build adds the
bundle SHA-256 for the owner to publish. No public HTTP service is advertised:
the app endpoint is private loopback. Registry publishing is tracked in #265.

## Client configuration reference

Replace `/absolute/checkout` with this checkout after `npm ci`. The following
JSON is shared by Claude Desktop (`claude_desktop_config.json`), Claude Code
(project `.mcp.json`) and Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "researchagent": {
      "command": "node",
      "args": [
        "--import",
        "/absolute/checkout/node_modules/tsx/dist/loader.mjs",
        "/absolute/checkout/mcp/server.ts"
      ],
      "env": {
        "RA_LIVE": "0",
        "MCP_MAX_BUDGET_MINOR": "200",
        "MCP_DAILY_CAP_MINOR": "500"
      }
    }
  }
}
```

VS Code (`.vscode/mcp.json`), using [the configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration):

```json
{
  "servers": {
    "researchagent": {
      "type": "stdio",
      "command": "node",
      "args": [
        "--import",
        "/absolute/checkout/node_modules/tsx/dist/loader.mjs",
        "/absolute/checkout/mcp/server.ts"
      ],
      "env": {
        "RA_LIVE": "0",
        "MCP_MAX_BUDGET_MINOR": "200",
        "MCP_DAILY_CAP_MINOR": "500"
      }
    }
  }
}
```

### App-hosted Streamable HTTP

Keep the Mac app open. Settings → Connect an agent creates a separate revocable
allowance and bearer for each client. Replace REPLACE_WITH_AGENT_TOKEN below;
protect the resulting private client configuration. Client-side stdio caps do
not raise app allowances. The endpoint is `http://127.0.0.1:9689/mcp`, rejects
browser Origins, and requires a bearer on every request. Use native desktop
clients, not browser extensions that send Origin headers.

Claude Code (`.mcp.json`) and Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "researchagent": {
      "type": "http",
      "url": "http://127.0.0.1:9689/mcp",
      "headers": {
        "Authorization": "Bearer REPLACE_WITH_AGENT_TOKEN"
      }
    }
  }
}
```

VS Code:

```json
{
  "servers": {
    "researchagent": {
      "type": "http",
      "url": "http://127.0.0.1:9689/mcp",
      "headers": {
        "Authorization": "Bearer REPLACE_WITH_AGENT_TOKEN"
      }
    }
  }
}
```

Claude Desktop uses the stdio bridge for loopback HTTP (Node/npm required):

```json
{
  "mcpServers": {
    "researchagent": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@0.1.38",
        "http://127.0.0.1:9689/mcp",
        "--allow-http",
        "--header",
        "Authorization: Bearer REPLACE_WITH_AGENT_TOKEN"
      ]
    }
  }
}
```

Codex (`~/.codex/config.toml`), export RESEARCHAGENT_TOKEN in the client environment:

```toml
[mcp_servers.researchagent]
url = "http://127.0.0.1:9689/mcp"
bearer_token_env_var = "RESEARCHAGENT_TOKEN"
```

All transports expose `search_expertise`, `ask_expert`, `get_run`, `wallet_status`,
`verify_answer` and `hire`. The optional operator-configured `hire_researcher`
requires separate signing authority and is disabled in the extension.
These snippets are syntax/contract tested; interactive acceptance in all five
products is not claimed.

Tool errors from the SDK expose validated `code`, `status`, `retryable`, safe `message` and optional `runId` in structured content. A retained run ID is a recovery handle, not authorization to start another purchase. Verify-export and hire HTTP requests are bounded at 15 seconds. Budget clamps continue free-first and expose `clampReason`. Engine-wide overload admission is deferred; `overloaded` is a supported error category rather than a current cap-of-four guarantee.

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

### Independent local origins (Lane F)

`PUBLISHER_URLS=http://127.0.0.1:<port>,http://127.0.0.1:<port>,http://127.0.0.1:<port>` admits at most three operator-configured numeric loopback origins. `PUBLISHER_URL` retains singleton compatibility. This is the labelled pinned-local-origin finals topology; public remote federation is deferred. Discovery/search has one two-second deadline per origin, four HTTP slots, 50 writers/origin and 50 returned hits/query, with healthy partial results.

Federated runtime references carry `source` version 1: origin, signed seller public key, profileId, resourceId and version. `shared/source-identity.ts` supplies the canonical tuple and citation key. TS, Python and MCP preserve that identity; wallet reputation crosses hosts. Receipt bundles dispatch v1/v2 explicitly. Historical missing origins remain unresolved; invoices, signed manifests, blobs, audit entries and intent IDs are unchanged. New obligations save endpoint context before signing; removal prevents new admission while recovery uses the saved endpoint. No engine bearer, delivery token or payment signature is forwarded across origins.

Offline reproduction: `node --import tsx scripts/demo-multi-origin.ts --fixture --output scratch/multi-origin.json`. Evidence and migration handoff: `docs/evidence/round2-f/README.md`. The proof is synthetic, uses simulated payments and an explicit fixture judging/citation rubric, and does not establish adoption or live model quality.

## Kill switch — `pause_spending`

`pause_spending({ reason: 'Unexpected spending' })` pauses spending durably and immediately. A scoped bearer pauses only
its own agent; an operator bearer pauses the wallet. Returns `{paused: true,
scope: "agent" | "wallet", agentId?: string}`. Repeated pause is safe. The optional
reason is at most 240 characters, excludes control characters, and is stored in
the audit trail. No client resume method exists: resume remains operator-only.
In-flight unsigned purchases cannot sign; signed obligations reconcile normally
without releasing their reservations. Cached desktop preferences cannot resume it.

Receipt contribution v3 exposes exact claim/passage use with semantic assessment
labelled not independently verified. See [receipt contribution contract](contracts/CONTRIBUTION.md)
and [offline fixture evidence](evidence/round2-g/README.md). Python callers can use
`Client.receipts(run_id)`; the existing offline verifier accepts v1/v2/v3.

## Zero-clone Testnet MCP (v1.0.0-rc.2)

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.0-rc.2/researchagent-mcp-1.0.0-rc.2.tgz --testnet
```

Release candidate · not yet on npm/PyPI/MCP Registry. Alternatively use the
local `dist/release/researchagent-mcp-*.tgz` from `make release-artifacts`. `node scripts/install-snippets.mjs --tag <tag> --testnet`
prints the line for a tag. No clone, no `.env`, no hosted service: the tgz boots its own engine and fixture publisher.

- **Rail.** `ESCROW_MODE=key-reveal` and `ANCHOR_RAIL=xrpl-testnet` are set for the engine only. `wallet_status` shows
  `rail: xrpl-testnet`, the public payer address and the label `Testnet · no real value`. `ask_expert` and `get_run` add
  `ledger.purchases[]` (`create`, `finish`, `refund`) and `ledger.anchor`, each `{ txHash, explorerUrl }`.
- **Wallets.** Stdio `initialize` answers at once; the first tool call waits for the public Testnet faucet (about 20 s cold,
  about 4 s with cached wallets). One buyer is funded by the faucet; fixture writers are funded from it, so one faucet
  request per machine. Wallets and durable cap accounting live under `$XDG_STATE_HOME/researchagent/testnet/`
  (fallback `~/.local/state/researchagent/testnet/`); `wallets.private.json` is mode 0600 and is never printed or
  returned by a tool. Keep that directory to reuse wallets; never publish it.
- **Caps.** Operator-set and zero by default (`mcp/policy.ts` is unchanged). Only policy code can purchase.
- **Fallback.** If the faucet or network fails, the engine runs SIMULATED and says so in `startupLabels`:
  `SIMULATED fallback · faucet_unavailable | validation_timeout | wallet_cache_unavailable | network_unavailable · no ledger transactions`.
- **Opt-in acceptance.** `RA_ACCEPT_TESTNET=1 node scripts/check-release-consumers.mjs --testnet` probes the packed bytes over
  stdio with a fresh npm cache, restarts to prove wallet reuse and cap enforcement, and checks each hash on s.altnet.
  Default CI never calls the faucet. Evidence: [round3-a](evidence/round3-a/README.md).
