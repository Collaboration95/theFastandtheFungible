# ResearchAgent for macOS

Apple Silicon or Intel, macOS 13 or later. Open the DMG, drag **ResearchAgent** to
**Applications**, then open it. Unsigned first-launch instructions and the
explicit owner-only Developer ID mode are in [SIGNING.md](SIGNING.md).

The first run is the offline judge demo: no `.env`, keys, Keychain prompt or
network required. All payments say **SIMULATED**; writers/articles are synthetic.
The packaged app runs the Day 1 UI, not a fork. The engine and fictional publisher
run in an Electron utility process with random `127.0.0.1` ports; Node's worker
isolates the existing engine configuration. There is no development web server.

Use ⌘K for commands, ⌘1/⌘2 for Run/Writers, ⌘N for a new question,
⌘Return to submit/confirm the plan, and ⌘. to stop buying. The native View menu
sets record mode to 1280×800; the original `make record` / `make clip` web workflow
also remains available. Settings opens the shared web Settings page with ⌘,. First run asks for fixture/Testnet and confirms caps. Window bounds persist between launches.

Desktop Settings can create/faucet-fund Testnet buyer and fictional publisher
wallets, save DeepSeek/OpenAI/Cloudflare credentials to the Keychain, select live
mode, set MCP per-call/daily caps, and pause new requests. Apply restarts the engine
and stops active work. The browser's per-question budget remains its authorization;
MCP caps are enforced by the engine. The wallet-wide gross daily cap and durable pause apply across web/MCP/SDK (#286).
Remote HTTPS mode skips the local engine, shows its host in the header and uses the API token saved in Keychain. Its operator configures the publisher, Host allowlist and wallet/MCP limits; the app does not raise remote caps. Save the token before applying a remote URL.
The TypeScript SDK covers ask/read/search/status/receipts/verify/pause plus explicit pay/hire; Python covers ask/read/status/receipts/verify/pause; this app reuses Day 1's validated UI API module
through a main-process protocol proxy, and uses the SDK for desktop wallet status
and the packaged MCP adapter. Local generated API tokens stay in main memory; copying the MCP command explicitly persists that token in Keychain so the adapter can reconnect after restart. Offline startup otherwise needs no Keychain access. It adds no second UI fetch implementation.

Keys live at rest in macOS **generic passwords**, service `ResearchAgent`:
buyer account `xrpl-payer`, per-writer accounts `XRPL_PUBLISHER_<SLUG>_SEED`,
and named provider/token accounts. Credentials are never passed as command-line
arguments. Secret reads and wallet generation occur in main; only public wallet
addresses return over IPC. User-entered provider credentials exist transiently in
the shared Settings renderer and are cleared on save. They never enter the
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

Build and validate from the clone (**macOS only**, no cloud resources). Requires Node ≥22.13, npm, Make, authenticated `gh` (`gh auth status`), and Xcode command-line tools (`xcode-select --install`, then `xcrun --find clang`). The Electron downloader uses `gh` and macOS tools. DMGs are unsigned by default; signing/notarization needs explicit owner configuration in SIGNING.md. Asar is intentionally disabled so the engine has a real filesystem cwd.

Commands below use a macOS POSIX shell:

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

## Acceptance and recovery

`OFFSET=1100 make app-accept` builds and mounts the DMG read-only, then launches
its executable with fresh app data and a disposable `ResearchAgent-Accept-*`
Keychain service. It creates an agent through Settings IPC, connects the MCP SDK
HTTP client, kills the fixture engine after durable signing, and checks recovery
uses the identical submission with exactly one receipt and grant. It then makes
one small XRPL Testnet purchase using `XRPL_PAYER_SEED` and the publisher seeds
from the local `.env`, copied to test Keychain items without printing them. No
live model calls: research/decisions are explicitly fixtures. The harness deletes
its test Keychain items, preserves isolated journals for investigation, and writes
`docs/evidence/app-acceptance.md`. Inspect a failed live journal before rerunning;
rerunning uses new intent authority and can make another Testnet purchase.
`node --import tsx desktop/accept.mjs --fixture-only` skips Testnet.

An unexpected utility-engine exit shows “reconnecting” in the native window title
and reconnects after 0.5 s, doubling to a maximum 30 s between attempts. Settings
exposes engine status. App data and the existing x402 signed-blob journal stay in
place: recovery reconciles the persisted submission instead of signing again.
An interrupted HTTP call may fail; reconnect and retry with the same idempotency
key. Quit cancels pending restarts and drains the current engine.

## Release notifications

The app checks GitHub Releases once ten seconds after launch and offers
ResearchAgent → Check for Updates. It uses the authenticated `gh` CLI, so update
checks require `gh` installed and authenticated; an unavailable automatic check
is quiet. Stable semver releases only, from this repository. It checks metadata
and offers the release page; it never downloads or installs an update, including
on quit. This remains safe while unsigned. Signing alone does not enable silent
updates; that requires a separate reviewed implementation.

## Architectures

`DESKTOP_ARCH=arm64 OFFSET=1100 make dmg` and
`DESKTOP_ARCH=x64 OFFSET=1100 make dmg` produce separate DMGs with identical
application sources. This avoids shipping both Chromium architectures to every
user. The downloader verifies each upstream Electron ZIP checksum through `gh`.
On Apple Silicon, x64 timing measures Rosetta, not native Intel performance.

Architecture measurements and exact validation scope are in
[packaged acceptance](../docs/evidence/app-acceptance.md). Use `--launch-only`
with `desktop/accept.mjs` to measure startup without purchases. `gh` must be on
the app's PATH (Finder launches may have a smaller PATH than a terminal).

## Recoverable startup and provider settings

The hardened static recovery page, Settings, native menu, IPC and app protocol
register before Keychain access or engine boot. Credential/configuration failures
stay in recovery. Engine crashes retry at most five times with exponential
backoff; Retry starts a new bounded sequence. Open Settings works while boot is
pending. Open offline demo never reads Keychain, disables legacy MCP credential
loading and uses the separate fixture store. Live SQLite data and uncertain
intents are preserved. No reset or credential-error process exit is used.

Settings supports DeepSeek, OpenAI and OpenAI-compatible research profiles with
base URL, model and an optional compatible decision judge. Compatibility is
restricted to the documented HTTPS hosts or numeric loopback development HTTP;
engine endpoint validation still applies. Profile validation makes no request.
Keys have presence-only save/replace/exact-account delete controls. Wallet seeds
cannot be deleted here. Failed native operations refresh presence, including
an unknown state when Keychain access is unavailable. Profile/key changes restart
the supervised engine. Test connection uses its saved environment key and the
loopback bearer-protected `/api/providers/test`; missing engine/endpoint is shown
as unavailable. Missing cost/usage remains unavailable, including null cost.

Pause wallet and Resume wallet are explicit actions. Boot, reconnect and profile
saves never write the durable pause. The inherited emergency `SPENDING_PAUSED=1`
is immutable for the app process and prevents Resume. Cached pause preferences
have no spending authority.

Fixture-only packaged recovery acceptance (no live credentials in environment):

```sh
RA_DESKTOP_KEYCHAIN_SERVICE=ResearchAgent-Accept-c2 node desktop/smoke.mjs --fixture-only --recovery --app "$PWD/desktop/out/mac-arm64/ResearchAgent.app" --output "$PWD/docs/evidence/round2-c2/recovery.json"
```

The harness refuses production service names and credential/network rail inputs.
Credential/outage faults are explicitly injected before native credential/network
access; unit tests cover actual credential/configuration decisions with synthetic
readers and mocked native Keychain commands. This is not evidence of real
Keychain incidents or real-provider success. It also runs a native fixture answer,
checks Settings during a five-second failure, tests unauthorized main-renderer
IPC and checks durable pause across engine restart/app relaunch. It preserves its
isolated temporary stores for investigation.
