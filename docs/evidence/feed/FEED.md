# Public purchase feed

26 targeted feed tests pass. Four screenshots are 71,731–110,247 B each.
Desktop and 390 px phone axe scans: zero serious/critical violations; no
document-level horizontal overflow. Local synthetic verification only; no hosted
deployment or new ledger transactions.

## Reproduce

Node 22.23.4; `OFFSET=1000 PUBLIC_FEED=1 npm run demo`, then open `/live`.
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
