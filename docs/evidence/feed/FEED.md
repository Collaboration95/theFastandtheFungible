# Public purchase feed

31 targeted feed tests pass. Eight screenshots are each below 200 KB.
Desktop and 390 px phone axe scans: zero serious/critical violations; no
document-level horizontal overflow. Local synthetic verification only; no hosted
deployment or new ledger transactions.

## Reproduce

Node 22.23.4; `DEMO_PORT_OFFSET=1000 PUBLIC_FEED=1 npm run demo`, then open `/live`.
Targeted contract/privacy tests: `npx vitest run tests/public-feed.test.ts`.
Full shipping gate uses the shared heavy lock and `npm run gate -- --publish`.

## Endpoint contract

`PUBLIC_FEED=1` enables the public routes; default is off. `/live` is a lazy page.
`GET /api/feed?limit=1…100` returns `{ rows, updatedAt }`; default JSON limit 50.
`Accept: text/event-stream` on `/api/feed` sends `snapshot` events with the latest
100 rows, a 15 s reconnect delay, keepalives and a ten-minute connection lifetime.
JSON is `public, max-age=2`; SSE is `no-store`, with proxy buffering disabled.
A single two-second snapshot serves every viewer. Limits: 60 requests per minute
per direct peer address, 100 simultaneous streams, 5,000 rate buckets and 256 KiB
queued output per client. Behind a proxy the peer quota is shared, deliberately
conservative; forwarded headers cannot bypass it. No ledger requests are made.

Each row: opaque purchase id; validated creation time; fixed public topic title;
public resource title and writer; SGD minor-unit price; validated EscrowCreate
hash and ledger; finish hash; key check (`match/mismatch/pending/unavailable`);
delivery gate (`verified/failed/pending/unavailable`); money state; seconds from
validated create to finish/cancel. A signed but unvalidated create is omitted.
The delivery gate is the recorded key/decryption/content proof, not a fresh
five-gate audit. The scoreboard retains the separate six violation counters.

## Static evidence handoff

The receipt batch was absent on main at implementation start. Export a separate
`data/evidence/testnet-1000/feed.json` with schema `public-feed-v1`, `label`, and
`rows` matching `shared/public-feed.ts`. `/api/feed/recorded` validates this strict
schema and returns 404 until the export exists. Never expose raw receipts.jsonl.
A minimal synthetic export lives in `tests/fixtures/public-feed.json`.
Only label a batch “1,000 verified Testnet purchases” after 1,000 retained real
receipts have independently passed key and delivery checks. The loader does not
invent that claim. The Testnet batch producer owns its receipt schema and files.

## Privacy tests

Individual injection attempts cover question, questionText, body, spans, contents,
premiumBytes, seed, walletSeed, secret, privateKey, apiKey, token, deliveryToken,
ip, ipAddress, principal, reveal, txBlob and salt in run/intent/audit/escrow data.
Every test checks that the sentinel is absent from the public projection. SSE
also checks question exclusion. Raw audit labels and data are never spread.
Other tests cover pending/mismatch/legacy outcomes, validated-only creates,
cache expiry, SSE no-store/cleanup, an open-stream create-to-finish update,
request limits and snapshot bounds.

## Screenshots and measurements

Playwright local captures: `empty.png`, `purchases.png`, `booth.png`, `phone.png`,
all under 200 KB. Data and hashes in these screenshots are synthetic, not ledger
evidence. The finite intercepted stream deliberately shows the reconnect notice.
The first full fast check caught date formatting and heading-weight drift; both
were fixed to use the existing presentation contract without exceptions. No transaction hashes are claimed as live evidence by this lane.

## Hosted handoff owned by R3-REACH

Before enabling the flag, both hosted nginx configurations need an exact feed
location forwarding one API Cache-Control header (JSON max-age=2; SSE no-store).
Their general API locations currently inherit another no-store header. Buffering
is already disabled. This lane cannot edit `docker/hosted/**`; API-level cache
and stream contracts are tested locally. See the dated builder-feedback entry.

## External and internal counts

`AUDIENCE_COUNTS=1` enables request attribution and the operator endpoint (default
off). `OPERATOR_TOKEN` is unset by default. It is never returned, logged or stored
in the run database. Authenticate `POST /api/operator/session` with an operator
bearer to set a signed, Secure, HttpOnly, SameSite=Strict cookie lasting 24 hours.
A direct operator bearer tags hosted calls before Authorization is stripped by
the hosted session guard. Local Store/API scripts default internal; remote
operator scripts must use the operator cookie/token. Existing spend, host,
session ownership and CSRF checks still apply independently.

`/api/demo/stats` retains the original all-run fields for compatibility and adds
`all`, `external` and `unclassified`. Each breakdown retains all six recorded
violation counters and `stoppedBeforeAnswer`. Legacy runs with no classification
remain in all; they are never inferred to be visitors. Headline metrics select
external only when its question count is non-zero. The audit UI labels its all-run
scope explicitly. Counts still use the original admitted Testnet population
since 11 Nov; local non-hosted databases are not this hosted scoreboard.

Reproduce: `npx vitest run tests/run-audience.test.ts tests/scoreboard-audience.test.tsx tests/hosted-stats.test.ts`.
Tests cover old/unknown runs, local defaults, external and all totals, signed and
tampered cookies, spoofed headers, and both headline-selection cases.

Operator setup (token supplied securely by the operator; never paste it into an
issue or request URL): send an authenticated POST to `/api/operator/session`,
then use the returned cookie in that browser. The token is not a spending
credential. A local API bearer is independently checked by the existing admission
guard, so local operators must retain their ordinary API authorization too.

The operator secret is also covered by telemetry redaction; the regression test
checks both the endpoint response/cookie and the shared log masker.

Step 1 clean-head verification: Node 22.23.4; check:fast passed (279 files,
3,093 tests); local gate passed 20/20. Initial JS: 159,242 B gzip against
170,000 B. The feed is a separate 1.75 KB gzip JS chunk.

## Answer value ratings

`ANSWER_RATINGS=1` enables `GET/POST /runs/:id/rating` (default off). POST accepts
only `{ "yes": true|false }`; GET returns `{ "yes": true|false|null }`. Existing
run ownership and CSRF checks apply. Only terminal runs with a paid, non-cancelled
receipt and a saved cited answer can vote. Each run has a unique database row;
the first vote wins atomically, retries are idempotent, and a conflicting vote
returns 409 with the saved boolean. Rate limit: 30 reads/writes per minute per
hosted session (local fallback: direct peer); 5,000 bounded rate buckets.

The optional lazy prompt says “Worth S$X?” for the run's gross purchase spend,
with Yes/No. It renders after the answer and never joins the answer/payment
pipeline. API or chunk-load failure leaves the answer usable; saving failures
show a quiet retry. Browser replay does not collect votes. Stats add
`rating: { rated, yes, yesPercent }` for all/external populations; no ratings means
null percentage. The feed adds `rating: boolean|null` to each purchase row; this
is the whole-run rating, shared across that run's purchases, not a separate vote
per article. Aggregate stats refresh within 60 seconds; feed updates within two.

Reproduce: `npx vitest run tests/answer-ratings.test.ts tests/answer-rating-ui.test.tsx tests/public-feed.test.ts`.
Tests cover persistence, one vote, conflicting votes, free/unfinished rejection,
strict payload validation, request limits, cross-visitor rejection, aggregate
populations and UI save failures. Synthetic component captures `rating-before.png`
and `rating-after.png` are each under 26 KB. They use a labelled standalone answer
fixture, not a live purchase or evidence of real visitor feedback.

Settlement display additionally requires a terminal audit event whose transaction
hash matches the purchase record. A signed finish alone stays pending. Regression
tests cover that case and the whole-run rating projected into each purchase row.
The final 1440 x 720 booth capture includes one complete purchase row and the
rating column without reducing the large type.

Signed-only create attempts are filtered before the snapshot limit, so they cannot
evict validated purchases. This regression is covered with 101 pending attempts.

Final rating-column layout was rechecked at desktop and 390 px: zero serious or
critical axe violations and no document-level horizontal overflow.

The feed reuses the existing writer-provenance badge, without adding public
fields. A page-level regression checks that disclosure, no initial animation,
new-purchase-only motion and stream cleanup.

Booth mode keeps the collapsed audit available to expand and preserves stale-
refresh notices; large-type styling does not hide either disclosure.

Additional synthetic captures: `external.png` shows the external headline;
`booth-720.png` shows a complete row at 1440 x 720.

The first rating browser gate caught disabled-feature probes returning 404. The
client now waits for the existing health response to explicitly advertise
`answerRatings: true` before loading the prompt or making any rating request.
The original clean-console assertions remain intact; a browser regression also
checks the opt-in prompt and saved vote. No gate was loosened.

Focused regression: `npx playwright test tests/ui-nov11.spec.ts --grep 'money and accessible overlays|answer value rating' --workers=1` passed all six cases.

Feed article/writer lookup uses the existing full source identity and version,
including a collision regression across two publishers with the same local IDs.
An old purchase without source identity never borrows a federated writer's
metadata by guessing from current candidates.

Missing article/writer metadata is labelled unavailable, without substituting a
question or guessing another publisher identity.

Clicking the selected feed tab preserves its current rows and connection status;
the page regression covers this without waiting for another purchase.

The live projection requires the recorded XRPL Testnet rail label. Simulated and
unlabelled runs are excluded before the row limit. The regression failed before
this filter and passes with it; synthetic screenshots remain labelled fixtures.

With audience attribution off, hosted visitors remain unclassified; they do not
fall through to the local-script internal default. A real HTTP regression failed
before the fix and passes afterward. Local scripts still default to internal.
