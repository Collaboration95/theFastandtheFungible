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

## Wave 3 · 4 Oct 2026, 23:29 SGT
- Packages: LIVE [#95](https://github.com/Collaboration95/theFastandtheFungible/pull/95), FAULT [#91](https://github.com/Collaboration95/theFastandtheFungible/pull/91), POLISH [#93](https://github.com/Collaboration95/theFastandtheFungible/pull/93), guarded CLOUDRUN [#92](https://github.com/Collaboration95/theFastandtheFungible/pull/92); fixes IMPACT [#90](https://github.com/Collaboration95/theFastandtheFungible/pull/90) and STAGE-CHECK [#94](https://github.com/Collaboration95/theFastandtheFungible/pull/94).
- Wall clock: approximately 56 minutes (22:34–23:29 SGT); qualification and rate-limit waits dominated.
- Review blockers: 0 across six single Sol 6.1 Medium reviews. All 17 sprint PRs merged; issues #59–#78 closed.
- Verification: final main verify passes 116 unit tests (zero skips), two serial browser checks, lint/typecheck/build. Fresh npm demo and npm demo:live each produce the S$0.80/v2 QUALIFIES story and actual PDF. S$0 shows would-buy without spending; open-sufficient buys nothing; actual fault UI retry preserves one receipt/settlement/charge/grant. Projector is readable at 1280×720; 16 UI citations and 32 named passages in each final PDF match exactly.
- Live evidence: Groq openai/gpt-oss-20b produced actual answers/reports, and both Clef models produced matched probability tables. Corrected default sweep recorded five canonical/open-sufficient/contradiction completions; one contradiction attempt spent zero at the original 0.20 threshold. Flash decisive values 0.1743–0.2630 vs redundant supplier 0.0340–0.0508 support the new generic 0.15 threshold. No fabricated corrected sweep is claimed. Five unchanged live attempts exceeded their deadline, then five explicitly fixture completions reported UNCHANGED. Final main live smoke used actual Clef with final-answer/report fixture fallbacks.
- Calls: qualification artifacts record 183 Groq / 257 Cloudflare, plus a conservative allowance of up to nine interrupted Groq calls. The final isolated main smoke adds only bounded calls; nightly limits remained below 300/1000. No credentials or raw provider errors were recorded.
- What broke: old Clef request fields caused HTTP422; adding model and criteria fixed it. Duplicate full bodies in report context caused HTTP413; exact spans avoided repetition. Groq429 and parallel Clef3-second timeouts caused visible fallbacks. Long Retry-After could stall the package; it now falls back without retrying early. Projector tabs hid internals from obsolete all-visible browser assertions; navigation was corrected. Cloud Run lacks qualified persistent SQLite WAL storage here, so prepare/deploy/startup guards preserve the journal gate and local fallback; no Docker runtime or cloud deployment is claimed.
- Lesson: check the provider schema before blaming keys, calibrate from recorded probabilities, and report the actual provider separately for each answer, decision and report. A fallback keeps the stage story usable only when the substitution stays visible and the hard gates remain enforced.
- Human handoff: qualify/deploy Cloud Run storage, record after Thu freeze, rehearse three times Friday, and tag demo-oct10. Full-provider live coverage remains imperfect. No real funds or cloud resources used.

## Pivot · 6 Oct 2026
- Trigger: `npm run demo:live` was genuinely live (DeepSeek answered, Clef bought, 80,000 drops settled on XRPL Testnet), yet every question returned the Vertex story. Root causes: a 19-doc single-topic synthetic corpus, a publisher search that ignored the query, a fixed 3-value gap enum, and stage-paced replay that made real runs feel like motion graphics.
- Decision: become a neutral search engine for agent-readable expertise. Federated writer search (Orama hybrid), signed manifests, real x402 v2 on `xrpl:1` with publisher-hosted facilitators, `/challenge` refunds, and a Beta-reputation trust matrix that weights Clef. Recorded as D1–D14 in FINAL-PUSH.md.
- Research that shaped it: Cloudflare Pay Per Crawl prices pages at one flat rate per site; Pay Per Use (30 Sep 2026) trusts the buyer's self-reported usage; x402 has no refund or delivery verification; XRPL Testnet is an official x402 network.
- Docs: 4 Oct prompt, plans and company context archived; roadmap, agent guide, diagrams and canvas deleted.
- Lesson: a live provider behind a fixed corpus is indistinguishable from a fixture. "Real" has to start at the data, not the model.
