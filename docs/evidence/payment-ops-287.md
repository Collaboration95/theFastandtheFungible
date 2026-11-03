# Payment operations evidence (#287)

Recorded 3 Nov 2026 against the Lane D implementation, based on #301.

## Local fault and performance proof

`node --import tsx scripts/payment-ops-proof.ts` compares response-held and
ledger-held signing queues using the same signer, an immediate in-memory ledger
and a controlled 300 ms writer-body delay. Ten independent pairs per arm.
This isolates the lock change; it is **SYNTHETIC**, not live throughput or an
end-to-end production load test. Before uses #301's response-held queue
semantics around the same signer; it is not a checkout-wide benchmark.

| Metric | Before | After |
|---|---:|---:|
| Queued payment p50 (ms) | 304.94 | 3.55 |
| Queued payment p95 (ms) | 307.91 | 6.24 |
| Lost-response recovery | Restart required (baseline source) | 15.30 ms, same process, 50 ms test interval |

The production reconciler defaults to 15 s, plus ledger/publisher latency.
The simulated recovery receipt count is 1; faults never produce a second
signature. The test interval is deliberately short and is not a 15 ms live
recovery promise. Source limitation before: REVIEW-NOV-2026 finding 3.

`tests/xrpl.test.ts` covers crash after persist/before submit, submit timeout,
confirmed-but-not-recorded, ledger-confirmed with publisher down, low balance,
stale ledger, sequence exclusion, slow delivery and endpoint authentication.
`tests/purchase.test.ts` covers timer recovery without restart, durable retries,
three-attempt exhaustion/backoff, recovery to VERIFIED and stopping on drain.
`tests/operations.test.ts` checks safe JSON logs, unknown costs, usage with
Langfuse disabled, database write failure and publisher failure.

## One real Testnet purchase

`node --import tsx scripts/payment-ops-proof.ts --testnet` uses a synthetic mini
article and fixture BUY policy; zero model calls. Loopback publisher at 9990
(OFFSET=1200); ignored journals persist under `scratch/payment-ops-287/`.
The script refuses to start another Testnet proof if its buyer DB exists.

- Rail: XRPL TESTNET · no real value.
- Amount: 0.06 XRP (60000 drops), below the 0.1 XRP cap; normal network fee additional.
- Transaction: [0109AE3D362011C2E277B3A617770162304651A93C5884CCC403D459C4FE9FC5](https://testnet.xrpl.org/transactions/0109AE3D362011C2E277B3A617770162304651A93C5884CCC403D459C4FE9FC5).
- Validated ledger: 22025680.
- Purchase and idempotent repeat: VERIFIED / VERIFIED; receipts: 1.
- Purchase plus repeat elapsed: 8.85 s.

No submit timeout was observed in this real check. Submit/crash recovery
observations above are injected local faults, never described as live incidents.

## Compatibility

- `make run OFFSET=1200`: web 6300, API 9988, publisher 9990; fixture startup and HTTP checked.
- `make clip OFFSET=1200`: UC2 reached Answer ready, screenshot and nonempty WebM/MP4 saved; record mode uses a fresh store and ephemeral ports. Generated media removed after checking to save disk.
- `npm run check:fast`: existing hard gates retained; final counts recorded in the PR.
- Runbook: `docs/RUNBOOK.md`.

After rebasing on #304, the scorecard fingerprint is versioned as
`sff-scorecard/v3-operations`: only the three telemetry-instrumented source
hashes change. Bank, corpus, snapshots, prompts and thresholds match v2;
all exact-hash checks remain. `npm run scorecard` completed the full fixture
flow, sweep, coverage and ten timing queries, consumed `operations-v1`, made
zero provider calls and reported zero hard-gate violations. The new fixture
summary is recorded alongside the retained v2 live history. An additional
read-only Testnet lookup confirmed the original hash/receipt again after rebase;
no further payment was made.
