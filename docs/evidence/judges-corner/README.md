# Judges' corner and stage kit · 11 November 2026

Lane JC, second resume from salvaged commits `87c3b1a4` and `79dffe40`,
on `origin/main` at `bd52beff`.
The UI checks use a local `HOSTED=1` stack with fixture models and simulated
settlement. The recorded bundle is from the real hosted Testnet run of
11 November: live research, rule-based purchase decisions, team-authored
writers, no real value. No hosted question was asked for these checks.

## Real stage check on this Mac

`node scripts/stage-check.mjs`, 11 November 22:34 SGT, exit 0:
**USE TIER 1 · Live**. Full output: [stage-check-nov11.txt](stage-check-nov11.txt).

- Hosted status: ready, 5/5 questions and S$10.00 remaining in the reused
  stage-check session. This is status evidence, not a new question.
- s.altnet: current ledger 22244245; EscrowFinish `4CCB4E56…1AC70638`
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

- Targeted Vitest: **104 passed, 1 opt-in skipped** across 8 files.
- Opt-in published-release test: **9 passed**, including real asset HEADs via `gh`.
- Local hosted Playwright (`LIVE_LEDGER=1 UPDATE_EVIDENCE=1`): **5 passed**.
  Browser verification reads **s.altnet.rippletest.net**, reporting
  **45 passed · 2 not checked, 0 failed**. The skips are identity checks, not
  payment failures.
- Ready, busy, paused and ended pages: no horizontal overflow at 390 px;
  axe serious/critical violations **0**. Desktop 1280 px and phone 390 px
  screenshots cover home, expanded builder commands and the verified result.
- Fetch spies: **0** run/scope/admission requests; allowance stays **5/5**.
- Stage kit timeout regression: unfinished sockets close; no fallback socket
  starts after the report returns. Replay is served on an ephemeral loopback
  port with `connect-src` restricted to the same origin.

Screenshots are local UI evidence, never a claim that this change has been deployed.
The visible recorded-run label describes that historical bundle, while the
environment chip truthfully describes the local simulated stack.

The startup plan now uses the same mixed-corpus label as the published MCP:
before a run has sources, “Fixture models · fictional and team-authored writers”.
Completed MCP results already narrow that label to the actual cited writers.
No source attribution is inferred before a run exists.

No test, leak threshold, gate or budget was loosened. The fact-menu snapshot
was added for the intended prose labels; the recorded receipts hash is unchanged.

## Shipping verification

The first full gate passed 19 of 20 steps. Its hosted privacy test used a broad
“any Verify region” selector, which also matched the new public recorded-run
verifier. The test now explicitly denies the private-run verifier and asserts
the public judges’ corner remains available. The existing inaccessible-run
and empty-sidebar checks remain. Targeted hosted checks then passed **4/4**.
The footer now calls `UC-key-reveal` “writer no-show and refund”, matching the
recording it opens; a unit test pins both the label and URL.

The required clean-head local gate and post-merge published gate are recorded
in the PR. No gate success is inferred from the targeted checks above.

## Orchestrator follow-ups

- Redeploy the hosted image to expose the static `/judge/` bundle and new UI.
- Configure `links.proof` after H7 ships its file-backed links; until then the
  optional refusal link is hidden. No public refusal was created by this lane.
- Supply the final MP4 path for the stage check; tier 4 remains NOT READY
  without it. Prepare the pitch tabs within the available hosted quota.
