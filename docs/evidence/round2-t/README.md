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
