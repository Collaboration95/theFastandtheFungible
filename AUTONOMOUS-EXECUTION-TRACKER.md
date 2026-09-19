# ResearchAgent post-October autonomous execution tracker

Existing issue bodies remain authoritative for existing issue numbers. The
four local issue specifications below use stable keys until corresponding
GitHub issues are created.

## Entry gate: finish and prove October 1 first

Before dispatching this tracker, the local agent must fetch current `main` and
verify the previous tracker. It must finish the remaining October 1 critical
path, or prove that it has already been integrated, before treating any item
below as Ready.

The previous critical-path rows still requiring proof are:

`#9, #33, #22, #35, #20, #23, #21, #14, #26, #36, #10, #11, #37, #6, #16, #5, #24`.

The October gate is complete only when #24's release checks pass and the
canonical local story demonstrates plan editing, evidence families, article
comparison, explicit approval, buy/skip/block, locked-before/unlocked-after
access, impact, dossier, receipt, failure states, reset, and accessibility.

Do not mark the October 1 milestone complete from documentation alone.

### Current October gate progress

| Issue | Status | Commit | Evidence / limitation |
| --- | --- | --- | --- |
| [#9 RA-02](https://github.com/Collaboration95/theFastandtheFungible/issues/9) | Review | `e8f9b05` | `npm run check:fast`, `npm run verify`, and `npm run test:e2e` pass. The server rejects a BUY unless the exact request carries manual approval; the setup displays the credential-free Partner Demo Wallet and manual approval rule. Independent review remains required before this can be treated as integrated gate evidence. |
| [#22 LDF-02](https://github.com/Collaboration95/theFastandtheFungible/issues/22) | Review | `2b66ab7` | Restart and malformed-store tests pass in `tests/persistence.test.ts`; `npm run check:fast` and `npm run verify` pass. Independent review remains required. |

## Automation-first decisions

| Existing work | Automation treatment |
| --- | --- |
| [#50 WALLET-02](https://github.com/Collaboration95/theFastandtheFungible/issues/50) requires a funded Testnet wallet, external network access, and explorer proof | Build `PAY-05-AUTO` first: a server-only payment-adapter conformance harness with deterministic XRPL response fixtures. Keep funded-wallet proof as a later external gate. |
| [#52 SOURCE-01](https://github.com/Collaboration95/theFastandtheFungible/issues/52) requires a legal/authorization decision for a real source | Build `SOURCE-02-AUTO` first: an adapter seam, normalized provenance contract, cache/replay behavior, and offline authorized-fixture adapter. Do not choose or fetch a real provider without authorization. |
| [#55 VALID-01](https://github.com/Collaboration95/theFastandtheFungible/issues/55) requires two or three target-user sessions | Do not pretend a coding agent can perform user research. Build `VALID-02-AUTO`: automated comprehension, accessibility, truth-label, and artifact-integrity checks. Keep actual sessions as a later product decision. |
| [#56 REL-01](https://github.com/Collaboration95/theFastandtheFungible/issues/56) requires live/fallback timed rehearsals and a feature freeze | Build `REL-02-AUTO`: a deterministic release rehearsal command and evidence bundle. Keep the final timed human rehearsals and freeze as an external release gate. |
| [#7 RA-10](https://github.com/Collaboration95/theFastandtheFungible/issues/7) requires a post-31-October deployment decision | Include only the code-level single-process readiness work, with a hard date and authorization gate. Do not deploy or select a provider autonomously. |

## Twenty-issue autonomous path

`Ready` means every dependency is integrated and verified on the current
orchestration branch. `Review` means the work is integrated on that branch but
still awaits the final PR merge to `main`. `Blocked` is reserved for an
explicit external decision or authorization; it is not a reason to weaken the
product boundary.

| Wave | # | Issue | Outcome | Depends on | Automation / verification |
| --- | ---: | --- | --- | --- | --- |
| 1 | 1 | [#38 LIB-01](https://github.com/Collaboration95/theFastandtheFungible/issues/38) | Reopenable local report history | October gate #24 | Local persistence and reload tests; opening history cannot re-execute purchases. |
| 1 | 2 | [#40 PLAN-03](https://github.com/Collaboration95/theFastandtheFungible/issues/40) | Versioned finance research skill templates | October #35 | Schema/version tests and old-run migration/reopen checks. |
| 2 | 3 | [#39 LIB-02](https://github.com/Collaboration95/theFastandtheFungible/issues/39) | Purchased article library without body redistribution | #38 and #11 | Purchase-to-library integration, license/access checks, and export negative tests. |
| 2 | 4 | [#41 PLAN-04](https://github.com/Collaboration95/theFastandtheFungible/issues/41) | Side-by-side plan comparison with one editable selection | #40 | UI/API tests prove comparison never authorizes payment or changes wallet state. |
| 2 | 5 | [#45 WALLET-01](https://github.com/Collaboration95/theFastandtheFungible/issues/45) | Immutable local wallet event ledger | #39 and #36 | Reconciliation/property tests; rejected and blocked events never reduce balance. |
| 3 | 6 | [#42 BUY-02](https://github.com/Collaboration95/theFastandtheFungible/issues/42) | Editable, non-duplicate multi-article plan | #41 and #14 | Budget/property tests; each quote remains separately approval-bound and idempotent. |
| 3 | 7 | [#43 EVID-01](https://github.com/Collaboration95/theFastandtheFungible/issues/43) | Claim-level conflict and uncertainty statuses | #39 and #37 | Golden conflicting-evidence fixture; exact spans on both sides; no unsupported confidence percentages. |
| 4 | 8 | [#44 LIB-03](https://github.com/Collaboration95/theFastandtheFungible/issues/44) | Bidirectional article/report/claim/span traceability | #39 and #43 | Integrity tests for report→article and article→claim links, version/hash, and access state. |
| 4 | 9 | [#46 EVAL-01](https://github.com/Collaboration95/theFastandtheFungible/issues/46) | Deterministic article-decision evaluation scorecard | #42, #44, and #45 | Dedicated command, expected golden outcomes, separate dimensions, and negative controls. |
| 5 | 10 | [#47 PAY-01](https://github.com/Collaboration95/theFastandtheFungible/issues/47) | Article-specific HTTP 402 protocol contract | #46 | Contract schemas and success/adversarial sequence examples; security/product review as a code-review artifact. |
| 6 | 11 | [#48 PAY-02](https://github.com/Collaboration95/theFastandtheFungible/issues/48) | One protected synthetic/authorized article endpoint | #47 | Protocol integration tests: unpaid challenge, valid delivery, invalid proof, and deterministic fallback. |
| 6 | 12 | [#49 PAY-03](https://github.com/Collaboration95/theFastandtheFungible/issues/49) | Quote binding, replay protection, and idempotency | #47 | Mutation tests for every bound field plus concurrent/double-submit tests. |
| 7 | 13 | `PAY-05-AUTO` — payment-adapter conformance harness | Deterministic server-only payment adapter boundary | #49 | Fixture responses cover payer, payee, amount, asset/network, validation result, delivery amount, explorer URL, secret redaction, and fallback. No funded wallet or live network is required in CI. |
| 7 | 14 | [#51 PAY-04](https://github.com/Collaboration95/theFastandtheFungible/issues/51) | Settlement and protected-article fulfilment remain separate | #48 and `PAY-05-AUTO` | Matching/mismatch artifact tests; successful payment with bad delivery remains locked and excluded from synthesis. |
| 7 | 15 | `SOURCE-02-AUTO` — source-adapter seam and offline conformance | Normalized, provenance-preserving public-source adapter boundary | #51 | Offline adapter fixture, cache/replay timestamps, content hash, allowlist, timeout, and fallback tests. No real provider is selected. |
| 8 | 16 | [#53 PUBLISH-01](https://github.com/Collaboration95/theFastandtheFungible/issues/53) | Bounded synthetic/authorized publisher listing demonstrator | #48 | Listing validation, version/hash traceability, server-only body, and discover/purchase integration tests. |
| 8 | 17 | [#54 SEC-01](https://github.com/Collaboration95/theFastandtheFungible/issues/54) | Repeatable adversarial payment and delivery suite | #51 and #53 | Wrong payee, changed amount, expired/replayed quote, duplicate approval, artifact mismatch, and mode confusion all block at the expected stage. |
| 9 | 18 | `VALID-02-AUTO` — automated comprehension and truthfulness checks | Machine-checkable UX and artifact-integrity score | #46 and #54 | Browser/API assertions for labels, stage semantics, keyboard path, approval language, no premium-body leakage, receipt completeness, and reset truthfulness. |
| 9 | 19 | `REL-02-AUTO` — deterministic release rehearsal bundle | One-command local rehearsal report and backup artifacts | `SOURCE-02-AUTO`, #54, and `VALID-02-AUTO` | Clean fixture run, canonical buy/skip/block, failure fallback, redacted logs, screenshots, receipt/manifest hashes, and failure diagnosis. Does not claim to replace human timed rehearsals. |
| 10 | 20 | [#7 RA-10](https://github.com/Collaboration95/theFastandtheFungible/issues/7) | Single-process production-readiness seam | #51; after 31 October only | Build/start/health/SSE smoke tests with fixture mode and no secrets. No hosting, provider selection, or deployment without explicit authorization. |

## Issue briefs

These are the four automation-first issue briefs for the local issue keys above.

### PAY-05-AUTO — payment-adapter conformance harness

**User story:** As an integrator, I need a deterministic payment boundary that
proves what a live XRPL adapter must validate without requiring a funded wallet
or network access in ordinary development.

**In scope:** typed adapter result/error contract; fixture response matrix;
server-only secret handling; exact payer/payee/amount/network checks;
validated `tesSUCCESS`; delivered amount; transaction hash and explorer URL;
redacted failures; fixture fallback.

**Acceptance criteria:**

- Every material payment field has a deterministic positive and negative test.
- A fixture result can never be labelled as validated Testnet settlement.
- A mismatched payer, payee, amount, network, validation result, or delivered
  amount fails before access is granted.
- Seeds never appear in client output, logs, errors, or persisted run data.
- The conformance suite runs without network access; live proof remains the
  explicit #50 gate.

**Out of scope:** funded wallets, mainnet, real network calls in CI, browser
seed entry, and provider deployment.

### SOURCE-02-AUTO — source-adapter seam and offline conformance

**User story:** As an integrator, I need one lawful adapter boundary that can
be tested offline before a real public source is selected and authorized.

**In scope:** adapter interface; normalized evidence record; source allowlist;
retrieval timestamp; provenance URL; license/use metadata; content hash;
bounded timeout; cache/replay; deterministic offline adapter; fallback.

**Acceptance criteria:**

- The offline adapter produces the same normalized record on replay.
- Provenance, retrieval time, license/use metadata, and hash survive caching.
- Timeout, malformed data, disallowed source, and unavailable-source paths
  preserve the canonical fixture fallback.
- No adapter can return protected article bodies into public client state.
- A real provider is not added until #52 receives explicit authorization.

**Out of scope:** crawling, paywall bypass, provider selection, and unlicensed
third-party content.

### VALID-02-AUTO — automated comprehension and truthfulness checks

**User story:** As the product team, I need machine evidence that a reviewer is
shown truthful labels, an understandable flow, and reconstructable artifacts
before asking humans to spend time in sessions.

**In scope:** browser assertions for the official journey; API/UI state matrix;
keyboard path; labels; fixture/Testnet distinction; manual approval language;
receipt completeness; protected-body absence; reset behavior; reportable
failure diagnostics.

**Acceptance criteria:**

- The suite detects any fixture/Testnet, open/locked/unlocked, or settlement /
  fulfilment label mismatch.
- The suite proves that no purchase or unlock occurs before explicit approval.
- The suite checks that every displayed claim reference resolves to an
  accessible span and that protected bodies are absent from client payloads,
  exports, and logs.
- The suite produces a separate result for each journey stage rather than one
  opaque pass/fail score.
- Human preference and comprehension findings are not fabricated from these
  automated checks.

**Out of scope:** recruiting participants, claiming usability validation, or
replacing #55's actual sessions.

### REL-02-AUTO — deterministic release rehearsal bundle

**User story:** As a presenter, I need a reproducible local rehearsal and
backup package that exposes exactly what passed and what still requires a live
or human check.

**In scope:** one release-check command; clean fixture reset; canonical
buy/skip/block path; explicit approval; locked/unlocked proof; impact,
dossier, receipt, and traceability artifacts; failure fallback; screenshots;
redacted logs; machine-readable manifest with hashes.

**Acceptance criteria:**

- A clean checkout can generate the bundle without credentials or network.
- Every failed stage identifies its command, artifact, and likely boundary.
- The bundle labels fixture simulation, optional Testnet evidence, and
  unperformed live checks separately.
- No premium body, seed, or secret is present in the bundle.
- The command does not silently auto-approve, auto-buy, or turn a fixture
  result into a live claim.

**Out of scope:** the two human timed rehearsals, final feature freeze,
provider deployment, and mainnet.

## Deferred external gates

These remain real work, but they are deliberately not delegated to the local
coding agent as if they were ordinary implementation issues:

- [#50 WALLET-02](https://github.com/Collaboration95/theFastandtheFungible/issues/50)
  — funded XRPL Testnet setup, validated explorer proof, and operator approval.
- [#52 SOURCE-01](https://github.com/Collaboration95/theFastandtheFungible/issues/52)
  — selection and authorization of one real public source.
- [#55 VALID-01](https://github.com/Collaboration95/theFastandtheFungible/issues/55)
  — actual finance-researcher sessions and findings.
- [#56 REL-01](https://github.com/Collaboration95/theFastandtheFungible/issues/56)
  — two timed live/fallback rehearsals and final feature freeze.
- [#12 RA-11](https://github.com/Collaboration95/theFastandtheFungible/issues/12)
  and [#15 RA-12](https://github.com/Collaboration95/theFastandtheFungible/issues/15)
  — provider-specific configuration and deployment authorization after the
  local release gate and after 31 October.

The automated counterparts may produce evidence for these gates, but must not
close them or claim that external authorization happened.

## Required proof for this tracker

- `npm ci` from a clean worktree.
- `npm run check:fast` after each integrated wave.
- `npm run verify` before accepting each issue into the integration branch.
- Targeted Playwright and accessibility checks whenever a user-facing boundary
  changes; full e2e/a11y at the release-bundle boundary.
- An independent subagent review for every issue, with the issue acceptance
  criteria mapped to changed files and test results.
- No secrets, premium bodies, unlicensed content, mainnet credentials, or
  silent purchase behavior in the branch or generated artifacts.
