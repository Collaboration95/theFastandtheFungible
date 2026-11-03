# ResearchAgent operations (single process, XRPL Testnet)

The engine, desktop worker and local MCP server run the same reconciler. Keep
one writer process per payer/data directory. Mainnet is disabled. Never paste
seeds, bearer tokens, signed blobs, delivery bodies or raw provider errors into
logs or issues. Set `LOG_FORMAT=json` for allowlisted money events on stderr;
MCP stdout remains JSON-RPC. Default console output is unchanged.

## Inspect and pause

Load the ignored `.env` using your normal launcher. These shell examples assume
`RA_API_TOKEN` is already in the environment and shell tracing is off. For the
Lane D demo (`make run OFFSET=1200`), `BASE=http://127.0.0.1:9988`.
For MCP/desktop use the engine URL printed on stderr and its configured token.

```sh
BASE=http://127.0.0.1:9988
curl -fsS "$BASE/health"
curl -fsS -H "Authorization: Bearer $RA_API_TOKEN" "$BASE/api/health?deep=1"
curl -fsS -H "Authorization: Bearer $RA_API_TOKEN" "$BASE/api/metrics"
curl -fsS -X POST -H "Authorization: Bearer $RA_API_TOKEN" \
  -H 'Content-Type: application/json' -d '{"paused":true}' "$BASE/api/wallet/pause"
```

`/health` and shallow `/api/health` are liveness with public mode labels only.
Deep health and metrics use #301's bearer/Host/Origin guard (anonymous access
is allowed only on loopback when no operator token is configured). Database
write failure returns HTTP 503 / `down`; dependency failures return HTTP 200 /
`degraded` with fixed, safe reasons. Check the JSON status, not just HTTP 200.
Deep probes time out in 3 s per dependency; validated-ledger age >30 s is stale.
Headroom subtracts the live reserve, outstanding admitted budgets and the
2,000-drop fee cap. A simulated ledger is explicitly labelled.

## Stuck SUBMITTING or delivery backlog

Inspect `purchasesByStatus` and `reconcileBacklog` in metrics. Every
`RECONCILE_INTERVAL_MS` (default 15000), `reconcileOnce()` queries ledger proof
and reuses the write-once submission. There is no re-sign, replacement payment
or local refund on a timeout. A validated success becomes a receipt even if the
publisher is down; the body still needs delivery and proof before access.
A missing tx is not evidence of no charge. Failed validation, or expiry past
LastLedgerSequence with a validated unmoved account Sequence, releases the
reservation. Otherwise leave it reserved and restore ledger connectivity.

DELIVERY_FAILED auto-retries at most three times. `deliveryAttempts` and
`nextDeliveryAt` persist on the intent: backoff is 15/30/60 s, rounded up to the
next tick. Exhausted deliveries stay charged and visible. Once the publisher is
healthy, use the existing retry-delivery control (or authenticated
`POST /runs/<runId>/retry-delivery` with `{"intentId":"..."}`); it resends the
same blob. Do not delete `submissions`, change intent status with SQL or start
another ask as a payment-recovery method. Old intents without timestamps have
`unknownAgeCount`; the age is unknown, not zero.

## Ledger unreachable or payer sequence unresolved

Deep health names `Ledger or payer balance unavailable` or stale validation.
Check connectivity to the configured Testnet `*.rippletest.net` WebSocket and
restore access; do not switch to Mainnet. `SUBMITTING` reservations remain.
Signing waits at most 5 s for the prior sequence to become ledger-proven safe;
if unresolved it refuses the new intent before signing. A slow writer's body
response never owns the payer lock. This is serialized signing, not Tickets or
parallel sequence allocation. Keep the old blob for reconciliation after a
restart. Network timeouts never authorize another signature for that intent.

## Publisher down

Deep health names `Publisher registry unreachable`. Start/restore the existing
publisher (`make run OFFSET=1200` for fixtures); confirm its `/registry` is
reachable from the API host. Preserve both `app.db` and `publisher.db`: the
publisher journal binds invoices, settlements and salts. Delivery retries can
recover after the server returns without charging again.

## Provider rate-limited (Groq TPM / Cloudflare quota)

Metrics expose LLM fallbacks and decision-unavailable counts. Run
`make preflight OFFSET=1200` for the explicit live-provider diagnostic (it calls
providers). Respect the provider cooldown; reduce concurrency or choose an
operator-configured provider with quota, then retry the ask. A failed decision
buys nothing. Fixture substitutions stay labelled. Provider names in health
mean configured selection, not a successful live model probe.

Model usage is recorded even with Langfuse disabled. Per-run `estimatedUsd` is
null unless all reported calls have operator-supplied blended rates in
`MODEL_INPUT_USD_PER_MILLION` and `MODEL_OUTPUT_USD_PER_MILLION`. These are a
scenario estimate, not billing; mixed models/cache discounts need appropriate
rates. Missing provider usage is unknown. Metrics never invent a zero cost.
`make scorecard` saves the endpoint snapshot as `operations.json` beside its
existing timing/audit output. Lock-wait samples are process-local (last 1024
successful acquisitions); settlement timings and usage are durable.

## Payer below reserve

Deep health shows balance/reserve/headroom; a purchase says `Payer balance below
reserve; nothing was charged` and has no submission row. The precheck uses
validated balance minus `reserve_base_xrp + OwnerCount * reserve_inc_xrp` from
`server_info`, amount and fee cap. Cache: 5 s, conservatively deducting newly
signed amounts/fees. Top up this Testnet account with `make wallets` and wait
for validation, or lower admitted budgets. Do not reduce reserve/fee checks.

## Rotate the payer seed

Pause spending. Wait until metrics shows no SUBMITTING payments or delivery
backlog, and drain/stop the engine. Back up `data/` while stopped. Replace
`XRPL_PAYER_SEED` in the ignored `.env` (desktop: Keychain), never in a CLI
argument or issue. Fund the new Testnet address, restart, inspect deep health,
then unpause using the pause endpoint with `{"paused":false}`. If an old
payment is unresolved, retain its original configuration and journal until
resolved; do not rotate away its reconciliation identity.

## Restore data from a copy

Pause and drain/stop all API, desktop, MCP and publisher processes before taking
or restoring a copy. Copy the whole data directory, including SQLite `-wal`
and `-shm` files if present, plus the publisher journal and local writer data.
Restore to a separate directory and configure APP_DB/PUBLISHER_DB/REPORT_DIR
(or RA_DATA_DIR for MCP). Keep the original intact. Start a single engine,
inspect deep health and reconciliation, then unpause. Never restore an older
buyer DB against a newer journal and assume it is safe to spend: compare stored
hashes with ledger history first. A backup restores state, not a proof of no
charge. `drain()` stops ticks and waits for active reconciliation and jobs;
`close()` also drains purchase work before closing the database/ledger.

References: [XRPL reserve fields](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/server-info-methods/server_info),
[reliable submission](https://xrpl.org/docs/concepts/transactions/reliable-transaction-submission).
