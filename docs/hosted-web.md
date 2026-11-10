# Hosted gateway: configuration and limits

This section describes the HG gateway. Deployment, provisioning, snapshots and the
public URL smoke test belong to the operations runbook. Local, desktop and MCP
behavior stays unchanged unless `HOSTED=1` is explicitly set. This source change
is not evidence of a deployed or funded service.

## Configuration (operator owned)

Use one API process and one publisher process, with the existing SQLite WAL
journals on one persistent disk. Deploy stop-before-start; do not overlap old and
new processes or mount independent databases behind the same payer. No Firestore
or GCS migration is involved. The front proxy must send the exact public Host.

| Variable | Contract |
| --- | --- |
| `HOSTED` | `1` enables the gateway. Invalid initialization serves a paused shell; it never falls back to owner authority. |
| `HOSTED_ORIGIN` | Exact HTTPS origin without a trailing slash, path, credentials or query. |
| `HOSTED_TRUSTED_PROXY` | One numeric IP: the directly connected trusted forwarder (127.0.0.1 for the packaged supervisor). It must overwrite X-Forwarded-For with exactly one validated client IP. Comma-separated chains and untrusted senders are rejected. Do not append an unvalidated Cloud Run chain. |
| `HOSTED_IP_HMAC_KEY` | Separate secret, at least 32 characters. Daily-derived HMACs identify abuse buckets; raw IPs are not written to the application database. |
| `HOSTED_CONTROL_PATH` | Durable local control file, default `data/hosted-control.json`. Missing, malformed, unreadable or expired means both admission and spending paused. |
| `HOSTED_ADMISSIONS_UNTIL` | Default and latest permitted deadline: `2026-11-19T16:00:00Z`. Earlier cutoffs are allowed. |
| `HOSTED_QUESTION_CAP_MINOR` | Default 200; may only reduce the per-question cap. |
| `HOSTED_PROVIDERS_READY_UNTIL` | Expiry of the operator's provider preflight evidence. Readiness fails after expiry. Do not set this without testing actual account/model access. |
| `HOSTED_RESEARCH_INPUT_USD_PER_MILLION`, `HOSTED_RESEARCH_OUTPUT_USD_PER_MILLION` | Conservative upper billing rates for the selected research model, including its peak tier. Missing or invalid rates prevent calls. |
| `HOSTED_DECISION_INPUT_USD_PER_MILLION`, `HOSTED_DECISION_OUTPUT_USD_PER_MILLION` | Separate conservative upper rates for the selected decision provider/model. |
| `HOSTED_DECISION_OUTPUT_TOKENS` | Bounded decision-attempt output envelope, default 8192. Qualify the selected provider's bound before enabling admission. |
| `HOSTED_DECK_URL`, `HOSTED_VIDEO_URL`, `HOSTED_PROGRESS_URL`, `HOSTED_REPLAY_URL` | Public evidence links; replay defaults to the recorded demo. |
| `APP_DB`, `REPORT_DIR` | Existing durable buyer journal and private report paths. Never serve either directory as static content. |
| `WALLET_DAILY_CAP_MINOR` | Existing wallet authority remains an additional ceiling. Provision a suitable sponsored cap explicitly; the local default remains unchanged. |

Use the pre-funded shared Testnet payer through the existing rail/seed settings.
Keys remain operator secrets. The gateway never provisions or faucets visitor
wallets. Hosted BYOK/compatible provider profiles and live remote search embeddings
currently fail initialization closed: publisher-side embedding attempts are not
yet qualified against the per-attempt model ledger. Use keyword search with
DeepSeek and OpenAI Decisions or Clef. Fixture substitution remains labelled on
answers and receipts. Do not advertise a live model result from configuration
alone; record the actual provider/rail identity in launch acceptance.

## Visitor and route contract

`GET /api/demo/status` issues an opaque `__Host-ra_session` cookie (Secure,
HttpOnly, SameSite=Lax, Path=/, absolute 24-hour lifetime) and returns `csrfToken`.
Only a SHA-256 cookie hash is stored. Every mutation requires that cookie, the
exact `Origin`, and `X-CSRF-Token`; Fetch Metadata must be same-origin when sent.
No CORS permission is emitted. Public bearer/principal/internal routing headers
are stripped. A supplied owner bearer cannot grant public authority.

HU must preserve an `Idempotency-Key` (1–128 ASCII letters, digits, underscore or
hyphen) across scope, submit, network retries and reload recovery. Scope reserves
a draft and its full question/model envelope; submit uses the same key. The full
canonical request digest is bound independently at scope and submit; a changed
digest returns 409. Cached scope and submit identities do not repeat work. A
settled-delivery retry requires its own persistent key. It reuses the same run and
intent; it cannot authorize a new purchase. SSE reconnects read durable state.

All run, intent/proof, receipt, JSON report, history, SSE, stop, retry, pin and
delete paths check the persisted principal before reading payloads. Missing,
foreign, hidden and expired IDs use the same 404 response. History includes all
of this visitor's visible runs, without the local four-run limit. Two concurrent
SSE streams per visitor and 16 globally are allowed; snapshots/backpressure are
bounded to 256 KiB and streams close at session expiry. All private responses
use `Cache-Control: private, no-store` and vary on Cookie/Origin.

The public API is an allowlist. Settings, reset reputation, keys/BYOK, wallet
funding, global wallet/export/ledger/audit, metrics, remote MCP/hire, publisher
faults, presenter/record, provider probes, online verification and PDF/HTML report
generation/downloads are unavailable. Writer status exposes bounded public
registry metadata only. **Route `/w` to this gateway, never directly to the writer
server**; quote/redeem/finish/fault administration must remain internal. The
publisher port itself must not be publicly reachable.

Learned writer reputation uses the visitor principal, including background proof
updates. No visitor can mutate a global publisher fault switch. A future guided
fault scenario must be bound to a run; there is no public fault endpoint here.

## Limits and accounting

| Scope | Maximum |
| --- | --- |
| Question | 200 minor gross; 2,000 characters; JSON bodies 16 KiB |
| Session / UTC day | 5 questions, 1,000 minor gross, one outstanding question |
| IP / UTC day | 60 questions, 12,000 minor gross; 3 starts/minute |
| Whole demo / UTC day | 300 admissions, 60,000 minor gross |
| Whole demo / lifetime | 2,100 admissions, 420,000 minor gross |
| Model USD | $0.05/question, $15/day, $105/lifetime |
| Model tokens / question | Research input 60,000 and output 6,000; decision input 50,000 |
| Queue | One active job, two waiting, 90-second wait, cancellable |

SQLite immediate transactions reserve the requested gross allowance and complete
$0.05 model envelope before queueing. Provider transports reserve integer
microdollars and worst-case tokens before **each attempt**, inside existing retry
loops. Completed provider usage can reduce the reservation; failed, partial,
missing-usage and malformed responses retain it. Unknown billing rates fail
closed. Refunds never restore gross authority. A terminal run releases unused
principal only when all intents prove final settlement or non-settlement;
uncertain money keeps the full hold. Outstanding holds count across midnight
and restart. Question counts are not refunded. IP HMAC buckets expire after 24
hours; unresolved global/session obligations remain held.

Restart stops interrupted research rather than silently replaying it. Existing
payment, refund, cancellation and anchor journals still reconcile; a paused
signer can cancel an outstanding escrow and re-send an already signed blob.
Pause is checked synchronously immediately before each new buyer signature;
new payments, creates, releases and anchors cannot sign while spending is paused.
Local operator pause and wallet caps remain additional restrictions.

Active history is inaccessible after 24 hours. The startup and one-minute retention sweeps
prunes terminal research payloads older than one day, preserving unresolved
payment journals and audit/idempotency records. Abandoned drafts release only their unused envelope after 90 seconds; draft scope payloads expire;
question commitments in hosted holds are hashes, not duplicate plaintext.
Langfuse export/public traces are disabled for hosted traffic. Provider/network
services can still receive request metadata; the operations runbook must qualify
proxy/cloud log retention before making broader privacy claims. Do not enter
personal or confidential information.

## Control and status

Initialize paused with `node scripts/hosted-control.mjs init`. Use `status`,
`pause [all|admissions|spending]` or `resume [all|admissions|spending]` over the
private operator channel. `--project` selects the IAP remote interface, which
defaults to dry-run and requires `--execute` to act. Writes use a
0600 temporary file, fsync, atomic rename and directory fsync. Set
`HOSTED_CONTROL_EXPIRES_AT` for an earlier control expiry. Resume refuses missing, malformed or expired control; no public route can
resume the service. An explicit future `HOSTED_CONTROL_EXPIRES_AT` can renew
control only while pausing, never silently during resume.

`GET /api/demo/status` returns `state` (`ready`, `paused`, `busy`, `degraded`,
`ended`), capabilities, remaining question/minor allowance, model/rail labels,
evidence links, CSRF token, and own queue positions. `src/api.ts` exports the typed
client; HU owns screen rendering and mutation headers.

**Hosted UI (HU).** The web app requests this status before its first render. A local
or desktop server answers `200 {"hosted":false}` (older builds, a 404), which render
unchanged and keep the browser console clean. Otherwise the app shows the
judge shell:

- an orientation line, then the visitor's own question (budget capped at
  S$2.00, remaining questions shown);
- one environment indicator with details on demand;
- a single state card for paused (exact copy), ended, allowance used up, on
  hold, offline or not responding;
- a wait card with Cancel for `busy`;
- after Stop, one true line for each purchase.

The run page adds **Verify on XRPL in your browser**: `sdk/verify.ts`, run
client-side against public Testnet nodes, read-only.

Owner controls are not rendered: Settings, BYOK, faucet, Presenter, Record,
⌘, and PDF. The sidebar lists only the visitor's runs, with **Clear my
history**. Mutations send `X-CSRF-Token` and an `Idempotency-Key` (fresh for
each question, reused on retry). Gateway refusals map from codes to plain
sentences in `src/hosted.ts`.

Locally: `npx playwright test --config tests/playwright/hosted.config.ts`
(local-gate step `browser-hosted`). Evidence:
[evidence/hosted-ui](evidence/hosted-ui/README.md).

`/livez` reports process liveness. `/startupz` requires writable DB, initialized
recovery and reachable corpus registry. `/readyz` additionally requires current
funding/ledger headroom, caps, provider preflight freshness, queue capacity,
unpaused controls and an unexpired admission window. Paused initialization serves
liveness and status but fails startup/readiness. Launch acceptance must still
exercise two actual deployed cookie jars, proxy-header spoofing, a real Testnet
purchase/refund/restart and read-only explorer verification before advertising a
URL; local synthetic tests do not establish those outcomes.

---

## Deployment and operations runbook

The app runs on one Singapore Compute Engine VM with a persistent ext4 disk.
Cloud Run runs only nginx. Its stable `run.app` origin forwards to the VM's
internal address over Direct VPC egress. SQLite WAL stays on the VM; there is
no Firestore, GCS, Cloud Build bucket, instance-overlap deployment or visitor faucet.
First deployed on 11 Nov 2026 to project `researchagent-sff`:
https://ra-front-651013803640.asia-southeast1.run.app (see
[Deployment record](#deployment-record-11-nov-2026)).

| Component | Setting |
| --- | --- |
| VM | `ra-app`, `e2-standard-2`, `asia-southeast1-b`, Debian 12, Docker Compose |
| State | `ra-state`, 30 GB `pd-balanced`, ext4; `/srv/researchagent`; daily snapshots at 18:00 UTC, seven-day retention |
| Roles | web nginx + production Vite, API, publisher; non-root, tini, read-only images, private tmpfs, restart unless stopped |
| Identities | VM `ra-app-vm` (registry reader, its own named secrets); front `ra-front` (no secrets); IDs must be 6-30 characters |
| Runtime state | buyer `/state/api/app.db`, reports `/state/api/reports`, publisher `/state/publisher/data/publisher.db`, control `/state/control.json` |
| Permissions | state directories 0700, files 0600, UID/GID 1000; operator env `/etc/researchagent/env` 0600 root-only |
| Network | `ra-vpc`, `ra-egress` `10.77.0.0/24`; VM `10.77.0.10:8080`; only that subnet may reach app; SSH only IAP `35.235.240.0/20` |
| Front | `ra-front`, min 1, max 2 stateless instances, concurrency 32, 3600 s timeout, private-ranges-only Direct VPC egress |
| Updates | pull first, compose **down completes before up**; lock prevents simultaneous deploy scripts; never two API/publisher processes |
| Models | DeepSeek + OpenAI Decisions `gpt-6-luna`; lexical search; fixture fallback must be explicitly selected and labelled (11 Nov: `DECISION_PROVIDER=fixture` until the OpenAI key is rotated) |
| Settlement | native XRP key-reveal, XRPL Testnet only, answer anchors on; pre-funded shared payer/writers |
| Event | admissions end `2026-11-19T16:00:00Z` (20 Nov midnight SGT); teardown 20 Nov after recovery/archive checks |
| Alerts | public `/ready` uptime check (front alias of the VM's `/readyz`) + readiness alert; about US$50 billing budget in the billing account's own currency (S$70 on the SGD account) at 50/90/100%; this alert is not a spending cap |

The VM has an ephemeral external address for outbound package/registry/model/RPC
access. No public inbound app or SSH firewall rule exists. The front has no
wallet, model key, state mount or Secret Manager access. Its header whitelist
preserves session/CSRF/idempotency/SSE headers, discards Authorization and all
unapproved internal headers, and selects the last Cloud Run supplied visitor
address as exactly one X-Forwarded-For hop. VM nginx replaces rather than appends
that hop; HG must trust **one** proxy hop. Access logs are off. Upstream retries
are disabled to avoid replaying a state-changing request. SSE is unbuffered.
An unreachable VM returns a static paused page with HTTP 503 and a recording link.

## Gateway configuration (HG)

The configuration and limits sections above are the runtime contract. The public
`docker/hosted/env.template` now uses those names. Limits other than the reducible
question cap are code constants; unrecognized template knobs cannot raise them.
The supervisor forwards over loopback, so `HOSTED_TRUSTED_PROXY=127.0.0.1` trusts
that final hop only; nginx must overwrite X-Forwarded-For with one validated IP.
The `/w` path also passes through HG; the publisher is never a public upstream.

Secrets supplied as environment variable **names**, never CLI values, are
`DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `PUBLISHER_SECRET`, `HOSTED_IP_HMAC_KEY`,
`XRPL_PAYER_SEED`, and paid roster `XRPL_PUBLISHER_<SLUG>_SEED` values. Session
cookies are random opaque values with server-side hashes; no session signing key
is required. Deploy copies secrets through 0600 temporary files into pinned
Secret Manager versions and removes local scratch files. The front receives no
keys. Scripts never read the owner's `.env` automatically.

Provider prices default to invalid zero rates and the provider-preflight deadline
to expired. Keep control paused while setting conservative rates and a verified
freshness deadline in the private runtime environment over IAP, then restart and
qualify the exact images before resuming. Templates do not prove live readiness.

`docker/hosted/start.mjs` is a packaging guard. The raw API binds loopback inside
its container; public traffic is forwarded only when `/api/demo/status` returns
the hosted contract. Without HG it serves paused status/503 and rejects asks,
while the publisher and recovery process can initialize. It never falls through
to local owner routes. The original `docker/Dockerfile.publisher` K_SERVICE guard is
unchanged; new stateful roles also refuse K_SERVICE. The guard probes HG over
`node:http` with the visitor's exact `Host` (`fetch()` drops `Host`, and HG
answers `origin_denied` to any other host). `PublisherClient` accepts only a
numeric-loopback publisher origin, so in compose the API supervisor relays
`127.0.0.1:8790` to `HOSTED_PUBLISHER_UPSTREAM` (`publisher:8790`). Startup
derives `ESCROW_WRITERS` from the deployed writer seeds; without it the
publisher quotes no escrow and every policy purchase is skipped.

## Health and acceptance contract

- `/livez`: process/event loop only; no provider or ledger calls. Cloud Run front
  tests its nginx process, VM API tests its supervised child.
- `/startupz`: HG confirms corpus, state and recovery initialization. A paused
  API is allowed only after HG safely initializes; missing HG returns 503.
- `/readyz`: 200 only when HG can admit work: funded, headroom available,
  providers/RPC fresh, origin correct, not paused/expired; otherwise 503.
- `/api/demo/status`: bounded safe JSON with state, capabilities, own remaining
  allowance, actual model/rail labels and public links. No operator diagnostics.

A healthy front process does not establish a ready wallet. Keep admissions paused
until all checks below pass on the exact deployed image digests.

## Operations and orchestrator-only commands

Only the orchestrator executes cloud mutations. All shell helpers default to
**dry-run**; `--execute` is explicit. A dry-run invokes neither gcloud nor Docker,
reads no secret values and writes no cloud/private manifest. It prints exact
argv for create/describe/update operations; resolved digests, project number and
first service URL are labelled placeholders until the corresponding read returns.
Describe-before-create handles existing resources; denied/unavailable inventory
fails closed. Retry a partial operation using the **same** manifest/project/SHA.
Never adopt an unrelated existing project. A failed run retains private manifest
ownership and created secret identifiers; inspect partial resources before retry.
No downloaded service-account keys are used. The operator needs project creation,
approved billing link, service enablement, registry write, secret administration,
VM/network/Run/IAM administration, IAP/OS Login and monitoring/budget permissions.
The runtime receives registry reader and access to its individually named secrets.
Supply --alert-email to create the operator channel in the new project, or
--notification-channel to reuse an already verified channel on a retry. Verify
actual alert delivery before advertising the URL.

### Exact command sequence

Use a clean gated checkout and an approved existing billing account. The budget
is stated in that account's currency: the script reads `currencyCode` and uses
50USD or 70SGD, or an explicit `--budget-amount <amount><CURRENCY>` (a USD
amount on an SGD account is rejected by Cloud Billing). Supply public
identifiers and private output paths outside the repository. The deploy runs
its own publishing gate, which refuses a dirty tree, so run it from a separate
clean worktree detached at the release SHA rather than a checkout you are editing.

A project that already exists (for example one the orchestrator created and
linked) is adopted only with `--adopt-project`, and only when it carries the
`purpose=sff-demo,expires=20261120` labels and is linked to the same billing
account; the manifest records `adopted: true`. `--gate-lock <script>` queues the
deploy's own `npm run gate -- --publish` behind the shared host lock.

Load secrets through a private wrapper outside the repository (mode 0700) that
exports **only** `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, the hosted payer/writer
seeds, and `PUBLISHER_SECRET`/`HOSTED_IP_HMAC_KEY` (generated once, 0600,
reused across deploys), then `exec "$@"`. Never source the owner's whole `.env`:
the script uploads every `XRPL_PUBLISHER_*_SEED` it finds. Derive the alert
address inside the wrapper (for example `$(gcloud config get account)`) so it
never appears in output; plans print `<alert-email>` and gcloud diagnostics go
to `<manifest>.log` (0600).

```bash
# 1. Plan provisioning. The execute call writes seeds before connecting/funding.
node --import tsx scripts/hosted-wallets.ts --testnet --out "$RA_PRIVATE_DIR/wallets" --dry-run
node --import tsx scripts/hosted-wallets.ts --testnet --out "$RA_PRIVATE_DIR/wallets" --fund
# Re-running reads balances and retains identities. Each wallet gets at most one
# durable faucet attempt; an uncertain/failed attempt requires private review.
# Do not delete attempt markers merely to make the faucet retry.

# 2. Load approved raw keys and provisioned seeds into named shell env variables.
# No cat .env, eval, set -x, secret literals in arguments, or printed seed values.
# Check public.json balances and headroom before proceeding.

# 3. Review the plan, including all secret variable names and firewall ranges.
make hosted-deploy ARGS="--project $RA_PROJECT --billing-account $RA_BILLING_ACCOUNT --sha $RA_SHA --manifest $RA_PRIVATE_DIR/deployment.json --alert-email $RA_ALERT_EMAIL --dry-run"

# 4. Orchestrator only. Requires clean selected HEAD and published local gate.
make hosted-deploy ARGS="--project $RA_PROJECT --billing-account $RA_BILLING_ACCOUNT --sha $RA_SHA --manifest $RA_PRIVATE_DIR/deployment.json --alert-email $RA_ALERT_EMAIL --execute"

# Release redeploy of the existing service (same manifest, project and VM):
$RA_PRIVATE_DIR/hosted-env.sh bash -c 'node docker/hosted/ops.mjs deploy --project researchagent-sff \
  --billing-account 01A738-0E0204-1A40C6 --sha "$0" --manifest $RA_PRIVATE_DIR/deployment.json \
  --alert-email "$RA_ALERT_EMAIL" --gate-lock <heavy-lock.sh> --execute' "$(git rev-parse HEAD)"
```

A redeploy reuses the VM, disk, journals and control file. The startup script
pauses admissions and spending before it stops the old stack, so every
redeploy (and every VM reboot) ends **paused**; resume only after the checks
below. The deploy waits for the boot-time startup run, queues a non-blocking
restart and requires the release marker `/run/researchagent-startup.done`
(`<sha> <origin>`), because the metadata script runner exits 0 even when the
script fails.

Operator-qualified runtime values live in `/etc/researchagent/env.local`
(root, 0600) on the VM. `startup.sh` applies it after the public template on
every render, so reboots and redeploys keep it. Only these names are accepted
(anything else stops the start): `HOSTED_PROVIDERS_READY_UNTIL`,
`HOSTED_{RESEARCH,DECISION}_{INPUT,OUTPUT}_USD_PER_MILLION`,
`HOSTED_DECISION_OUTPUT_TOKENS`, `HOSTED_QUESTION_CAP_MINOR`,
`HOSTED_ADMISSIONS_UNTIL`, `HOSTED_{DECK,VIDEO,PROGRESS,REPLAY}_URL`,
`WALLET_DAILY_CAP_MINOR` and `DECISION_PROVIDER` (`openai`, `cloudflare` or
`fixture`; a fixture decision model is labelled on every answer and receipt).

The script builds from `git archive SHA` locally, uses each Dockerfile's own
ignore file, pushes immutable full-SHA tags, resolves and records digests, then
deploys those digests. It creates the project/billing link/APIs/registry, identities,
secrets, VPC/subnet/firewall, disk/snapshot schedule, VM/startup, Cloud Run front,
uptime check/readiness alert and a project-filtered budget in the billing currency. No GCS source
bucket or Developer Connect connection is used. Initial startup is paused with a
placeholder origin; after Run returns its stable URL, metadata is updated and the
VM renders the exact origin and restarts while still paused. Retries preserve
existing control and journals. Package/bootstrap and cloud IAM/quotas remain
cloud acceptance work. The VM image family selects Debian 12; app image bases
are exact version tags plus registry manifest digests; app releases are also
deployed by digest.

### Verify, pause, resume and rotate

```bash
node scripts/hosted-control.mjs status --project "$RA_PROJECT" --dry-run
node scripts/hosted-control.mjs status --project "$RA_PROJECT" --execute
node scripts/hosted-control.mjs pause --project "$RA_PROJECT" --reason maintenance --execute
# Wait for active research and every outstanding create/finish/refund/cancel/anchor
# to reconcile. Check the HG operator state privately over IAP; no public admin API.
# Before resume: qualify HG configuration, funding, providers, disk and limits.
node scripts/hosted-control.mjs resume --project "$RA_PROJECT" --execute
make hosted-smoke ARGS="--url $RA_URL --question '$RA_OWN_QUESTION' --paused-url $RA_PAUSED_URL --execute"
```

The control CLI enters the existing API container over IAP, atomically replaces
control with fsync and retains 0600. Missing control fails closed. `init` never
resets existing state; `resume` refuses expiry. Pausing must not prevent recovery
of existing obligations. A separate paused local/acceptance endpoint is required
by smoke; smoke never toggles production control automatically.

For key rotation, pause/drain first, use a new gated release SHA with new local env
values so new pinned secrets are created, deploy, verify and then resume. Reusing
a SHA retains its original version-1 secrets. Retain session hashes and hosted holds during key rotation. Payer/writer identity rotation requires explicit obligation
reconciliation and retention of old recovery signers; never overwrite a wallet
just to resolve a pending transaction. Manifest retains earlier secret identifiers
for teardown, and accepted prior manifests should be saved privately for rollback.

## Rollback

Pause and reconcile first. Save `/etc/researchagent/images` and the accepted
manifest privately for every release. Over IAP, restore only the previous accepted
**image digest file**, then run `/opt/researchagent/update.sh` (pull, down, up).
Do not restore an old database or replace a persistent disk over new obligations.
The previous app must read the current schema; otherwise remain paused. To roll
back the stateless front, `gcloud run deploy ra-front --image <accepted-digest>`
with the same network/service settings, or direct all traffic to its accepted
revision. Never split traffic across two stateful VM stacks. Run readiness,
isolation, Testnet receipt and explorer checks again before resuming.

Dry-run on 11 Nov: the previous release's digests (`a5884cea`) were written to
a root-only temporary env file on the VM; `docker compose config --images`
rendered all three digests and `docker compose pull` fetched them with the VM
identity, while `/etc/researchagent/images` and the running stack stayed
unchanged. Earlier `ra-front` revisions remain listed for a front rollback.
An actual rollback has not been executed.

## Caddy / sslip.io fallback

If Direct VPC egress cannot be qualified, keep the same VM/disk and use the
optional `fallback.compose.yaml` plus `Caddyfile`. Allocate/record the VM address,
set `FALLBACK_HOST=<VM-IP>.sslip.io`, create private UID-1000 0700 `caddy` and
`caddy-config` directories on the persistent disk, and explicitly open only
80/443 with a separately named `ra-fallback` firewall rule. Caddy listens on
unprivileged internal 8080/8443 and forwards one remote-address hop. It strips
Authorization and internal principal headers. Public fallback firewall/TLS/DNS actions
are orchestrator-only and outside the default deploy. Change HOSTED_ORIGIN to
that exact HTTPS origin and re-render/restart. Disable the alternate front or
redirect to the canonical host; do not wildcard origins or share cookies. Qualify
TLS, header handling and smoke again. Fallback was not run locally or in cloud.

## Teardown on 20 Nov

Pause admissions/signatures at event expiry; let recovery finish. Purge expired
visitor content through HG's retention path; keep minimal money journals needed
for resolution. Export a minimal private journal/receipt manifest to an approved
location outside this project and verify checksums/recovery readability. Record
`pendingObligations: 0` and `archiveVerified: true` in the private deployment
manifest only after checking them. Pending or uncertain obligations block deletion.

```bash
make hosted-teardown ARGS="--project $RA_PROJECT --manifest $RA_PRIVATE_DIR/deployment.json --dry-run"
make hosted-teardown ARGS="--project $RA_PROJECT --manifest $RA_PRIVATE_DIR/deployment.json --execute"
```

Execute refuses before 20 Nov SGT or without those archive/reconciliation flags.
It stops the VM, takes/validates `ra-final-<release>` snapshot, then deletes the
front, VM, original disk, schedule, firewall, subnet/VPC, tracked secrets,
registry, identities, monitoring and budget. The **final snapshot and dedicated
project remain** so project deletion cannot destroy the final backup. Scheduled
snapshots retain their configured seven-day expiry. Snapshot deletion, billing
unlink and project deletion are separate owner retention decisions after archive
verification. Snapshots may retain visitor content beyond active history expiry;
disclose/protect this backup retention and remove it on the approved schedule.
Subnet deletion may need the same teardown command retried after Run releases
addresses. Verify residual inventory and billing read-only; do not promise instant
physical deletion or a zero final invoice. Point all public entry links to the
recorded walkthrough before shutdown.

## Mandatory checks before advertising the URL

1. Verify the documented env/control names and one-hop proxy trust. Verify
   session cookies, exact Origin/CSRF, owner-route denial and fail-closed boot.
2. Build and run the exact Linux images on the disk. Exercise buyer and writer
   crashes/recovery, stop-before-start updates, pending refund/anchor recovery,
   0600/0700 permissions and restoration from a consistent snapshot. No lost key,
   duplicate intent charge, grant-before-payment or old database restoration.
3. Two cookie jars each create work. Foreign reads, mutations, SSE/reconnect,
   nested intent proofs, receipts, exports, history, delete, stop and retry return
   404 or filtered lists. Include missing cookies, forged headers and cache tests.
4. Supply an own question, live models and funded Testnet payer/writers. Require
   justified purchase, grounded answer, valid signed receipts/grants, validated
   create/finish/anchor hashes and working Testnet explorer links. Do not force
   purchases for irrelevant questions; preserve free-first and abstention.
5. Measure question/session/IP/global/model limits, idempotency/reconnect/restart,
   queue expiry, balance/RPC/provider failure, paused/ended and Stop behavior.
6. Check 1440×900, 390×844, zoom 200%, keyboard and reduced motion on served UI;
   one true environment indicator, no owner setup or per-purchase approval.
7. Exercise VM-unreachable paused page, alert delivery to the verified channel,
   budget recipients/thresholds, compatible rollback and teardown dry-run.
   Verify the served explainer/deck/video/replay links before advertising live.

`hosted-smoke.mjs` records dated sanitized pass/fail checks without raw questions,
cookies, keys, answers or receipt payloads. Live mode costs one bounded own
question plus a second isolation run; offline mode uses fixtures/simulated rail.
A `--expect-paused` run is explicitly **partial paused-shell evidence**, not a
successful isolation/purchase acceptance. SDK verification checks receipt/ledger
semantics; explorer HTTP reachability is recorded separately. More exhaustive
HG/HM crash/concurrency/abuse and HU visual evidence is still required.

## Local proof and remaining qualification

See [local evidence](evidence/hosted-ops/README.md). Docker daemon unavailable:
production Vite build + bundled API/publisher ran natively with HOSTED=1, fixture
models/simulated rail, ports 6800/10488/10490 (OFFSET 1700), raw API 10489 and
front 6801. That historical HO proof predates HG; deployed isolation and purchase probes
were first qualified in cloud on 11 Nov (see the deployment record below).
No cloud deployment, provider call, wallet provisioning or Testnet transaction
was performed by HO. A local proxy probe separately checks header stripping,
one XFF hop, SSE and VM-unreachable paused behavior. All listeners are cleaned up.

Risks: cloud org/public-invoker restrictions, IAM/OS Login, registry/package
availability, Direct VPC startup delays, snapshot consistency, Testnet RPC/reset,
provider quota/access, conference NAT, anonymous abuse and HG integration remain
launch gates. A dependency or cost failure pauses new work without deleting
obligations. Explicit fixture mode uses actual fixture labels; a recording is
chosen separately and never substituted for an arbitrary typed question. If
qualification misses the deadline, publish the dated recorded walkthrough.

## Deployment record (11 Nov 2026)

The first cloud deployment ran on 11 Nov SGT from `f77ae141` against an
orchestrator-created project (adopted with `--adopt-project`) on an SGD billing
account (budget `70SGD`). Eleven cloud failures were fixed and retried with the
same manifest; the table, sanitized smoke results and screenshots are in
[evidence/hosted-deploy-nov11](evidence/hosted-deploy-nov11/README.md).

Qualified on the deployed digests: paused smoke (`--expect-paused`), then after
resume the live acceptance smoke (two cookie jars, every foreign read and
mutation 404, a real policy purchase with SDK-verified receipts and ledger
anchor, four Testnet transactions with reachable explorer links, paused probe
503). Also checked: 1440 and 390 px screenshots of the served home page, alert
email delivery for the readiness policy, budget thresholds and recipient,
VM-unreachable paused page and recovery, rollback and teardown dry-runs.

Not yet qualified: buyer/writer crash and recovery and snapshot restore in
cloud, the limit measurements of check 5, zoom/keyboard/reduced motion on the
served UI, an executed rollback, and deck/video/progress links (empty in status).
The decision model runs as the labelled fixture until the OpenAI key is
rotated. The uptime alert fires whenever the service is paused, including
during every redeploy. The project's auto-created `default` network keeps its
open SSH/RDP rules; it has no instances.

Every redeploy and reboot ends paused. The provider-preflight deadline in
`env.local` must be moved forward at each release, or readiness turns
`degraded` when it passes. Resume with
`node scripts/hosted-control.mjs resume --project researchagent-sff --execute`
after the paused smoke, then run the live smoke.

Reference commands were checked against official documentation for
[Direct VPC egress](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc),
[Run deploy](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy),
[uptime checks](https://docs.cloud.google.com/monitoring/uptime-checks) and
[billing budgets](https://docs.cloud.google.com/sdk/gcloud/reference/billing/budgets/create).
