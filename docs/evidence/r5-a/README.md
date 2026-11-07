# Round 5 A — verifiable abstentions

Local packed candidate, fixture models, fictional fixture writers plus team-authored real content, XRPL Testnet, faucet only; no real value. This is consumer/ledger evidence, not a published release or live-model quality measurement.

Every DONE Testnet run now commits its audit head, including no-purchase decision rows. STOPPED/FAILED runs without receipts remain unanchored. Simulated exports retain the unchanged verifier's `SKIP audit anchor: simulated run`. Anchor policy uses the existing fee/reserve ceiling outside purchase-budget accounting; normal observed anchor fee is 12 drops. Fee spikes retain the existing payer policy and display the actual fee. Neither verifier, Store money methods, corpus, bank bytes nor signing order changed.

The UI offers receipts export without requiring a purchased answer and labels the anchor `Anchored on XRPL · no purchase · anchor fee 12 drops (Testnet) · ledger N`. A failed anchor leaves DONE with an explicit, redacted `Anchor unavailable (reason)` event. MCP returns `ledger.anchor` and empty purchases. `try` prints one result and net/gross amounts.

## IOU timing (retained target miss)

Fresh private state: **122.885 s** to first packed MCP `ask_expert`; warm process restart and second call: **21.452 s**. Cold target ≤100 s **not met** (previous reported 134 s); warm ≤35 s met. Cold wallet preparation took 106.76 s; serial issuer stage reached trust lines at 14.2 s, then issuance at 79.8 s. Only account-line reads overlap; all signing and validation remain serial in the original order. Four progress lines plus wallets-ready go to stderr. JSON-RPC stdout was parsed by the MCP SDK throughout. No timeout or threshold was raised to turn this miss into a pass.

Provisioning moved from scripts/testnet-wallets.ts to publisher/publishing/testnet-funding.ts before this branch. The minimal read/progress change is in that current implementation. The fixture test checks overlapping reads, the exact original signature sequence, progress and warm reuse.

## Reproduction and provenance

Build with `node scripts/build-mcpb.mjs`, add the release `bin.mjs` entry, build/copy the UI and `npm pack` into a lane-private directory. Run the unchanged `scripts/judge-bank-testnet.ts` against each frozen bank with `RA_ACCEPT_TESTNET=1`, separate durable private state and `JUDGE_OUT_DIR` under this folder. Each results.json records bank and packed artifact SHA-256. The runner's separate ≥12 buy-and-cite assertion remains unchanged; its held-out failure is retained, independent of online verification.

`acceptance.ts` records packed MCP IOU cold/warm, packed app HTTP export, and a try-style SDK/engine abstention export. Python verification uses a freshly built and installed wheel. TS uses `npm run verify:answer -- <export> --ledger`. Private wallets stay outside this directory.

Retained harness incidents: the first app export looked in the MCP database rather than app's separate directory. A resumed attempt also encountered replaced bytes at the shared `/tmp/researchagent-mcp-1.0.0.tgz` path (its hash changed from the bank candidate's ed5dfc58… to 5d49ae48…). That old artifact still omitted abstention anchors and duplicated try's RESULT. The failed harness logs and its try output remain here, explicitly excluded from final acceptance. Final app/SDK/try validation uses the isolated `/tmp/r5-final/` artifact. The banks had already extracted and pinned the original candidate before that replacement; their anchor checks and per-artifact hashes remain authoritative. The final candidate differs only in the equivalent try amount calculation and removal of a redundant provisioning filter; anchor/bank behavior is identical.

The harness export observation wait was corrected from 20 to 90 seconds to match UI observation, after the initial harness failure; this changes evidence orchestration only. Product waits, test timeouts, verifiers, hard gates and policy thresholds were not loosened. No independent agent review was started because this implementation child was instructed to do the work itself.

One mixed-artifact SDK state audit reports a pre-existing `premium_leak` on the UC3 run created by the replaced shared tgz; it is retained as `mixed-artifact-state.gate-audit.txt`, never counted as zero. The three named abstention runs from the intended candidate independently audit at zero (`abstentions.gate-audit.json`), as does the final app state. A separate fresh-state final try avoids reuse of that old UC3 record.

## Final results

- Development online verification **16/20 → 20/20**; held-out **8/20 → 20/20**. Both completed banks: **gate audit 0**, no blanks, unchanged buy-and-cite **16/20 and 8/20**. All 20 held-out exports additionally pass the freshly installed Python wheel online. The held-out runner exits 1 solely at its unchanged ≥12 buy-and-cite assertion; dev exits 0. Per-question exports, checks, hashes and runner logs are retained.
- All three requested abstention surfaces pass both unchanged CLI verifiers: packed MCP (`iou-cold`, plus warm), packed app (`app`) and try-style SDK (`try-style`). Each prints `PASS audit anchor` and `RESULT PASS`. Simulated export prints `SKIP audit anchor: simulated run (no ledger)` and `RESULT PASS`.
- Final fresh packed `try`: 69.0 s; **one** `RESULT PASS`; **net S$0.40 / gross S$0.70**. Read-only ledger verification passes its refund/re-buy/anchor chain.
- **Additional gate finding retained:** fresh UC3 try's full-state gate audit flags one `premium_leak`: event 31 REFUND contains the existing mandatory disclosure `fixture writer cooperates a real writer could refuse`, also present in paid `team-recovery`. The exact eight-word detector flags that overlap. Thus the earlier mixed-state finding is also reproducible on fresh final bytes; it was not caused by the shared-tgz replacement. This ancillary diagnostic is **1, not 0**; it is not waived or removed. Abstention, app and both required bank gate audits remain zero. The disclosure/corpus and detector are unchanged and outside this lane's file ownership.
- After rebasing on origin/main: `check:fast` **passes**, 162 files, 1,377 tests pass / one existing skip; 20 chaos scenarios, zero invariant violations. Focused checks cover crash recovery with/without purchases, one fee, budget unchanged, simulated/incomplete skips, visible failure, no-purchase export/label, progress/read overlap, serial signing order, and single try result.

**Loosened:** only the acceptance harness's export observation wait, 20 → 90 s, disclosed above. No product timeout, verifier, gate, test threshold or signing order changed. **Unmet target:** IOU cold 122.885 s exceeds 100 s. **Additional nonzero diagnostic:** UC3 full-state gate audit 1, detailed above.

Browser follow-up: the first CI browser job failed against the previous anchor copy. The two existing UX2 assertions now require the exact new fee/ledger label and unavailable message; href, polling-stop and 90-second-deadline assertions remain intact. Local `npx playwright test tests/ux2.spec.ts`: **4/4 pass**, ephemeral ports. No assertion or timeout was removed or relaxed.
