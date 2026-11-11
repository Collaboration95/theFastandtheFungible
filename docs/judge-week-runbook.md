# Judge week · 13–19 November 2026

Owner only; check from a phone. Bookmark this page and the
[replay](https://collaboration95.github.io/theFastandtheFungible/demo/).
Commands run from this checkout on the operator Mac; `$RA_PRIVATE_DIR` is the
existing private deployment directory. Times are Singapore time.

## Daily 2-minute check

| Open on the phone | Healthy looks like |
| --- | --- |
| [Demo](https://ra-front-651013803640.asia-southeast1.run.app), then [readiness](https://ra-front-651013803640.asia-southeast1.run.app/ready) | `ready` or `busy`; full queues are healthy. [Status](https://ra-front-651013803640.asia-southeast1.run.app/api/demo/status) shows allowance/links. Reuse the browser; ask nothing. |
| [Cloud Billing](https://console.cloud.google.com/billing?project=researchagent-sff) → project spend | Compare actual and forecast spend with **S$40**. Billing reports can lag; an alert is not proof that spending has stopped. |
| [Payer check](https://ra-front-651013803640.asia-southeast1.run.app/ready/funds) | `ok`: at or above **30 XRP**. `low`: act. `unknown`, even HTTP 200: unconfirmed. Exact balance: wallet command below. |
| [DeepSeek](https://platform.deepseek.com) → balance | Credit remains; account works. Check daily, including **15 Nov**. |
| Alert-email inbox | No unresolved `ra-readyz-failed`, `ra-payer-funds-low` or billing mail. Redeploy alerts still need a recovery check. |

**S$40 boundary:** the brief's ceiling and 75%/90% warnings have no merged
`budget-stop/` implementation or spending-cap procedure at this revision.
[Hosted alerts](hosted-web.md#deployment-and-operations-runbook) instead document
**S$70**, 50%/90%/100% notifications, which do not stop the VM. Pause if S$40
is at risk; do not rely on a hard stop or warning delivery.

Private status and Testnet balances (**existing** wallet directory only; an empty
one creates identities):

```sh
node scripts/hosted-control.mjs status --project researchagent-sff --execute
node --import tsx scripts/hosted-wallets.ts --testnet --out "$RA_PRIVATE_DIR/wallets"
```

## If X happens, do Y

**Resume** means `node scripts/hosted-control.mjs resume --project researchagent-sff --execute`.
**Pause** means `node scripts/hosted-control.mjs pause --project researchagent-sff --reason maintenance --execute`.
Check readiness afterwards. Resume requires checked funding, providers, control
expiry and payment reconciliation. A bad resume rolls back with Pause.

| If | Do this | Rollback / safe fallback |
| --- | --- | --- |
| Paused | Run the private status command; Resume after fixing the cause. Redeploys end paused. | Pause if readiness fails; replay. |
| Not ready | Pause; check `/ready`, status and the [readiness/guard contract](hosted-web.md#gateway-configuration-hg). | Resume after recovery; otherwise replay. HTTP 200 HTML alone proves nothing. |
| Payer low | Pause; run the wallet check. Follow [Testnet provisioning](hosted-web.md#exact-command-sequence). `--fund` only tries below 20 XRP, once per saved identity. | Keep identities/recovery signers; Resume after verified funding. |
| Budget warning at 75% | Open billing; run private status. Pause if forecast threatens S$40. | Resume within the same ceiling; otherwise replay. |
| Budget warning at 90% | Pause; check lagging billing and remaining exposure. | Stay paused unless S$40 remains safe; replay. |
| DeepSeek out | Pause; check account balance and [provider preflight](hosted-web.md#verify-pause-resume-and-rotate). | Resume after qualification; otherwise labelled replay/offline extracts. |
| Testnet reset | Pause; review saved identities/markers, then `node --import tsx scripts/hosted-wallets.ts --testnet --out "$RA_PRIVATE_DIR/wallets" --fund`. Requalify before Resume. | Preserve journals/signers/markers; replay/video if ledger evidence vanished. |
| Session flood | Run private status; keep the browser cookie. Let guards reject excess sessions; Pause if unusable. | Resume after recovery; never clear sessions or raise limits. |
| Judge says “out of questions” | Open the status URL in their existing browser; offer the corner's recorded verification or replay. | Daily allowance resets on the UTC day; no operator reset or new-cookie bypass. |
| Budget function stopped the VM | Open billing and the [VM](https://console.cloud.google.com/compute/instances?project=researchagent-sff); leave stopped. No supported budget-function restart command exists here. | Replay. App Resume cannot start a VM; never restart to defeat S$40. |

Limits ([contract](hosted-web.md#limits-and-accounting), `server/hosted/limits.ts`):
**5 started questions + 15 plans per session/day**;
**60 admissions/IP/day, 6 starts/minute**; **300 admissions/demo/day**.
Gross limits are **1,000 / 12,000 / 60,000 minor** respectively; each question
is at most **200 minor**. Cancelled plans spare questions, not model costs.
New sessions: **120/address/hour**, table **5,000**. One run, two waiting;
busy alone needs no intervention.

A whole-service Resume arms [automatic resume](hosted-web.md#if-the-vm-restarts-by-itself)
for that exact release after an unexpected restart. New releases, money/operator
pauses and expiry stay paused. For code rollback, Pause; follow
[Rollback](hosted-web.md#rollback): accepted image digests, IAP,
`/opt/researchagent/update.sh`, current database, requalification. Never restore
an old database over obligations; snapshot restore is not a proven shortcut.

## Set video and proof links without a redeploy

Set `$RA_VIDEO_URL` and `$RA_PROOF_URL` to actual public HTTPS links.
The [#488 state-disk file](hosted-web.md#control-and-status) is read each status poll:

```sh
node scripts/hosted-control.mjs links --project researchagent-sff --execute
node scripts/hosted-control.mjs links --project researchagent-sff --execute --video "$RA_VIDEO_URL" --proof "$RA_PROOF_URL"
node scripts/hosted-control.mjs links --project researchagent-sff --execute --clear video
```

Rollback: restore previous values, or `--clear proof` / `--clear all`. Check on
the phone. The VM-down front cannot read this file; its `HOSTED_VIDEO_URL`
still requires a front redeploy.

## Pitch day · 18 Nov

Use a **phone hotspot**: venue Wi-Fi shares IP limits. Prepare [tabs](stage.md)
in one profile: finished x402 run/key check, refusal/proof, its EscrowFinish,
replay, local PDF. Two prepared runs use two questions; history lasts 24 hours.
**Ten minutes before the 11:30 SGT pitch**, run:

```sh
node scripts/stage-check.mjs --video /absolute/path/to/final-video.mp4
```

No question is asked. Follow GO/NO-GO; also play the MP4 and open the actual key
transaction. File signatures do not prove playback.

| Tier | Show and label honestly |
| --- | --- |
| 1 · Live | Prepared run, actual cost/count, **Check the key yourself**, corner verification. Say “a run from ten minutes ago” only if true. No fresh question. |
| 2 · Sandbox unavailable | Open runs or reachable corner, plus explorer. “A recorded run from the live sandbox, 11 Nov.” Site unreachable and no tabs: tier 3. |
| 3 · Explorer/node unavailable | Local replay and offline verification. “Replay of a recorded Testnet run, no backend.” Public-ledger checks are not running. |
| 4 · No network | Local MP4 **0:09–1:27**, PDF slides **3, 5, 10**, offline verifier. “This is our recorded demo.” |

Before the pitch, start replay and open its printed ephemeral URL. Keep that
terminal running; Ctrl-C stops it. Save MP4, PDF and receipts locally:

```sh
node scripts/stage-check.mjs --serve-replay --rebuild
node --import tsx scripts/verify-answer.ts public/judge/hosted-run-nov11.receipts.json
```

**“Paid on delivery. Proven on the ledger.”** Testnet first; computed key match,
writer-signed refund limit, zero-question verification, recorded unsigned RLUSD
verdict, close. [Two-minute timing](stage.md) · [pitch](submission/pitch-2min.md).
Keep observed results and fixture/recorded/writer labels. Failed lookups never
earn a current green check.

## Teardown · 20 Nov

Admissions end **00:00 SGT**. The intended instance stop is **00:30 SGT**;
verify its schedule in the VM console, since the deploy helper does not create
it. Neither stops billing for every resource. Point links to the replay.

**Owner decides deletion.** Pause, reconcile, archive privately and verify
recovery readability before setting `pendingObligations: 0`, `archiveVerified: true`
in the manifest. Preview; execute only if chosen:

```sh
make hosted-teardown ARGS="--project researchagent-sff --manifest $RA_PRIVATE_DIR/deployment.json --dry-run"
make hosted-teardown ARGS="--project researchagent-sff --manifest $RA_PRIVATE_DIR/deployment.json --execute"
```

[Teardown](hosted-web.md#teardown-on-20-nov) removes service, VM, original disk
and tracked infrastructure; retains final snapshot/project. **Owner decides**
snapshot deletion, billing unlink and project deletion later. Check residual billing.

## Never do

- Never use real money or Mainnet spending.
- Never paste seeds or keys into commands, this document, chat or logs.
- From **13 Nov**, agents never ask hosted questions except **one smoke per deploy**;
  use local stacks for tests. The owner's pre-asked pitch runs are separate.
