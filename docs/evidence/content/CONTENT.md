# Real content evidence

12,104 public-docs passages in 1,136 article chunks; 13,372,294 bytes. Each passage is at most 1,200 characters. One real Testnet paid delivery and a complete RLUSD snapshot are recorded below. Documentation acquisition itself makes no ledger writes or model calls.

## Reproduce

```sh
npm run corpus:public-docs
FREE_TIER=public-docs npm run dev:publisher
```

Authenticated `gh api` downloads pinned tarballs to a scoped temporary directory outside the repository. The index is larger than 8 MB and ignored; only the manifest and deterministic builder are committed. `docker/hosted/build.mjs` rebuilds the index inside its temporary archive before Docker runs (handoff to R3-REACH). No deployment. Startup fails if the opt-in index is missing. Tiny stubs are excluded to retain the existing article validation; code fences and template directives are omitted. XRPL private snippets, source-image notes and underscore-prefixed templates are excluded because they are not public pages. Known page-title heading templates are resolved; unsupported dynamic headings cite the page root. Markdown links in heading labels do not leak their target path into the anchor. No length or leak guard was loosened.

## Sources and licences

- XRPLF/xrpl-dev-portal at `182f8d20b157aa791433ff399a0f30dbed74a5eb`: 8,756 passages, 841 chunks. MIT; full licence text retained in manifest.
- coinbase/x402 at `0e6e8c55d86b4f14234fb6e49a4052074fb93e57`: 3,348 passages, 295 chunks. Apache-2.0; full licence text retained in manifest.

## Five answers drawn only from public docs

These are source-extract checks, not live-model results.

**What does account_info return?**
The `account_info` command retrieves information about an account, its activity, and its XRP balance. All information retrieved is relative to a particular version of the ledger.
Source: https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_info#account_info

**What does gateway_balances calculate?**
The `gateway_balances` command calculates the total balances of trust line tokens issued by a given account, optionally excluding amounts held by operational addresses. This method doesn't support MPTs.
Source: https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/gateway_balances#gateway_balances

**What is account_lines?**
The `account_lines` method returns information about an account's trust lines, which contain balances in all non-XRP currencies and assets. All information retrieved is relative to a particular version of the ledger.
Source: https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_lines#account_lines

**What does a facilitator do?**
The facilitator is an optional but recommended service that simplifies verifying and settling payments between clients (buyers) and servers (sellers).
Source: https://github.com/coinbase/x402/blob/0e6e8c55d86b4f14234fb6e49a4052074fb93e57/docs/core-concepts/facilitator.md

**What is HTTP 402 used for?**
X402 is an open protocol for HTTP-native machine-to-machine payments. It extends the existing HTTP 402 Payment Required status code into a complete payment flow: a service responds with its payment requirements, a client fulfills them with an on-chain transaction, and the service delivers the resource.
Source: https://xrpl.org/docs/agents/agentic-payments-x402#agentic-payments-with-x402-on-the-xrp-ledger

## Verification incident (12 Nov)

At clean head `c074461afa56066445483eb850c535ff5bd825ff`, `check:fast` passed (3,070 unit checks; 20 chaos iterations, zero invariant violations). The full Node 22 gate passed all steps except hosted browser startup: desktop staging and the hosted web server both rebuild `dist/` concurrently. Hosted startup failed with `ENOENT ... dist/.vite/manifest.json`, while desktop staging succeeded. Receipt: `1794474650280-27304-f5d75ed4-a9e7-4193-a90d-58471695dcee.json` in the shared Git local-gate store. The gate now schedules desktop staging after hosted checks; every check and budget is retained.

A later clean integration fast check at `8db4ca2d3615667473819be29056d1d17ebd93e5` passed 3,197 tests but failed the Codespaces fixture because port 5173 was in use. Its requested `webPort: 0` was falling back to Vite 7.3.6's default 5173. An added regression assertion reproduced that exact port even in isolation, then passed after binding the fixture's public HTTP server directly to OS-assigned port zero. The exact forwarded-host/origin checks remain, failed startup closes its Vite server, and no existing assertion or timeout was relaxed.

The next full gate at `35727b70aa8ae2dcc4c7f56025e6162b75aeef2d` passed 19/20 checks but the desktop replay accessibility path timed out: the receipt dialog still intercepted the following citation click after a global Escape. Receipt `1794485991609-26693-29efce53-0b1d-4cca-b975-a3e5e1fc72dc.json` retains the failure. That test now waits for the full lazy-loaded receipt, targets Escape at the receipt dialog and explicitly asserts it is hidden before continuing. The accessibility audit, keyboard dismissal, viewport coverage and original timeout remain; no forced click or relaxed check is used. The focused rerun passed both viewport tests. Its standalone copied Pages tree under `scratch/` was then discovered by ESLint; that generated output was retained outside the checkout before retrying, with lint rules unchanged.

## Ledger analytics writer

Opt in with `LEDGER_ANALYTICS=1` (default unset/off). Reports cost S$0.40 through the existing x402 registry and signed manifest. Run `npm run dev:publisher`, then search `/w/ledger-analytics/search?q=RLUSD%20XRP%20AMM%20pool%20statistics`. The enabled topics are RLUSD supply/holders/concentration, the RLUSD/XRP AMM and configured project Testnet account activity. The default account list includes the real writer's public wallet, including when its signing key comes from local writer state; `LEDGER_PROJECT_ACCOUNTS` explicitly overrides the list. Global escrow totals are disabled. No Mainnet transaction is ever signed or submitted by this writer: its public client allows read methods only. It serializes reads per network, backs off HTTP and RPC overload errors, and refuses repeated markers, mixed-ledger pages, incomplete scans or scans longer than four minutes. The normal signing key is held in the local writer state directory or `XRPL_PUBLISHER_LEDGER_ANALYTICS_SEED`; it is never committed.

Sample: Mainnet ledger **108279209**, hash `5DF84A09A6811C02C013F6DF356D641B1654FC627C43E0F22AE797B4FB0B4CAF`, computed at 2026-11-12T09:21:32.192Z. See `ledger-analytics-sample.json`: exact report, manifest, salts and real writer public key. Check the hash on https://livenet.xrpl.org/ledgers/108279209, then repeat `amm_info` at that ledger for XRP and RLUSD issuer `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`. Issuer source: https://docs.ripple.com/products/stablecoin/overview/token-addresses . The signature proves the writer signed the measurements; ledger reads check the measurements.

The complete RLUSD snapshot took 259 reads / 135.574 seconds: 102,527 RLUSD trust lines, 68,064 positive holder balances, supply 885245927.4516457097218898886876168862004000003 RLUSD, top-ten share approximately 79.9053%. These are XRPL-issued balances, not cross-network supply or unique beneficial owners. Snapshot ledger 108279095, hash `9CFC06C897938C6B215C2B70023793AFED8CE90DD580A70874AD044471CDA49E`; `rlusd-snapshot.json` contains the exact inputs and result. The earlier 60-second diagnostic stopped at 131 reads and produced no report.

At startup, background jobs prewarm every enabled topic with staggered starts. They refresh RLUSD every ten minutes and AMM/project accounts every two minutes. Search never performs or waits for a public-ledger read or computation, so the normal three-second retrieval deadline is unchanged. A topic without a complete snapshot returns no hit, rather than a timeout or unavailable-writer marker. Refresh keeps the previous complete snapshot until the replacement has finished and passed ordinary corpus validation; concurrent topics share an atomically rebuilt index. Background validated-header polls run every 3.5 seconds. Search withdraws snapshots beyond their signed K, conservatively advances the cached tip between polls, and withdraws all affected snapshots if header telemetry is over ten seconds old. New purchase quotes require the latest current snapshot. Immutable older versions remain only for already signed payment delivery/retry and historical challenges.

Freshness is bound in the signed first passage: “as of validated ledger N (hash H), computed at T”, and in the manifest's signed `ledgerFreshness` object with topic, network, N/H/T and K. RLUSD uses **K=256**: (600+140)/3.5 is about 212 ledgers, with 44 additional ledgers of margin. AMM and project accounts use **K=64**, covering their 120-second interval and measured computation time with margin. These replace the earlier unshipped uniform K=120 policy; the retained historical purchase/sample signatures still describe their original K=120 and were not rewritten. The buyer checks metadata against the bound passage, the report network’s header and the first ledger past N+K against purchase time; an actual Testnet payment supplies its validated ledger close time. Mainnet and Testnet ledger indices are never compared. Stale or unverifiable reports become CLAIM_FAILED, remain outside accessible content/citations, and can be challenged through the existing signed refund path. Historical retry uses the purchase time rather than today's tip. The new writer uses ordinary x402 payment; it does not advertise the optional escrow scheme until that scheme has the same asynchronous freshness hook.

### Measured background prewarm and refresh

Live read-only measurement completed at **2026-11-12T10:27:31.917Z**. `prewarm-snapshots.json` retains all five exact reports, locally signed manifests, delivery salts, ledger hashes and measured durations. AMM and project-account periodic refreshes completed while the initial RLUSD scan was still running; no partial RLUSD snapshot was published.

| Topic | Measured computation | Refresh interval | Signed K | Validated ledger indices |
| --- | --- | --- | --- | --- |
| RLUSD | 136.384 s | 600 s | 256 | Mainnet 108280168 |
| AMM | 2.498 s initial / 2.599 s refresh | 120 s | 64 | Mainnet 108280168 / 108280199 |
| Project accounts | 1.981 s initial / 1.498 s refresh | 120 s | 64 | Testnet 22265288 / 22265324 |

The RLUSD snapshot is ledger 108280168 / `74EB2B9396371EE7BDABACBE65243058639073335610635536B278E6D8BC1055`; verify at https://livenet.xrpl.org/ledgers/108280168 and repeat every `account_lines` page for the issuer at that index. The project-account snapshots cover the same dedicated writer and payer listed below. This measures computation and signatures, not another purchase, model answer or network write.

With a locally provisioned writer signing key, reproduce the timing capture without a faucet, payment or model call:

```sh
LEDGER_PROJECT_ACCOUNTS=rPcGTrh6sBaNhXNJyQjMZzrevnAp3p5hvf,rKvkhPm45VPStAW5EgKo6zqCJSH5uQBP6k npm run content:prewarm
```

### Live Testnet paid delivery

`npx tsx publisher/writers/ledger-analytics/probe.ts --testnet` uses a dedicated Testnet payer and the funded writer, the normal purchase service, a S$2 budget, one S$0.40 report and a retry of the same intent. Observed: VERIFIED, one receipt, one accessible grant. No model calls. Receipt and exact report/proof are in `testnet-purchase.json`. Payment: `46D61B480AC861E5F35C5604510BFC9D1A7FA45D9287E1F6DA1AFAF4F3EDB4F4` — https://testnet.xrpl.org/transactions/46D61B480AC861E5F35C5604510BFC9D1A7FA45D9287E1F6DA1AFAF4F3EDB4F4 . Writer: `rPcGTrh6sBaNhXNJyQjMZzrevnAp3p5hvf`. Writer faucet funding: `479439588590F60944D39FC17D275ADD3111E55B42DB11F4C7137B57C42616B8` (validated ledger 22264107). Payer funding/payment hashes are retained in the evidence JSON. Seeds and live journals stay outside the repository.

### Live project Testnet activity

`testnet-activity.json` is a writer-signed public-read snapshot of the dedicated content writer and payer at validated ledger **22264706**, hash `567538282B0DFAF684FA477AC9329D3CFE41EF9FB64EE89E41B3A277B638AC92`, computed at 2026-11-12T09:52:54.719Z. The normal manifest signature and all delivery leaves verify locally. Both accounts' previous transaction is the same payment hash above. The sample lists balances, sequence and owned-object count, not a fabricated transaction-rate estimate. Repeat `account_info` for each listed address with `ledger_index: 22264706`, and compare https://testnet.xrpl.org/ledgers/22264706 . No new transaction or purchase was made for this snapshot.

### Unmeasured global escrow scan

Three complete public-node pages at ledger 108279002 / `1E6D961CB7B6FDAAC5591B9C89311DBF0584D53B941A1BCAA473A9E4ECE2B0EA` returned zero Escrow objects but still carried a marker. That is **not a zero escrow total**. Global escrow reports are disabled: startup does not compute them, the corpus excludes them, search cannot list them and no new purchase can quote them. Calling their computation entry point fails explicitly. A complete, measured scan is required before future admission. The four-minute scan cap remains unchanged for enabled reports.

During real-profile integration, clean head `47536f0cf6101a669c86840b0d48f2fc29b31707` passed `check:fast` (3,233 tests; four existing skips) but its full gate timed out the existing paid-site leak audit at 30 seconds. Receipt `1794488629187-62523-9a437b23-2211-4761-a0a9-d37482b6e6fd.json` retains the failure; the replay browser suite passed. The cause is not established. Verification is rerun with the original timeout, leak threshold and checks unchanged.

## Real corpus profile

`CORPUS_PROFILE=real` (default unset / `default`) implies the public-docs free tier and ledger-analytics writer. It admits project team notes and author-supplied local/published writers whose corpus marks them non-synthetic. All eight bundled fictional publishers are excluded: alphaleak, basis-points, kopi-contrarian, load-factor, marketpulse-digest, notfinancialtimes, open-records and the-fab-floor. Their current roster files all mark `synthetic: true`; Open Records' operator authorship flag does not make its fictional records real.

Newly discovered publisher registries are also filtered by explicit non-synthetic provenance under the real profile. Missing provenance is not treated as real. Public documentation has its upstream name, MIT/Apache licence and a “Public documentation” writer badge. The ledger writer and team notes retain “Team-authored”; no independent-writer identity is claimed. Default fixtures, evaluations and all eight fictional roster files remain unchanged. Cheap profile tests cover admission, article/writer references, real locally published authors, free-source substitution and rendered badge labels.

## Separate real-content replay

Select `?scenario=UC-real-content` in the replay, or “Public docs · live models” in its picker. The existing default remains `UC3-key-reveal`. The new fixture is `demo/traces/UC-real-content.json`: HTTP/SSE research API capture, DeepSeek Flash synthesis and compatible JSON decisions, six claims, five public XRPL documentation chunks, zero purchases and a zero article budget. All cited spans resolve to the original xrpl.org URL. Compatible decisions remain explicitly uncalibrated; this does not claim model calibration or ledger settlement.

The successful capture reserved a conservative model-cost upper bound of US$0.066118 for three calls. The initial identifier-only question was classified off-topic by the scope guard; the recorder then invoked `/runs` directly with its plan. This proves the research API, not normal chat routing. A second capture with an XRPL-prefixed question failed and did not replace the fixture. Across both attempts, the recorder refused any request that would exceed the cumulative US$0.90 bound, using input bytes and output ceilings at rates above the provider's documented peak Flash prices. Actual billed spend was not measured. No further model calls were made.

With the main checkout’s `.env` symlink configured locally and never printed, re-record in one command:

```sh
npm run corpus:public-docs && npm run demo:capture:real
```

The recorder explicitly opts into the real profile, requires the bounded live model, uses ephemeral local ports and simulated settlement, disables embeddings and external telemetry, permits only local HTTP and the model endpoint, and refuses to save failed or fixture-synthesized answers. Each future invocation has a US$0.90 reservation ceiling. `CONTENT_RECORDING_QUESTION` optionally selects a different question; unset reproduces the committed question. The capture source SHA and exact provider labels are retained in the fixture. The off-topic classification and the failed second capture remain routing/reliability follow-ups.

## Configuration and offline checks

| Setting | Default | Opt-in effect |
| --- | --- | --- |
| `FREE_TIER` | unset / `default` | `public-docs` replaces existing free articles with the built documentation |
| `LEDGER_ANALYTICS` | unset / off | `1` adds the ledger writer and background prewarming/refresh |
| `CORPUS_PROFILE` | unset / `default` | `real` implies docs and analytics and excludes synthetic publishers |
| `PUBLIC_DOCS_ARCHIVES_DIR` | unset | Reuse extracted pinned archives instead of fetching fresh scoped tarballs |
| `LEDGER_REPORT_DIR` | `data/ledger-reports` | Location for retained immutable report versions |
| `LEDGER_PROJECT_ACCOUNTS` | The real writer's public wallet plus addresses derived from available configured project seed variables | Explicit comma-separated project Testnet account allowlist |
| `XRPL_PUBLISHER_LEDGER_ANALYTICS_SEED` | Normal local writer state fallback | Required normal signing identity on the Testnet rail; never print or commit it |
| `CONTENT_RECORDING_QUESTION` | `What information does the account_info command return?` | Local replay capture question |
| Replay `scenario` query | Existing `UC3-key-reveal` | `UC-real-content` selects the separate real-source run |

Offline targeted checks validate all retained report signatures/leaves, the actual paid receipt's signer/price/version, canonical SDK links, default/real payment boundaries and byte-identical index reconstruction. A bundled-module check loads the index using the hosted dist/data layout. These checks make no network writes. Full Node22 gate receipts and merge status are reported separately; targeted checks are not release admission.

## Integration verification

The first three steps passed Node 22 `check:fast`, published 20/20 local gates, and exact merged-SHA admission: documentation PR #527 / `4a985d79c8b4ecc0cd80547ea4fd82107e7a1426`; ledger writer #536 / `9653e2df4a6b86a085f97ce67dfb1a2c3b43ace3`; real profile #537 / `8e7fb86b4959b6910c339bfb33db98a846823cdb`. The final profile run passed 3,238 unit tests with four existing skips and 20 chaos iterations with zero invariant violations. Cheap admission, badge and money-path cases cover both profiles; the full suite keeps its default fixtures.

The retained paid-site leak timeout was an observed host-load flake: its two-test file took 12.716 seconds in the fast suite, exceeded the existing 30-second per-test timeout in the full gate (30.032 seconds for the file), then passed unchanged in 23.879 seconds on retry. Later current-main integration gates passed as well. No timeout, leak threshold or assertion was loosened. The replay and its final release-admission receipt are a separate fourth PR.

The initial replay fast check rejected environment wording defined in the demo helper. Those definitions now live in the shared presentation contract; the existing default ENV labels, generated site helper and presentation guard fixtures are unchanged. The presentation-contract and real-replay targeted checks then passed (four tests), with no resource leaks.

Replay gate receipt `1794490708869-56910-449aae4d-80a4-41ee-91f2-2f0f832db924.json` exposed an old browser assertion assuming every recording was fictional. Only the new UC-real-content case now asserts its exact live-answer/simulated-payment provenance; every prior fixture keeps its original assertion and data. The focused browser check passed. The same gate hit the unchanged judge-corner file’s five-second per-test timeout (5.573 seconds for the file, versus 0.646 seconds in the fast suite); an unchanged targeted retry passed all 17 tests in 0.627 seconds, with clean resources. No timeout or copy-guard fixture changed.
