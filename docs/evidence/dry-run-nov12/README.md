# Unsigned ledger dry runs · 11 November 2026

Run `node scripts/ledger-dry-run.mjs` (or repro 01 with `--live`). Public RPC only; nothing signed or submitted, no fees paid. Mainnet is read-only. TEST-SGD is our no-value Testnet stand-in for RLUSD.

| Network | Transaction | Verdict | Autofilled fee (drops) | Ledger index |
|---|---|---|---:|---:|
| Testnet | RLUSD | tecNO_PERMISSION | 10 | 22244249 |
| Testnet | TEST-SGD control | tesSUCCESS | 10 | 22244249 |
| Testnet | Dummy finish fee | tecNO_TARGET | 350 | 22244249 |
| Mainnet | RLUSD | tecNO_PERMISSION | 10 | 108262329 |

The Testnet creates use the same source, destination, value, deadline and condition; only currency/issuer change. The dummy finish tests fee autofill, not successful delivery: OfferSequence 1 names no escrow. Its 36-byte synthetic fulfillment is public test data.

We retain the signing fees: buyer 12 drops to lock; writer 423 to reveal (xrpl.js fractional formula and 1.2× cushion). rippled autofills 350 for the finish. A simulation is a ledger-state snapshot, not a guarantee of later submission.

[Raw requests and responses](result.json), including amendment status, issuer flags and ledger indexes. [Official simulate API](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/transaction-methods/simulate).

## Production finish guard (X1c, 12 November)

The finish guard is a **read-only ledger pre-check; the key is never sent before
the signed finish**. It re-reads the validated escrow immediately before signing:
object present, expected owner, this writer as destination, expected amount and
CancelAfter, ledger Condition matching both the quote and the Condition derived
locally from K; validated `close_time + 30 s < CancelAfter`. Missing, finished or
cancelled objects fail closed. LastLedgerSequence remains current + 5.

The production path never simulates a finish, with either real or dummy
fulfillment. The application RPC wrapper rejects simulate requests with a
Fulfillment (JSON or binary). Buyer create/cancel/anchor simulations are unchanged.
The standalone historical fee probe above used a public dummy, never K, and
remains valid evidence. Unsigned finish simulation with real K was unsafe: even
a refusal would disclose the article key to the RPC operator. Only the persisted
signed finish submission may send K; its validation can still fail or be delayed.

Regression evidence: `tests/writer-reveal-guard.test.ts` spies on every request,
checks no request before submit contains K or its fulfillment hex, and checks
that the first key-bearing request is the signed, persisted finish submission.
`tests/xrpl-connection.test.ts` verifies rejection before connecting or forwarding
a simulate containing Fulfillment. The pre-check report is persisted with the
signed finish and replayed on retries, without inferring a new check or signing
again. The existing gate-audit implementation is unchanged.

### Live acceptance · 12 Nov, 00:33 SGT

Current source `runTry(["--testnet"])`, loaded with Node/tsx, fresh application
state and cached Testnet wallets: **RESULT PASS**, 54.3 s; S$2.00 budget,
S$0.70 gross, S$0.40 net. Fixture models and fictional/team-authored writers;
real Testnet execution, no real value. Two writer pre-check events, zero finish
simulation events. No hosted question used.

| Step | Validated transaction |
|---|---|
| Create | [50C1F0D6…](https://testnet.xrpl.org/transactions/50C1F0D6FD4E5ABE7A43E856D9DD2E4A29EF6042D25000AD4E8F74ECDD813D53) |
| Finish | [98107EE1…](https://testnet.xrpl.org/transactions/98107EE15BFAF87CDD77AF54590961089AF953913FF2C90BD9FDCC1A8FE3CBCD) |
| Writer-signed refund | [6A1F5113…](https://testnet.xrpl.org/transactions/6A1F51139BF843131E560235C972190856D2D99DC225C30004D73431C98988A6) |
| Re-buy create | [11A6A682…](https://testnet.xrpl.org/transactions/11A6A6824C165FA780F49403932E469FC11607A3D77EE77938B084A029EB9E47) |
| Re-buy finish | [3D8F9724…](https://testnet.xrpl.org/transactions/3D8F97249C3B6851671904726BB694506C90B3FA39C221C07A6C85C66A73BB23) |
| Anchor | [1C649170…](https://testnet.xrpl.org/transactions/1C6491706B1FAB1D8CAFBAE918F2822A0B803DB1D415676EF0CF49D06979450A) |

Published v1.1.1 MCP TypeScript verifier and independent Python wheel both verify
the fresh receipt export with `--ledger`: **RESULT PASS**, 12/12 Testnet checks,
anchor at ledger 22246373; Python 61 passed, 0 failed, 2 skipped. Artifacts were
downloaded with `gh release download v1.1.1`; the wheel was extracted before use
(the verifier reads its bundled schemas as files). Unchanged `gate:audit --db`
reports 1 run, 0 violations across all ten rules. The five focused test files
(writer guard, RPC connection, ledger dry run, key reveal, gate audit) pass 69/69;
resource check: 0 unexpected temp entries, 0 live owned groups. No thresholds,
fee caps, audit rules or buyer simulation semantics were loosened.

The same happy-path spy assertion was run against the pre-fix `931ef666` writer,
signer and RPC sources in an isolated synthetic test sandbox. It fails because
the pre-submit RPC list contains the real per-test fulfillment inside an unsigned
EscrowFinish simulate request. With X1c sources, all 14 writer-guard cases pass.
This is synthetic regression evidence; no Testnet key was used in the negative probe.
