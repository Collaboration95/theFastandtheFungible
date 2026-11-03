# Fresh-set generalisation audit, 3 Nov 2026

This audit covers every behavioural rule added by #320 and #324, read through
`gh pr view 324` and both complete PR diffs. Earlier #304/#307/#318/#320/#324
iterations reused the corpus; even new v2 questions were drawn from visible
documents. #324 inspected historical heldout errors. Its 80.05% is descriptive
of a reused synthetic question holdout, not an unbiased generalisation estimate.

| Added rule | Classification before this change | Disposition before fresh evaluation |
|---|---|---|
| #320 manifest schema/signature and article/version/publisher/wallet binding | General integrity principle | Retained; unverified/legacy menus remain unknown |
| #320 known capex/capacity/lead-time/issuance keys | General metric-scope principle, incomplete hand-written vocabulary | Retained, including coarse investment/cost, allocation and bond aliases; these are necessary filters, not exact semantic equivalence |
| #320 six named semiconductor subjects and special package priority | Benchmark-specific entity allowlist | Replaced by names/acronyms extracted from the request; mixed-case technical names take priority over broad uppercase company acronyms; ordinary names otherwise |
| #320 first-year and dated-request matching | General period principle with benchmark-specific 2023–2030 range | Range removed; digits or spelled-out years 1900–2199; first year only remains a disclosed limitation, not exact-quarter/comparison verification |
| #320 empty verified menu rejects a recognised metric | General conservative promise rule | Retained; absent/invalid/unsigned manifests still unknown |
| #320 fixed short-term list (BoJ/HBM/QFN/BGA/Fed/JGB) | Benchmark-specific acronym whitelist | Replaced by arbitrary uppercase/mixed-case acronyms and mixed letter/digit identifiers; ordinary long content words unchanged |
| #320 inverse-passage-frequency requested-term ranking | General extraction principle | Retained; ranks accessible text only |
| #320 pin best ties, two per requirement, first five requirements; preserve previous requested evidence | General bounded extraction heuristic | Retained; unchanged eight-passage broad-summary cap and exact citation validation |
| #320 reject passages without numbers or with no-new-evidence wording | General numeric-task heuristic, limited to this class of question | Retained; does not claim non-numeric QA generality |
| #320 word boundaries in buy/purchase instruction detector | General token-boundary correction prompted by corpus prose | Retained; direct commands remain filtered; never grants model spending authority |
| #324 wafer-only domain veto with wafer/foundry/TSMC/Kestrel synonyms | Benchmark-specific commodity/domain exception | Removed; coarse price requests use request-derived entity overlap across any domain; no wafer, writer or company allowlist |
| #324 allow entity/title context for metric promises | General public-scope principle with coarse-menu false negatives/positives | Retained; price menus can omit the precise metric, and cannot establish factual support |
| #324 arbitrary mixed letter/digit identifiers | General identifier principle | Retained and extended to arbitrary acronyms |
| #324 require a standalone number rather than identifier digits | General numerical-evidence principle | Retained; an identifier alone is not a numerical result |

No thresholds, hard gates, leak checks, old labels or old tests are loosened.
The inherited country-scope rule predates #320 and is unchanged; its limited
country vocabulary remains a known limitation. Country aliases are left to that
rule so its existing off switch retains its meaning. Month names/question words
are not treated as entities. Lexical name extraction remains heuristic: this is
not a universal ontology or a semantic coverage claim.

## Prospective protocol

- 48 newly authored questions over 24 newly authored documents, two requested
  facts per source. Four domains: water utilities, maritime logistics, fibre
  networks and food cold chain. Water use partially overlaps an old topic;
  maritime/fibre/cold-chain content is new. New fictional operators, measurements
  and questions; no old requested facts. Existing publisher identities remain.
- 32 paid-needed and 16 free-sufficient cases; fixed prices S$0.20–0.65.
  All 24 documents include two additional unrequested measurements. Other
  operators, periods and metrics plus the unchanged old corpus are distractors.
- Offline Codex specifications, existing corpus `assemble` and menu schema,
  existing bank schema/needle verification. Same vendor as Luna; human review
  pending. Templates and regular single-fact questions make this a narrow,
  relatively structured challenge, not a representative customer sample.
- `scripts/generate-fresh-eval.ts` builds `eval/questions/bank.fresh.v1.json`
  and the isolated `corpus-fresh.v1/`. `check-corpus.mjs --extra` checks the
  combined corpus with the identical schema and eight-word leak checks. The
  ordinary demo corpus and all historical banks stay byte-identical.
- Freeze questions, labels, corpus, policy candidates, prompt/metric code and
  configuration in Git BEFORE any model run. No fixture-quality trial on the
  fresh set and no live development run. Unit tests use old dev or separate
  synthetic probes, not fresh labels.
- One LIVE main-policy run (#324 scope and selection source byte-for-byte), then
  one LIVE generalised-policy run. Each has a new empty cache and US$1 hard cap:
  task maximum US$2, within the authorised US$4. No tuning after either result.
  LIVE Luna decision/coverage; fixture planner/writer; keyword search;
  SIMULATED payments, no Testnet/mainnet transactions.
- Unchanged metrics and 2,000-replicate, seed-700, source-cluster percentile CIs;
  24 clusters, all questions of each source resampled together. Paired intervals
  for the fresh policy comparison only. Old heldout vs fresh is unpaired across
  different sets, not evidence of a causal improvement.
- Report all paid attempts, estimated usage and failures. Provider retries are
  the existing bounded transport retry, not a second quality trial. Do not pool
  the reused holdout into an independent-test estimate. CIs condition on fixed
  synthetic templates and observed draws; they omit provider variation, human
  label error and correlations across source templates.

Results and the exact deck/pitch recommendation are added after both runs in
`REPORT-decisions.md`, with compact sufficient scoring records for reproduction.
