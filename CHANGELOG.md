# Changelog

All notable changes to ResearchAgent. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Tagged releases are
feature-day milestones (v0.x), not semantic-version promises; the SDK and Python
package carry their own 1.0.0 version in `packages/`.

Every number below keeps the scope label of the evidence it comes from
(synthetic, fixture, local or Testnet). Nothing here uses real money.
Packages are built and consumer-tested but **not published** to npm, PyPI or
the MCP Registry; that is an owner step tracked in #265.

## 1.0.0 (candidate)

Merged on `main` after [v0.8.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.8.0)
(PRs #332 and #341–#366).

### Added

- Key-reveal escrow: the writer is paid only by publishing the article key in
  EscrowFinish; a second Testnet demo tab and the ledger page verify the
  key/Condition binding, ciphertext commitments and authenticated decryption
  read-only in the browser. Synthetic articles and fixture no-show are labelled.
- Policy-owned answer audit anchors, verified with `--ledger` (#366).
- Live ledger verification (#359), forwarded fixture Codespaces and first-run relevance (#361), cold Testnet launcher and recorded UC3 (#364), standalone MCP tarball (#365), and round-2 reachability evidence (#360, #362).

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
