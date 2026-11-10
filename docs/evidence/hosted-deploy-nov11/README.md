# Hosted judge demo: first cloud deployment, 11 November 2026

**Live URL:** https://ra-front-651013803640.asia-southeast1.run.app
(GCP project `researchagent-sff`, Singapore). Shared XRPL Testnet demo, no real value.

This is cloud evidence for lane H4-early: the deploy tooling from
[hosted-web.md](../../hosted-web.md) executed against a real project, fixed
until it worked, then smoke-tested on the public URL. Files here are sanitized:
no keys, seeds, cookies, CSRF tokens, raw questions' answers or receipt payloads.
The operator alert address and private manifest stay outside the repository.

**State at hand-off (11 Nov, 04:55 SGT):** `ready`, admissions open. `/ready`
and `/readyz` return 200; `/api/demo/status` reports `ready` with 5 questions /
1,000 minor units remaining per session. The rail label reads "Shared XRPL
Testnet demo · no real value". Decisions use the **labelled fixture** model
(`DECISION_PROVIDER=fixture`) until the OpenAI key is rotated; research and
answers use DeepSeek.

## Deployed release

Release `f77ae14179371743e44832164028ae2258202a7d`, deployed by digest from
`asia-southeast1-docker.pkg.dev/researchagent-sff/researchagent/`:

| Image | Digest |
| --- | --- |
| api | `sha256:1e1a49433845de344146d61711db527d424f7305e8a0bbeceace8ef21adce7c6` |
| publisher | `sha256:b5eccce692c24dd158bbb49ae4bc4d56f3e2814301d7acc46095ae995ec8fea0` |
| web | `sha256:931146e37fba31bf3bc919a6c3ac272d27fb9236f30daa0b89e000a215641b12` |
| front (Cloud Run) | `sha256:675e74521ab552d9b39e7909efdfbeb67a7f3e6162a6db296dc48868f7ad989c` |

| Setting | Value |
| --- | --- |
| VM | `ra-app`, e2-standard-2, `asia-southeast1-b`, 30 GB pd-balanced `ra-state`, daily snapshots (7-day retention) |
| Front | `ra-front`, min 1 / max 2, concurrency 32, 3600 s timeout, Direct VPC egress private-ranges-only |
| Firewall | `ra-front-app` 10.77.0.0/24 → tcp:8080; `ra-iap-ssh` 35.235.240.0/20 → tcp:22 |
| Budget | 70 SGD (about US$50), current spend, alerts at 50/90/100%, filtered to this project, one email channel |
| Uptime and alert | `/ready` every 60 s (10 s timeout); policy `ra-readyz-failed`, 120 s duration |
| Model rates (operator `env.local`) | research 0.40/1.60, decision 0.25/1.00 US$ per million input/output tokens, above list prices |
| Wallet | daily cap 10,000 minor units (10 XRP Testnet); per-question budget 200 minor |

Runtime values are set in `/etc/researchagent/env.local` over IAP (root, 0600).
The provider-preflight deadline is `2026-11-13T04:00:00Z`; the release redeploy
must move it forward or readiness turns `degraded`.

## What failed in cloud, and the fix (each retried with the same manifest/project)

All times SGT, 11 Nov. Every fix is in this PR with a test where the code has one.

| # | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| 1 | `iam service-accounts create ra-vm`: INVALID_ARGUMENT | Service-account IDs need 6-30 characters | VM identity is `ra-app-vm` (test pins both IDs to the rule) |
| 2 | `beta monitoring channels list`: ambiguous filter | The Monitoring API rejects unquoted right-hand sides | Quoted `displayName="…"` filters; probe also showed budgets need a quota project (`--billing-project`) |
| 3 | Gate refused to publish | Operator edited docs in the deploy checkout mid-run | Deploy from a clean detached worktree at the gated SHA |
| 4 | `billing projects link`: HTTP 429 | Re-linking an already linked project is a rate-limited write | Link only when the current billing account differs |
| 5 | `spawnSync git ENOBUFS` | The release tar is 166 MB, above Node's 128 MB buffer | `git archive -o <file>` then extract |
| 6 | All roles `EACCES` on `/app/docker/hosted/start.mjs` | The private wrapper's `umask 077` made the extracted tree owner-only, so UID 1000 could not read `/app` | `tar -xpf` keeps the archive's modes; the startup wait also missed this fast failure, so it now compares the unit's exit timestamp; a broken image can no longer block its replacement (startup pauses the durable control file directly if the image cannot) |
| 7 | Web container restarting | nginx could not create `/var/cache/nginx/fastcgi_temp` on the read-only root | All nginx temp paths under `/tmp` |
| 8 | `/api/demo/status` stuck on the guard's fallback body | `start.mjs` probed HG with `fetch()`, which silently drops `Host`; HG answered `origin_denied` to every probe | Probe over `node:http`; new supervisor test with a fake HG that enforces the exact Host |
| 9 | `/readyz` degraded, writer status unavailable | `PublisherClient` accepts only a numeric-loopback publisher origin; compose gave `http://publisher:8790` | The API supervisor relays `127.0.0.1:8790` to the publisher container |
| 10 | Every policy BUY ended `SKIPPED` ("Writer escrow unavailable") | The publisher quotes escrow only for `ESCROW_WRITERS`, never set in the hosted template | Startup derives `ESCROW_WRITERS` from the deployed writer seeds (as `testnet-wallets.ts` does locally) |
| 11 | `billing projects describe`: HTTP 429 | Per-minute quota of gcloud's shared client project | Billing reads retried (6 × 10 s) |

Also changed before the first cloud call: the budget is stated in the billing
account's currency (this account is SGD: `70SGD`, about US$50), an existing
labelled project is adopted only with `--adopt-project`, the alert address is
redacted from plans, gcloud diagnostics go to a 0600 log beside the private
manifest, and the front gained a `/ready` alias (Cloud Run did not in fact
intercept `/readyz`; both work).

## Checks

Against the mandatory list in [hosted-web.md](../../hosted-web.md#mandatory-checks-before-advertising-the-url):

| Check | Result | Evidence |
| --- | --- | --- |
| Paused smoke (`--expect-paused`, partial) | pass, 5/5 | [smoke-paused-2026-11-10T20-42-56Z.json](smoke-paused-2026-11-10T20-42-56Z.json) |
| Live acceptance smoke: own XRPL question, two cookie jars, foreign reads/mutations/history, real purchase, SDK receipt + ledger verification, anchor, explorer links, reverse ownership, paused probe | pass, 80/80 | [smoke-live-2026-11-10T20-47-42Z.json](smoke-live-2026-11-10T20-47-42Z.json) |
| Operator probe runs | ESCROW_CREATE → GRANT → ESCROW_FINISH → VERIFIED on Testnet | names only; no answer text kept |
| 1440 and 390 px served home page | 200, no horizontal overflow, no console errors; one environment indicator | [1440](live-home-1440.png), [390](live-home-390.png) |
| Alert delivery | readiness alert email received from Cloud Monitoring (20:01 UTC, 10 Nov) while the stack was still degraded | recipient kept private |
| Budget | 70 SGD, thresholds 0.5/0.9/1.0 of current spend, project filter, one channel | read back with `billing budgets describe` |
| VM unreachable | web container stopped: `/`, `/api/demo/status` and `/ready` served the paused page/503; restarted: 200 | operator check |
| Rollback dry-run | previous release digests rendered by compose and pulled by the VM identity; live images file unchanged | see hosted-web.md, Rollback |
| Teardown dry-run | plan stops the VM, takes `ra-final-f77ae1417937`, then deletes front, VM, disk, schedule, firewalls, subnet/VPC, 84 tracked secrets (6 releases × 14), registry, identities, monitoring and budget | `make hosted-teardown … --dry-run` |

Not yet qualified: buyer/writer crash and recovery and snapshot restore in
cloud; check 5 limit measurements; zoom 200%, keyboard and reduced motion on the
served UI; an executed rollback; deck/video/progress links (empty in status).
The uptime alert also fires on every intended pause, including each redeploy.
The auto-created `default` network keeps Google's open SSH/RDP rules (no
instances are on it).
