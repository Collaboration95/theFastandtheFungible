# Offline metric, calibration, and analysis conventions

These dependency-free modules are research utilities. They make no API calls,
initiate no purchases, and do not change production defaults. Run their checks:

```sh
node --import tsx --test bench/decisions/metrics.test.ts
```

## Loss, discrimination, and missing estimates

`binaryMetrics(y, p)` requires equal-length, finite arrays in [0, 1]. Its `n`
includes soft targets. Brier is mean `(p-y)^2`. Fractional labels such as 0.5
are constructed partial-relevance targets; this is squared error against a soft
target, **not** an observed Bernoulli-outcome Brier score. If interpreted as
Bernoulli probabilities, expected outcome Brier additionally includes `y*(1-y)`.
Disclose the soft-label convention and counts in each result table. Log loss is
soft-label cross entropy using natural logarithms and a 1e-15 floor only inside
the logarithm. Correct predictions at exact 0/1 incur zero log loss.

AUROC and AUPRC use only labels exactly 0 or 1: 0.5 and all other fractional
targets are excluded from discrimination counts, without affecting the losses.
Report hard-positive, hard-negative, and excluded counts alongside these
metrics. AUROC is `null` without both hard classes. AUPRC is stepwise **average
precision**, using one threshold per distinct predicted probability, not
trapezoidal interpolation. Tied ranks receive half credit in AUROC. AUPRC is
`null` without hard positives and 1 if all hard observations are positive.

Reliability bins are sorted equal-mass bins with target count
`min(15, ceil(sqrt(n)))`; at n >= 197 this targets the brief's 15 bins. Adjacent
equal probabilities are kept together, so large tie blocks can reduce the
number of bins and unbalance their sizes. Untied masses differ by at most one.
Small samples intentionally use fewer bins rather than singleton bins. This
small-n/tie adaptation to the brief's fixed 15 bins must be disclosed in the
paper. ECE is the row-count-weighted absolute difference between each bin's
mean probability and mean target. Bin `n`, `predicted`, and `observed` support
reliability diagrams directly; ECE remains sensitive to binning and sample size.

`multiclassMetrics(labels, probabilities)` uses the sorted union of ground-truth
labels and probability keys as the class universe; provide **all expected class
keys, including zero-probability classes**, consistently across arms and splits.
Missing probabilities are zero. Distributions must sum to 1 within 1e-6; these
utilities do not normalize invalid provider outputs. Multiclass Brier is the
mean **sum** of squared errors across classes, with range [0, 2], rather than
dividing by class count. Macro F1 averages one-vs-rest class F1 including absent
classes with F1=0. Argmax ties select the lexicographically first class. Per-class
ECE uses one-vs-rest targets and the same bins as the binary function.

`scoreMetrics(y, p)` computes MAE and Pearson correlation of average ranks
(Spearman). Scores are finite numbers and may span 0..2; they are not constrained
to [0, 1]. Spearman is `null` for constant vectors or fewer than two observations.
Empty losses, ECE, discrimination, MAE, macro F1, and exact-match rates are `null`,
so JSON exports preserve absence without emitting NaN or invented zeros.

## Decisions and currency

`decisionMetrics(rows)` consumes `{expected, selected, priceMinor}`. Identifiers
are resource IDs; `null` means no buy. `priceMinor` is the **selected resource's
actual price** in integer minor units (SGD cents in this benchmark). For a skipped
purchase its price is unused. Do not substitute the expected resource's price
for a wrong selection. Wasted spend sums prices of wrong buys and stays in minor
units; divide by 100 only for an SGD display.

A correct non-null selection is a true positive. Any other non-null selection
is a false positive. Any non-null expected resource not selected is a false
negative, including choosing the wrong resource. Precision divides true
positives by all buys; recall divides them by all expected buys. F1 is
`2*TP/(number_of_buys+number_of_expected_buys)`. Undefined decision precision,
recall, and F1 denominators yield **0**, a conventional rule that must be retained
consistently across arms. A no-buy-only slice may have F1=0 and exact match=1.
Exact match includes correctly selecting nothing. `missedValue` counts missed
expected buys, including wrong-resource buys; it is **not monetary value**, which
cannot be inferred from the given interface. `n` counts decision rows.

## Paired bootstrap and scenario clusters

The exact interfaces are:

```ts
bootstrapIndexes(n, iterations = 10000, seed = 20261008, groups?): Generator<number[]>
pairedBootstrap<T>(rowsA: readonly T[], rowsB: readonly T[],
  metric: (rows: T[]) => number | null,
  iterations = 10000, seed = 20261008,
  groups?: readonly (string | number)[]): {
    estimateA: number | null; estimateB: number | null; difference: number | null;
    ciA: [number, number] | null; ciB: [number, number] | null;
    ci: [number, number] | null; iterations: number; validIterations: number;
  }
```

Match rows by **scenario, candidate, question, and repeat ID** before calling.
Equal lengths alone cannot establish alignment. Do not independently filter
failed calls per arm: report failures and define a common analysis population
before matching. The same sampled original indexes are applied to both arms;
the effect and its `ci` are **A minus B**. A negative Brier difference favors A;
a positive decision F1 difference favors A. `ciA` and `ciB` estimate each arm's
metric. CIs are two-sided 95% percentile intervals over 10,000 resamples by
default, using linear interpolation at index `(n-1)*p`. `percentile(arr, p)`
accepts p in 0..1 and never mutates its input. Mulberry32 with the given integer
seed makes resampling deterministic; seeds are reduced to 32 bits.

**Pass scenario IDs as `groups` for Brier and repeated-round decision F1 CIs.**
The generator draws as many clusters as there are unique scenarios, with
replacement, then includes every candidate/repeat in each sampled scenario.
When a scenario appears twice, all its rows appear twice. Unequal cluster sizes
produce varying resampled row counts; every group member remains intact. IDs
are typed, so numeric 1 and string "1" are distinct. Without `groups`, resampling
is at the individual-row level and is appropriate only for independent rows.
One scenario produces a degenerate interval and cannot establish between-scenario
uncertainty. Report the number of independent scenarios, not just the row count.

For example, both arms' aligned rows can have `{scenarioId, y, p}`:

```ts
const ci = pairedBootstrap(a, b,
  rows => binaryMetrics(rows.map(r => r.y), rows.map(r => r.p)).brier,
  10000, 20261008, a.map(r => r.scenarioId));
```

Default Brier averages **rows**, so scenarios with more candidates/repeats have
more weight. To target a scenario-average effect, aggregate the squared losses
to one row per scenario first, then bootstrap their mean. To combine questions,
use `bootstrapIndexes` to reconstruct original rows and recompute the desired
pre-registered question-weighted metric; do not silently switch weighting.

A resample with an undefined metric for either arm is excluded jointly and
counted via `validIterations`. This matters for one-class AUROC samples; such
intervals are conditional on the metric being defined. Report exclusions and
do not treat them as zero. Unexpected non-finite metric outputs throw. These
percentile intervals are not BCa intervals and may be coarse at small group
counts. A degenerate F1 interval in a no-buy-only slice does not imply that
purchase behavior has been evaluated. Selection of calibration/thresholds must
finish on dev before test CIs are inspected; the bootstrap here does not model
uncertainty from retraining or selecting a calibrator.

`mcnemar(correctA, correctB)` returns `{b, c, discordants, pValue, n}`. `b` is
A correct/B wrong; `c` is A wrong/B correct. The exact two-sided binomial p-value
is `min(1, 2 * P[Binomial(b+c, 0.5) <= min(b,c)])`, with p=1 when there are no
discordants. Concordant rows do not affect the p-value. Log-space summation
avoids initial-term underflow for large samples. Extremely small final p-values
can round to zero in floating point. Use **one independent correctness pair per
scenario/round**. If rounds are repeated within scenarios, pre-register a
scenario-level correctness summary and do not count repeats as independent
McNemar trials. Always report discordant counts and exact-match effect sizes,
not only p-values.

## Calibration fitting and selection

`fitCalibration([{p,y}], method)` accepts soft targets in [0, 1] and returns a
JSON-serializable discriminated model. `applyCalibration(model, p)` is pure.
Identity leaves the input unchanged. Platt fits
`sigmoid(a*logit(p)+b)`, clipping input probabilities to [1e-6, 1-1e-6] for the
logit. Its objective is mean soft-target cross entropy plus `1e-4/2*(a*a+b*b)`.
Newton updates use a line search and up to 100 iterations. The slope is allowed
to be negative; a learned inversion should be disclosed. For a constant target,
Platt returns a constant clipped-target prediction. Isotonic uses weighted
pool-adjacent-violators, first combining duplicate probabilities by their row
counts. Predictions interpolate linearly between fitted knots and use constant
endpoint extrapolation. Isotonic is nondecreasing and cannot undo inverted
rankings. Non-identity fitting rejects empty data.

`chooseCalibration(points, seed = 20261008)` accepts dev points with optional
`group` or `scenarioId` fields (string/number). When both are supplied they must
identify the same group. If `split` is present it must equal `dev`; passing test
or production-regression points throws. When the field is absent the caller
must enforce dev-only isolation. Without group IDs each row is its own group;
**supply scenario IDs whenever rows share a scenario**. Generation twins or
other related scenarios also require a common grouping ID if their dependence
would leak across folds.

Unique group keys are sorted, shuffled deterministically with the seed, and
assigned round-robin to five folds (or the number of groups if there are only
2–4). All candidates and repeats of each group stay together. Each method is
fit on each training fold and applied only to that fold's holdout. Selection
minimizes pooled out-of-fold dev squared error; ties within 1e-12 prefer
identity, then Platt, then isotonic. This CV objective weights rows, rather
than making unequal-sized scenarios equal. Fold row counts can differ because
assignment balances group counts. With fewer than two groups, identity is
retained, CV scores are `null`, and `foldCount` is zero. This is explicit
insufficient evidence rather than training-data performance claimed as CV.

The result returns `method`, `model`, `cvBrier`, `folds` with original
`trainIndexes`/`testIndexes`, `foldCount`, `nGroups`, and an explanatory `reason`.
The chosen model is **refit on all dev points**. Save this serialized model and
selection metadata before applying to test; never call `chooseCalibration` on
test. Fit a separate calibrator per arm/question. Repeat the same grouping and
seed across arms. Upstream instruction/configuration tuning must also obey dev
isolation; these folds alone do not remove bias from earlier selection.

## Multiclass recalibration limitation

The fitting API above is **binary only**. A choice probability vector must stay
on the simplex. Independently fitting one-vs-rest calibrators generally produces
probabilities that do not sum to one; silently presenting these as calibrated
multiclass probabilities would be invalid. Normalizing those outputs changes
every fitted marginal and is itself a distinct method that must be selected
and evaluated as a full-vector transform using grouped dev CV and multiclass
Brier. A future implementation could compare identity with shared temperature
scaling on logits (or log-probabilities with disclosed clipping) and a regularized
vector/multinomial calibration model. It must preserve class order and the
simplex, and fit/select without test access. Temperature scaling and multinomial
calibration are not implemented here.
Likewise ordinal 0..2 credibility scores need an ordinal/distribution-aware
method rather than feeding the expected score into a binary probability fit.

At the user's direction, `analyze.ts` implements a specific **original-only
binary marginal calibration plus a full-vector transform**. It fits the original
probability to `label == original`, then allocates `1-calibratedOriginal` over
rewrite and overlap in their existing ratio. If both raw probabilities are
exactly zero, the new remaining mass is split equally, a disclosed convention.
This preserves the simplex. Method selection still minimizes original-vs-rest
binary grouped CV Brier, **not** full multinomial CV Brier. The report also shows
the transformed full-vector multiclass Brier, macro F1, and per-class ECE. Do not
claim those were the calibration selection objective or that the two remaining
class marginals were separately calibrated. Raw probability vectors whose sum
is within .001 of 1 are normalized as rounding before metric calculations and
calibrated policy replay. Larger errors fail analysis. Corrections are counted;
the basic `multiclassMetrics` remains strict and performs no silent correction.

## Offline analyzer and information barrier

```sh
node --import tsx bench/decisions/analyze.ts --freeze
node --import tsx bench/decisions/analyze.ts --report
# Only after both CF arms complete all seven full-dev configurations, before CF held-out:
node --import tsx bench/decisions/analyze.ts --complete-cloudflare-freeze
```

`--freeze` reads only serialized dev rows, dev family specs, dev run files
(`baseline-*`/`tune-*`), and cache records referenced by those dev rows. It never
reads test baseline or final outputs. It requires complete baseline/evidence/
batch/batch-evidence/historical/no-read/abstract-first dev coverage for each measured non-fixture arm, with failed
rounds included; missing full-dev configurations block freeze rather than
allowing a prematurely chosen winner. Partial screening rows are ineligible;
all seven configurations normally compete once each has full dev coverage. The
documented Cloudflare quota exception below restricts its two arms to the four
completed original configurations. Arms with no dev run rows are absent,
never invented. Flash baseline is required. Family membership comes from
`scenario-specs.jsonl` (`familyId`/`scenarioIds`), not separate scenario IDs; if
the dataset also has `group`, it must agree. Thus clean/adversarial/condition twins
and all their candidates/repeats remain in the same fold or resampled cluster.

Dev-only promotion amendment, recorded 2026-10-08 before held-out evaluation:
the parent reported Clef no-read screening exact matches of 23/28 versus baseline
46/96, and Luna historical 27/28 versus baseline 58/96. These different dev
populations do not establish an improvement. They motivated promoting all three
screens (historical, no-read, abstract-first) to the full 96 dev scenarios for
every hosted arm, preserving the same maximum seven configurations per arm.
Runner `--phase promote` appends missing dev rows to the existing `tune-*` files;
the analyzer requires complete coverage, including failures, before any freeze
artifact is saved. Calibration and threshold selection remain dev-only. The
parent owns launching `--freeze` after all promotions finish. The initial screens
are selection evidence, not held-out results; final reporting uses the promoted
full dev configuration selection and the separately frozen held-out evaluation.

External quota amendment, recorded 2026-10-08 before held-out evaluation:
`out/blocked-cloudflare.json` documents Workers AI HTTP 429, code 4006, exhaustion
of the daily free 10,000-neuron allocation, and an explicit paid-plan requirement.
The parent stopped Cloudflare promotion; no account upgrade, alternate credentials,
further requests, or quota workaround is authorized. Flash and full Clef each
completed baseline/evidence/batch/batch-evidence on all 96 dev scenarios. Their
historical promotion is partial (including quota-error rows), and no-read and
abstract-first remain 28-row screens. Only those four complete configurations can
win for Flash/Clef. Partial runs remain in `tuning-log.csv` with observed/expected
counts, fallback counts, request failures, and exclusion reason, and are scored
separately as `quota-excluded-dev` rather than pooled into eligible evidence.
Luna still requires all seven configurations on all 96 dev scenarios. The analyzer
accepts this exception only with the recognized quota marker (status 429/code
4006/provider Cloudflare Workers AI); ordinary incomplete promotion still blocks
freeze. Frozen metadata records the block and eligibility per arm. This creates
a disclosed configuration and budget asymmetry; dev tuning does not establish
provider superiority.

Held-out Cloudflare arms are **blocked**, with null quality estimates and no
fixture substitution presented as hosted-provider results. Final quality is Luna
and the explicitly labelled fixture, three repeats of 64 test scenarios plus the
separate four production regression scenarios. Operational timing remains Luna
only, 28 clean topic families at repeat 401; it does not enter quality results.
The final summary is `partial-cross-provider-quota` even when Luna's per-arm
status is `measured-final-runs-complete`. No Flash paired comparison is emitted
without actual Flash held-out observations. Luna-versus-fixture paired estimates
and McNemar may be reported, clearly naming the fixture reference; they cannot
replace the missing incumbent contrast. The decision remains **retain incumbent
Flash**, because missing incumbent/full-Clef held-out evidence prevents the
preregistered rule from certifying a switch, regardless of Luna's measured scores.

`selfBootstrap(rows)` reports each observed arm's own F1 and Brier 95% percentile
CIs from 10,000 deterministic topic-family resamples. All twin variants,
candidate observations, and repeats stay within each sampled family. Main Brier
is the equally weighted mean of gap/addressesGap/original/paid binary losses,
with per-question Brier intervals and observation counts also disclosed. If a
question has no available predictions, the four-question estimate and affected
bootstrap draws are undefined, not imputed; `validIterations` records this.
Intervals are conditional on frozen dev selection, describe the available arm
population, and do not estimate an absent provider contrast. Serialized coverage
and fixture fallback conventions remain unchanged.

For each arm/config, binary models fit gap, candidate addressesGap, original,
and paid relevance separately, selected by grouped dev CV as above. A config
uses paid calibration from the full dev configuration with the same final paid
question wording: evidence and batch-evidence use **evidence** dev; baseline,
batch, historical, no-read, and abstract-first use **baseline** dev. The source
is explicitly recorded as `paidCalibrationSource` in the frozen arm and tuning
log. Batch-evidence dev has no paid calls, but its final paid questions use the
evidence variant; baseline paid calibration would use the wrong distribution.
Missing or failed paid observations do not trigger substitution of another
wording's calibration data. Failed decision fallback
predictions are never used to fit or apply the failed provider's calibrators.
Independently successful paid observations can still train paid calibration
when that scenario's decision calls failed. The fixture arm stays uncalibrated.

The threshold grid is .05 to .60 inclusive by .01. Every candidate threshold
replays all dev scenarios through **the actual offline `select()` helper in
run.ts**, including whole-round fixture fallback on production-timeout/error
rounds. Highest dev F1 wins, then lowest wasted spend; any remaining threshold
tie chooses the smallest grid value, and config ties retain the earliest of
baseline/evidence/batch/batch-evidence/historical/no-read/abstract-first.
This is full-dev threshold/config tuning,
after CV selected calibration; it is not an unbiased estimate of tuning gains.
The selected calibrator is refit on all available dev observations. Threshold
and configuration choices never read test. For all evaluations, raw policy
replay must exactly reproduce recorded selected ID, price, and fallback status;
otherwise analysis stops with a disagreement.

The freeze writes `tuning-log.csv`, `threshold-curves.csv`, `results-dev.csv`,
`latency-dev.csv`, `analysis-dev.json`, then atomically writes `frozen-config.json` **last**. A
second `--freeze` refuses to retune after the freeze exists. The runner consumes
the frozen arm's `config`; the analyzer applies both its **frozen calibration
and frozen threshold** when evaluating final rows. Stored runner picks remain
the raw/default-threshold baseline for that wording.

If the parent later resolves the Cloudflare quota and finishes all seven
configurations for **both** CF arms, `--complete-cloudflare-freeze` (alias
`--refreeze-cloudflare`) permits one narrowly
scoped dev amendment to an initial quota-blocked freeze. It does not run requests
or change billing. It rejects any CF test-baseline/final/operational run file,
including an empty file, by filename before reading any held-out contents. It
also rejects incomplete CF dev configurations or remaining code 4006 quota-error
rows; the parent must rerun those failed dev rows, not merely append scenarios
that were never run. Ordinary provider errors/fallbacks still count in dev.

Dev dataset/family hashes and every non-CF dev file must remain unchanged.
Luna/fixture calibrators, selected configurations, thresholds, and selection
metadata must match their prior frozen objects exactly. Luna held-out files may
already exist but are never read by refreeze. Original frozen metadata and dev
analysis (including partial-CF exclusions) are archived as
`frozen-config-before-cloudflare-refreeze.json` and
`analysis-dev-before-cloudflare-refreeze.json`; the revision records their prior
frozen hash/time and block provenance, refreshes dev artifacts, and atomically
saves `frozen-config.json` last. All seven configurations then compete on equal
dev coverage for each hosted arm. No CF held-out calls may start until that save
completes. The unchanged prior quota marker is treated as historical using its
recorded hash; a changed/new quota marker blocks CF reporting again. Refreeze is
not permitted a second time or for an ordinary non-blocked freeze. Missing CF
held-out results still cannot qualify a switch after dev parity is restored.
Only CF calibrators/configurations/thresholds are refit; Luna/fixture frozen
objects and dev logs are copied exactly from the initial dev analysis. Luna can
therefore run held-out independently after the initial partial freeze, while CF
completion reads only dev data and filenames proving CF held-out has not begun.
If both CF arms reach all seven full-dev configurations before the **first**
freeze, ordinary `--freeze` restores seven-config parity automatically, provided
no code 4006 dev rows remain; the original quota marker is retained by hash as
historical provenance rather than deleted or silently treated as active.

Tuning-log status rows are enriched offline with `kept` (whether that eligible
configuration matches the frozen arm), `uniqueReferencedRequestCount`, and
`referencedUniqueRequestCostUsd`. Counts and costs deduplicate exact referenced
cache keys within that configuration and include paid and error requests that
were actually referenced. Borrowing paid calibration data causes no new call
and does not add borrowed source keys to the configuration's run cost. Shared
keys make these costs **nonadditive across configurations**; they are
replay-priced references, not incremental API billing or the total meter.
`enrichSavedTuningLog()` checks the original frozen dev-file hashes, updates the
saved dev analysis and CSV, and never modifies `frozen-config.json` or retunes.
Freeze and report both populate these fields.

`summary.robustnessDiagnostics` and each arm's `baselineWordingDiagnostic` join
saved `out/robustness.json` results as **baseline-wording-diagnostic**, on dev
items and raw individual-candidate requests. The final chosen configuration is
explicitly shown separately; `finalConfigurationMeasurement` is false. The
final policy's `positionBias`/`stability` fields remain unmeasured, and absent
Cloudflare diagnostics stay null. Baseline option-order shifts and repeat
variation are not evidence of final batched/calibrated-policy sensitivity.

Flash-only account-resumption amendment (user explicitly authorized, 2026-10-08):
the parent may use the public routing alias `CLOUDFLARE_API_TOKEN_2` for a friend's
authorized account, with gentle limits, for Flash final/isolated operational
requests and then robustness if available. Credentials and transport remain
parent-owned. This is a change of account route and time window, not a new dev
search: Flash stays at its existing frozen evidence configuration, threshold
0.38, and exact calibrators. Full Clef remains blocked; original dev search
coverage remains four CF configurations versus seven Luna configurations.

Report honors current per-arm `blockedArms`/`resumedArms` fields in
`out/blocked-cloudflare.json`, rather than letting the older frozen global marker
hide new Flash measurements. Alternatively, the parent can save
`out/cloudflare-resumption.json` with `arm:"flash"`,
`tokenAlias:"CLOUDFLARE_API_TOKEN_2"`, `accountChanged:true`,
`frozenUnchanged:true`, and ISO `at`. The parent's actual aliases
`credentialAlias:"CLOUDFLARE_API_TOKEN_2"` and `frozenSelectionChanged:false`
are also accepted. Optional config/threshold must match the frozen values;
optional `frozenHash` is checked against the unchanged frozen file. Only public
audit and positive integer limiter fields are copied into the
summary; no credential value is read. That explicit record removes only Flash's
old block; full Clef stays unavailable. A newer or explicitly renewed Flash quota
block takes precedence. Original frozen block history is retained separately.

The summary exposes `blockedArms`, `resumedArms`, and `cloudflareResumption`.
Once Flash held-out exists, matched Luna-versus-Flash contrasts are computed
with the same family-cluster bootstrap/McNemar conventions. Overall study status
remains partial while full Clef is blocked. The decision reason must reflect
actual incumbent availability: completed Flash evidence no longer counts as
missing, but the UC3 oracle/story discrepancy still prevents regression/switch
qualification. Paper generation must use arm-specific availability, not a global
Cloudflare-block boolean, when discussing incumbent comparisons. Account and
time-window differences are recorded as limitations; local queue limits must be
read from the actual route configuration rather than inferred from pooled files.

The resumed route is one in flight, 50 starts/minute (1,200 ms spacing), versus
Luna's original two in flight and below-150 starts/minute (410 ms spacing).
`latencyConditionsByArm` and `latencyComparison` disclose this difference.
Unique-key `clientCallLatency` is separate from round wall time: it excludes
local admission/account-discovery waiting, but includes HTTP/network time and
failed/timed-out calls. Neither population measures server-only inference.
An explicit `blocked-cloudflare-second.json` overrides the older resumption.

The offline paper generator verifies the frozen hash and rejects a stale report
that omits an existing resumption record. Ordinary rendering refuses incomplete
nonblocked quality runs; `--allow-incomplete` renders only a labelled draft.
Run report, then evidence, then `python3 bench/decisions/write-paper.py` after the
parent finishes measurement. Missing metrics remain unavailable. UC1's three
Luna regression fallback matches are disclosed separately from the 192-round
main test's failure population. The no-gap bypass remains an untested proposal.

`--report` requires the freeze before opening test data/results, verifies the
parent's test lock (`SHA256(JSON.stringify(testArray))`), and verifies the dev
data hash against the freeze. It writes `results-test.csv`, `latency.csv`, and
`summary.json`. The summary exposes incomplete/missing repeats. It separately
reports test baseline, final tuned, regression, and slices. Tuned challenger
versus tuned flash and raw baseline challenger versus raw baseline flash have
their own paired family-clustered 10,000-resample F1 and four-question-mean Brier
CIs. Matching Brier observations are intersected by original scenario/repeat/
question/resource key; missing observation counts are explicit. Four-question
Brier is null if any of the four questions has no observations. Paired CIs on
both arms and their difference are in the comparison rows in the CSV and JSON.

Exact McNemar uses **one pair per independent topic family**, with a family
correct only when every paired variant/repeat selects its expected resource.
This conservative family summary is distinct from ordinary per-round McNemar;
report the convention and discordant family counts. It avoids treating twins
or repeats as independent trials.

Policy-level scores include the actual fixture substitute on failed rounds;
those predictions are labelled and remain uncalibrated. `provider-parsed-including-late`
metrics separately show every available parsed raw provider prediction, including
late results. A runner-initialized zero after a round parse failure is **not**
reported as a measured probability. Paid failures/late outputs have no recorded
fallback: they remain missing with coverage counts, rather than inventing paid
predictions. No timeout/error rounds are deleted from decision F1 or latency.

Paid request records and `row.paid` do not necessarily share ordering: requests
are appended at completion while Promise.all preserves candidate order. Future
paid rows' `requestKey` selects the cached record directly. Legacy rows match the
candidate's exact granted body against `request.state.passages[0]` (Clef) or
`JSON.parse(request.input).passages[0]` (Luna). Repeated occurrences of the same
key are deduplicated before matching. Missing or ambiguous legacy matches are
counted as `unresolvedPaidCalls` and excluded from timely paid metrics/training;
they do not get an invented success or timeout. A missing direct requestKey
record is an integrity error. Raw parsed paid probabilities remain separately
reported, including late results, with their lower evidential status explicit.

Latency uses referenced cache keys and includes failed and late calls. Decision
round USD uses decision-call keys only; paid post-grant audit costs are separate.
Setup and QA costs belong to the parent's full `cost.json` ledger and are not
presented as per-decision experimental cost. The recorded round wall time
includes limiter queues. **Operational round p95 and per-round decision cost
use only `decisionCacheHits === 0` rounds**; `round-wall-cache-warm` reports rounds
with any decision cache hits, and `round-wall-legacy-cache-status-unknown` reports
unknown cache status separately. Missing cold rounds yield null operational
estimates and cannot establish a latency gate pass. Main max-call lower bounds
also use only no-cache rounds. Per-call latency/reliability deduplicates request
keys within each stage, so reuse of a historical latency is never a new trial.
Unique referenced paid audit cost is reported separately; the full meter remains
the authority on total charges. Final spent
amounts are theoretical wrong-purchase costs in synthetic selections, never
actual payments. Totals across three repeats and mean per-repeat/per-round waste
must be distinguished. Missing final rows never produce a fabricated arm metric.

Clean-twin attack lift is computed from the spec's clean/adversarial scenario
and resource mappings, as calibrated policy value(attacked) minus value(clean),
matched by repeat. Its mean, maximum, family counts, and pairs involving fallback
are exposed. No switch recommendation is computed here: the parent applies
the full preregistered rule and joins separately measured position/stability
diagnostics. Unmeasured statistics stay null; missing evidence cannot pass a
switch criterion. QA results remain owned by the parent.

The initial baseline process loaded older modules and lacks cache-hit fields.
At the parent's direction, baseline cache status is reconstructed **in the
original per-arm baseline file order**, with the seen set seeded by that arm's
saved smoke key. A decision key seen before the current row counts as a cache
hit; every row key, including paid keys, is then added to the set. Explicit new
runner counters take precedence. Reconstruction is labelled
`baseline-key-history`; its filename, seed smoke keys, and affected row count
are saved in `metadata.baselineTimingReconstruction` and copied into the final
summary. This assumes the parent-run baseline followed smoke with no other
prior arm traffic using the same payloads; it does not infer coldness from
request timestamps. Other legacy rows remain unknown. Test baseline and final
runs use the new runner fields. Dev latency rows are copied into the report's
`latency.csv` with their original stage and provenance.

Regression expectations are read from `data/regression-scope.json`. The summary
and CSV show `oracleExpected`/`oracleMatch` and `storyExpected`/`storyMatch`
separately. UC3's dataset oracle selects Fab Floor while the story expects an
initial AlphaLeak purchase; this discrepancy remains explicit and prevents
`regressionGate.switchQualificationPass`, even if the oracle selection is
correct. The compatibility `pass` field is also false for discrepancies or
unknown story expectations. Missing repeats prevent gate qualification. These
remain offline selection checks, not payment/proof/refund execution.

The parent's independent DeepSeek QA is running on **192 candidate occurrences**
(20% of 960), in addition to the dataset worker's author audit. The standalone
data-notes statement that independent QA was not performed describes that
worker's scope and is superseded by the parent's run. After freeze, `--report`
reads **actual** `out/label-qa.json` when present and carries its model, sample
count, completed count, and agreement statistics into `summary.labelQa`.
Absent outputs remain null; a running audit is not claimed completed, and no
kappa or agreement value is invented. The analyzer never reads that mixed
dev/test QA output during tuning or changes locked labels from the audit.

## Refusals, reliability, and provider-quality coverage

An HTTP-200 response containing `answers[].type == 'refusal'` is a **semantic
failure**, even when the transport record has no `error`. The analyzer detects
these directly from cached responses. Per-call reliability uses distinct
request keys and reports `httpOrTransportErrorCount/Rate`,
`semanticRefusalCount/Rate`, `timeoutCount3s/timeoutRate3s`, and
`combinedFailureCount/Rate`. The combined count is the union of HTTP/transport
failure, semantic refusal, and timeout; an overlapping refusal plus timeout
counts once in the union. HTTP status outside 200..299 is a failure even if the
record's `error` field is absent. Compatibility `errorRate` now means the combined
rate, rather than only `rec.error`. Missing request populations yield null rates.
Other schema/parse failures remain visible through recorded round fallback and
coverage; these refusal counters do not claim to enumerate all invalid shapes.

Refusals trigger/preserve production's whole-round fixture fallback. A refused
round response has **no raw gap probability**: an initialized zero is not a
measurement. Because the runner's parse catch stores `judgments=[]`, otherwise
successful candidate-call responses can also be absent from that row's raw
provider-quality population. The analyzer does not recover those judgments
to bypass the refusal. `providerQualityCoverage` records expected/available gap
and candidate counts, refusal-affected **scenario rows**, empty-judgment fallback
rows, and candidate slots discarded by the whole-round parse path. Request
refusal counts and affected scenario counts are different because twins can
reuse one cached refused request. All affected rounds still contribute to
policy F1/exact match/spend through their actual fixture substitute. Raw
provider-only quality is conditional on available serialized probabilities;
disclose this coverage loss rather than describing it as full-arm quality.

## Isolated operational amendment

The parent preregistered an additional `--phase operational` before test
evaluation: each hosted arm runs **alone**, on the 28 clean held-out topic
families, using its frozen config, fresh repeat namespace 401, and
`withPaid=false`. Files are `out/runs/operational-{config}-{arm}-401.jsonl`.
`--freeze` never reads them. After freeze, `--report` validates clean/test IDs,
config, repeat, uniqueness, and absence of paid calls, then joins **only their
timings, request reliability, and decision-call cost**. Operational judgments
and selections never enter main three-repeat F1/Brier, paired CIs, McNemar,
regression, or attack-lift populations.

`summary.isolatedOperational[arm]` and `final[arm].isolatedOperational` carry
coverage, missing IDs, cold/warm/unknown counts, p95, unique-request reliability,
cost, and `criterion3`. Complete operational evidence requires every expected
clean family, no reused/unknown-cache rows, and recorded decision request keys.
`criterion3.eligible` additionally requires p95 <= 2500 ms and timeout rate <= 1%
as preregistered. Missing/partial/warmed runs cannot establish this gate.
Separate refusal/combined rates accompany that latency/timeout criterion; the
amendment does not add a new unregistered numerical refusal threshold.

Primary `final[arm].decisionP95Ms`, `timeoutRate3s`, and hosted-arm
`costPer1000DecisionRoundsUsd` now come from the isolated operational population,
with explicit source fields. Concurrent final cold timing/reliability/cost remain
separate (`concurrentFinalDecisionP95Ms`, `concurrentFinalTiming`,
`concurrentFinalTimeoutRate3s`, `concurrentFinalCostPer1000DecisionRoundsUsd`).
CSV rows use stage `isolated-operational`, which is an operational result rather
than a fourth quality repeat. The fixture arm does not have hosted operational
measurements and cannot qualify this hosted latency gate.

Both isolated and concurrent round wall times include configured local
concurrency and rate/token limiter queues; resumed Flash uses one in flight,
while original Luna uses two. Isolated execution removes
cross-arm contention by runner protocol; external provider/network contention
is not measured. Concurrent final runs include other-arm harness contention
(both Cloudflare sizes share a vendor limiter). The isolated p95 has only 28
independent clean families and one repeat: its tail is determined by very few
rounds. Report that limitation; do not present this sample as a precise service
SLO or replace the wall time by the longest-call lower bound.
