# H6: the hosted demo showed "paused" while nothing was paused

11 Nov 2026. Hosted judge demo v1.1.0 (`3157fe41`), one e2-standard-2 VM behind the Cloud Run nginx front.

## What was seen live

1. Between 03:29 and 03:52 UTC, 11 visitor requests (`GET /runs/…`, `GET /api/…`) were answered 503 at about
   1.50 s while 6 mock-judge visitors and a video recorder used the demo. The video lane saw the demo "flip to
   paused mid-take". The control file was never paused, and no container restarted.
2. The `ra-readyz` uptime check (`GET /ready`, every 60 s from 6 checker locations, 10 s timeout) got 503 at
   about 1.50 s roughly once a minute, including when the demo was idle. The `ra-readyz-failed` alert could page the
   owner for that.

[`live-ready-sample.txt`](live-ready-sample.txt) is our own read-only sample of the public URL (30 × `/ready` with the
uptime-check User-Agent and no cookie, 04:18–04:21 UTC):

| `/ready` answer | count | latency |
| --- | --- | --- |
| 200, warm readiness cache | 5 | 0.05 s |
| 200, readiness refreshed inside the request | 23 | 0.42–0.70 s (median 0.43 s) |
| 200, slow refresh | 1 | 1.36 s |
| **503 paused page** | **1** | **1.55 s** |

`/livez`, which the front answers by itself, stayed at 0.03–0.09 s, so the delay is on the VM.

## Root cause

The packaged guard ([`docker/hosted/start.mjs`](../../../docker/hosted/start.mjs)) sits between the VM's nginx and
the HG gateway. Its job is to fail closed, so that a non-hosted or broken API is never exposed. Before H6 it did
that by probing HG's `GET /api/demo/status` **before every request**, with the visitor's cookie and a **1.5 s
timeout**. On a timeout it served the paused page (503), or a fake `{state:"paused"}` status.

- **Symptom 1 (visitors).** HG's status route awaits `ready()` (`server/routes.ts`). It caches readiness for 5 s, then
  refreshes it inside the request: the publisher registry plus two XRPL Testnet RPCs (`account_info`,
  `server_info`) to `s.altnet.rippletest.net`, a US-hosted public node, from asia-southeast1. Every request that
  arrived during a slow refresh, its own or another request's, hit the guard's 1.5 s timeout and got the paused page.
  Concurrent runs on 2 vCPUs add event-loop delay on top of that. Locally, fixture runs added at most 56 ms
  (table below), so the ledger round trip is the main cost.
- **Symptom 2 (uptime check).** Six checks a minute arrive about 10 s apart, so almost every check finds the 5 s
  cache expired and pays the refresh inside the guard's probe. About one refresh in 25–30 takes more than 1.5 s:
  the probe times out, and the guard answers 503 at 1.50 s. Region, Host, headers and the per-IP read limit play no
  part. The check's Host is the public one, and `/readyz` skips sessions and read limits. A manual curl usually
  lands on a warm cache or a fast refresh, which is why it looked healthy.
- **A third problem, not yet visible.** HG mints a session for every cookieless request. The guard's probe for each
  uptime check (and for each visitor's first request) therefore minted one: about 8,640 sessions a day from the uptime
  checks alone, against HG's 5,000 live-session ceiling. About 14 hours after a deploy, the ceiling would make HG answer
  429 `session_limit` to the probe. Every new visitor would then get the paused page, and `/ready` would fail for real.
  The orchestrator checked it live after this lane's warning: 3,530 sessions at about 13:00 SGT, of which 63 had ever
  asked a question, so about 3 hours of headroom. They slowed the uptime check from 60 s to 900 s; no session was
  deleted. Once H6 is deployed, neither the guard nor the uptime check mints sessions (`/readyz` never does), and
  `docker/hosted/ops.mjs` sets the existing check back to 60 s on every deploy. The leftover sessions expire on their own
  within 24 hours.

## The fix

The answer the guard needs (is this child HG, and does HG accept this Host?) belongs to the child and the Host, not
to each request. The child cannot change while the guard runs, because the guard exits with it.

- A contract answer is kept per Host and re-checked in the background every 10 s, one probe per Host at a time.
  No visitor request waits on a probe once the Host has qualified.
- Fail closed is kept. An answer that is not the contract (`{hosted:false}`, 403, 500, malformed) or a refused
  connection withdraws the qualification at once. Without a recent qualification, requests wait for a probe and get
  the paused page if it fails.
- A re-check that is only slow keeps the qualification until 60 s after the last good answer. After that the guard
  fails closed again, so an API that has really hung reaches the paused page within about a minute.
- The probe timeout is now 5 s instead of 1.5 s. It matters only for the first qualification after a start or a
  withdrawal, because re-checks no longer block requests.
- Probes carry the guard's own HG session cookie, never a visitor's cookie or address. They mint at most one session
  a day.
- The guard is not the pause authority. HG's own paused state, its 503 `paused` refusals and its 503 `/readyz` pass
  through unchanged.

## Local proof

`node --import tsx scripts/hosted-load.mjs` runs the guard (this checkout, or `--guard-ref 3157fe41` for the deployed
one) in front of the real HG gateway: `HOSTED=1`, fixture models, the simulated rail, the fixture writer server,
ephemeral ports. Each visitor behaves like the browser: status, history and writers at boot, then ask (scope,
submit), follow the run over SSE, poll the run every 5 s and the status every 3 s, then ask again. A separate client
polls `/readyz` with no cookie, like the uptime check. Readiness is the one stand-in, because a local stack
has no funded Testnet payer. It keeps the production shape (5 s cache, one refresh at a time), and each refresh waits
a latency taken from the live sample: `380,400,1310,520,370,570,1900,380,650,450` ms, cycled. The one >1.5 s refresh
in the live sample is kept, but made more frequent (1 in 10 instead of about 1 in 25–30) so the bug shows within minutes.

**Live cadence** (the headline pair): `/readyz` every 10 s, as six checker locations a minute produce; visitors as above.

| run | guard | requests | guard paused: visitor / `/readyz` | `/readyz` 200 | sessions minted | event-loop delay p99 / max |
| --- | --- | --- | --- | --- | --- | --- |
| [6 visitors, 180 s](before-3157fe41-live-cadence.json) | 3157fe41 (deployed) | 1,178 | **18 / 0**: every visitor's status at once, 3 times, each at 1.50 s | 18 / 18 | 42 | 13.9 / 50.3 ms |
| [6 visitors, 180 s](after-live-cadence.json) | H6 | 1,188 | **0 / 0** | 18 / 18 | 12 | 13.9 / 82.9 ms |

After H6, visitor status calls still wait for a slow readiness refresh (p95 1.9 s, the emulated tail), but they get
HG's real state, never the paused page. The event loop never stalled (max 83 ms), so there was no event-loop blocking
to fix.

In the before run, the 18 paused answers were `GET /api/demo/status` returning the guard's fake `{state:"paused"}`: the
app shows its paused card when it sees that. Each time, all six visitors' polls landed in the same slow refresh. This
is the "flipped to paused mid-take" the video lane saw.

**Uptime-heavy pairs** (first harness version): `/readyz` every 2 s. In this version visitors also idled for up to 90 s
after each answer, waiting for the event stream to close (fixed in the final harness). So these runs mostly exercise
the uptime path:

| run | guard | requests | guard paused: visitor / `/readyz` | `/readyz` 200 | sessions minted | event-loop delay p99 / max |
| --- | --- | --- | --- | --- | --- | --- |
| [6 visitors, 120 s](before-3157fe41.json) | 3157fe41 (deployed) | 157 | **0 / 2** (1.50 s each) | 53 / 55 | 67 | 12.6 / 55.8 ms |
| [6 visitors, 120 s](after.json) | H6 | 156 | **0 / 0** | 54 / 54 | 6 | 12.4 / 48.5 ms |
| [8 visitors, 240 s](before-3157fe41-8x240.json) | 3157fe41 (deployed) | 289 | **0 / 4** (1.50 s each) | 105 / 109 | 125 | 12.5 / 45.3 ms |
| [8 visitors, 240 s](after-8x240.json) | H6 | 335 | **0 / 0** | 109 / 109 | 9 | 13.5 / 47.5 ms |

"Sessions minted" counts new rows in HG's session table during the run. Before H6, every cookieless probe (each
uptime check, and each visitor's first request) added one. After H6 it is one per visitor, which is the real count.

HG's own 429 refusals are expected and are never counted as paused: one active question and two waiting, `busy`
while a question runs, 3 starts a minute per address, 5 questions a session. The harness retries a refused ask after
3 s, much faster than a judge would, so the request counts are a heavier load than the browser makes. In the after runs, `/readyz` still waited for the slow refresh itself (max 1.9 s) and answered 200, well
inside the uptime check's 10 s.

**The operator pause still pauses** (`pausedControl` in the after files). With the control file paused, status
through the guard says `paused` with `ask: false`, submit and scope answer 503 `paused`, and `/readyz` answers 503
`paused`.

**A broken or non-hosted API still fails closed.** [`tests/hosted-guard.test.ts`](../../../tests/hosted-guard.test.ts)
drives a stand-in HG through every case:

- one probe per Host, carrying the guard's own session;
- slow but healthy is never shown as paused, and the guard fails closed once no good answer is recent;
- a non-contract answer withdraws the qualification at once;
- `{hosted:false}`, 500, malformed, hung, or nothing listening all get the paused page and the fake paused status,
  and `/readyz` answers 503;
- HG's own paused state is forwarded;
- another Host never rides on the public Host's qualification.

Against the deployed guard, the first two tests fail and the fail-closed tests pass, as they should.

## Open Records signing key (same PR)

R9-B (#472) drops a free article that arrives without its writer's signed proof. The deploy path provisioned seeds
only for writers with a paid price, so the free-only Open Records writer (the open central-bank sources) would have
had every free article dropped after the next redeploy. `docker/hosted/ops.mjs` and `scripts/hosted-wallets.ts` now
plan one `XRPL_PUBLISHER_<SLUG>_SEED` for every writer in `data/writers`, in the same wallet-file and secret flow as
the others. `tests/hosted-ops.test.ts` proves that both dry-run plans include `XRPL_PUBLISHER_OPEN_RECORDS_SEED`.

Open Records gets a dedicated seed rather than the `XRPL_PUBLISHER_GRID_OPERATORS_REPORT_SEED` fallback in
`publisher/registry.ts`. Grid Operators is not a hosted writer, so that fallback would need a secret named after a
writer the hosted roster does not have. The registry already prefers the dedicated name, and the fallback stays for
local development. The key only signs; Open Records is never paid, so its wallet needs no funding.

No cloud resource, secret or Testnet transaction was created by this lane.
