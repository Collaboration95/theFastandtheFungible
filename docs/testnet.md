# Testnet first touch

Run `make testnet`, or `node --import tsx scripts/testnet-start.ts` after installing
Node dependencies. No npm command is needed to launch. Fixture models, fictional
writers and XRP on XRPL Testnet only; no real value. Open the printed local URL,
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

`make testnet ARGS="--capture --key-reveal"` records the second demo tab using
these same isolated faucet wallets and HTTP/SSE capture path. The labelled
fixture AlphaLeak refuses signed delivery and is then quarantined by the fixture harness; the
harness waits for policy's validated cancellation, injects a labelled quarantine
(not automatic reputation scoring), resumes the existing policy
loop, and records The Fab Floor's key publication and cited delivery. This is
capture orchestration, not a claim that the public UI automatically replans a
cancelled no-show today. Principal is fully returned; transaction fees remain
paid. The post-grant proof export is public evidence; no unrevealed key or wallet
seed is exported. Ciphertext before the grant stays quarantined.
