# Changelog

All notable changes to ResearchAgent. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Tagged releases are
feature-day milestones (v0.x). Package versions follow the release tag.

Every number below keeps the scope label of the evidence it comes from
(synthetic, fixture, local or Testnet). Nothing here uses real money.
Packages are built and consumer-tested but **not published** to npm, PyPI or
the MCP Registry; that is an owner step tracked in #265.

## Unreleased

## v1.0.0 — 7 Nov 2026

First stable release. It folds in the rc.1 and rc.2 candidate notes below and everything merged since rc.2. The GitHub release carries the SDK tarball, Python wheel, MCPB, MCP tarball and unsigned DMGs; nothing is published to npm, PyPI or the MCP Registry yet.

### Added

- Opt-in TEST-SGD key-reveal token escrow on the zero-clone MCP and app with `--testnet --iou` (#384). TEST-SGD is our own faucet-funded Testnet IOU, a stand-in for RLUSD, with no real value. Real IOU receipts pass both independent ledger verifiers (6/6).
- One-shot `try --testnet` judge path (#387): UC3 with a S$2 cap, six numbered ledger links, `--ledger` verification and `RESULT PASS`. 84.2 s with an empty npm cache and fresh faucet wallets; a faucet failure runs a labelled SIMULATED path with the reason. Python `__version__` and compact verification by default, with `--verbose`.
- Stranger writer onboarding (#389): `init <dir>` scaffolds two commented example notes, validation reports every problem before faucet provisioning, and a locally published Testnet writer is discovered by the running app. Cold `init` 1.396 s; cold init plus `publish --testnet` to validated Credential 33.9 s (33.888 s); malformed note rejected in 1.510 s.
- Team-authored writer (#390): eight paid builder notes on XRPL, x402, RLUSD, escrow, fees and Credentials, disclosed as "team-authored · real content · not an independent writer · Testnet". Frozen pre-ingestion judge bank: 15/20 buy-and-cite, 0 blank answers, 0 terminal gate-audit violations, 20/20 receipt verifications. Uncovered questions end with "No listed writer covers this yet · nothing bought" and a publish link.
- Pixel-art agent (#385): original character with a sprite sheet, atlas, README hero GIF (89.0 KB), site loop and the app's writer-reputation loading state; holds frame 0 under reduced motion.
- Shared owner Settings and macOS desktop integration (#386): nine sections, guarded and audited owner changes (CSRF and local-origin checks, masked keys), Keychain, first-run onboarding, Cmd+, and persisted window bounds. A packed Testnet launcher audits a 0→125 cap change; the unsigned arm64 DMG recovers one signed submission with one receipt and grant.
- SFF submission pack refresh (#391): 12-slide deck and PDF, 50/150/300-word descriptions, 9-shot video script, pitch and 20-answer Q&A.

### Changed

- MCP tarball 21.44 → 3.419 MB (8 MB ceiling enforced); fresh-cache stdio initialize 56.5 → 6.3 s; app ready 134 → 27.0 s (#387). No-purchase runs skip the anchor transaction.
- Live ledger verification of all 45 hashes: 27.5 → 1.970 s, first verified row 1.143 s (#388). One WebSocket per endpoint, 16 outstanding lookups, no verification check removed. Issued currency names decode (RLUSD, not 40 hex); the demo proof strip collapses to `6/6 Testnet hashes verified live ✓`. Fixture CI ledger check 45/45 in 200 ms under the unchanged 6 s threshold.
- Install lines, README badge (plain semver), landing, demo banner and docs point at v1.0.0; `try` is in the release. Replays recaptured and receipts rebound (#390); EscrowCancel reports principal returned, separately from refunds.
- Duplicate builder-feedback IDs renumbered (B24/B25) and B26–B29 added; duplicate IDs now fail `check:fast` (#388).

### From the release candidates

- rc.2 (5 Nov): zero-clone Testnet MCP (#376) and app (#380); TEST-SGD key-reveal token escrow (#381); writer onboarding and the judge path (#378); verifier accepts key-reveal proofs, Python `--ledger` and default anchors (#377); completed answers poll for their validated anchor without reload; ledger expanded 25 → 45 curated transactions, 45/45 validated read-only on public Testnet.
- rc.1 (4 Nov): SDK, Python and MCP artifacts (#370); key-reveal escrow on first touch (#369, #372); Testnet reachability fixes (#367); engine heap and loop-stall reductions (#368, #371); quiet-host soak passes all five unchanged gates, worst-interval p99 25.8 ms (#374).
- Python wheel uses the PEP 440 form of the version: `1.0.0` for this release, `1.0.0rcN` for candidates.

Full candidate notes follow unchanged.

## v1.0.0-rc.2 — 5 Nov 2026

### Added

- Zero-clone Testnet MCP (#376) and app (#380), fixture models, fictional writers and no real value; writer onboarding and judge path (#378).
- TEST-SGD IOU key-reveal token escrow (#381): three happy paths and a no-show cancellation; stand-in for RLUSD, not real RLUSD. Expanded ledger verifies these runs and writer Credentials read-only.
- RC.2 artifacts and generated installs; completed answers poll for their validated anchor without reload (browser regression).
- Verifier accepts key-reveal proofs, Python `--ledger`, and default anchors (#377); default replay leads with live key-reveal UC3 and honest refund semantics (#379).

- Writer cold start: `publish --testnet` (repo bin and MCP tgz) provisions a faucet writer wallet, issues a Testnet writer Credential, enables key-reveal escrow and prints `Writer live · address r… · CredentialCreate tx ↗`. Evidence in `docs/evidence/round3-c/` (public faucet, synthetic starter). A "Real writers" list (`docs/evidence/real-writers.json`, empty until consent) is shown on the README and `/ledger/`, labelled "real person · Testnet · no real value".
- `npm run test:judge`: headless landing → every demo tab → ledger → release-link walk, run in CI.
- `per_call_cap` clamp reason, distinct from `budget_exhausted`, across the engine, TS and Python SDKs and MCP output. No cap value changed.

### Changed

- First-touch polish: promise lists show digit years, no duplicates, capped at five; the Unclear list applies the relevance floor; the README question about Kestrel–TSMC margins now buys the paid article on the fixture; ledger status reads "Checking 25 hashes live… 0/25" and checks in parallel; the anchor row says "Memo = audit head …; answer anchor"; badge, landing page and demo banner point to the release candidate.

## v1.0.0-rc.1 — 4 Nov 2026

### Added

- Release-candidate SDK, Python and MCP artifacts (#370); desktop CI downloads Electron before DMG builds (#373).
- Key-reveal escrow on first touch and in the live Testnet product (#369, #372).

### Changed

- Fix Testnet reachability and first-impression money consistency (#367).
- Reduce engine nursery footprint with retained-heap evidence (#368); attribute loop stalls, reduce Store work and clean consumer scratch (#371).
- Quiet-host full soak passes all five unchanged gates, worst-interval p99 25.8 ms; heavily loaded shared-host run failed (#374). [Local synthetic/SIMULATED evidence](docs/evidence/soak-nov4-ab/README.md).

## 1.0.0 (candidate)

Merged on `main` after [v0.8.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.8.0)
(PRs #332 and #341–#366).

### Added

- Key-reveal escrow: the writer is paid only by publishing the article key in
  EscrowFinish; a second Testnet demo tab and the ledger page verify the
  key/Condition binding, ciphertext commitments and authenticated decryption
  read-only in the browser. Synthetic articles and fixture no-show are labelled.
- Policy-owned answer audit anchors, verified with `--ledger` (#366).
- Live ledger verification, forwarded fixture Codespaces and first-run relevance, cold Testnet launcher and recorded UC3, standalone MCP tarball, and rehearsal evidence (#359–#362, #364–#365).

- Same-engine fixture workload harness and retained shared-host baseline misses.
  [#353](https://github.com/Collaboration95/theFastandtheFungible/pull/353)
- Writer identity verification using native XRPL Credentials.
  [#357](https://github.com/Collaboration95/theFastandtheFungible/pull/357)

- Python SDK: typed, standard-library client with `ask`, event iteration,
  receipts, `get_run` and `wallet_status`. [#341](https://github.com/Collaboration95/theFastandtheFungible/pull/341)
- Independently installable artifacts: SDK tarball, Python wheel/sdist and a
  `.mcpb` bundle, each accepted by a clean consumer (fresh npm project, fresh
  venv, extracted MCPB). Static browser replay of UC1–UC3 at `/demo/` from
  recorded fixture traces. [#332](https://github.com/Collaboration95/theFastandtheFungible/pull/332)
- Ranked XRPL/x402 builder feedback (six findings with severity and mainnet
  consequence) and a Testnet ledger page with nine curated historical
  transactions. The page ships in `site/ledger/`. [#343](https://github.com/Collaboration95/theFastandtheFungible/pull/343)
- Bring your own key: one OpenAI-compatible endpoint for research and a generic
  JSON judge labelled UNCALIBRATED, which policy never lets buy. Cooperative
  Stop that cancels in-flight provider calls, and an active-work cap of four
  (100 concurrent asks → 4 admitted, 96 typed 503). [#347](https://github.com/Collaboration95/theFastandtheFungible/pull/347)
- Mac app recovery: a recovery screen, a BYOK Settings card with a connection
  test, a durable pause, and IPC canaries (13 privileged methods rejected by the
  research renderer). [#346](https://github.com/Collaboration95/theFastandtheFungible/pull/346)
- Independent local writers: up to three pinned loopback origins in one search.
  Canonical source identity keeps writers with identical IDs distinct through
  policy, grants, citations, reports, receipts and hire recipients. [#348](https://github.com/Collaboration95/theFastandtheFungible/pull/348)
- Agent kill switch: `pause` in the TypeScript and Python SDKs and
  `pause_spending` in MCP. An agent bearer pauses itself, an operator bearer
  pauses the wallet, and only an operator can resume. [#349](https://github.com/Collaboration95/theFastandtheFungible/pull/349)
- "What your money bought": receipt v3 links each paid claim to its exact
  delivered passage; semantic value is labelled "not assessed". [#350](https://github.com/Collaboration95/theFastandtheFungible/pull/350)
- Independent offline receipt verifier in Python (Ed25519 and secp256k1, no Node,
  no network). TypeScript and Python agree on 177 of 177 conformance cases. [#352](https://github.com/Collaboration95/theFastandtheFungible/pull/352)

### Changed

- README and docs front door organized by audience, with a candidate changelog.
  [#354](https://github.com/Collaboration95/theFastandtheFungible/pull/354)
- Link the live historical Testnet ledger page from the docs.
  [#355](https://github.com/Collaboration95/theFastandtheFungible/pull/355)
- Remove retained-history accounting scans while preserving exact spending
  equivalence. [#356](https://github.com/Collaboration95/theFastandtheFungible/pull/356)
- Bound engine verification work and split synchronous research batches.
  Quiet-host 600-ask fixture loop p99: 28.6 ms; this is scoped rehearsal evidence.
  [#358](https://github.com/Collaboration95/theFastandtheFungible/pull/358)

- CI is a job graph (`changes` → `verify`, `chaos`, `browser`, `python`,
  `artifacts` → `check`). Per-component coverage floors are exact ratios that
  may not drop, payments branch coverage must stay at or above 85%, and Chromium
  and Python are required on full-code changes. Hosted wall time on the
  integration PR was 249 s against 278 s for the earlier serial run. [#344](https://github.com/Collaboration95/theFastandtheFungible/pull/344)
- Run history reads use indexed projections: 3,000-run hydration 34,372.8 ms →
  313.3 ms (about 110×, local synthetic). SSE snapshots and request bodies are
  size-bounded. [#345](https://github.com/Collaboration95/theFastandtheFungible/pull/345)
- Release admission: a tag publishes only the exact bytes that passed
  same-SHA acceptance, and the tag must match the package version. [#332](https://github.com/Collaboration95/theFastandtheFungible/pull/332)
- UX polish with no behaviour change: receipt rows with dot-and-text status,
  grouped Mac Settings, recovery screen with one primary action. [#351](https://github.com/Collaboration95/theFastandtheFungible/pull/351)

### Fixed

- Late refund recovery: a refund confirmed after a restart is recorded exactly
  once, with gross spend unchanged and zero signing calls. [#345](https://github.com/Collaboration95/theFastandtheFungible/pull/345)
- Oversized terminal snapshots (about 266 KB, over the 262,144-byte SSE cap) left
  the UI on "Searching". The client now re-reads the same run by ID, with one
  admission and unchanged receipts. [#344](https://github.com/Collaboration95/theFastandtheFungible/pull/344)
- Soak harness: a 606-second laptop sleep was misread as a hang. Provider
  transport now races a typed deadline, the leak auditor retains one observation
  at a time, and watchdogs capture diagnostics. A 30-minute rerun: 615
  iterations, 155 real SIGKILLs, zero double charges. [#342](https://github.com/Collaboration95/theFastandtheFungible/pull/342)
- Mac startup recovers from missing, locked or corrupt credentials, an MCP port
  conflict, and engine outage instead of failing to open. [#346](https://github.com/Collaboration95/theFastandtheFungible/pull/346)

### Security

- BYOK endpoint boundary: reviewed public HTTPS origins plus numeric loopback.
  Names that resolve to private, shared or metadata addresses are refused before
  a socket opens, and redirects make zero requests to their target. [#347](https://github.com/Collaboration95/theFastandtheFungible/pull/347)
- Multi-origin isolation: no engine bearer, delivery token or payment signature
  crosses origins; 15 endpoint attack vectors and five exported-proof origin
  tamper vectors are refused. [#348](https://github.com/Collaboration95/theFastandtheFungible/pull/348)
- Kill switch audit: the pause and its audit entry commit atomically; paused
  agents cannot sign fees or new purchases. [#349](https://github.com/Collaboration95/theFastandtheFungible/pull/349)
- Receipt verification no longer depends on the TypeScript implementation:
  167 invalid cases (origin, key, signature, manifest, passage, claim, grant,
  amount, audit link) are rejected by both. [#352](https://github.com/Collaboration95/theFastandtheFungible/pull/352)

## [0.8.0] - 2026-11-03 · Any agent, one wallet

- SDK v1: typed streaming asks, verification and journaled x402 payments. Packed,
  not published. [#333](https://github.com/Collaboration95/theFastandtheFungible/pull/333)
- Mac app hosts MCP over loopback HTTP with per-agent Keychain tokens and
  allowances, plus `verify_answer` and `hire` tools. [#334](https://github.com/Collaboration95/theFastandtheFungible/pull/334)
- Crash-safe engine restart, notify-only update checks, separate arm64 and x64
  DMGs (unsigned). A packaged app made a Keychain-backed Testnet purchase. [#335](https://github.com/Collaboration95/theFastandtheFungible/pull/335)
- Fully live operational successes 14/30 → 27/30 on a fixed sequence (synthetic
  corpus, XRPL Testnet); one lexical audit flag remains. [#336](https://github.com/Collaboration95/theFastandtheFungible/pull/336)
- Starter Kit x402 interoperability in both directions, native XRP on Testnet. [#337](https://github.com/Collaboration95/theFastandtheFungible/pull/337)
- One-click Claude Desktop MCPB and registry-ready `server.json` (not published). [#338](https://github.com/Collaboration95/theFastandtheFungible/pull/338)
- Official Testnet RLUSD: UC2 paid 0.90 RLUSD, UC3 refunded 0.30 RLUSD. RLUSD
  escrow is unavailable because the issuer locking flag is unset. [#340](https://github.com/Collaboration95/theFastandtheFungible/pull/340)

## [0.7.0] - 2026-11-03 · Proof you can check

- `npm run verify:answer` checks an exported answer: 40/40 citations and 4/4
  Testnet checks in the recorded run; a tampered file exits 1. [#322](https://github.com/Collaboration95/theFastandtheFungible/pull/322)
- Payment chaos testing: 1,729 fault episodes, 431 SIGKILLs, zero double charges
  (fixture only). [#317](https://github.com/Collaboration95/theFastandtheFungible/pull/317)
- Refreshed README and shared site header. [#326](https://github.com/Collaboration95/theFastandtheFungible/pull/326)

## [0.6.0] - 2026-11-03 · Answers, made clear

- Answer and claims redesign; the UC3 PDF went from 50 to 4 pages. [#323](https://github.com/Collaboration95/theFastandtheFungible/pull/323)
- Value-of-information veto in the decision policy; held-out waste 39.39% →
  35.48% (target missed). [#324](https://github.com/Collaboration95/theFastandtheFungible/pull/324)
- Scoped allowance per agent from one wallet. [#319](https://github.com/Collaboration95/theFastandtheFungible/pull/319)

## [0.5.0] - 2026-11-03 · The money, made clear

- Shell, plan, payments, refund and net Spend UI; four allowed keyframes. [#316](https://github.com/Collaboration95/theFastandtheFungible/pull/316)
- Wasted-purchase analysis and a frozen 140-question evaluation with confidence
  intervals. [#318](https://github.com/Collaboration95/theFastandtheFungible/pull/318)
- Proof-or-refund XRPL escrow with durable buyer cancellation [#308](https://github.com/Collaboration95/theFastandtheFungible/pull/308);
  tamper-evident audit trail and `COMPLIANCE.md` [#309](https://github.com/Collaboration95/theFastandtheFungible/pull/309).

## [0.4.0] - 2026-11-03 · Mac app

- Offline Electron app, DMG and Keychain storage; installed launch to
  interactive 2.088 s (single local sample). [#303](https://github.com/Collaboration95/theFastandtheFungible/pull/303)
- Hire the agent over x402 [#306](https://github.com/Collaboration95/theFastandtheFungible/pull/306);
  continuous payment recovery [#305](https://github.com/Collaboration95/theFastandtheFungible/pull/305);
  publish Markdown folders as paid Testnet writers [#300](https://github.com/Collaboration95/theFastandtheFungible/pull/300).

## [0.3.0] - 2026-11-03 · Fact menu

- Signed fact menus in decisions. Live selection F1 0.235 → 0.419; wasted spend
  regressed 36.2% → 47.2%; the follow-up is #276. [#304](https://github.com/Collaboration95/theFastandtheFungible/pull/304)

## [0.2.0] - 2026-11-02 · The app, done properly

- Keyboard-first Run and Writers views, brand kit and exports. [#295](https://github.com/Collaboration95/theFastandtheFungible/pull/295),
  [#293](https://github.com/Collaboration95/theFastandtheFungible/pull/293)

## [0.1.0] - 2026-11-02 · MCP server and nightly scorecard

- MCP server: search writers and buy within human-set caps, four stdio tools. [#266](https://github.com/Collaboration95/theFastandtheFungible/pull/266)
- Nightly scorecard and a six-rule read-only hard-gate audit. [#268](https://github.com/Collaboration95/theFastandtheFungible/pull/268)
- Builder feedback (15 findings), MIT licence, contributing and security policy. [#264](https://github.com/Collaboration95/theFastandtheFungible/pull/264), [#284](https://github.com/Collaboration95/theFastandtheFungible/pull/284)

## Earlier

The October build (engine, XRPL and x402 rail, DeepSeek research, Clef decisions,
the stage demo) predates the tags. See the [design record](docs/FINAL-PUSH.md)
and the [build log](https://collaboration95.github.io/theFastandtheFungible/evolution/).
The `hackathon-baseline`, `known-good-2026-10-08` and `cloudflare-reduce` git tags
mark those points.

[0.8.0]: https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.8.0
[0.7.0]: https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.7.0
[0.6.0]: https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.6.0
[0.5.0]: https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.5.0
[0.4.0]: https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.4.0
[0.3.0]: https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.3.0
[0.2.0]: https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.2.0
[0.1.0]: https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.1.0
