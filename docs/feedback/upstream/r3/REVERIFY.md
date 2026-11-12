# Reverification and exclusions

Verified 12 November 2026. GitHub tracker searches used authenticated `gh api -X GET search/issues`; JSON results and exact queries are under evidence/. Searches include open and closed issues/PRs. Counts are search snapshots, not a claim that every public discussion was discovered. The large txnNotFound search is retained unmodified; the narrower query files retain matching URL/title/state.

## Upstream defaults inspected

| Repository | Default | Commit |
|---|---|---|
| XRPLF/xrpl.js | main | 4226827251436633d7383ac8e358196e51a9af09 |
| XRPLF/xrpl-dev-portal | master | 182f8d20b157aa791433ff399a0f30dbed74a5eb |
| t54-labs/rlusd-cli | main | 155ab72076c9cb455a6c6c2d46254768e941193b |
| t54-labs/monid-x402-xrpl | main | 3eba1346710985c9c9373852eff71b3de7046fb3 |

All clones were made in /tmp. No upstream branch, fork or remote write was made. Portal patches are local commits exported with `git format-patch -1 --stdout`; each branches independently from the listed default head. Applying all three also works because they touch separate paths.

## Requested findings and old drafts

| Candidate | Decision and exact reason |
|---|---|
| signMultiBatch pinned failure | **Drop current-default fix request.** Reproduced ``No field `account` `` on locally installed xrpl 4.7.0 with codec 2.11.0 using the frozen spike B2 public transaction fields and an ephemeral offline signing key. Current upstream `packages/xrpl/src/Wallet/batchSigner.ts` already supplies `account`, sequence/ticket, flags, txIDs, batchAccount and optional signerAccount. [#3371](https://github.com/XRPLF/xrpl.js/pull/3371) merged 13 July 2026; [#3370](https://github.com/XRPLF/xrpl.js/issues/3370) is closed completed. A duplicate patch against current main would be wrong. Local product dependency upgrade/backport belongs to its owning lane; no untested dependency change here. |
| Batch outer success | **Narrow and retain as comment + optional docs patch.** [#3968](https://github.com/XRPLF/xrpl-dev-portal/pull/3968) already documented outer success. Open [#3366](https://github.com/XRPLF/xrpl-dev-portal/issues/3366) tracks tutorials; use a +1 with new ALLORNOTHING evidence there. Missing inner metadata and full-ledger reconciliation remain worth stating explicitly. A rippled diagnostic API would be an enhancement, not a consensus defect. Related [#8666](https://github.com/XRPLF/rippled/issues/8666) is Batch simulate support, not a duplicate of historical diagnostics. |
| RLUSD locking | **Retain as issuer support request**, not an allegation of a rippled bug. Spike D and independent account_info/feature reads agree on both networks. No attempt to escrow official RLUSD in this lane. |
| Delegation fees | **Drop docs-gap claim.** `docs/concepts/accounts/permission-delegation.md`, Comparison with Multi-Signing: transaction cost is paid by delegate. Limitations assigns Delegate owner reserve to delegator. `docs/references/protocol/transactions/common-fields.md`, Sending Delegated Transactions, also states the fee rule. `docs/concepts/accounts/reserves.md` supplies normal object reserves; no evidence of a misleading principal rule. Spike A's delegated-create metadata shows principal from visitor and Fee from delegate. |
| Old 01 issuer permission | **Drop generic docs request as already covered.** `docs/tutorials/payments/send-fungible-token-escrows.md` step 9 explicitly enables `asfAllowTrustLineLocking`; EscrowCreate and AccountRoot references cover permission/bit. Consolidate the still-disabled official issuer evidence into the RLUSD support draft. |
| Old 02 delivered amount | **Retain only as documentation/conformance request.** Current CLI still has buyer-only x402 tests; npm x402-xrpl 0.3.4 still omits repository metadata. Do not infer an unsafe hosted verifier from an opaque SDK or from our adversarial fixture. CLI's own 20 x402 tests pass. No claim of live exploit or SDK fix patch. |
| Old 07 endpoint history | **Narrow and retain.** Public-server docs already identify XRPL Labs CORS, so drop that missing-table claim. Fresh HTTP responses still disagree for one validated historical receipt. Add instructions to establish history coverage; do not demand permanent identical retention from public nodes. |
| Starter Kit PR | **Retain and route concretely to portal.** Portal owns agentic x402 guidance and escrow code samples. No canonical monolithic Starter Kit repository was found; use `_code-samples/x402-key-reveal-escrow` plus a docs link. Keep experimental scheme separate from exact support. Original four hashes re-read successfully; offline example tests pass. |
| Old 03–06 and 08 | Read for context, not promoted by this task. No claim of current upstream verification for those additional historical drafts. |

## Other-lane feedback

Inspected the full BUILDER-FEEDBACK.md and refreshed origin before packaging. Initial packaging main snapshot was bc247cf54789b710ad9f72154f0e6fd8c302c887. Recent R3 entries concern our own proxy cache policy, settlement polling/stream observations, build-output race and reservation-to-manifest crash recovery. They are local integration behavior or performance recommendations, not demonstrated upstream defects; no speculative issue is filed for them. Spike B/D evidence is already packaged above. Public PR #533's Testnet scale evidence and #532's phone publishing work overlap only shared append-only docs; no owned implementation files were edited.

Recheck new BUILDER-FEEDBACK additions after the final shipping rebase. This is a completed bounded packaging run, not an unbounded monitor for later findings. New upstream defects require new evidence and tracker checks before being added.

## Reproduce the research

- `gh repo clone XRPLF/xrpl-dev-portal /tmp/portal-repro -- --depth 1` and analogous commands for the other rows; inspect the pinned commit before comparing.
- `gh api -X GET search/issues -f 'q=repo:XRPLF/xrpl.js signMultiBatch'` (other literal queries are stored with results).
- `npm view x402-xrpl version repository dist-tags --json`: latest 0.3.4, beta 0.4.0-beta.1, no repository field. The current public Python gateway is not this npm package's source.
- Use each ISSUE.md's read-only minimal repro. Full original Testnet submission commands are in the pinned spike evidence. No signing is needed to refresh receipts and issuer flags.

Patch-file whitespace exception: `.gitattributes` disables blank-at-eol/blank-at-eof checks only for the literal `.patch` mail containers (context lines and format-patch signature). The actual upstream source diffs pass default `git diff --check`; no source whitespace rule, test, spending gate or threshold is relaxed.

The pinned failure has a standalone offline command in [SDK-REPRO.md](evidence/SDK-REPRO.md). All three patches were also applied together to the pinned upstream base; the combined source diff passes default whitespace checks.

Shipping refresh: main `cab06488` adds the scale pilot sequence-contention and fresh-funding-allocation entries. Both explicitly distinguish local queue/allocation behavior from public-node defects; neither warrants another upstream issue. Preserved both lanes' appended feedback and changelog lines during rebase.

A second shipping refresh to `6b892337` adds resolved local Docker packaging friction and ESLint source-discovery setup. Neither is an XRPL/x402 upstream defect; no additional draft was created.

Shipping refresh to `26e119f9`: the browser publishing entry describes our address-bound manifest signer contract, with no upstream defect or observed faucet outage. Retained without another filing item.

Shipping refresh through `f8dd1781`: reviewed the new ledger-analytics, Vite-port-zero and replay-dialog entries. Complete fixed-ledger pagination and overload backoff are documented server/client responsibilities; the proposed aggregation endpoint is a feature suggestion without a minimal upstream defect. Receipt-modal synchronization is our test integration. Vite 7.3.6 locally contains the falsy-port fallback, but [vitejs/vite#23158](https://github.com/vitejs/vite/pull/23158) merged its port-zero fix on 6 August 2026 and current main no longer uses that fallback; retained its metadata in evidence/vite-port-zero.json and dropped a duplicate filing. A product upgrade/backport remains with that owning lane. The public-MCP merge adds no new feedback entry. Both lanes' shared-document additions are preserved.

Final shipping refresh through `8e7fb86b` (#537/#538): the failed-payment diagnostic is in our own `sdk/x402.ts` (`tests/reach-paid.test.ts` imports `../sdk/x402.js`), not the upstream npm SDK; it is a local owning-lane follow-up, not another upstream report. The paid-site leak-audit timeout has no established upstream cause and retains its original threshold. No new upstream defect is demonstrated by either entry. Shared feedback and changelog additions are preserved. Upstream default heads and issue #3366 were rechecked during the queue wait and remain as recorded above.
