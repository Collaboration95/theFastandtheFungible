# Round-4 fixture refresh · 7 Nov 2026

Run: `EVAL_FROZEN_FILE=eval/scorecard/frozen-round4.json DOTENV_CONFIG_PATH=.playwright/no-env make scorecard`.
No `--live`; no model calls or payments. Default network guard remains enabled.

The default invocation first failed the frozen-input guard. Main has changed
`server/agents/loop.ts`, `server/agents/decision.ts`, `shared/fact-menu.ts`, and
`server/agents/requirements.ts` since the retained v9 snapshot. This lane edits
none of those files. Bank, corpus, snapshots, config and sample hashes match.

`frozen-round4.json` is a separately retained round-4 input snapshot, generated
before evaluating. The original `frozen.json`, history and regression thresholds
remain intact. Input hashes differ: before/after is descriptive only, not a
paired improvement or a passed same-input regression gate. A subsequent run
using this snapshot can use the existing same-input comparison guard.

Fresh output is retained as `latest-round4-fixture.json` and appended to history.
`latest.json` remains the published LIVE fresh-set result so J2's README numbers
and its `readme:check` contract stay consistent. This fixture result does not
replace or rebrand that LIVE evidence. The SFF tracker includes both classes.
