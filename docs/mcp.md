# Use ResearchAgent from Claude Code, Codex or any MCP client

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
