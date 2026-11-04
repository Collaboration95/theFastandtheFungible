# Lane T: answer audit head on XRPL Testnet

Observed 2026-11-04 (Singapore), fixture models and fictional writers. No real
money or .env. `node --import tsx scripts/anchor-proof.ts` uses the same scratch
faucet wallet provisioning as `make testnet`, executes UC3 through the engine,
and saves a portable receipt. Ports are ephemeral. The ignored wallet cache and
SQLite outbox remain in scratch; neither secrets nor signed blobs are exported.

Anchor transaction: `546AE8131582AFD34528007100EDC7DC130C1CE081FA2DB72AE5FA0C73C27570`.
Ledger 22048303, AccountSet, validated tesSUCCESS, **anchor fee 12 drops**,
zero principal. The fee is separate from article spend. See transactions.json
and receipts.json. Verification fetched the public ledger independently:

- typescript-ledger.txt: `npm run verify:answer -- docs/evidence/round2-t/receipts.json --ledger` → PASS.
- python-ledger.txt: `PYTHONPATH=packages/sdk-python/src python3 -m researchagent verify docs/evidence/round2-t/receipts.json --ledger` → PASS.
- tampered.json changes the final audit entry's answer hash without updating its chain hash.
- typescript-tamper.txt and python-tamper.txt run the same commands on tampered.json → FAIL, audit head mismatch.

These transcripts are historical live Testnet observations, not a promise of
future public-node availability. Offline verification still needs no network.
The first provisioning attempt returned the launcher's generic network/faucet
fallback. A second attempt succeeded; the first failure's root cause was not
identified. Endpoint server_info checks confirmed network ID 1 on both fixed
Testnet endpoints. No fallback was substituted for this proof.

Crash coverage: tests/anchor-crash.test.ts injects interruption before submit,
lost submit response, and interruption after validation; each closes and reopens
a disk Store, preserves exactly the same signed blob, and finishes with one
ledger fee despite concurrent ensure calls. This is synthetic fault injection
and restart coverage, not a live Testnet process-kill experiment. The standard
200-run chaos matrix separately uses real SIGKILL and simulated settlement.
All original 184 receipt conformance cases are retained; eight anchor cases add
malformed/head/answer and stubbed-ledger coverage shared by TS and Python.

## PR recovery and browser diagnosis (2026-11-04)

Rebased onto main after #364 and #365. Both SFF-PUSH entries and both builder
feedback entries are retained; main's MCP artifact, consumer process-group
cleanup and diagnostic-only quick RSS slope are unchanged.

Hosted run 41742856407 failed before run admission: the Ask click was intercepted
by `section.ra-env-pop` (environment disclosure), not the new answer/receipt
anchor footer. The environment component was identical on main. Its automatic
opening waited for asynchronous health labels and could cover Ask after the
preset click. Suppress automatic opening after pointer or keyboard interaction;
explicit disclosure remains available. Both new regression cases fail against
the original main component and pass with the fix (Node 22). Browser selectors,
assertions, timeouts, conformance cases and hard gates are unchanged.

The early ECONNREFUSED was the preview proxy polling the API during startup;
health subsequently succeeded and nine other hosted specs passed. The same
transient startup message was observed locally with the browser suite passing.
Recovery verification uses fixture providers, simulated settlement, ephemeral
ports and DOTENV_CONFIG_PATH=.playwright/no-env. No new Testnet transactions.
