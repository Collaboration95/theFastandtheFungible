# Free draft and UC3 pace (#281, #232)

Shipped behaviour: a validated extract from free passages is published over SSE as
`FREE_DRAFT` immediately after free retrieval, before model composition. The UI
labels it “Draft · free sources only” and applies the UX-2 question-ranked lead
selector and citation validation. Checked answers replace it in place. Paid
citations require a verified grant. The paid upgrade names its state change and
opens the existing added/removed claims view. No new animation or dependency.

## Measured fixture timings

Local production Chromium, 3 Nov 2026, OFFSET=500 (5600/9288/9290), fictional
corpus, fixture research/decisions, simulated payments, embeddings and telemetry
off. Before: origin/main `1e457b4`; after: stream implementation `cfdd2fc`, rebased
on `870fbb9`. Main advanced through unrelated release/README work during this run;
none of those files is changed by this PR. Raw samples: `stream-281-before.json`
and `stream-281-after.json`. Reproduce with the fixture production demo at
OFFSET=500 and `node scripts/measure-stream-281.mjs <output.json>`.

Times begin at **Start now**, after clarification and the intentional 5 s plan
confirmation; first answer means rendered cited text, final means “Answer ready”.
One sample per case and pace, same question order, separate fresh before/after
ledgers. These are paired observations, **not p50/p95 estimates**. Real pace runs
follow Stage runs on the same ledger, so UC3's repeat skips quarantined AlphaLeak;
compare Stage rows for the full refund path. No live-provider latency, Testnet
settlement, or live p95 improvement is claimed.

| Case | Stage 1× first answer, before → after | Stage 1× final, before → after |
| --- | --- | --- |
| UC1 | 8.363 → 1.562 s | 15.942 → 2.034 s |
| UC2 | 9.600 → 1.535 s | 39.797 → 4.545 s |
| UC3 | 8.389 → 1.321 s | 61.324 → 8.025 s |

| Case | Real pace first answer, before → after | Real pace final, before → after |
| --- | --- | --- |
| UC1 | 0.307 → 0.307 s | 0.314 → 0.313 s |
| UC2 | 0.433 → 0.421 s | 0.733 → 0.817 s |
| UC3 | 0.214 → 0.203 s | 0.484 → 0.692 s |

## Why UC3 looked slow

The before Stage 1× run spends about 61 s replaying a fixture run that finishes in
under a second at real pace. Old dwell values stack on every search, wire,
reputation and decision event (ANSWER alone 3.4 s; DECIDE 4.6 s). That explains the
large presentation penalty observed here; the historical 69 s versus 34 s runs
were not reproduced, and their provider contribution cannot be established from
these fixtures. The new dwell schedule uses short search/decision pauses and
retains readable proof, grant, challenge and refund states (refund 1 s).

The free draft also removes model composition from time to first answer after
retrieval. A deterministic blocked-composer test demonstrates this independently
of fixture speed. It does not remove planning or retrieval latency. The trace
records draft elapsedMs and each checked composition's durationMs. Existing
retrieval fan-out is already parallel; purchase rounds remain sequential because
the next decision depends on new evidence, refund/trust outcome and remaining
budget. No spending or model timeout gate was changed.

## Verification and bounds

- `npm run check:fast`: 90 files, 721 tests passed, including existing five-gate,
  budget, one-charge, retry/refund, source access and UX-2 selector coverage.
- New real HTTP SSE test checks every received UC3 snapshot for paid passage
  bytes before a verified grant and excludes refunded contents/citations. The
  fast draft also rejects a deliberately supplied paid canary.
- A blocked composer proves a cited draft is already published while the checked
  answer is pending. Every stored UC3 replay prefix withholds paid contents and
  rendered citations until its grant; the final lead retains “26 weeks to 18 weeks”.
- Production Playwright: UC2/UC3 flows, PDF, accessibility, UX-2 exact citation,
  mobile Spend and supporting screens passed (8 tests).
- No leak threshold or hard gate was loosened. The recovery browser test now
  expects “Draft · verified evidence” when its injected failed snapshot already
  contains a checked paid answer, preserving the provisional label accurately. Legacy recorded
  traces still use their historical ANSWER markers; new traces reveal checked
  versions only at ANSWER_READY. No premium token streaming is enabled.
- Conflict boundaries preserved: no changes to Makefile, README.md, site/,
  docs/README.md, docs/SFF-PUSH.md, docs/RUNBOOK.md or scripts/release.mjs. This
  evidence note records the shipped change instead of editing the reserved tracker.

Commit-hook incident: the newly merged release fixture inherited GIT_DIR and
GIT_INDEX_FILE, so its temporary-repository Git commands affected the caller's
worktree ref/index. Restored the stream branch to cfdd2fc and rebuilt the index
without changing working files. The equivalent fix landed on main in PR #329 during this run. The final rebase
retains that upstream test unchanged; it removes inherited GIT_* variables from
every child Git/release process. No assertion is removed.

- Additional production Playwright checks: 6 passed (14 total), including keyboard,
  failure recovery, 320–1440 px reflow, reduced motion and performance; UC2 CLS
  0.01269, below the unchanged 0.02 limit.
