# October 10 build log

## Wave 0 · 4 Oct 2026, 21:41 SGT
- Package: W0, [PR #79](https://github.com/Collaboration95/theFastandtheFungible/pull/79).
- Wall clock: approximately 11 minutes (21:31–21:42 SGT).
- Review blockers: 0, one Sol 6.1 Medium pass.
- Verification: check:fast (22 unit tests); verify (17 browser tests and production build).
- What broke: initial tests could not listen in the filesystem/network sandbox (EPERM); permitted local execution passed.
- Lesson: agree typed boundaries before parallel work. The legacy fixture journey stays wired until integration; no October demo claims yet.

## Wave 1 · 4 Oct 2026, 22:14 SGT
- Packages: CORPUS [#83](https://github.com/Collaboration95/theFastandtheFungible/pull/83), PUB [#82](https://github.com/Collaboration95/theFastandtheFungible/pull/82), LEDGER [#85](https://github.com/Collaboration95/theFastandtheFungible/pull/85), RESEARCH [#81](https://github.com/Collaboration95/theFastandtheFungible/pull/81), DECIDE [#84](https://github.com/Collaboration95/theFastandtheFungible/pull/84), REPORT [#80](https://github.com/Collaboration95/theFastandtheFungible/pull/80), UI-ASK [#86](https://github.com/Collaboration95/theFastandtheFungible/pull/86), UI-AGENT [#87](https://github.com/Collaboration95/theFastandtheFungible/pull/87).
- Wall clock: approximately 30 minutes (21:43–22:13 SGT), six workers maximum.
- Review blockers: 0 across eight single Sol 6.1 Medium reviews.
- Verification: all package check:fast/precommits green; main verify passes 112 unit tests plus 17 legacy browser tests/build. Seven additional internals fixture tests enter the default suite in W2.
- What broke: branch auto-deletion after merging an active worktree interrupted local sync; removed the worktree before branch cleanup. No package build failure. Main and W2 verification starts briefly overlapped, causing a port conflict in W2; rerun serially.
- Demo smoke: October scripts intentionally belong to W2. Its first ephemeral HTTP smoke already passed S$2→grid S$0.80→v2 QUALIFIES→round-2 stop→real PDF, and S$0→would buy with no charge.
- Lesson: stable typed stubs let modules meet on the first integration run. Parallel implementation works; browser checks must remain serial on the shared demo ports.

## Wave 2 · 4 Oct 2026, 22:34 SGT
- W2-INTEGRATE [#88](https://github.com/Collaboration95/theFastandtheFungible/pull/88), W2-SCENARIOS [#89](https://github.com/Collaboration95/theFastandtheFungible/pull/89).
- Wall clock: approximately 28 minutes (22:04–22:32 SGT), integration local plus one scenario worker.
- Review blockers: 0 across two single Sol 6.1 Medium passes.
- Verification: main verify passes 97 tests/two browsers/build before scenarios; scenario check:fast adds required SC-01–06, Stop and API/SSE/Clef/Groq leaks (108 passed, one optional unchanged impact test skipped pending fix-forward).
- Demo: npm run demo on main PASS at S$2 (S$0.80, v2 QUALIFIES, round 2 stop, real PDF) and S$0 (zero spend, would buy). Exact drawer and corpus HTTP403 verified. Provider badges all fixture/local/simulated.
- What broke: obsolete browser form labels, then controlled report routing from hidden .playwright directory. Fixed labels and sendFile options without opening arbitrary paths. The unchanged variant exposed STRENGTHENS vs UNCHANGED; W3-IMPACT-FIX owns it.
- Lesson: end-to-end tests found integration details that isolated modules could not. Keep the paid body quarantined until a verified grant, including wire snapshots.
