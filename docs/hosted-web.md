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
| `HOSTED_DECK_URL`, `HOSTED_VIDEO_URL`, `HOSTED_PROGRESS_URL`, `HOSTED_REPLAY_URL` | Public evidence links. Deck, progress and replay default to the repo's deck PDF and the gh-pages `/progress/` and `/demo/` pages; the video stays hidden until `HOSTED_VIDEO_URL` is set. The operator's links file on the state disk (`hosted-control.mjs links`, below) overrides `video` and adds an optional `proof` link without a redeploy. `HOSTED_VIDEO_URL` in the deploying shell is also given to the Cloud Run front for its paused page. |
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
Only a SHA-256 cookie hash is stored. A session that never asked a question is dropped
after 2 hours instead (it holds no money and no run); the page notices the next time it
asks, fetches a new token and repeats the request once, so a visitor sees nothing. Every mutation requires that cookie, the
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
SSE streams per visitor and 16 globally are allowed; a visitor's newest stream
replaces their oldest (a closed tab's stream can stay open behind the proxies), a
settled run (final payments and its ledger anchor) answers 204 so EventSource stops,
snapshots/backpressure are bounded to 256 KiB and streams close after 10 minutes or
at session expiry, whichever is first. All private responses
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
| Session / UTC day | 5 questions, 1,000 minor gross, one outstanding question (a new question replaces the visitor's own unstarted plan or chat reply, which still counts) |
| IP / UTC day | 60 questions, 12,000 minor gross; 3 starts/minute |
| Whole demo / UTC day | 300 admissions, 60,000 minor gross |
| Whole demo / lifetime | 2,100 admissions, 420,000 minor gross |
| Model USD | $0.05/question, $15/day, $105/lifetime |
| Model tokens / question | Research input 60,000 and output 6,000; decision input 50,000 |
| Queue | One active job, two waiting, 90-second wait, cancellable. Only a question's start queues; planning has its own lane (two plans at once, six waiting, 20-second wait, then 429 `busy`) and does not wait for the running question |
| New sessions / address / hour | 120 (an IPv4 address, or an IPv6 /64; HMAC of it, kept one hour); a request that already carries a live cookie never counts. Over the cap: 429 `session_rate` |
| Session table | 5,000. When full, idle sessions (no question ever) at least 10 minutes old are dropped, oldest first, 500 at a time; a session that asked is never dropped early. Still full: 429 `session_limit` |

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

**Planning while the demo is busy (H7).** `POST /api/scope` no longer waits for the running question (it took 9 to 21 s, or
answered 429 `busy`, whenever another visitor's run held the demo). Planning is one model call that moves no money and
runs inside its hold's model-dollar envelope, so the caps are unchanged; a small separate lane bounds how many plans run
at once. Only a question's start (`POST /runs`) queues. `GET /api/demo/status` adds `wait.estimateSeconds` (and
`estimateSeconds` on each of the visitor's own queue entries): how long until a new question would start, from the
median of the last ten runs plus what is left of the running one, rounded up to 5 s and never below 10 s while a run is
active. It is absent until a run has finished since the service started, because there is nothing to base a number on.
A queued run's first event carries the same estimate.

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

**Links without a redeploy.** `video` and `proof` (the optional links `GET /api/demo/status` returns under `links`) are
re-read on every status call from `links.json` beside the control file on the state disk, and win over `HOSTED_VIDEO_URL`:

```
node scripts/hosted-control.mjs links --project <id> --execute --video https://youtu.be/<id> --proof https://<url>
node scripts/hosted-control.mjs links --project <id> --execute                  # show what is set
node scripts/hosted-control.mjs links --project <id> --execute --clear video    # video | proof | all
```

Each value must be a plain https URL (a real host, at most 300 characters, no spaces or quotes); anything else is
refused by the command and ignored if it reaches the file by hand. Without `--project` it edits the file next to
`HOSTED_CONTROL_PATH`; without `--execute` the remote form only prints its `gcloud` line. The change shows on the
visitor's next status poll; the running service and its start, stop and auto-resume are not touched. (The front's
paused page cannot read this file, because it is served when the VM is down: see the paused-page note below.)

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
funding/ledger headroom, caps, provider preflight freshness (from the background
check, at most 15 s old), unpaused controls and an unexpired admission window. A full
queue is not a failure (200, `queue: "full"`). Paused initialization serves
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
| Alerts | public `/ready` uptime check (front alias of the VM's `/readyz`) + readiness alert (`ra-readyz-failed`); public `/ready/funds` check (alias of `/readyz/funds`) + `ra-payer-funds-low` alert, same channel, when the shared payer holds less than 30 XRP; about US$50 billing budget in the billing account's own currency (S$70 on the SGD account) at 50/90/100%; this alert is not a spending cap |

The VM has an ephemeral external address for outbound package/registry/model/RPC
access. No public inbound app or SSH firewall rule exists. The front has no
wallet, model key, state mount or Secret Manager access. Its header whitelist
preserves session/CSRF/idempotency/SSE headers, discards Authorization and all
unapproved internal headers, and selects the last Cloud Run supplied visitor
address as exactly one X-Forwarded-For hop. VM nginx replaces rather than appends
that hop; HG must trust **one** proxy hop. Access logs are off. Upstream retries
are disabled to avoid replaying a state-changing request. SSE is unbuffered.
An unreachable VM returns a static paused page with HTTP 503 (`docker/hosted/paused.html`). It is the product's
light theme and type, self-contained (the app's own files live on the VM), carries the "XRPL Testnet · no real value"
label, and links the recorded walkthrough, the slide deck and the source. A demo video link appears when the front has
one: export `HOSTED_VIDEO_URL` (a plain https URL) in the shell that runs `ops.mjs deploy`, which passes it to the Cloud
Run front; nginx fills it into the page. The front is the only place that can serve this page while the VM is down, so
this link, unlike the links file below, needs a front redeploy (a Cloud Run revision; the VM is not touched).

## Gateway configuration (HG)

The configuration and limits sections above are the runtime contract. The public
`docker/hosted/env.template` now uses those names. Limits other than the reducible
question cap are code constants; unrecognized template knobs cannot raise them.
The supervisor forwards over loopback, so `HOSTED_TRUSTED_PROXY=127.0.0.1` trusts
that final hop only; nginx must overwrite X-Forwarded-For with one validated IP.
The `/w` path also passes through HG; the publisher is never a public upstream.

Secrets supplied as environment variable **names**, never CLI values, are
`DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `PUBLISHER_SECRET`, `HOSTED_IP_HMAC_KEY`,
`XRPL_PAYER_SEED`, and one `XRPL_PUBLISHER_<SLUG>_SEED` for every served writer, free-only Open Records included (it signs free deliveries; it is never paid, so it needs no funding). Session
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
answers `origin_denied` to any other host).

The guard qualifies the child once per `Host`, not once per request (H6). A
contract answer is kept and re-checked in the background every 10 s, one probe
per Host at a time, each with a 5 s timeout. An answer that is not the contract
(or a refused connection) withdraws it at once. A re-check that is only slow keeps
it until 60 s after the last good answer; after that the guard serves the paused
page again until HG answers. Probes carry the guard's own HG session, never a
visitor's cookie or address, so they mint at most one session a day. The guard
is not the pause authority: HG reports an operator pause itself (paused state,
503 `paused` on asks, 503 `/readyz`), and that passes through unchanged. Before
H6 the guard probed on every request with a 1.5 s timeout. A slow HG readiness
refresh (two Testnet round trips from Singapore, about 0.4 s, sometimes over 1.5 s)
therefore showed visitors and the `/ready` uptime check the paused page while
nothing was paused, and every cookieless probe (6 uptime checks a minute) minted
a session toward HG's 5,000-session ceiling (3,530 by 13:00 SGT on 11 Nov, when the
check was slowed to 900 s). Uptime checks hit `/readyz`, which mints no session, so
every deploy now sets the existing `ra-readyz` check back to 60 s. Evidence:
[evidence/h6](evidence/h6/README.md).
Re-run locally with `node --import tsx scripts/hosted-load.mjs`.

H7 closed the three follow-ups H6 left ([evidence/h7](evidence/h7/README.md)):

- **Session flood.** A client that never keeps a cookie minted a session per request, up
  to the 5,000 ceiling, after which every new visitor was refused. A new session now needs
  room under 120 per address per hour (an IPv6 client counts by its /64), counted with the
  same daily-rotating HMAC as the question caps (no raw address is stored; the records are deleted after an hour). A
  reload, a second tab or a room of judges behind one network address does not reach it.
  Sessions that never asked a question expire after 2 hours, and a full table drops the
  oldest of those before it refuses anyone. The money caps are untouched.
- **Readiness off the request path.** The readiness probe (writer registry, payer balance,
  Testnet ledger) runs on its own timer every 5 s and `/api/demo/status`, `/readyz`,
  `/health` and the ask gate read its last answer from memory (`server/hosted/readiness.ts`).
  **Staleness bound: 15 s.** An answer is used only while the check behind it started at most
  15 s ago; in steady state that is 5 to 11 s (a check is cut off after 6 s and counted as not
  ready). If the timer stops, answers turn into "not ready" after 15 s: it fails closed. Pause,
  the admission window, the money caps and the spending guard are not read from this cache;
  they are still read fresh at every authority boundary.
- **Full queue is busy, not down.** `/readyz` answers 200 `{status:"busy",queue:"full"}`
  when one question is running and two are waiting, so the `ra-readyz-failed` alert does
  not email the owner for a busy demo. It still answers 503 for `paused`, `degraded` and
  `ended`. Visitors see the same busy state and the same refusal as before.

`PublisherClient` accepts only a
numeric-loopback publisher origin, so in compose the API supervisor relays
`127.0.0.1:8790` to `HOSTED_PUBLISHER_UPSTREAM` (`publisher:8790`). Startup
derives `ESCROW_WRITERS` from the deployed writer seeds; without it the
publisher quotes no escrow and every policy purchase is skipped.

## Health and acceptance contract

- `/livez`: process/event loop only; no provider or ledger calls. Cloud Run front
  tests its nginx process, VM API tests its supervised child.
- `/startupz`: HG confirms corpus, state and recovery initialization. A paused
  API is allowed only after HG safely initializes; missing HG returns 503.
- `/readyz`: 200 when HG can admit work (state `ready`) or is merely busy (state `busy`,
  including a full queue, which adds `queue: "full"`): funded, headroom available,
  providers/RPC fresh (last background check at most 15 s old), origin correct, not
  paused/expired. 503 for `paused`, `degraded` and `ended`.
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
redeploy ends **paused**; resume only after the checks below. A VM restart that
nobody asked for does not need an operator when the release was already
qualified: it resumes itself under the guard in
[If the VM restarts by itself](#if-the-vm-restarts-by-itself). The deploy waits for the boot-time startup run, queues a non-blocking
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

`status` also prints `qualified`: the release an operator last resumed
(`{commit, qualifiedAt}`), or `null`. That record is what arms the automatic
resume below. Resuming the whole service writes it from the running container's
`RA_COMMIT` (set from the deployed images file); a release with no id, a partial
resume (`admissions` or `spending` only) and the automatic resume itself write
nothing, and a whole-service resume of a release with no id deletes any earlier
record, so another release's qualification never carries over (this covers a
rollback to an older release).

### If the VM restarts by itself

A redeploy always ends paused. A restart nobody asked for (host failure, kernel
panic) must not strand judges on the paused page for days, so in that one case
the stack may resume itself. It does so only when **all** of these hold:

1. An operator already qualified this exact release: the last whole-service
   `resume` after a passed smoke recorded its commit in `qualified.json` on the
   state disk, and the commit now deployed (VM metadata, images file and the
   running API container) is the same one.
2. Before the restart the service was running, or was paused only by the
   boot-time `deploy` pause itself (a second restart during startup). A pause
   with any other reason (`maintenance`, `operator_paused`, a budget or money
   cap, `prelaunch`) or a half-paused service stays paused.
3. The control has not expired, and nobody has paused it since the restart: its
   reason is still exactly `deploy`.
4. `/startupz` answers 200 and `/readyz` reports the paused state for at least
   three checks over 60 seconds, within ten minutes of boot. While paused,
   `/readyz` hides provider and funding readiness, so those are visible only
   after the resume; if the demo is not ready then, it stays unpaused, refuses
   new work until it recovers by itself, and the log line says so.
5. `hosted-control resume --local` accepts it. It is the operator command, so its
   refusals (missing, invalid or expired control) still apply, and
   `--only-if-reason deploy` makes it refuse if the pause changed after the last
   check.

Anything else stays paused and says why in one line. A deploy through `ops.mjs`
(and any startup run that is not the first after a boot, such as re-rendering
after editing `env.local`) deletes `qualified.json`: it ends paused exactly as
before, and only the manual resume after its smoke arms the automatic resume
again. A planned VM stop and start counts as a restart too; to keep the stack
paused through one, pause first with any reason other than `deploy`. A rollback
is not sticky across a restart either: the restart redeploys the release named
in the VM metadata, which stays paused unless that release was qualified.

```bash
# Armed? "qualified" holds the release an operator resumed, or null.
node scripts/hosted-control.mjs status --project "$RA_PROJECT" --execute
# After a restart, over IAP on the VM: one plain line, resumed or stayed paused and why.
sudo journalctl -t researchagent-autoresume --no-pager
sudo cat /srv/researchagent/autoresume.log
```

Examples: `autoresume: resumed. release 1a2b3c4d5e6f was qualified by an operator
at 2026-11-12T03:10:00.000Z, the service was running before the restart, and the
API stayed healthy for 60 s (/startupz OK, /readyz reporting only the pause).
Readiness after resume: ready.` and `autoresume: stayed paused (new_release):
release … was deployed but only … was qualified by an operator`. The other
reasons are `not_qualified`, `release_mismatch`, `operator_pause`, `expired`,
`operator_pause_now`, `unhealthy` and `resume_refused`. The code is
`docker/hosted/autoresume.mjs`; `startup.sh` records the control file before its
own pause and starts the check detached after the release marker is written.

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

Qualified live on 11 Nov by the H5 sweep ([evidence](evidence/h5-hosted/README.md)): the session
limit (5th question, then the used-up card), the per-IP start rate (4th start in a
minute refused), Stop during a live escrow (cancelled after about 2 minutes, S$0.40
back to the sponsor wallet), reload and offline mid-run, two-context isolation,
keyboard, 200% zoom and reduced motion. It also found that streamed DeepSeek calls were
metered at their worst case, so every paid answer fell back to offline extracts; fixed
in the H5 PR, live after the next release.

Not yet qualified: buyer/writer crash and recovery and snapshot restore in
cloud, the per-IP daily question cap (60) on the live URL, an executed rollback,
and the demo video link (`HOSTED_VIDEO_URL` unset).
The decision model runs as the labelled fixture until the OpenAI key is
rotated. The uptime alert fires whenever the service is paused, including
during every redeploy. The project's auto-created `default` network keeps its
open SSH/RDP rules; it has no instances.

Every redeploy ends paused. The provider-preflight deadline in
`env.local` must be moved forward at each release, or readiness turns
`degraded` when it passes. Resume with
`node scripts/hosted-control.mjs resume --project researchagent-sff --execute`
after the paused smoke, then run the live smoke. That resume also arms the
guarded automatic resume for the release: a restart nobody asked for brings the
same release back without an operator, and anything else (a new commit, an
operator or money pause, an expired control, an unhealthy API) leaves it paused.
Not yet drilled on the VM.

Reference commands were checked against official documentation for
[Direct VPC egress](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc),
[Run deploy](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy),
[uptime checks](https://docs.cloud.google.com/monitoring/uptime-checks) and
[billing budgets](https://docs.cloud.google.com/sdk/gcloud/reference/billing/budgets/create).
