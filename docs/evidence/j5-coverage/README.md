# J5 judge coverage

## Diagnosis before content

Baseline: PR #390, frozen v1 dev set, 15/20 buy-and-cite, zero blanks. `baseline-diagnosis.json` extracts candidate relevance and decision audit records from the unchanged round4-j1 receipts.

| Miss | Finding | Action |
|---|---|---|
| J04 | RLUSD note retrieved (0.413); no repo evidence names Singapore pilot banks. No purchase or citation. | Preserve abstention; invent no bank names. |
| J11 | Budget/policy topic already covered in team-x402 (retrieved 0.360); deterministic decision declined all candidates. | Policy miss: leave policy and existing metadata alone. |
| J13 | team-verification retrieved (0.614), but no purchase. Existing article covers ledger verification. | Policy miss, not missing citations after purchase; leave alone. |
| J17 | team-credentials retrieved (0.557), explicitly says identity does not prove accuracy; no purchase. | Policy miss; leave alone. |
| J20 | Related settlement/verification caveats retrieved (0.257/0.252), no purchase; no focused readiness/compliance note. | Add dedicated readiness note sourced from COMPLIANCE and security contracts. No assertion that Testnet supports real-money use. |

All five have zero intents and zero sources: none is an answer-stage failure to cite an already purchased article. Candidate presence proves retrieval, not policy eligibility. The audit extracts preserve the precise selection reasons.

## Prospective holdout

v2 was committed at ccf3a2fe before new articles. It is a single-author prospective holdout, not independently blinded. v1 remains byte-for-byte frozen as development evidence. Neither bank, prompts, policy nor thresholds are tuned after measurement. Fixture retrieval, metadata decisions and extractive answers measure mechanism coverage, not live-model answer quality.

## New content provenance

Both paid notes use the existing team writer, ordinary signed manifests and grants, unverified identity and ordinary trust priors, with no self-boost. Disclosure: team-authored · real content · not an independent writer · Testnet.

- readiness.json (664 words (repository counter)): docs/COMPLIANCE.md controls/custody/screening/mainnet sections; docs/contracts/SECURITY.md; docs/writer-verification.md. Legal threshold numbers deliberately omitted because the source requires counsel confirmation.
- asset-provisioning.json (686 words (repository counter)): docs/BUILDER-FEEDBACK.md B19, B26 and 3 Nov native DEX observations; docs/key-reveal-escrow.md; docs/x402-xrpl.md. No fresh issuer query, mainnet rate, AMM routing or DID capability claimed.

## Measurement

See the final results below.

## Attempts and retained failures

`initial-attempt/` preserves the first partial runs. New paid bodies mistakenly repeated the public team label, which the unchanged eight-word leak detector correctly flagged against public writer metadata. The label was removed from paid bodies; public writer disclosure was retained. Fresh wallets and a rebuilt package are used for the final run. No gate or threshold was relaxed.

The runner now enables online ledger verification as well as Testnet settlement verification. The old runner used only `{testnet:true}`, which did not verify the audit anchor online. Current no-purchase MCP runs intentionally omit the anchor; the unchanged verifier's `--ledger` consequently fails with `No ledger anchor in export`. This is an RC-owned MCP/verifier follow-up, not patched or hidden here. Purchase receipts must still pass all online checks.

## Reproduction

Build the ordinary portable runtime with `node scripts/build-mcpb.mjs`, pack it with the release `bin.mjs` entry and `npm pack`, and retain the tgz outside the build directory. These are local packed candidate bytes, not a replaced v1.0.0 release asset. Artifact SHA-256 is in each results.json. No RC/RB-owned file is edited.

```sh
RA_ACCEPT_TESTNET=1 JUDGE_OUT_DIR=docs/evidence/j5-coverage/dev JUDGE_INTENT_PREFIX=j5-dev- node --import tsx scripts/judge-bank-testnet.ts /tmp/researchagent-mcp-1.0.0.tgz
RA_ACCEPT_TESTNET=1 JUDGE_BANK=eval/questions/judge-xrpl.v2.json JUDGE_OUT_DIR=docs/evidence/j5-coverage/heldout JUDGE_INTENT_PREFIX=j5-heldout- node --import tsx scripts/judge-bank-testnet.ts /tmp/researchagent-mcp-1.0.0.tgz
```

Separate private durable wallet state per bank; faucet funds only, ephemeral ports, S$2 application budget per question (no real value). Never load .env. Runtime uses fixture providers. The runner retains its existing minimum-hit and verification assertions; a failed assertion is preserved as a failed acceptance outcome, not waived. Terminal gate auditing is supplemented by existing pre-grant leak tests; it does not constitute wire capture of every network byte.

Validation: corpus self-check passes; 11 focused fact-menu/signature/site-leak/disclosure tests pass. `npm run check:fast` passes, including 1,344 unit passes (one skipped) and 20 chaos scenarios with zero invariant violations. Corpus count assertions move from 8 to 10 team notes and 71 to 73 paid articles. The historical fact-menu snapshot stays preserved; a new J5 content/retrieval snapshot accounts for the two added articles. These are corpus changes, not lowered thresholds.

All retained initial-attempt intents were read back as VERIFIED and all initial runs DONE after shutdown; no pending principal obligation was found. Private wallet/journal directories are retained for reconciliation and excluded from Git.

## Final results · 7 November 2026

**Honest headline: v2 held-out 8/20 buy-and-cite.** v1 development: 16/20 (previous 15/20). Both have zero blank answers and zero terminal gate-audit violations. These fixture-provider results do not establish live-model quality.

[Development per-question receipts and transactions](dev/README.md) · [Held-out per-question receipts and transactions](heldout/README.md) · [machine-readable summary](summary.json).

The online verifier passed 16/20 dev and 8/20 held-out exports. Failed checks remain in the per-question evidence; no missing anchor is counted as a pass. `cli-ledger-verification.json` records the explicit `scripts/verify-answer.ts ... --ledger --json` invocation for J01. The bank runner applies those same online options to every export. The unchanged acceptance assertions fail when any verification fails (and when fewer than 12 questions buy and cite); that failure is retained, not loosened.

J18 initially returned DONE before its asynchronous anchor was persisted. A read-only re-export from the same durable run found the anchor and passed online verification, without another purchase. Both pre-anchor files are retained. The runner now observes purchased-run anchors inside its existing 180-second deadline; no timeout was raised. Final online results are 16/20 dev and 8/20 held-out; the remaining failures are exclusively no-purchase exports.

J20 now buys and cites team-readiness, increasing development coverage from 15 to 16. J04 remains unsupported; J11/J13/J17 remain policy declines. Held-out H13/H14 retrieved team-readiness at relevance 0.415/0.542 but policy returned SKIP_LOW_VALUE. New content and bank bytes were not adjusted after observing held-out outcomes. The held-out 8/20 is the headline, not the development gain.

Semantic limitation: H13 has eight citations to free fictional fixture articles, despite zero paid purchases. Those passages do not establish mainnet readiness and are not counted as a hit. Thus “zero blanks” is only a completion measure; it is not a claim that every nonblank answer is useful or factually responsive. “No buy-and-cite” in the tables includes free-only answers as well as explicit abstentions. No-purchase receipt exports, including H13, lack anchors.
