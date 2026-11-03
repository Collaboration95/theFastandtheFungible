# ResearchAgent for macOS

Apple Silicon, macOS 13 or later. Open the DMG, drag **ResearchAgent** to
**Applications**, then open it. Unsigned first-launch instructions and the
automatic Developer ID pipeline are in [SIGNING.md](SIGNING.md).

The first run is the offline judge demo: no `.env`, keys, Keychain prompt or
network required. All payments say **SIMULATED**; writers/articles are synthetic.
The packaged app runs the Day 1 UI, not a fork. The engine and fictional publisher
run in an Electron utility process with random `127.0.0.1` ports; Node's worker
isolates the existing engine configuration. There is no development web server.

Use ⌘K for commands, ⌘1/⌘2 for Run/Writers, ⌘N for a new question,
⌘Return to submit/confirm the plan, and ⌘. to stop buying. The native View menu
sets record mode to 1280×800; the original `make record` / `make clip` web workflow
also remains available. Desktop Settings opens with ⌘,.

Desktop Settings can create/faucet-fund Testnet buyer and fictional publisher
wallets, save DeepSeek/OpenAI/Cloudflare credentials to the Keychain, select live
mode, set MCP per-call/daily caps, and pause new requests. Apply restarts the app
and stops active work. The browser's per-question budget remains its authorization;
MCP caps are enforced by the engine. The wallet-wide gross daily cap and durable pause apply across web/MCP/SDK (#286).
Remote HTTPS mode skips the local engine, shows its host in the header and uses the API token saved in Keychain. Its operator configures the publisher, Host allowlist and wallet/MCP limits; the app does not raise remote caps. Save the token before applying a remote URL.
The SDK currently covers MCP tools; this app reuses Day 1's validated UI API module
through a main-process protocol proxy, and uses the SDK for desktop wallet status
and the packaged MCP adapter. Local generated API tokens stay in main memory; copying the MCP command explicitly persists that token in Keychain so the adapter can reconnect after restart. Offline startup otherwise needs no Keychain access. It adds no second UI fetch implementation.

Keys live at rest in macOS **generic passwords**, service `ResearchAgent`:
buyer account `xrpl-payer`, per-writer accounts `XRPL_PUBLISHER_<SLUG>_SEED`,
and named provider/token accounts. Credentials are never passed as command-line
arguments. Secret reads and wallet generation occur in main; only public wallet
addresses return over IPC. User-entered provider credentials exist transiently in
the separate Settings renderer and are cleared on save. They never enter the
research renderer. While running live, plaintext secrets exist in main-process
memory, utility-process/worker environments and signing objects. JavaScript does
not guarantee erasure of those copies. No seed is written to application data or
logged. The claim "your seed never leaves Keychain" would be false.

XRPL seeds do not encode a network. The app therefore offers no arbitrary seed
import; generated wallets are funded only via Testnet and every ledger connection
is restricted to `*.rippletest.net`. A seed could technically be used elsewhere
outside this app; the network endpoint guard is the enforceable boundary.

Non-secret preferences, isolated fixture/Testnet SQLite stores and receipts live
under `~/Library/Application Support/ResearchAgent/`. Premium passages can appear
in the research renderer only after a verified grant, just as in the web app.
Offline reports use the existing labelled HTML print fallback; no second Chromium
download is bundled. Remote pages/scripts never load inside an app window.

The Settings MCP button copies a Claude Code command pointing at this installed
app's adapter. It needs system Node ≥22.13 and the app open; it uses the same
engine and durable MCP caps. The research renderer cannot invoke desktop actions:
main validates both the sender window and its top-level origin.

Build and validate from the clone (no cloud resources):

```sh
npm ci
OFFSET=900 make app
OFFSET=900 make dmg
# Install desktop/out/ResearchAgent-<version>-arm64.dmg first:
OFFSET=900 make desktop-smoke
```

`DESKTOP_VERSION` can override package metadata for a scheduled release build.
The smoke uses a disposable data directory, tests UC1–UC3 with fixtures, checks
isolation, blocked networking/Host/Origin rebinding and clean shutdown, then writes
screenshots and launch-to-interactive timing under ignored `desktop/evidence/`.
Its launch is a fresh process with empty application data; it does not claim to
flush the macOS filesystem cache. Live settlement and signed/notarised launch
require separate live evidence and are not inferred from offline smoke results.

Installed DMG size, cold-start method and validation limits: [evidence](../docs/evidence/macos-app-259.md).

## Connect an agent over HTTP

Local mode hosts Streamable HTTP at `http://127.0.0.1:9689/mcp` alongside the
legacy stdio adapter. Only the exact loopback Host is accepted; browser Origins
are refused. Every request requires its own agent bearer, rechecked against the
same durable engine registry. Paused or revoked keys receive 401, including
already connected clients. The endpoint stops with the app. Remote-backend mode
has no local MCP listener. Port 9689 must be available.

Open Desktop Settings → Connect an agent. Each Claude Desktop, Claude Code,
Cursor or Codex panel creates independent per-call/daily allowances (SGD cents),
shows gross spend, reserved authority and last authenticated HTTP request, and
provides pause/resume and permanent revoke. Create a replacement to change caps.
The wallet cap and wallet pause apply to all clients. Agent allowances replace
the legacy MCP caps; the requested tool budget is clamped by backend policy.
Settings refreshes every ten seconds while unfocused. Fixture and Testnet modes
have separate registries.

Copy config writes the secret directly from Keychain to the clipboard; it never
enters the renderer. Paste into the client's private config. Claude Code uses
native HTTP; Cursor uses URL/headers JSON; Codex uses TOML URL/http_headers.
Claude Desktop uses the `mcp-remote` stdio bridge via `npx` (Node and an initial
package download required). These are generated configs; interactive sessions
in all four products have not been acceptance-tested. Protect config files and
the clipboard as credentials. Revoke the connection if exposed.

Tools: `search_expertise`, `ask_expert`, `get_run`, `wallet_status`,
`verify_answer` (receipt verification; optional read-only Testnet lookups), and
`hire`. Hire wraps `/v1/ask`: request a quote with question, budget_minor
(100/200/500) and a stable idempotency_key; sign it using the caller's wallet,
then pass payment_signature with the same inputs. A verified settled caller
payment supplies research authority; the fixed S$0.20 fee is additional. The
backend refuses payments that cannot fit the agent/wallet caps, before submitting
anything. It never silently changes an already signed invoice. No tool exposes
an article purchase or arbitrary signing command. The HTTP host disables the
legacy environment-configured outbound `hire_researcher` signer.

Headless local HTTP: `node --import tsx mcp/server.ts --http`; provision agent
keys with `npm run agents -- add --db data/mcp/app.db ... --token-file <private-path>`
(use RA_DATA_DIR if configured). Raw keys are emitted only to that new private
file. Stdio remains the default. HTTP refuses RA_BACKEND_URL because its registry
must be the local engine's database.

HTTP fixture tests and a single real Testnet purchase are recorded in
[app-mcp-http evidence](../docs/evidence/app-mcp-http.md). The latter uses the
local Testnet payer; it is not packaged Keychain acceptance evidence.
