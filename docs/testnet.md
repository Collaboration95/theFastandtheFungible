# Testnet first touch

Run `make testnet`, or `node --import tsx scripts/testnet-start.ts` after installing
Node dependencies. No npm command is needed to launch. Fixture models, fictional
writers and XRP on XRPL Testnet only; no real value. Local writer purchases default
to key-reveal escrow. Use `ESCROW_MODE=payment make testnet` for explicit plain
Payments. The live activity and receipt show create, key publication, policy
checks and cancellation countdown. Unsupported writers are skipped without fallback. Open the printed local URL,
choose Malaysia packaging lead times (UC3), Ask, and confirm the plan. The prompt
budget authorizes policy purchases; no per-purchase approval is added.

`make testnet ARGS=--capture` automatically executes UC3 through the existing
HTTP/SSE capture tool on OS-assigned ephemeral ports. It records pay → failed
proof → validated cooperative refund → replacement purchase. This spends Testnet
XRP again each time. Capture recovers oversized SSE frames via the durable GET.
The printed first-hash time includes wallet provisioning and app startup.

The launcher ignores `.env` and inherited provider, wallet and endpoint settings.
It generates fresh wallet keys in ignored `scratch/testnet-first-touch/wallets.private.json`
(mode 0600). Do not publish that file. It reuses those wallets while funded. A
single public faucet request funds the buyer, which provisions seven fixture
writers with 6 Testnet XRP each, avoiding multiple per-IP faucet requests. Their
remaining balances are checked before funding. Funding is setup, separate from
product purchases. The network must report ID 1; endpoints are fixed Testnet
allowlisted URLs. Seeds and faucet response bodies are never printed.

If faucet or network provisioning fails, the UI displays SIMULATED SGD and the
launcher prints SIMULATED fallback. A failed setup does not produce Testnet
capture evidence. Preserve the ignored cache to reuse partially funded wallets.

XRP only. RLUSD requires a separate authenticated faucet and trust lines; this
command does not attempt it. Credentials are optional and are not issued here.

The static `/demo/` autoplays the committed Testnet UC3 with Pause/Resume and
secondary simulated UC1–UC3 scenarios. It performs no engine, provider, wallet or
payment calls. Up to three allowlisted endpoint attempts per row (two workers,
five seconds per lookup; a key-reveal finish also fetches its create transaction) compare ledger identity, destination, invoice and amount using
the ledger page verifier. Unavailable history stays labelled historical; recorded
validation never implies that a fresh lookup succeeded.

`make testnet ARGS="--capture --key-reveal"` records the default demo tab, the
key-reveal UC3 (AlphaLeak key published, broken promise, writer-signed refund,
The Fab Floor key reveal, answer anchor), writing `demo/traces/UC3-key-reveal.json` and
`docs/evidence/lane-b3/` including the exported `UC3.receipts.json`; `--kestrel` records
the Kestrel question as evidence only. Anchoring is on by default on Testnet
(`ANCHOR_RAIL=off` opts out). `make testnet ARGS="--capture --key-reveal --no-show"`
records the writer no-show tab using
these same isolated faucet wallets and HTTP/SSE capture path. In that one the labelled
fixture AlphaLeak refuses signed delivery and is then quarantined by the fixture harness; the
harness waits for policy's validated cancellation, injects a labelled quarantine
(not automatic reputation scoring), resumes the existing policy
loop, and records The Fab Floor's key publication and cited delivery. This is
capture orchestration, not a claim that the public UI automatically replans a
cancelled no-show today. Principal is fully returned; transaction fees remain
paid. The post-grant proof export is public evidence; no unrevealed key or wallet
seed is exported. Ciphertext before the grant stays quarantined.

For three independent cold boots use `node --import tsx scripts/accept-key-reveal.ts`.
It runs `make testnet` three times through the browser proxy, asks UC3, and saves
only create/finish/refund/re-buy hashes and first-create timing under
`docs/evidence/lane-x/`. `TESTNET_WALLET_FILE=scratch/<unique>/wallets.private.json`
selects a fresh wallet cache. The acceptance script deletes its private scratch.
Funding, hire ingress, royalties, change and cooperative refunds stay Payments.

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

## Zero-clone Testnet app (v1.0.0-rc.2)

```sh
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.0-rc.2/researchagent-mcp-1.0.0-rc.2.tgz app --testnet     # or without --testnet for the labelled SIMULATED rail
```

Release candidate · not yet on npm/PyPI/MCP Registry. Only Node 22 is needed: the tgz carries the engine,
the fixture corpus and the built web UI (about 0.2 MB gzipped on top of a 21 MB tgz). It boots the same engine as the MCP
bin, with the same faucet wallets from `$XDG_STATE_HOME/researchagent/testnet/` (shared with `--testnet` MCP; the app's own
database lives in `testnet/app/`), serves the UI on `127.0.0.1` (ephemeral port, or `--port N`) and prints:

```text
ResearchAgent ready: http://127.0.0.1:N · fixture models · XRPL TESTNET · no real value
  payer address: r… (public; seeds stay in …/researchagent/testnet, mode 0600)
  caps: per-prompt budget set in the UI (max S$5.00) · wallet daily cap S$5.00 (app Testnet default; WALLET_DAILY_CAP_MINOR overrides)
  SDK: createClient({ baseUrl: 'http://127.0.0.1:M', token: readFileSync('…/api-token', 'utf8').trim() })
  verify: await client.verify(await client.receipts(runId), { testnet: true })
```

- **Authority.** The UI's per-prompt budget and deterministic policy are the only spending authority; the page never holds
  the engine token (this server adds the bearer, like the desktop shell and the Vite proxy). Requests need Host `127.0.0.1:N`
  (or `localhost:N`) and no foreign Origin, so a web page cannot drive the engine. `mcp/policy.ts` caps are untouched;
  the app adds a wallet-wide **daily cap of S$5.00 in Testnet mode** (S$20 default on the SIMULATED rail; set
  `WALLET_DAILY_CAP_MINOR` to change it).
- **No `.env`.** The app never reads one; models and writers are fixtures. Key reveal and anchoring are on.
- **SDK.** The printed `baseUrl` is the bearer-protected engine (not the UI port); the token is in `…/api-token` (mode
  0600, removed on exit) and is never printed. The SDK's `ask` is the MCP surface, so also set the operator caps, e.g.
  `MCP_MAX_BUDGET_MINOR=200 MCP_DAILY_CAP_MINOR=500 npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.0-rc.2/researchagent-mcp-1.0.0-rc.2.tgz app --testnet` (default zero, as for MCP).
  `RA_URL=<baseUrl> RA_API_TOKEN=$(cat <token file>) npx tsx examples/ask.ts` works from a checkout.
- **Fallback.** A faucet or network failure starts the app on the SIMULATED rail and the ready line says why
  (`SIMULATED fallback · faucet_unavailable | validation_timeout | wallet_cache_unavailable | network_unavailable · no ledger
  transactions`); the UI labels every figure SIMULATED.
- **Opt-in acceptance.** `RA_ACCEPT_TESTNET=1 node scripts/check-release-consumers.mjs --testnet` also boots the packed
  `app --testnet` from a fresh npm cache and wallet cache, drives the UI in Chromium (Kestrel question → key-reveal escrow →
  `tx ↗` links and the anchor) and checks each hash on s.altnet. Default CI runs only the SIMULATED `app` consumer.
  Evidence: [round3-d](evidence/round3-d/README.md).

## Devcontainer Testnet CI

[`codespace-testnet.yml`](../.github/workflows/codespace-testnet.yml) (manual and nightly, never on PRs) boots `.devcontainer/testnet`
with `devcontainers/ci`, lets its `postStartCommand` run `make testnet` with a generated API token and operator caps
(S$2 per question, S$5 per day), asks UC3 over the SDK, and checks EscrowCreate and EscrowFinish on s.altnet. A faucet or
network failure is not a red build: the probe prints a yellow `SIMULATED fallback (reason)` warning annotation, writes it
to `result.json` and the step summary, and exits 0 (gate 5: nothing simulated passes as Testnet). First run:
[run 41804181845](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/41804181845), real Testnet, 51.9 s,
`0AB8881C01758BC9418A700918153F172AEB9F9B474B12134D564A6B9A99D039` (EscrowCreate, ledger 22057869) and
`E76A9F4A6363785C6ACCEF528540F0140AF6FA3969D4E07854FEDDB1E7130CBE` (EscrowFinish, ledger 22057870). This is not a real
Codespace; that check stays with the owner (#265).

## Token escrow opt-in

`make testnet ARGS=--iou` (or `ESCROW_ASSET=test-iou make testnet`) enables
TEST-SGD · IOU issued by our Testnet issuer · no real value · stand-in for RLUSD.
S$ prices map 1:1. XRP key reveal remains the default. The public faucet funds
a dedicated permissioned issuer and trust lines; seeds stay in the existing 0600
scratch store. The launcher refuses IOU execution if provisioning fails.
The issuer has zero transfer fees. MCP IOU mode is a follow-up.
See [key reveal](key-reveal-escrow.md) for the asset matrix and safety checks.
