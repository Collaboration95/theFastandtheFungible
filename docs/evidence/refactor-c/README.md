# Lane C: portable startup and Testnet provisioning (7 Nov 2026)

Reachability / Feasibility: direct mode dispatch, operator-owned startup plan,
funding leaf and bounded worker ownership. Public XRPL Testnet faucet funds only;
fixture models and fictional writers. No real money, release or cloud resources.

## Cold local-packed measurements

macOS arm64, Node 26.3.1. Each cell uses a separate empty npm cache and separate
cold wallet directory. Times include npx installation from the local tgz; exclude
GitHub transfer. OS/filesystem caches are not flushed. `init` means stdio JSON-RPC
initialize, not the writer `init` subcommand. App readiness retains the exact
Testnet ready block. Try retains all six transactions and independent bundled
ledger verification under the unchanged 90 s process deadline.

| Run | Initialize (s) | App ready (s) | Try + ledger verifier (s) |
| --- | ---: | ---: | ---: |
| Before, historical J2 | 6.293 | 26.977 | 84.191 |
| 1 | 3.392 | 20.899 | 69.492 |
| 2 | 1.427 | 20.988 | 74.667 |
| 3 | 3.619 | 23.673 | 71.505 |
| Target | ≤6 | ≤25 | ≤80 |

Raw per-run stdout/stderr and timings.json preserve outcomes, including any misses.
The runner is measure.mjs. Private state is retained under the ResourceScope XDG
acceptance directory for manual reconciliation; no seeds or bearers enter evidence.
Initialization intentionally answers before background provisioning; those cells
establish protocol readiness, not successful wallet funding.

Measured tgz: **3,567,250 bytes**, versus J2 **3,418,528 bytes**. Hard cap 8 MB passes.
The conditional 3.1 MB goal is not achieved. Shared-chunk profiling remains Lane B
follow-up; this lane adds a small plan bundle without changing dependency splitting.
artifact.json identifies the measured product-source commit and exact packed hash.
Later evidence/tests do not change these runtime bytes.

## Contracts and verification

Pure parseCommand and resolveStartup expose a credential-free plan. CLI port wins;
RA_DATA_DIR wins over XDG state, then home. Test defaults use port zero. Caps are
operator environment only; MCP defaults stay zero and the try demo retains its
existing 200/500/500 caps. No tool sets authority. Existing mode adapters retain
publisher init/publish validation and local-writer registration.

TestnetProvisioner is shared by the MCP adapter and wallet scripts. XRP funding,
TEST-SGD issuer/locking/trust/issuance, and RLUSD trust-line rules remain distinct.
Only writer balance reads become concurrent, in batches of four. Signing,
submission, faucet checks, fee ceilings and validation remain serial/unchanged.
Publisher credential funding now imports the leaf rather than the publisher entry.

ResourceScope owns worker termination and lifecycle timers, try scratch and verifier
process groups. Boot accepts AbortSignal and has a 90 s bound. Close allows 3.5 s
for graceful drain, then terminates the worker; fixture tests require ≤5 s and
terminal closed state. Close is idempotent and asynchronous signal-handler errors
are caught. This is fixture teardown evidence, not a guarantee of live settlement
completion within five seconds. Existing durable journals remain authoritative.

Chromium loads only inside the report path. Report content and HTML fallback are
unchanged; the equivalent builder string rewrite was removed. Minimal builder
changes also package the new plan module; package.json is untouched.

`npm run check:fast` passes; focused lifecycle/adapter tests pass. Full coverage
and the unchanged component floors are checked separately. Extraction initially
failed publisher line coverage because scripts became measured product code;
TEST-SGD cold/warm fixture coverage was added rather than lowering the floor.
Node 22.13.0 bundled verifier passes the unchanged lane-b3 UC3 receipt fixture
with online ledger checks (node22-verifier.txt). The full suite retains publisher
credentials/private files, pause/refund, IOU opt-in, fallback labels and stable
try idempotency checks. No frozen evidence or verifier implementation was edited.

Madge 8.0.0, --circular --extensions ts,mjs --ts-config tsconfig.json, rooted at
extension/publish/engine: **4 → 3 reports**. Funding startup component: **1 → 0**.
The remaining three reports are unchanged contribution/contracts and store cycles
outside this lane's ownership; no claim of zero cycles across the entire graph.
See cycles-before.txt and cycles-after.txt. Madge reports static dependency edges,
including type-only edges, rather than proving runtime reachability.

Production source net LOC: **+97** (git numstat, excluding tests/evidence). The
≥150 deletion target is missed: extraction moves code and explicit lifecycle and
plan ownership add code. No arbitrary deletion was made to meet the target.

Nothing loosened: gates, coverage floors, deadlines, verifiers and payment/escrow
ordering are unchanged. Follow-ups: shared bundle profiling with B, further
adapter consolidation with parity evidence, and deferred desktop adapter work.
