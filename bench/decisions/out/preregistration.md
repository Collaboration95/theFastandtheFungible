# Preregistered purchase-decision benchmark — 8 October 2026

Research only. Production model, corpus, prompts, policy, payment code and UI remain unchanged. Every datum is SYNTHETIC. Only real hosted API responses are called measured model results. No purchases, wallets, XRPL, ports or Playwright.

## Decision rule fixed before baseline

Incumbent: Clef-flash. A challenger must meet every criterion on the held-out test:

1. Decision F1 improves by at least .05 and its paired 95% CI excludes zero; OR its F1 difference CI includes zero and wrong-purchase spend falls by at least 25%.
2. Mean Brier across gap relevance, candidate relevance, original probability and delivered relevance is not worse, assessed by paired scenario-cluster 95% CI.
3. Measured round p95 is at most 2.5 seconds and individual-call timeout rate at 3 seconds at most 1%.
4. Injection lift is no worse than flash; UC1–UC3 selection regression checks all pass.
5. Estimated metered cost per 1,000 rounds is no more than three times flash.

Several qualifying arms: greatest F1. None: keep Clef-flash. The same criteria apply to full Clef. Missing evidence cannot pass a criterion. The demo stays Clef regardless; any later deployment requires a separate PR.

## Planned protocol and scope choices

- At least 160 constructed scenarios, 40 writers and 320 articles; 60/40 dev/test. Test JSON SHA256 locked before baseline. Regression is separate.
- User explicitly permits GPT-6 clone workers to generate data. GPT-6.1 Sol authors structured specs and deterministic prose realizations; evaluated Luna never generates or labels data. DeepSeek independently relabels a 20% candidate sample. This replaces the brief's DeepSeek generation requirement, saves API spend, and is a threat to validity. The 40 manual inspections are by an AI agent, not a human. Thirty gold items await user review.
- Baseline dev first. Test baseline is computed only after tuning freezes, avoiding the brief's contradictory instruction to run test before dev tuning. No test results inform selection.
- API configurations: verbatim baseline, evidence-focused wording, historical conclusion-centred gap, remove read sources, abstract-first ordering, combined round+candidate questions with baseline wording, and combined questions with evidence wording. Three context/history variants screen on four dev scenarios per domain; baseline/evidence/combined variants use all dev. No more than 12 configurations per arm.
- Full-dev configs selected by dev decision F1 (wrong spend tie-break), after calibration chosen by grouped five-fold dev CV. Binary Platt/isotonic/identity calibrated separately. Original probability may be calibrated with other class mass proportionately rescaled. Threshold grid .05–.60 by .01. Preserve raw metrics too.
- Final held-out + regression three independently sampled repeats. Replicates have a distinct cache namespace but identical API payloads. Replays of each replicate are cached and cost nothing. Baseline test gets one sample after freeze. Report scenario-cluster 10,000-resample paired CIs and exact McNemar.
- Stability uses 24 dev candidates × 5 replicates per arm, reduced from 200 to limit low-information repeated spending. Three originality option permutations use a balanced dev subset. Reduced samples are limitations, not evidence of full stability.
- Primary labels are constructed binary/ordinal; any partial .5 targets get explicitly identified as soft labels, excluded from binary AUROC/AUPRC, not misrepresented as empirical probabilities.
- Raw API durations are observed with a 20-second shadow ceiling; durations exceeding production's 3 seconds count as timeouts and production decisions use the existing whole-round fixture fallback. This measures both uncensored (up to 20s) latency and a production-timeout simulation without paying twice. It does not claim actual cancellation at 3s. No retries hide failures.
- Two in flight per vendor, <=150 requests/min and <=150k estimated input tokens/min; Cloudflare sizes share one limiter. Round wall time includes the limiter; max constituent latency is separately a labelled lower bound, never passed off as a measured full round. Combined round calls test whether fewer requests help under the same cap.
- Costs from returned usage; conservative character estimates only when missing. Provider maximums remain $5 each/$10 total; local guardrails are stricter: Luna $2, Cloudflare combined $4.50, DeepSeek $4.50 and total $9, with Luna <=15k calls/15M input tokens. Forecast before each phase.
- Paid-relevance reads are synthetic post-grant fixtures kept separate from candidate metadata; there are no actual grants or deliveries. Regression checks are offline purchase selections, not live x402/proof/refund requalification.
- Worktree is /private/tmp/tftf-bench-decisions to use the authorized writable workspace. Branch name is bench/decisions-vs-clef. Existing main-checkout UI edits are untouched; no PR/merge.
- Production DecisionProvider discriminator has only cloudflare/fixture. The benchmark-only Luna adapter uses the compatible discriminator internally; every exported result identifies Luna explicitly. No production labels are affected.
- Sandbox DNS failure on the first smoke request was logged; explicit network approval enabled the retry. Account lookup is needed because the local account-id env variable is absent. Setup traffic is distinct from experimental reliability.

## Metrics and limits of the claim

Primary: decision F1 and wasted spend, Brier, equal-mass 15-bin ECE. Also log loss, AUROC/AUPRC, originality multiclass Brier/macro-F1/per-class ECE, credibility MAE/Spearman, exact selections, missed correct buys, adverse-text lift, position sensitivity, repeated std, p50/p95/p99 and 3s reliability. Wrong-resource purchases count as both false positive and missed expected purchase. Initial thresholds: flash .15, full Clef .35, Luna/fixture .20.

The claim is performance on constructed synthetic evidence, from this single machine/network and date. It is not independently human-validated calibration, real-world purchase ROI, a model fine-tune, or an end-to-end live payment benchmark.
