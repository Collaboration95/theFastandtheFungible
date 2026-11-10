# C3 public-index corpus expansion

Content only. Team-authored explainer · sources cited · not an independent writer · Testnet.
S$0.40 display accounting per article; faucet funds only; no real value.
The existing signed-manifest, fact-menu, policy, grant and delivery paths apply.
No composition, selection-policy, newcomer-probe, model or threshold edits.

## Inventory and sources

125 new answer-first explainers: all 79 transaction types in the captured xrpl.org
transaction index, 17 account-option/state explainers (16 AccountSet options plus
PasswordSpent; overlapping AccountRoot bits share articles), six missing core
concepts, 17 XLS documents and six compliance topics. Existing reserves, cost and
partial-payment explainers complete the nine-item core-concept inventory.
The collection grows from 22 to 147 explainers; ten builder notes are rewritten
to remove engineering paths, storage details and installation incident logs.

`indexes.json` records public index membership and fetched source hashes.
`coverage.json` maps each item to one article and ordered public source metadata.
Numbered citations refer to that ordered list; every addition records its access
date, 10 November 2026. URLs remain in public metadata, not repeated paid prose.
Article lengths use the existing real-content limits, with new pieces bounded
at 150–300 words. Four exact passages and ordinary signed fact menus remain mandatory. First passages have explicit primary-source attribution so their noun-phrase menus become signed named-source claims. Every new explainer is checked for that first-passage claim. The prior exact automatic-menu assertion is retained for all older articles; for the 125 new explainers it checks automatic remaining menus plus the authored first menu, schema and exact-passage binding. This is the only changed assertion beyond corpus/count pins.

XLS proposal status is stated explicitly. Documented transactions, especially
lending, vaults, confidential tokens, sponsorship, delegation and Batch, are
not represented as confirmed live capabilities. The fetched known-amendments
page needs client-side data for its live table; no activation date or enabled
network status is inferred from that shell. Batch's individual-result caution
and DelegateSet's PaymentBurn warning are retained.

Regulator pages were checked using official web sources. Direct MAS responses
were bot-verification shells and FATF returned 403; those response hashes are
not evidence of substantive text. `regulator-sources.json` retains those limits.
FinCEN's direct PDF endpoint returned 404; the readable official release
summarizing the same 2019 guidance is used in the article instead. Legal
summaries do not certify this product or invent exemptions, partners or dates.
Author interpretation is labelled separately from factual exposition.

## Pipeline validation

`check:paid-bodies` rejects repository paths, source filenames and a small list
of engineering storage terms in every paid body and passage. It runs in
`check:fast`; mutation tests and a scan of the complete shipped corpus also run
in the ordinary unit gate. Existing eight-word leak checks remain unchanged.
Manifest signatures, passage delivery and public metadata checks cover all
147 explainers. The current corpus hash and paid-article count (95 → 220) are
re-pinned for these intended additions and note rewrites. Historical corpus,
bank and constructed-coverage goldens remain unchanged.

No embeddings were generated and no live model provider was called. New and
rewritten entries use the existing keyword-search fallback. No `.env` symlink
was needed. Ports are ephemeral; the reserved demo ports were not bound.

## Measurements

Before/after measurements use only v1, v3, v3-dev and v3-negatives, the exact
packed tgz artifacts, fixture research/decision models and XRPL Testnet.
No held-out bank was executed or used to select topics. A broad hash-only `rg` search accidentally traversed two v4 bank files because its exclusion glob was wrong; it returned no matching content. This boundary violation is retained explicitly, and all subsequent searches use named allowed paths. No v5 question text was inspected or evaluated. The upstream v5 schema/hash test is part of the routine gate; it does not run a judge bank or expose its question text. These are observed dev
results, not held-out or live-model quality estimates. All 140 runs verified online; independently repeated offline verification also
passes for all 140 receipt bundles. Exact-package raw-store audits, including
authority checks, report zero violations across all banks.

| Bank | Candidate found before → after | Buy-and-cite before → after | answersIt before → after | Negative buys before → after |
|---|---|---|---|---|
| v1 | 20/20 → 20/20 | 16/20 → 17/20 | unavailable | n/a |
| v3 | 17/20 → 18/20 | 7/20 → 11/20 | 4/20 → 7/20 | n/a |
| v3-dev | 16/20 → 16/20 | 6/20 → 9/20 | 2/20 → 1/20 | n/a |
| v3-negatives | 5/10 → 5/10 | 2/10 → 2/10 | unavailable | 2/10 → 2/10 |

Candidate found means at least one registered paid candidate before value
selection, read from persisted run.candidates. Both negative-bank exits remain
failures for N03 and N08. The dev answersIt regression is retained; wider corpus
coverage does not establish consistent answer quality. Composition and selection
remain K3 work.

Original baseline v3/v3-dev results each contain one premium-leak audit finding
because later invocations loaded the edited worktree corpus while the baseline
package served older article versions. These original results/logs are retained.
Re-auditing raw snapshots, events, grants and authority with the exact corpus
inside each measured package yields zero violations. No audit rule was changed.

Each bank has an archive of original receipts and online reports; the archive
index pins every member and archive hash. All archive members were extracted
and hash-checked. This preserves evidence below GitHub's 300-file diff limit.
summary.json separates the original runner audit from the exact-artifact audit.
Private wallet state and packed artifacts are retained outside the repository.

The first local validation caught missing fourth passages and stale corpus/count
pins; both were fixed without reducing requirements. Provisional candidate attempts were stopped while correcting flag aliases,
source references and first-passage claim menus. One provisional negative run
recorded two abstentions; these partial observations remain diagnostics and
are not pooled with final measurements. Final measurements use
`candidate-frozen.tgz` with fresh private state and output directories.
Wallets and signing material remain outside the repository.


## Local checks

Final pre-integration `npm run check:fast`: 173 files, 1,420 tests passed;
20 chaos iterations, zero invariant violations. Transient corpus-check timeouts
under concurrent load were rerun without changing their 5-second thresholds.
The first full gate also caught two unchanged popover-placement tests; both
passed in isolation without code or assertion edits. The shipping gate must
still pass on the final clean head; these earlier failures are not admission.

Raw-audit reproduction uses the unchanged `readRuns`/`auditRuns` helpers with
`loadWriterCorpus` rooted at the measured package's extracted `data/`, plus
`auditAgentAuthority(auditEntries(readOnlyDatabase))`. Using the current worktree
corpus to audit an older package is not a valid replacement for that context.

## Earlier shipping failures

The first shipping attempt obtained no merge admission. `local-validation.json` retains exact clean
source identities, successful steps and failure output from the shipping attempts.
At clean head `5dc69835`, the unit suite and all other executed checks passed,
but both `tests/ux2.spec.ts:159` popover-overlap checks failed. The unchanged
cached-step recheck failed the same checks. The sanitized environment also
reproduced an overlap failure on upstream baseline `1f9df59c` without C3;
`upstream-popover.log.gz` preserves that reproduction. An earlier unsanitized
isolated invocation passed, so it is not a substitute for the gate environment.

After rebasing onto the document-only #424, clean head `43c58796` had six
timeouts: streamDraft, three corpus-v2 cases, fact-menu and site-leak. It passed
1,434 tests, with six failed tests across four files; dependent browser-app
checks were not admitted. Other lanes were running full gates concurrently.
Timeouts remain unchanged, including the existing 5-second and 30-second limits.
The earlier complete check:fast pass is pre-integration evidence only.

The first attempt left the PR in draft. The orchestrator subsequently confirmed
the popover as an intermittent main-branch issue, assigned its permanent fix to
GF, and authorized a rebase and one gate retry for the named load failures. No UI, policy or gate code was
edited to clear these failures. Receipt archives and measured artifacts remain
valid for the isolated C3 corpus comparison. Current-head and exact merged-commit admission are recorded in the PR status;
these historical failed receipts never substitute for either admission.

On resume after #426, `integration-resume.json` records runtime package changes
from the upstream DX lane separately. All measured corpus bytes are unchanged.
The original dev-bank measurements describe their pinned artifact, not a new
measurement of the integrated DX runtime. No judge banks were rerun on resume.
