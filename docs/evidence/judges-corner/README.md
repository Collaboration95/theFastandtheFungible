# Judges' corner and stage kit · 11 November 2026

Lane JC, resumed from `ea3bd80b` and rebased onto v1.1.1's `bd52beff`.
The UI checks use a local `HOSTED=1` stack with fixture models and simulated
settlement. The recorded bundle is from the real hosted Testnet run of
11 November: live research, rule-based purchase decisions, team-authored
writers, no real value. No hosted question was asked for these checks.

## Real stage check on this Mac

`node scripts/stage-check.mjs`, 11 November 17:33 SGT, exit 0:
**USE TIER 1 · Live**. Full output: [stage-check-nov11.txt](stage-check-nov11.txt).

- Hosted status: ready, 5/5 questions and S$10.00 remaining in the reused
  stage-check session. This is status evidence, not a new question.
- s.altnet: current ledger 22238847; EscrowFinish `4CCB4E56…1AC70638`
  validated in ledger 22228567, Fulfillment present.
- v1.1.1 tgz and wheel: actual asset HEADs via authenticated `gh`, both 200.
  Replay and ledger pages: both 200.
- Committed bundle SHA-256:
  `1f2fe4de4de58fedb68c8e04c9f2106fa0b66004c1839ae93f29bb0662ee13ee`;
  public copy matches `docs/evidence/hosted-export-nov11/receipts.json` byte for byte.
  Offline verifier: RESULT PASS. Deck PDF exists (1274 KiB).
- Video: **NOT CHECKED**, no `--video` path supplied. Tier 4 is NOT READY
  until the presenter supplies the final MP4. Replay can be built locally.

## Acceptance checks

Browser and final gate results are recorded below after completion. Screenshots
are local UI evidence, never a claim that this change has been deployed.
The visible recorded-run label describes that historical bundle, while the
environment chip truthfully describes the local simulated stack.

The startup plan now uses the same mixed-corpus label as the published MCP:
before a run has sources, “Fixture models · fictional and team-authored writers”.
Completed MCP results already narrow that label to the actual cited writers.
No source attribution is inferred before a run exists.

No test, leak threshold, gate or budget was loosened. The fact-menu snapshot
was added for the intended prose labels; the recorded receipts hash is unchanged.
