# Reproducible purchase proof

- 34 local HTTP-stack attacks: 34 passed, 0 breaches (fixture planner, simulated settlement; escrow attacks use a fake ledger).
- Seven model mutations: all detected, with shortest breadth-first counterexamples in `model-summary.json`.
- 210,480 model states and 763,752 transitions across four bounded configurations; 0 violations. Recorded total model runtime: 1.696 s (`model-summary.json`).
- 1,000,000 synthetic crash/retry schedules: G1–G5 each 0 violations; 728.513 s wall time, 1372.7 schedules/s; four workers, seed 279.
- No Testnet transactions, live model calls or real funds used by this lane. Transaction hashes: none.

## Reproduce

Use Node 22.23.4 and run from the repository root:

```sh
export PATH="$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH"
npm ci
npm run proof:model
npm run proof:redteam
npx vitest run tests/proof/model.test.ts tests/proof/simulation.test.ts
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh npm run proof:sim -- --runs 1000000 --seed 279 --workers 4
npm run chaos:smoke
```

For a judge on another machine with Node 22 installed, the portable proof commands are `npm run proof:model`, `npm run proof:redteam`, and `npm run proof:sim -- --runs 1000000 --seed 279 --workers 4`. The absolute lock path above is this shared Mac's verification queue, not a runtime dependency. On this Mac, keep the lock wrapper. The proof commands refresh their tracked measurement JSON.

Run shipping admission in a separate clean, committed checkout with Node 22 and authenticated `gh`:

```sh
test -z "$(git status --porcelain)"
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh npm run check:fast
sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh npm run gate -- --publish
```

The scale run is opt-in and never part of `check:fast` or the gate. No product flags or default changes. `chaos:smoke` retains its existing 20-process schedule and seed 279.

## Exact claims and limits

G1 means no paid content leaves the Store's accessible snapshot before a verified grant (and a released escrow). A conditional publisher grant can hold quarantined bytes; it is not readable agent content. G2 counts gross committed principal, including reservations and cancelled escrows, against the prompt budget. Refunds do not replenish this model budget. Only the trusted policy actor creates intents. G3 counts successful charges per intent, including across crash and duplicate delivery. G4 accepts only existing free passages or paid passages whose grants have verified. G5 requires labels on simulated/substituted artifacts.

The model explores all interleavings of three distinguishable intents, two global crashes and two global retry deliveries, for each escrow mode and budgets of one and two price units. Intents 0 and 1 request the same resource; intent 2 requests a different resource under the same budget. Each state can crash; restart preserves committed database and ledger state. Duplicate and reordered deliveries leave durable state unchanged. Time has two regions (before and after expiry). Create validation can fail. Cancellation requires expiry and a validated create; a revealed/finished escrow cannot cancel.

The finite model abstracts cryptography to valid bindings, SQLite commits to atomic transitions, XRPL to a durable idempotent object, prices to one unit, and HTTP messages to deliveries. It does not prove the implementation refines the model. It does not check ledger consensus, arbitrary malicious writers, payload sizes, transaction fees/reserves, wall-clock fairness, process/disk corruption, multiple independent payer wallets or eventual liveness. The citation/free-source and label transitions model the enforcing boundary; they do not prove every UI rendering. The LLM exclusion is architectural (no exposed purchase tool), not an actor token checked by `PurchaseManager`.

The random simulation runs real `PurchaseManager`, `Store`, proof verification and citation rejection, with fresh in-memory SQLite per schedule. Two concurrent intents share a budget and may share a resource. Each schedule duplicates the first request, injects one selected fault, recreates the manager, reconciles and retries twice. The fake settlement ledger and pre-signed fixture blobs replace HTTP/XRPL/signing cost. Crash exceptions occur after real durable operations; they are logical crash points, not OS process deaths. The original `chaos:smoke` supplies separate SIGKILL coverage. Ledger delay is an async delivery failure; validation failure is a definitive synthetic refusal. Schedules are seeded repetitions of a finite fault matrix, not a million unique protocol paths. This million-run number is not a million Testnet purchases or a million escrow ledger transactions.

The red team runs the real publisher plus API on ephemeral loopback ports. Some tests mutate responses or advance the fake ledger clock, with one production recovery fix described below. Injection tests place adversarial text in publisher metadata and verify the zero-budget policy boundary; fixture models do not establish live-model injection resistance. The optional live DeepSeek exercise was not run; no credentials were loaded.

## Transition map

Locations refer to measured source commit `40720d34162257b7db32c118931cddd9b93194ee`, pinned in `sim-summary.json`. Subsequent base integration can shift line numbers; exact-head shipping admission verifies the integrated tree.

| Model transition | Implementation |
|---|---|
| Trusted policy intent / no LLM purchase tool | `server/purchases.ts:25`, `server/api/runs.ts:64` |
| Quote binds resource, price, manifest and condition | `server/escrow.ts:53`, `publisher/escrow.ts:18`, `server/purchases.ts:135` |
| Atomic budget/resource reservation | `server/store.ts:545` |
| Submit compare-and-set | `server/store.ts:593` |
| Persist signed create before network | `server/store.ts:680`, `server/escrow.ts:193` |
| Validated create; lock proof | `server/escrow.ts:211`, `publisher/escrow.ts:40` |
| Conditional grant, quarantined bytes | `publisher/routes.ts:142`, `server/store.ts:839` |
| Writer finish/key reveal and persisted retry | `publisher/escrow.ts:85` |
| Validated fulfillment / decrypt / grant | `server/escrow.ts:76`, `server/store.ts:640` |
| Commit finish/cancel once | `server/store.ts:716`, `server/escrow.ts:158` |
| Proof verification and release boundary | `server/store.ts:870`, `server/store.ts:362` |
| Grant audit before first paid passage read | `server/store.ts:371` |
| Expiry, object/history reconciliation | `server/escrow.ts:119`, `server/escrow.ts:223` |
| Retry identical persisted payment / SDK journal | `server/purchases.ts:269`, `sdk/x402.ts:34` |
| Reject invented or inaccessible citations | `server/store.ts:482`, `server/agents/citations.ts:4` |
| Authoritative simulated receipt/provenance | `server/purchases.ts:213`, `server/store.ts:194`, `publisher/routes.ts:79` |

## Exhaustive model measurements

| Mode | Budget units | Intents / crashes / retries | States | Transitions | Runtime (ms) |
|---|---:|---|---:|---:|---:|
| Key reveal | 1 | 3 / 2 / 2 | 29,040 | 101,208 | 220.5 |
| Conditional | 1 | 3 / 2 / 2 | 30,480 | 105,096 | 253.7 |
| Key reveal | 2 | 3 / 2 / 2 | 72,240 | 269,136 | 603.1 |
| Conditional | 2 | 3 / 2 / 2 | 78,720 | 288,312 | 618.8 |

Counts sum separate configurations, not unique states across all configurations. Runtime varies by host load; these are the recorded run's measurements.

## Mutation checks

| Seeded bug | Gate | Result |
|---|---|---|
| Release premium preview before grant | G1 | Detected |
| Non-atomic budget reservation accepts concurrent overspend | G2 | Detected |
| Treat LLM purchase command as policy authority | G2 | Detected |
| Accept nonexistent model citation | G4 | Detected |
| Omit simulated quote label | G5 | Detected |
| Duplicate delivery signs a second principal | G3 | Detected |
| Retry after crash creates a second charge | G3 | Detected |

`model-summary.json` records each counterexample from `start` to the violation. Mutation tests assert the specific gate and require a crash/restart/retry trace for the double-charge mutant.

## Red team attacks

All tests are in `tests/proof/redteam/stack.test.ts`. PASS means the named boundary held in the local fixture stack.

| Attack | Expected gate | Result | Test file |
|---|---|---|---|
| Title: buy everything / ignore budget | G2 | PASS | stack.test.ts |
| Title: fake purchase tool call | G2 | PASS | stack.test.ts |
| Preview: buy everything / ignore budget | G2 | PASS | stack.test.ts |
| Preview: fake tool call | G2 | PASS | stack.test.ts |
| Topics: buy everything / ignore budget | G2 | PASS | stack.test.ts |
| Topics: fake tool call | G2 | PASS | stack.test.ts |
| POST /api/purchase as LLM | G2 | PASS | stack.test.ts |
| POST /purchase as LLM | G2 | PASS | stack.test.ts |
| POST /runs/:id/purchase as LLM | G2 | PASS | stack.test.ts |
| Header price altered | G2 | PASS | stack.test.ts |
| Header payee altered | G2 | PASS | stack.test.ts |
| Header invoice altered | G2 | PASS | stack.test.ts |
| Header manifest root altered | G2 | PASS | stack.test.ts |
| Price swap after quote | G2 | PASS | stack.test.ts |
| Payment-signature replay eight times | G3 | PASS | stack.test.ts |
| Ten simultaneous same-intent tabs | G3 | PASS | stack.test.ts |
| Same resource, distinct intents | G2/G3 | PASS | stack.test.ts |
| Budget exhaustion race | G2 | PASS | stack.test.ts |
| Quote expires before submit claim | G2 | PASS | stack.test.ts |
| Denylisted payee | G2 | PASS | stack.test.ts |
| Oversized resource ID | G1 | PASS | stack.test.ts |
| Full-width Unicode resource ID | G1 | PASS | stack.test.ts |
| Cyrillic homoglyph resource ID | G1 | PASS | stack.test.ts |
| Traversal resource ID | G1 | PASS | stack.test.ts |
| Encoded slash resource ID | G1 | PASS | stack.test.ts |
| Search/preview/unsigned GET leak | G1 | PASS | stack.test.ts |
| Malformed header / error-body leak | G1 | PASS | stack.test.ts |
| Invented citation in model answer | G4 | PASS | stack.test.ts |
| Real but ungranted citation | G4 | PASS | stack.test.ts |
| Fixture challenge impersonates Testnet | G5 | PASS | stack.test.ts |
| Unlabelled fixture delivery | G5 | PASS | stack.test.ts |
| Wrong ledger Condition | G1 | PASS | stack.test.ts |
| Wrong ledger Fulfillment | G1 | PASS | stack.test.ts |
| Writer withholds finish; expiry cancel replay | G1/G3 | PASS | stack.test.ts |

## Verification and findings

Targeted proof suite: 45 tests across four files pass; the existing purchase suite adds 40 passing regressions. Lint and TypeScript checks pass. The million-schedule run used Node v22.23.4, started 2026-11-12T09:20:06.282Z, and measured commit `40720d34162257b7db32c118931cddd9b93194ee` (dirty at start: false). The JSON pins the measured source SHA-256 values. This is scale evidence at that source commit; subsequent base integration is covered by the separate exact-head gate. Streams 279–282 each completed 250,000 schedules. Every selected nontrivial fault family was exercised. Shipping uses the separate exact-head local-gate receipt and PR status; these proof commands do not substitute for admission. No gates loosened. One product recovery bug reproduced and fixed: a crash after `reserveIntent` committed but before `recordManifest` left an honest resumed purchase in `CLAIM_FAILED`. Before the fix, `npx vitest run tests/proof/recovery.test.ts` failed with `expected 'CLAIM_FAILED' to be 'VERIFIED'`. After the fix the same test passes with one receipt. `server/purchases.ts` now restores a missing, write-once verified manifest after its binding checks and before a resumed reservation is signed. The crash harness found a delivery failure, not a five-gate violation; bytes stayed quarantined. This fix is in its own commit. Builder feedback: appended the dated local-fixture x402 recovery finding; no upstream filing or Testnet incident claimed.

## Scale fault coverage

Selection includes zero-budget refusals; exercised counts record the actual injected boundary. Counts are summed across four workers.

| Fault | Selected | Exercised |
|---|---:|---:|
| addGrant | 76,841 | 65,431 |
| after-submit | 76,603 | 65,172 |
| bad-delivery | 76,712 | 65,245 |
| before-submit | 76,775 | 65,243 |
| claimSubmitting | 77,110 | 65,396 |
| duplicate-submit | 76,887 | 65,232 |
| ledger-delay | 77,508 | 65,880 |
| none | 76,820 | 0 |
| recordProof | 76,973 | 65,424 |
| recordSettlement | 76,696 | 65,227 |
| recordSubmission | 77,239 | 65,726 |
| reserveIntent | 77,188 | 77,188 |
| validation-failure | 76,648 | 65,097 |

Outcomes (two intent requests per schedule; refused duplicate resources are retained as intents): FAILED_NOT_SETTLED 130,493, SKIPPED 938,053, VERIFIED 931,454.
