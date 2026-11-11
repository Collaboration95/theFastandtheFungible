# H7: hosted hardening (11 November 2026)

Local verification only: HOSTED=1, fixture research and decision models, simulated payments and ephemeral ports. No hosted questions, cloud changes, live providers or Testnet transactions. Readiness latency is an explicit stand-in; the hosted API, publisher and packaging guard are real local processes.

The original salvaged before/after JSON was replaced because its maximum event-loop delay exceeded 16 minutes. Those interrupted runs did not establish a 120-second comparison. The replacement pair ran sequentially under the shared heavy lock, with sleep inhibited.

## Load proof

Six visitors for 120 seconds with readiness latencies 380,400,1310,520,370,570,1900,380,650,450 ms cycled; one uptime check per 10 seconds, then 5,200 cookieless requests from one address (12 in flight). The pinned baseline is bd52beff55589f026e71cef3c73cf84984bc516e, unpacked into a temporary source snapshot with the current harness and shared dependencies. Baseline uses --inline-readiness; H7 uses the production background cache. Source SHA-256 values are in each JSON.

| Measurement | Before | H7 |
| --- | ---: | ---: |
| Measured wall time (s) | 122.2 | 121.4 |
| Requests | 926 | 978 |
| Status p50 (ms) | 4 | 3 |
| Status p95 (ms) | 1213 | 8 |
| Status max (ms) | 1903 | 22 |
| Readiness refreshes | 19 | 25 |
| Cookieless flood sessions minted | 4980 | 120 |
| Session table after flood | 5000 | 143 |
| Next real visitor HTTP | 429 | 200 |
| Event-loop p99 (ms) | 16.2 | 15 |
| Event-loop maximum (ms) | 55.9 | 49.6 |

Expected 429 refusals (queue, starts-per-minute and question allowances) are reported separately from false pauses. The flood reaches the baseline session ceiling, so its post-flood pause submit/scope probes are blocked by session_limit; its readiness probe still reports paused. H7's next visitor and all pause boundaries are checked after the flood.

## Focused checks

Session tests pin rolling-hour behavior across UTC midnight, HMAC-only retention, IPv6 /64 rotation, valid cookie reuse, unused-session expiry/reclamation and preservation of question/money limits. Readiness tests cover cold immediate refusal, nonblocking refreshes, failures, hung probes without overlap, stale answers and shutdown. Hosted integration tests cover queue-full 200 busy, busy planning and a pause while a plan waits for a planning place.

Links tests execute local writes and exercise both shell-quoting layers of the remote dry-run with fake gcloud/sudo; invalid URLs and malformed files are rejected/ignored. Production readiness wiring is tested with a mocked payer at exactly 30,000,000 and 29,999,999 drops; this does not claim real Testnet readings or delivered email.

The real local nginx front substitutes a configured video, hides the missing video, serves the branded 503 page, and forwards /ready and /ready/funds correctly. Deployment/teardown behavior is checked as dry-run only with a sentinel gcloud. The alert uses the existing notification channel and is provisioned on deployment; no cloud check or policy was created here.

The inherited paused-page screenshots at 1280 and 390 pixels were visually inspected during resume; the page HTML is unchanged from that capture. paused-layout.json records no horizontal overflow and zero serious/critical axe findings at both sizes. The configured-video path is additionally checked through real nginx.

## Verification and changed bounds

The merge gate is `npm run check:fast` plus a clean-head published local gate, both run under the shared heavy lock. Exact receipts/statuses are reported in the PR; after squash merge the merged SHA is gated with `npm run gate -- --base HEAD^ --publish`. Targeted H7 tests and the existing hosted access/integration suite are also checked. The diff and evidence are secret-scanned with gitleaks in redacted mode.

Readiness previously refreshed inline after five seconds. It now uses a result only until 15 seconds after its probe started, refreshes every five seconds, and fails closed on probe failure, six-second timeout, stale data or cold startup. This explicitly broadens the cached readiness bound; operator pause, admission deadline, money envelopes and signing guards stay fresh. A full queue changes readiness from 503 to 200 busy without raising capacity. Planning is concurrent with research within its separate bounded lane. No gate, test, leak threshold or budget was loosened.

Deployment remains with the orchestrator. State-disk video/proof links need no API redeploy, but the static front video needs front configuration because the front must still work with the VM stopped. UI consumers of the new optional estimated wait fields are left to JC; H7 does not edit that lane's files.
