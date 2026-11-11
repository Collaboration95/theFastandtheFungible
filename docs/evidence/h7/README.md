# H7: hosted hardening (11–12 November 2026)

Local verification only: HOSTED=1, fixture research and decision models, simulated payments and ephemeral ports. No hosted questions, cloud changes, live providers or Testnet transactions. Readiness latency is an explicit stand-in; the hosted API, publisher and packaging guard are real local processes.

The final H7 arm was rerun after the desktop gate caught an API import of a deployment helper that is not staged in the desktop build. API links validation now stays in the server build, with parity tests against the operator helper. The independent planning lane also refuses waiting work during shutdown and drains the running plan’s final database writes before storage closes. The harness additionally records both link validators and SSE implementation source hashes; those metadata-only additions do not change baseline traffic. The final harness explicitly disables advisory ledger credentials and calibration; those environment overrides were absent during the baseline run, so the effective fixture settings agree. Source-file digests are named sha256 objects, keeping file identity unambiguous to the secret scan.

The original salvaged before/after JSON was replaced because its maximum event-loop delay exceeded 16 minutes. Those interrupted runs did not establish a 120-second comparison. The replacement pair ran sequentially under the shared heavy lock, with sleep inhibited.

## Load proof

Six visitors for 120 seconds with readiness latencies 380,400,1310,520,370,570,1900,380,650,450 ms cycled; one uptime check per 10 seconds, then 5,200 cookieless requests from one address (12 in flight). The pinned baseline is bd52beff55589f026e71cef3c73cf84984bc516e, unpacked into a temporary source snapshot with the current harness and shared dependencies. The temporary baseline’s 623 engine/UI/corpus/build inputs and its hosted deployment files were checked byte-for-byte against that commit; no .env is present. Baseline uses --inline-readiness; H7 uses the production background cache. Source SHA-256 values are in each JSON. The phone proof additionally pins every UI/shared, server/publisher and v2 corpus file, so later integration cannot retain a measurement from a different engine.

| Measurement | Before | H7 |
| --- | ---: | ---: |
| Measured wall time (s) | 122.2 | 122.6 |
| Requests | 926 | 960 |
| Runs admitted | 70 | 60 |
| Runs finished | 70 | 60 |
| Status p50 (ms) | 4 | 5 |
| Status p95 (ms) | 1213 | 10 |
| Status max (ms) | 1903 | 23 |
| Readiness refreshes | 19 | 25 |
| Cookieless flood sessions minted | 4980 | 120 |
| Session table after flood | 5000 | 142 |
| Next real visitor HTTP | 429 | 200 |
| Event-loop p99 (ms) | 16.2 | 14.7 |
| Event-loop maximum (ms) | 55.9 | 52.3 |

Expected 429 refusals (queue, starts-per-minute and question allowances) are reported separately from false pauses. The flood reaches the baseline session ceiling, so its post-flood pause submit/scope probes are blocked by session_limit; its readiness probe still reports paused. H7's next visitor and all pause boundaries are checked after the flood.

## Phone and front proof

| Measurement | Before | H7 |
| --- | ---: | ---: |
| SSE encoded body bytes | 1340842 | 226712 |
| Snapshot frames | 14 | 10 |
| Phone Done lag (ms) | 2679 | 353 |
| Repeat static transfer (bytes) | 241573 | 1204 |
| Repeat all-resource transfer (bytes) | 242319 | 1939 |
| Repeat composer (ms) | 1774 | 417 |
| Initial app gzip body (bytes) | 146346 | 133131 |
| Questions after cancel | 4 | 5 |
| Questions after Start | 4 | 4 |

Chromium at 390×844, CDP 1.6 Mbps / 150 ms / 4× CPU, local TLS nginx using each arm’s front template. A test-only 1,500 ms delay at the publisher-client transport boundary stretches the fixture paid Kestrel–TSMC run in both arms; no production source is patched. Readiness is an explicit local override. Done lag runs from the server DONE event to the browser’s Done DOM update at the next animation frame; this is an emulated phone, not physical-device evidence. SSE bytes are encoded response-body bytes recorded at the VM bridge; snapshot arrivals are measured in EventSource after browser decompression. Repeat static transfer counts HTML and hashed assets; all-resource bytes are also retained in the JSON. The production API/router, front configuration, fixture models and simulated money path are otherwise real. The baseline is bd52beff.

The probe cancels one real plan dialog before starting the paid run: H7 keeps all five questions after Cancel, then four after Start. Limits tests separately pin the friendly 16th-plan refusal, idempotence, failed admission without a run, UTC-day rollover and migration of old holds. Unit wire tests require each flushed frame within 300 ms, keep the 256 KiB uncompressed frame/queue limits and cover late anchors, phase-only failures, negotiation and the kill switch. Existing stream recovery still follows one durable run.

Reproduce under the heavy lock after building each source tree: `node --import tsx scripts/hosted-phone-proof.mjs --root <tree> --out <json> --label <arm>`. Before and after JSON and 390 px screenshots are in this directory. No cloud or live hosted request is part of this proof.

## Focused checks

Session tests pin rolling-hour behavior across UTC midnight, HMAC-only retention, IPv6 /64 rotation, valid cookie reuse, unused-session expiry/reclamation and preservation of question/money limits. Readiness tests cover cold immediate refusal, nonblocking refreshes, failures, hung probes without overlap, stale answers and shutdown. Hosted integration tests cover queue-full 200 busy, busy planning and a pause while a plan waits for a planning place, and a concurrent Start while that same question is still planning (409 with no run or submit digest).

Links tests execute local writes and exercise both shell-quoting layers of the remote dry-run with fake gcloud/sudo; invalid URLs and malformed files are rejected/ignored. Production readiness wiring is tested with a mocked payer at exactly 30,000,000 and 29,999,999 drops; this does not claim real Testnet readings or delivered email.

The real local nginx front substitutes a configured video, hides the missing video, serves the branded 503 page, and forwards /ready and /ready/funds correctly. Deployment/teardown behavior is checked as dry-run only with a sentinel gcloud. The alert uses the existing notification channel and is provisioned on deployment; no cloud check or policy was created here.

The inherited paused-page screenshots at 1280 and 390 pixels were visually inspected during resume; the page HTML is unchanged from that capture. paused-layout.json records no horizontal overflow and zero serious/critical axe findings at both sizes. The configured-video path is additionally checked through real nginx.

## Verification and changed bounds

The merge gate is `npm run check:fast` plus a clean-head published local gate, both run under the shared heavy lock. Exact receipts/statuses are reported in the PR; after squash merge the merged SHA is gated with `npm run gate -- --base HEAD^ --publish`. Targeted H7 tests and the existing hosted access/integration suite are also checked. The diff and evidence are secret-scanned with gitleaks in redacted mode.

Readiness previously refreshed inline after five seconds. It now uses a result only until 15 seconds after its probe started, refreshes every five seconds, and fails closed on probe failure, six-second timeout, stale data or cold startup. This explicitly broadens the cached readiness bound; operator pause, admission deadline, money envelopes and signing guards stay fresh. A full queue changes readiness from 503 to 200 busy without raising capacity. Planning is concurrent with research within its separate bounded lane. The owner changed the session question policy: cancelled/abandoned plans no longer consume one of five questions; 15 planning/chat attempts per session per UTC day now bound them. Existing IP/global admission and money/model caps stay unchanged. Tests asserting that a cancelled plan costs a question were updated to the owner’s decision. No gate, leak threshold or money cap was loosened.

Deployment remains with the orchestrator. State-disk video/proof links need no API redeploy, but the static front video needs front configuration because the front must still work with the VM stopped. UI consumers of the new optional estimated wait fields are left to JC; H7’s only shared UI edits implement the newly authorized plan-limit notice and truthful chat allowance copy; other wait-estimate UI work remains with JC.


## Deployment follow-up

The orchestrator owns API/web/front deployment and the real incremental-stream check through Cloud Run. On its own smoke run, record the raw `/runs/<id>` size and confirm `curl -N --compressed` shows frames arriving one by one. If frames batch, set `HOSTED_SSE_GZIP=0` in the VM API environment and recreate that container. Both front and VM nginx must carry the new Accept-Encoding whitelist entry. The front asset/cache changes require a front deploy; no deploy was performed here.

The final initial app gzip body measured **133,131 bytes (133.1 KB)** at gzip level 5 against the **130 KB soft target**. The owner explicitly accepted the initial 1.8 KB miss on 12 Nov and required App.tsx to remain untouched while A11Y/LEDGER edit it. The table retains the exact final integrated result. Follow-up: lazy-load secondary run/receipt panels in the owning UI lane; preserve front gzip level 5. The repeat-visit target still passes (1,204 bytes, 417 ms composer). No hard gate or test threshold was lowered.
