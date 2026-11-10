# Hosted judge demo operations

The app runs on one Singapore Compute Engine VM with a persistent ext4 disk.
Cloud Run runs only nginx. Its stable `run.app` origin forwards to the VM's
internal address over Direct VPC egress. SQLite WAL stays on the VM; there is
no Firestore, GCS, Cloud Build bucket, instance-overlap deployment or visitor faucet.
This lane supplies deployment tooling, **not an advertised live service**.

| Component | Setting |
| --- | --- |
| VM | `ra-app`, `e2-standard-2`, `asia-southeast1-b`, Debian 12, Docker Compose |
| State | `ra-state`, 30 GB `pd-balanced`, ext4; `/srv/researchagent`; daily snapshots at 18:00 UTC, seven-day retention |
| Roles | web nginx + production Vite, API, publisher; non-root, tini, read-only images, private tmpfs, restart unless stopped |
| Runtime state | buyer `/state/api/app.db`, reports `/state/api/reports`, publisher `/state/publisher/data/publisher.db`, control `/state/control.json` |
| Permissions | state directories 0700, files 0600, UID/GID 1000; operator env `/etc/researchagent/env` 0600 root-only |
| Network | `ra-vpc`, `ra-egress` `10.77.0.0/24`; VM `10.77.0.10:8080`; only that subnet may reach app; SSH only IAP `35.235.240.0/20` |
| Front | `ra-front`, min 1, max 2 stateless instances, concurrency 32, 3600 s timeout, private-ranges-only Direct VPC egress |
| Updates | pull first, compose **down completes before up**; lock prevents simultaneous deploy scripts; never two API/publisher processes |
| Models | DeepSeek + OpenAI Decisions `gpt-6-luna`; lexical search; fixture fallback must be explicitly selected and labelled |
| Settlement | native XRP key-reveal, XRPL Testnet only, answer anchors on; pre-funded shared payer/writers |
| Event | admissions end `2026-11-19T16:00:00Z` (20 Nov midnight SGT); teardown 20 Nov after recovery/archive checks |
| Alerts | public `/readyz` uptime check + readiness alert; US$50 billing budget at 50/90/100%; this alert is not a spending cap |

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

`docker/hosted/env.template` is the single public configuration template. HG owns
runtime enforcement and the final names for hosted policy/session configuration.
At HO implementation time HG was not merged: the template uses the binding
architecture decision names, and proposed policy names remain **unqualified
until HG confirms them**. Never treat the presence of a template limit as proof
that the gateway enforces it. Match this section and template to HG before launch.

Required shared settings are `HOSTED=1`, exact HTTPS `HOSTED_ORIGIN`,
`HOSTED_ADMISSIONS_UNTIL`, and `HOSTED_CONTROL_PATH=/state/control.json`.
Proposed template limits: question 200 minor; session 5 questions/1000 gross minor
per UTC day; IP 60 questions/12000 minor/day and 3 starts/minute; global
300 questions/60000 minor/day; lifetime 2100 questions/420000 minor; model
US$0.05/question, $15/day, $105 total; one active/two waiting/90 s queue expiry.
HG also enforces 16 KiB bodies, 2000-character questions, 24 h history, ownership,
exact Origin/CSRF, disabled owner/PDF routes and provider freshness.

Secret names supplied as local environment variable **names**, never CLI values:
`DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `PUBLISHER_SECRET`, `HOSTED_SESSION_KEY`,
`HOSTED_IP_HMAC_KEY`, `XRPL_PAYER_SEED`, and every paid roster writer's
`XRPL_PUBLISHER_<SLUG>_SEED`; optional corresponding addresses. HG must confirm
the session/HMAC names. Deploy copies each value to a 0600 temporary file,
creates an immutable per-release Secret Manager secret with version 1, grants
only the VM identity access, then deletes the local scratch files. Startup renders
those pinned versions into the private env file. The source archive, Docker build
arguments, metadata and printed plan contain no secret values. Restrict operator
shell tracing/history; scripts never read the owner's `.env` automatically.

`docker/hosted/start.mjs` is a packaging guard. The raw API binds loopback inside
its container; public traffic is forwarded only when `/api/demo/status` returns
the hosted contract. Without HG it serves paused status/503 and rejects asks,
while the publisher and recovery process can initialize. It never falls through
to local owner routes. The original `Dockerfile.publisher` K_SERVICE guard is
unchanged; new stateful roles also refuse K_SERVICE.

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

Use a clean gated checkout and an approved existing **USD** billing account.
Supply public identifiers and private output paths outside the repository.
These are operator instructions, not evidence that any command ran in cloud.

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
```

The script builds from `git archive SHA` locally, uses each Dockerfile's own
ignore file, pushes immutable full-SHA tags, resolves and records digests, then
deploys those digests. It creates the project/billing link/APIs/registry, identities,
secrets, VPC/subnet/firewall, disk/snapshot schedule, VM/startup, Cloud Run front,
uptime check/readiness alert and project-filtered US$50 budget. No GCS source
bucket or Developer Connect connection is used. Initial startup is paused with a
placeholder origin; after Run returns its stable URL, metadata is updated and the
VM renders the exact origin and restarts while still paused. Retries preserve
existing control and journals. Package/bootstrap and cloud IAM/quotas remain
cloud acceptance work. The VM image family selects Debian 12; app image bases
are exact version tags and app release images are deployed by digest.

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
a SHA retains its original version-1 secrets. Model/session-key rotation may
invalidate sessions. Payer/writer identity rotation requires explicit obligation
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

1. Confirm HG's actual env/secret/control names and one-hop proxy trust. Verify
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
front 6801. HG absent means the normal isolation/purchase probes remain blocked.
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

Reference commands were checked against official documentation for
[Direct VPC egress](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc),
[Run deploy](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy),
[uptime checks](https://docs.cloud.google.com/monitoring/uptime-checks) and
[billing budgets](https://docs.cloud.google.com/sdk/gcloud/reference/billing/budgets/create).
Cloud execution remains unverified.
