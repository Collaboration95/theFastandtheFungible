# Upstream filing bundle — 12 November 2026

**5 items ready to file; 0 filed. Owner approval is required (#265 A11).**
No external issue, comment, fork, PR, email or forum post was created. All GitHub research uses authenticated `gh`, except that the upstream link checker followed GitHub links over HTTP before this was detected; that checker has stopped.

| Finding | Repo / channel | Type | Severity | Evidence | Status |
|---|---|---|---|---|---|
| Missing rolled-back Batch inner results | XRPLF/xrpl-dev-portal #3366 | docs (+1 comment; optional PR patch) | Medium | [Draft and hashes](batch-rollback/ISSUE.md), [patch](batch-rollback/fix.patch) | ready to file |
| Receipt history coverage and HTTP CORS | XRPLF/xrpl-dev-portal | PR (docs) | Medium | [Draft and minimal repro](endpoint-history/ISSUE.md), [patch](endpoint-history/fix.patch) | ready to file |
| Issued-asset negative settlement vectors | t54-labs/rlusd-cli, route to SDK maintainer | issue (docs/conformance request) | Medium | [Draft and synthetic negative cases](delivered-amount/ISSUE.md) | ready to file |
| Standalone key-reveal escrow example | XRPLF/xrpl-dev-portal | PR (example + docs) | Low enhancement | [Draft and four Testnet hashes](starter-kit-escrow/ISSUE.md), [patch](starter-kit-escrow/fix.patch) | ready to file |
| RLUSD issuer locking policy | Ripple Stablecoin support / developer contributions form | email (manual support/form draft) | High integration constraint | [Draft and both-network flags](rlusd-locking/ISSUE.md), [spike D](evidence/spike-d.json) | ready to file |

Primary filing counts: **1 issue, 2 PRs, 1 docs comment, 1 email/support draft**. Three `format-patch` files exist because the comment also has an optional fix PR. File the Batch comment first; use its optional PR only if desired, without creating another issue. No standalone rippled issue: the ledger behavior is intentional; historical inner diagnostics would be a separate feature design.

## Owner filing

Read each ISSUE.md and PR.md. Each folder has FILE.sh; patch folders also have PR-FILE.sh. The PR scripts clone the current default branch, apply the pinned patch, rebase, fork, push and create the PR. They stop on conflicts. No script has been executed, including with the approval guard unset. Syntax was checked with `sh -n` only.

After the owner approves the concrete bundle, the one ordered command is:

```sh
R3_OWNER_APPROVED=YES sh docs/feedback/upstream/r3/FILE-ALL.sh
```

**Do not run before owner approval.** The script files four GitHub items in order and prints the manual Ripple support step. It cannot send the email/form draft: the owner must paste it into the verified channel. No recipient address or customer access is assumed. Rerunning the script can create duplicate filings; retain the first run's URLs and do not blindly retry after ambiguous output.

## Verification and limits

- Upstream default heads, duplicate searches, dropped claims, and other-lane review: [REVERIFY.md](REVERIFY.md).
- Fresh read-only results: [live-reads.json](evidence/live-reads.json), [TEST-SGD control](evidence/iou-control.json). Seventeen Batch/delegation/example hash lookups: 15 validated successes and the 2 intentionally uncommitted inner hashes; the three TEST-SGD controls also validated. Three HTTP endpoints independently reproduce the historical RLUSD receipt disagreement.
- Three independent patches against portal `master` at `182f8d20b157aa791433ff399a0f30dbed74a5eb`; each passes `git apply --check` against that base. New local documentation paragraphs rendered. [Patch tests](starter-kit-escrow/TESTS.md) distinguish two passing offline tests from the skipped opt-in live test and disclose four upstream link-check failures.
- No new Testnet submission. Mainnet was read only. The issuer-flag observations have ledger indexes, not transaction hashes; TEST-SGD control hashes are not RLUSD escrow evidence. Synthetic underdelivery mutations do not prove a hosted facilitator vulnerability.
- Existing drafts 01–08 remain historical artifacts, and this bundle does not imply that all eight are still current. README, deck, site and judge-copy counters are orchestrator-owned. The public filed count stays **0** until the owner files.
