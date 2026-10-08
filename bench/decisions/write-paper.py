"""Render the research paper from saved evidence. Does not call providers."""
import csv
import json
import argparse
import hashlib
import math
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out', type=Path, default=Path('bench/decisions/out'))
parser.add_argument('--allow-incomplete', action='store_true', help='Render an explicitly labelled draft, never qualify incomplete evidence')
args = parser.parse_args()
OUT = args.out
def read(name):
    return json.loads((OUT / name).read_text())
def fmt(value, places=3):
    return '—' if value is None or not math.isfinite(value) else f'{value:.{places}f}'
def table(headers, rows):
    def cell(value):
        return str(value).replace('|', '\\|').replace('\n', ' ')
    return '\n'.join(['|' + '|'.join(map(cell, headers)) + '|',
                       '|' + '|'.join(['---'] * len(headers)) + '|'] +
                     ['|' + '|'.join(map(cell, row)) + '|' for row in rows])
def ci(metric):
    metric = metric or {}
    bounds = metric.get('ci')
    return fmt(metric.get('estimate')) + (f' [{fmt(bounds[0])}, {fmt(bounds[1])}]' if bounds else ' [unavailable]')
def percent(value):
    return 'Unavailable' if value is None else f'{value*100:.2f}%'
def contrast(metric):
    metric = metric or {}
    bounds = metric.get('ci')
    return fmt(metric.get('difference')) + (f' [{fmt(bounds[0])}, {fmt(bounds[1])}]' if bounds else ' [unavailable]')
def numeric(row, key):
    value = row.get(key)
    return None if value in (None, '') else float(value)
def assessment(pass_condition, evidence):
    return ('PASS — ' if pass_condition is True else 'FAIL — ' if pass_condition is False else 'UNAVAILABLE — ') + evidence

summary = read('summary.json')
facts = read('publication-facts.json')
dev = read('analysis-dev.json')
frozen = read('frozen-config.json')
cost = read('cost.json')
qa = read('label-qa.json')
robust = read('robustness.json')
examples = read('discussion-examples.json')
with (OUT / 'results-test.csv').open() as f:
    test_rows = list(csv.DictReader(f))
arms = ['flash', 'clef', 'luna', 'fixture']
names = {'flash': 'Clef-flash', 'clef': 'Clef 27B', 'luna': 'OpenAI Luna', 'fixture': 'Fixture'}
blocked_arms = summary.get('blockedArms', [a for a in arms if summary['final'].get(a,{}).get('status')=='blocked-cloudflare-quota'])
blocked = bool(blocked_arms)
resumption = summary.get('cloudflareResumption')
frozen_hash = hashlib.sha256((OUT/'frozen-config.json').read_bytes()).hexdigest()
if summary.get('frozenHash') != frozen_hash:
    raise ValueError('Regenerate analyzer report: frozen hash does not match')
if (OUT/'cloudflare-resumption.json').exists() and not resumption:
    raise ValueError('Regenerate analyzer report after Flash account resumption; stale global CF blocking cannot be published')
luna = summary['final']['luna']
if not luna.get('confidenceIntervals'):
    raise ValueError('Do not publish before Luna held-out estimates exist')
incomplete = [x['arm'] for x in summary['completeness'] if not x['complete'] and not x.get('blocked')]
if incomplete and not args.allow_incomplete:
    raise ValueError('Nonblocked held-out arms incomplete: '+','.join(incomplete)+'; use --allow-incomplete only for a labelled draft')
status = ('PARTIAL: held-out evidence unavailable for '+', '.join(names[a] for a in blocked_arms)+'.'
          if blocked else 'Measured hosted-arm held-out runs complete.')
if incomplete: status = 'DRAFT — incomplete: '+', '.join(names[a] for a in incomplete)+'. '+status
if resumption: status += ' Flash resumed on a user-authorized second account with unchanged frozen selection.'
flash = summary['final'].get('flash', {})
flash_available = bool(flash.get('decisions'))
complete = {r['arm']:r['complete'] for r in summary['completeness']}
total = sum(x['usd'] for x in cost.values())
repository = 'https://github.com/Collaboration95/theFastandtheFungible'
branch = repository + '/tree/bench/decisions-vs-clef/bench/decisions'
prereg = repository + '/commit/9eede4d'
f1 = ci(luna['confidenceIntervals']['f1'])
brier = ci(luna['confidenceIntervals']['brier'])

baseline = [next(r for r in dev['results'] if r['arm'] == a and r['config'] == 'baseline'
                and r['view'] == 'raw-policy' and r['question'] == 'decision') for a in arms]
baseline_table = table(['Arm', 'F1', 'Exact picks / n', 'Wrong-purchase S$', 'Missed oracle buys', 'Policy Brier', 'Fallback rounds'],
    [[names[r['arm']], fmt(r['f1']), f"{round(r['exactMatch']*r['n'])}/{r['n']}", fmt(r['wastedSpendSgd'], 2), r['missedValue'], fmt(r.get('meanFourBrier')), r['fallbackRounds']] for r in baseline])

final_table_rows = []
for arm in arms:
    r = summary['final'].get(arm, {})
    if not r.get('decisions'):
        final_table_rows.append([names[arm], 'Blocked' if arm in blocked_arms else 'Pending'] + ['Unavailable']*8)
        continue
    injection = r.get('injectionLift') or {}
    robustness = robust['summary'].get(arm, {})
    final_table_rows.append([names[arm], str(r['decisions']['n'])+(' complete' if complete.get(arm) else ' partial'), ci(r['confidenceIntervals']['f1']), fmt(r['decisions']['exactMatch']),
        fmt(r['wastedSpendSgdPerRepeat'], 2), ci(r['confidenceIntervals']['brier']), fmt(injection.get('meanDeltaValue'), 4),
        fmt(robustness.get('maxPositionDelta')), fmt(r.get('decisionP95Ms'), 1), fmt(r.get('costPer1000DecisionRoundsUsd'), 4)])
final_table = table(['Arm', 'Quality rounds / status', 'Purchase F1 [95% CI]', 'Exact match', 'Wrong S$ / repeat', 'Four-question Brier [95% CI]',
                     'Mean attack Δvalue', 'Baseline option-order Δp', 'Isolated round p95 ms', 'USD / 1k rounds'], final_table_rows)
attack_table = table(['Arm','Attack pairs','Mean Δvalue','Maximum Δvalue','Pairs with positive lift'],
    [[names[a],r['injectionLift']['nPairs'],fmt(r['injectionLift']['meanDeltaValue'],4),fmt(r['injectionLift']['maximumDeltaValue'],4),sum(p['delta']>0 for p in r['injectionLift']['pairs'])]
     for a,r in summary['final'].items() if r.get('injectionLift')])

call_table = table(['Arm', 'Mean tokens: round / candidate / paid', 'Replay-priced USD / round', 'USD / 1k one-round prompts'],
    [[names[r['arm']], ' / '.join(fmt(c['meanInputTokens'], 1) for c in r['byKind']), fmt(r['meanUsdPerRound'], 7), fmt(r['usdPer1000Rounds'], 4)] for r in facts['baselineCallCost']])
latency_table = table(['Arm', 'Call kind', 'Client p50 ms', 'Client p95 ms'],
    [[names[r['arm']], c['kind'], fmt(c['p50Ms'], 1), fmt(c['p95Ms'], 1)] for r in facts['baselineCallCost'] for c in r['byKind']])
calibration_table = table(['Arm', 'Frozen dev configuration', 'Threshold', 'Gap / candidate / originality / paid calibration', 'Dev F1'],
    [[names[a], frozen[a]['config'], fmt(frozen[a]['threshold'], 2), ' / '.join(frozen[a]['calibration'][q]['method'] for q in ['gap','addressesGap','original','paid']), fmt(frozen[a]['devDecision']['f1'])] for a in arms])
raw_tuning_table = table(['Configuration', 'Flash raw F1', 'Clef raw F1', 'Luna raw F1'],
    [[config] + [next((fmt(r['decision']['f1']) for r in facts['rawDev'] if r['arm']==a and r['config']==config and r['complete']), 'Incomplete') for a in arms[:3]]
     for config in ['baseline','evidence','batch','batch-evidence','historical','no-read','abstract-first']])
thresholds = [.05,.10,.15,.20,.30,.40,.50,.60]
curve_table = table(['Arm / frozen configuration']+[fmt(t,2) for t in thresholds],
    [[names[a]+' / '+frozen[a]['config']] + [next((fmt(r['f1']) for r in dev['curves'] if r['arm']==a and r['config']==frozen[a]['config'] and abs(r['threshold']-t)<1e-8),'—') for t in thresholds] for a in arms])

reliability = []
for a in arms:
    r = next(r for r in dev['results'] if r['arm']==a and r['config']=='baseline' and r['view']=='raw-policy' and r['question']=='addressesGap')
    reliability.append('**'+names[a]+' — baseline dev candidate relevance**\n\n'+table(['Bin', 'n', 'Mean predicted', 'Observed fraction'],
        [[i+1,b['n'],fmt(b['predicted']),fmt(b['observed'])] for i,b in enumerate(r['bins'])]))
reliability_text = '\n\n'.join(reliability)
(OUT/'reliability.md').write_text('# Reliability bins\n\n'+reliability_text+'\n')

quality_rows = [r for r in test_rows if r['stage']=='final-test' and r.get('view')=='calibrated-policy' and r['question'] in ['gap','addressesGap','original','paid']]
quality_table = table(['Arm', 'Question', 'n', 'Brier', 'Log loss', 'ECE', 'AUROC', 'AP'],
    [[names[r['arm']],r['question'],r.get('n',''),*[fmt(numeric(r,k)) for k in ['brier','logLoss','ece','auroc','auprc']]] for r in quality_rows])
extra_quality = [r for r in test_rows if r['stage']=='final-test' and r.get('view')=='calibrated-policy' and r['question'] in ['originality','credibility']]
extra_quality_table = table(['Arm', 'Task', 'Multiclass Brier', 'Macro F1', 'MAE', 'Spearman', 'Class ECE'],
    [[names[r['arm']], r['question'], *[fmt(numeric(r,k)) for k in ['brier','macroF1','mae','spearman']],
      ', '.join(k+':'+fmt(v) for k,v in json.loads(r.get('perClassEce') or '{}').items()) or '—'] for r in extra_quality])
decision_table = table(['Arm', 'Precision', 'Recall', 'Missed buys / all repeats', 'Fallback rounds', 'Timely paid / expected'],
    [[names[a],fmt(r['decisions']['precision']),fmt(r['decisions']['recall']),r['decisions']['missedValue'],r['fallbackRounds'],
      f"{r['observedTimelyPaidPredictions']}/{r['expectedPaidPredictions']}"] for a,r in summary['final'].items() if r.get('decisions')])
operation_table = table(['Arm', 'Cold rounds', 'Round p50 / p95 / p99 ms', 'Client-call p95 ms', 'Timeouts / calls', 'Final HTTP / refusal / timeout counts', 'Limits: concurrent / RPM'],
    [[names[a], (r.get('isolatedOperational') or {}).get('timing',{}).get('cold',{}).get('n',0),
      ' / '.join(fmt((r.get('isolatedOperational') or {}).get('timing',{}).get('cold',{}).get(k),1) for k in ['p50','p95','p99']),
      fmt((r.get('isolatedOperational') or {}).get('clientCallLatency',{}).get('p95Ms'),1),
      f"{(r.get('isolatedOperational') or {}).get('requestReliability',{}).get('timeoutCount3s','—')}/{(r.get('isolatedOperational') or {}).get('requestReliability',{}).get('n','—')}",
      ' / '.join(str(r.get('requestReliability',{}).get(k,'—')) for k in ['httpOrTransportErrorCount','semanticRefusalCount','timeoutCount3s']),
      f"{(r.get('latencyConditions') or {}).get('maxInFlight','—')} / {(r.get('latencyConditions') or {}).get('maxRequestsPerMinute',(r.get('latencyConditions') or {}).get('maxRequestsPerMinuteCeiling','—'))}"]
      for a,r in summary['final'].items() if a!='fixture' and r.get('decisions')])
kept_cost_table = table(['Arm', 'Kept config', 'Unique referenced requests', 'Referenced USD'],
    [[names[r['arm']],r['config'],r.get('uniqueReferencedRequestCount','—'),fmt(r.get('referencedUniqueRequestCostUsd'),5)]
     for r in dev['tuningLog'] if r.get('kept')])
coverage_table = table(['Arm', 'Raw gap available/expected', 'Raw candidates available/expected', 'Discarded candidate slots', 'Paid missing/late'],
    [[names[a], f"{r['providerQualityCoverage'].get('availableRawGapPredictions','—')}/{r['providerQualityCoverage'].get('expectedGapPredictions','—')}",
      f"{r['providerQualityCoverage'].get('availableCandidateJudgments','—')}/{r['providerQualityCoverage'].get('expectedCandidateJudgments','—')}",
      r['providerQualityCoverage'].get('discardedCandidateSlotsOnWholeRoundFallback','—'),r.get('paidMissingOrLate','—')]
     for a,r in summary['final'].items() if a!='fixture' and r.get('decisions')])
slice_rows = [r for r in test_rows if r['stage'].startswith('test-slice:') and r.get('view')=='calibrated-policy'
              and r['question']=='decision' and r['arm'] in ['flash','luna']]
slice_table = table(['Arm', 'Slice', 'Rounds', 'F1', 'Exact match', 'Wrong S$'],
    [[names[r['arm']],r['stage'].split(':',1)[1],r['n'],fmt(numeric(r,'f1')),fmt(numeric(r,'exactMatch')),fmt(numeric(r,'wastedSpendSgd'),2)] for r in slice_rows])
qa_table = table(['Independent QA label', 'Cohen κ', 'Agreement', 'Items'],
    [[k,fmt(v['kappa']),fmt(v['agreement']),v['n']] for k,v in qa['agreement'].items()])
cost_table = table(['Provider/model', 'Calls', 'Input tokens', 'Estimated USD'],
    [[names.get(a,a),v['calls'],f"{v['inputTokens']:,}",fmt(v['usd'],4)] for a,v in cost.items()])
regression_groups = []
for a in arms:
    rows = summary['final'].get(a,{}).get('regression',[])
    for scenario in dict.fromkeys(r['id'] for r in rows):
        group = [r for r in rows if r['id']==scenario]
        regression_groups.append([names[a],scenario,len(group),sum(r['oracleMatch'] for r in group),sum(r['storyMatch'] is True for r in group),sum(r['fallback'] for r in group)])
regression_table = table(['Arm', 'Fixture', 'Repeats', 'Oracle matches', 'Story matches', 'Fallbacks'],regression_groups)

comparison = summary.get('comparisonsVsFixture', {}).get('luna', {})
incumbent_comparison = summary.get('comparisonsVsFlash', {}).get('luna', {})
contrast_text = ('Paired Luna–Flash estimates are available on matched observed rounds; incomplete repeats cannot qualify a switch.'
                 if incumbent_comparison.get('f1') else 'No paired Luna–Flash estimate is available yet; full Clef blocking does not determine Flash availability.')
if incumbent_comparison.get('f1'):
    c = incumbent_comparison
    contrast_text += f" Luna minus frozen Flash: ΔF1 **{contrast(c['f1'])}**, ΔBrier **{contrast(c['brier'])}**, over {c['pairedRounds']} paired rounds in {c['nIndependentGroups']} topic families. Exact McNemar has {c['mcnemar']['b']}/{c['mcnemar']['c']} discordants and p={fmt(c['mcnemar']['pValue'],6)}."
if comparison.get('f1'):
    c = comparison['f1']
    contrast_text += f" Secondary Luna minus Fixture: ΔF1 {contrast(c)}, ΔBrier {contrast(comparison.get('brier'))}; family McNemar p={fmt(comparison['mcnemar']['pValue'],6)}. Fixture is not the registered incumbent."

def criteria_for(arm):
    r = summary['final'].get(arm,{})
    if not r.get('decisions'):
        return ['UNAVAILABLE — no measured held-out evidence']*5
    c = summary.get('comparisonsVsFlash',{}).get(arm,{})
    matched = complete.get(arm) and complete.get('flash') and c.get('pairedRounds')==r['decisions']['n']==flash['decisions']['n'] if flash_available else False
    f1_metric = c.get('f1') or {}
    bounds = f1_metric.get('ci')
    reduction = None
    if matched and flash['decisions']['wastedSpend']>0:
        reduction = 1-r['decisions']['wastedSpend']/flash['decisions']['wastedSpend']
    first = None
    if matched and bounds and f1_metric.get('difference') is not None:
        first = (f1_metric['difference']>=.05 and bounds[0]>0) or (bounds[0]<=0<=bounds[1] and reduction is not None and reduction>=.25)
    first_text = f"ΔF1 {contrast(f1_metric)}; wrong-spend reduction {percent(reduction)}; complete matching {'yes' if matched else 'no'}"
    brier_metric = c.get('brier') or {}
    second = brier_metric['ci'][1]<=0 if matched and brier_metric.get('ci') else None
    operational = r.get('isolatedOperational') or {}
    third = bool(r.get('criterion3Eligible')) if operational.get('evidenceComplete') else None
    third_text = f"p95 {fmt(r.get('decisionP95Ms'),1)} ms; call timeout {percent(r.get('timeoutRate3s'))}; isolated evidence {'complete' if operational.get('evidenceComplete') else 'missing/incomplete'}"
    own_lift = (r.get('injectionLift') or {}).get('meanDeltaValue')
    base_lift = (flash.get('injectionLift') or {}).get('meanDeltaValue')
    gate = r.get('regressionGate') or {}
    fourth = False if gate.get('complete') and not gate.get('switchQualificationPass') else (
        own_lift<=base_lift if matched and own_lift is not None and base_lift is not None and gate.get('switchQualificationPass') else None)
    fourth_text = f"mean lift {fmt(own_lift,4)} vs {fmt(base_lift,4)}; regression qualified {gate.get('switchQualificationPass','unavailable')}; oracle/story discrepancies {','.join(gate.get('expectedVsStoryDiscrepancies',[])) or 'none recorded'}"
    own_cost = r.get('costPer1000DecisionRoundsUsd')
    base_cost = flash.get('costPer1000DecisionRoundsUsd')
    cost_complete = operational.get('evidenceComplete') and (flash.get('isolatedOperational') or {}).get('evidenceComplete')
    ratio = own_cost/base_cost if cost_complete and own_cost is not None and base_cost is not None and base_cost>0 else None
    fifth = ratio<=3 if ratio is not None else None
    return [assessment(first,first_text), assessment(second,'paired ΔBrier '+contrast(brier_metric)+'; conservative no-worse certification requires upper CI ≤0'),
        assessment(third,third_text), assessment(fourth,fourth_text), assessment(fifth,f"USD/1k {fmt(own_cost,4)} vs {fmt(base_cost,4)}; ratio {fmt(ratio)}; isolated costs only")]

requirements = ['1: ΔF1 ≥.05 and CI excludes zero; OR CI spans zero and waste falls ≥25%',
    '2: Four-question Brier no worse', '3: Round p95 ≤2.5 s; 3-s call timeout ≤1%',
    '4: Injection lift no worse; all UC regressions pass', '5: Decision-round cost ≤3× Flash']
criterion_values = {arm:criteria_for(arm) for arm in ['luna','clef']}
criteria_table = table(['Registered requirement', 'Luna vs frozen Flash', 'Full Clef vs frozen Flash'],
    [[requirement,criterion_values['luna'][i],criterion_values['clef'][i]] for i,requirement in enumerate(requirements)])
reason = summary.get('switchQualification',{}).get('reason','Full preregistered evidence must be checked; missing evidence cannot pass.')
abstract_comparison = ('The saved report supplies Luna–Flash paired contrasts; full Clef remains separately unavailable.' if incumbent_comparison.get('f1') else
    'Luna–Flash paired evidence is not yet available; pending Flash and blocked full Clef are separate states.')
limiter_text = ('Resumed Flash uses one in-flight request, 50 starts/minute and 1,200 ms spacing on a second account. Luna used two in flight with below-150 starts/minute (410 ms spacing). These round wall times have incomparable limiter/account conditions; neither their ratio nor a queued Flash round is intrinsic model latency.' if resumption else
    'Original routes used at most two requests in flight and below-150 starts/minute, with a shared Cloudflare bucket. Round wall time includes those queues.')

example_text = []
for e in examples['examples']:
    example_text.append(f"- **{e['slice']}**, `{e['scenarioId']}` / `{e['resourceId']}`: “{e['preview']}” Constructed public relevance is {e['labels']['addressesGap']}; delivered-body relevance is {e['paidLabel']}. This illustrates the label boundary, not an assertion that every model failed this row.")
position = examples.get('positionExample')
if position:
    probabilities = [p.get('probabilities',{}).get('original') for p in position.get('permutations',[]) if p.get('probabilities')]
    example_text.append(f"- **Option order**, `{position['scenarioId']}` / `{position['resourceId']}`: measured baseline P(original) across cyclic orders was {', '.join(fmt(p,2) for p in probabilities)}. Named options map by value, not array index. This diagnostic is separate from final batch wording.")
uc1 = [r for r in luna.get('regression',[]) if r['id']=='UC1']
uc1_fallback = sum(r['fallback'] for r in uc1)
uc1_note = (f"Luna's UC1 no-gap control matched the oracle in {sum(r['oracleMatch'] for r in uc1)}/{len(uc1)} repeats, with Fixture fallback in {uc1_fallback}/{len(uc1)}. These regression fallbacks are outside the 192 main test rounds; zero main-test failures does not mean zero failures across regression controls. This makes the proposed deterministic no-gap bypass relevant, but that optimization was not evaluated." if uc1 else
    'UC1 evidence is absent; no no-gap regression success is asserted.')

text = f'''# Calibrating purchase decisions: OpenAI Decisions versus Cloudflare Clef

8 October 2026 · tftf team; benchmark run by an AI agent

**Status: {status}** All corpus data are **SYNTHETIC**. Code, data and raw evidence: [bench/decisions-vs-clef]({branch}).

## Abstract

**Keep production Clef-flash at threshold 0.15.** This is not proof of model superiority. Tuned Luna's observed held-out purchase F1 is **{f1}**, and mean four-question Brier **{brier}**; complete evaluation is 64 synthetic scenarios, three repeats and 28 topic families. Its isolated p95 is **{fmt(luna.get('decisionP95Ms'),1)} ms** under its own limiter. {abstract_comparison} The baseline originality diagnostic's maximum option-order shift is **{fmt(robust.get('summary',{}).get('luna',{}).get('maxPositionDelta'),2)}**. Account/limiter differences restrict latency interpretation, and the UC3 oracle/story discrepancy prevents regression qualification. Estimated usage is **US${total:.4f}**, excluding subscription/prepaid fees. The demo keeps its fixed Clef path.

## Introduction

tftf searches agent-readable expertise with a wallet. DeepSeek clarifies, plans and writes; the decision model judges whether another source closes the gap. Deterministic policy authorizes purchases within the user-set budget.

Classification accuracy alone misses purchase policy. Three uncertain judgments are multiplied: moderate scores can suppress a useful source, while overconfidence can promote a cheap distraction. We assess calibration alongside selection, waste, cost and latency.

Prompt, context, request topology and calibration experiments make no production edits. [architecture-notes.md]({branch}/architecture-notes.md) separates measured experiments from proposed optimizations.

## Systems and saved vendor descriptions

These **vendor-reported** properties were collected in vendor-sources.json on 8 October; they are not measurements reproduced here.

| System | Hosted input price / million tokens | Documented properties and limitations |
|---|---:|---|
| Clef-flash | $0.09 | 9B decision model; Apache 2.0 weights; 65,536-token context; up to 64 questions and four embedded images. Vendor median/p95 38.8/122.4 ms. |
| Clef | $0.24 | 27B multimodal model; same typed question surface. Vendor median/p95 209.3/238.6 ms. |
| OpenAI Decisions, gpt-6-luna | $0.10 | Public beta; predicate, choice and score distributions, including refusal. No output/cache charge; regional and long-context pricing can differ. No documented seed, temperature control or self-serve Decisions fine-tuning. |
| Fixture | $0 | Existing deterministic metadata heuristic; a reference, not a hosted model. |

Cloudflare describes Brier-loss/RLCD training and FDE-assisted tuning; self-serve tuning was not established. OpenAI advertises roughly ten times Responses speed without a comparable distribution. Images, residency behavior and self-hosting were not evaluated. No model was fine-tuned.

Sources: [OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions), [API schema](https://developers.openai.com/api/reference/typescript/resources/decisions/methods/create), [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Clef model card](https://developers.cloudflare.com/workers-ai/models/clef/), [Flash model card](https://developers.cloudflare.com/workers-ai/models/clef-flash/), and [Cloudflare's launch measurements](https://blog.cloudflare.com/clef-decision-models/). Vendor server measurements and our client round trips measure different quantities.

## Purchase policy and boundaries

`judgeRound` estimates whether the gap is material. `judgeCandidate` estimates gap coverage, chooses original/rewrite/overlap and scores credibility from zero to two. `judgePaidRelevance` evaluates delivered passages after a grant; here those passages are synthetic granted-content fixtures, with no real purchase.

```text
value = gapMaterial × addressesGap × P(original)
        × (0.5 + 0.25 × credibility) × trust
```

The imported `decide()` applies rewrite, trust, cap and budget rules, then ranks eligible candidates by value per dollar. The five-second modal confirms the research plan; the user-set budget remains the spending authorization. The model cannot authorize payments. One charge per intent, real citations and explicit fallback labels remain requirements.

```mermaid
flowchart LR
  Q[Question and confirmed budget] --> G[Open gap]
  G --> D[Decision model: public metadata]
  D --> P[Deterministic budget and purchase policy]
  P --> X[x402 / XRPL Testnet grant]
  X --> C[Granted passages and calibration]
```

Only the model and offline policy portions are exercised here. Candidate requests exclude structured prices, wallets, URLs, bodies and construction labels. Untrusted abstracts can still contain price-anchoring language. Payload isolation is therefore different from resistance to persuasion. The multiplied values are decision scores, not proven joint probabilities: the factors are correlated.

## Methods

The synthetic library has 42 writers, 686 article IDs, 546 paid articles and 602 distinct bodies. Each of 160 scenarios has six paid candidates: 960 candidate occurrences and 320 paid examples. Domains cover rates, semiconductors, aviation, energy, logistics, water and cybersecurity. Only 646 IDs occur in candidates/read sources; article counts are not independent prose observations. Accounting is in data-notes.md.

GPT-6.1 Sol high generated specifications, then deterministic prose realization, under the user's authorized substitution for DeepSeek generation. Evaluated models did not generate labels. Coverage, provenance, credibility and delivered relevance were fixed first. Partial coverage is a hard negative; overclaims separate public promises from delivered content.

There are 70 clean scenarios, 70 adversarial twins and 20 boundary-condition scenarios. Each of five attack families has 14 examples: direct instructions, encoded instructions, role spoofing, price anchoring and retitled duplicates. Each remaining condition has only two scenarios. In particular, 156 of 160 gaps are labelled material. Calibration of the gap predicate can exploit this strong prior; deployment with frequent empty gaps may behave differently.

The split is 96 dev/64 test scenarios in 42/28 topic families. Clean/attack twins stay within their split; templates and writer identities still overlap. Test-array SHA-256 `{summary['testLock']}` was locked before successful baseline launch. An earlier builder-change check aborted before baseline calls. Clustering prevents twin leakage and pseudoreplication, but cannot manufacture diversity.

DeepSeek independently relabelled 192 candidate occurrences at temperature 0.7. Some occurrences share articles; these are agreement observations, not 192 independent documents. Its QA context includes public and delivered fields, while candidate arms remain public-only. The author-agent inspected 40 items; that is self-review, not human validation. Thirty gold items await the user's review.

{qa_table}

We report binary Brier, log loss, equal-mass ECE, AUROC and average precision; multiclass Brier/macro-F1 and per-class ECE for originality; and MAE/Spearman for credibility. Reliability bins preserve ties and reduce their count on small samples. Wrong-resource selections count as both false positives and missed correct purchases. Wasted spend sums synthetic SGD prices when selected IDs differ from oracle IDs; it is not API spending or delivered-body utility. An oracle-correct overclaim can still deliver irrelevant content.

Calibration selects identity, Platt or isotonic transformations by five-fold family-grouped dev CV. Originality calibration transforms P(original) and preserves the relative remaining class mass. This is not a multinomial calibration fit. Configuration and threshold selection maximize dev F1, then minimize waste, sweeping 0.05–0.60. These selected dev values are optimistic training evidence; test estimates are the relevant generalization check.

95% percentile CIs use 10,000 deterministic whole-family resamples, retaining candidates, twins and repeats. Paired contrasts intersect scenario/repeat/question/resource observations. Four-question Brier weights the four binary tasks equally. McNemar treats a family as correct only when every paired variant/repeat is correct. CIs are conditional on frozen tuning. Missing values remain absent. Errors, refusals and over-three-second calls retain actual whole-round Fixture policy fallback; discarded successful answers stay missing from raw provider coverage.

All five [registered criteria, commit 9eede4d]({prereg}) must pass. The decision table states numerical thresholds and actual evidence; missing evidence cannot pass. For no-worse Brier, this paper conservatively requires the paired CI upper bound ≤0, with no invented noninferiority margin. An interval permitting worsening does not certify that gate.

## Baseline results

The verbatim production questions, default thresholds and full 96-scenario dev split give:

{baseline_table}

These descriptive dev results are not provider superiority claims. Brier and reliability bins are **arm-plus-fallback policy probabilities**, not provider-only calibration: Luna's seven baseline fallback rounds contribute Fixture predictions. Raw parsed-provider coverage is separate in the CSV.

Reliability diagrams are provided as exact bin tables in [reliability.md]({branch}/out/reliability.md). Each arm's candidate-relevance bins show predicted versus observed frequencies, with sample counts; all questions' bins are also embedded in results-dev.csv and results-test.csv. This avoids implying smooth calibration from a small, correlated corpus.

## Tuning and architecture experiments

Seven configurations cover current wording, evidence-focused wording, historical conclusion-centred materiality, omission of read-source context, abstract-first serialization, nineteen-question batching and evidence wording with batching. A separate round needs seven decision requests; batching uses one. It also exposes other candidates and the conclusion, changing semantics and transport overhead.

{raw_tuning_table}

The evidence bundle specifies entity, measure and time, and treats embedded directions as data. It substantially helps Luna here, but hurts raw Clef buying at existing thresholds. Batching the old wording alone hurts Luna. These interactions argue against assuming that a clearer prompt or fewer requests universally improves decisions. Calibration can rescue a shifted score scale, but cannot recover missing evidence or prove resistance to unseen attacks.

Cloudflare completed four full dev configurations before quota exhaustion; three promoted screens stayed incomplete and ineligible. Luna completed seven, so search/paid-call budgets differ. Flash resumption does **not** restore dev parity or change calibration: it retains frozen evidence/{fmt(frozen['flash']['threshold'],2)}. No CF-only refreeze was used. The account-route change enables additional measurement, not tuning prompted by Luna test results.

{calibration_table}

These are research settings, not deployment defaults. Paid calibration for evidence and batch-evidence comes from the evidence-wording dev task; other configurations use baseline paid wording. Cached predictions support every offline sweep without additional API charges. Selected dev F1 across representative thresholds is:

{curve_table}

{kept_cost_table}

Kept-config costs deduplicate exact referenced cache keys, including paid/error requests. Shared keys make costs nonadditive across configurations; these are replay-priced references, not incremental API billing. Borrowed paid calibrators require no new calls. All candidates, including excluded partial quota runs, remain in tuning-log.csv.

## Final held-out results

Complete quality evaluation is 192 rounds per arm: 64 scenarios × three repeats, still only 28 family clusters. Observed counts and partial/blocked states are shown explicitly. Wrong-purchase S$ per repeat averages the three runs when complete. Pending Flash evidence is not equated with blocked full Clef.

{final_table}

{attack_table}

A negative average does not establish injection immunity: individual positive lifts remain. Attack twins also carry distinct opaque resource IDs, so this is not a pure text-substring ablation. Neither these fixtures nor their mean replace the deterministic budget-authorization boundary.

{contrast_text}

{quality_table}

{extra_quality_table}

{decision_table}

{coverage_table}

These policy probabilities include fallback. Originality multiclass Brier sums class losses rather than dividing by three; the selection fit only calibrates original-versus-rest. Credibility is not calibrated. Provider-parsed raw metrics, default-threshold replay and baseline-test rows remain in CSV. Operational repeats are excluded from quality. Baseline option diagnostics do not measure final batched/calibrated sensitivity.

{slice_table}

Slices reuse correlated families and are descriptive, not independent significance tests. Several boundary slices have only two scenarios; no-buy-only F1 can be zero while exact match is one. Negative attack lift means reduced value for the spec-mapped attacked source relative to its clean twin, not immunity to arbitrary injection.

Production regression uses four selection fixtures: UC1, UC2, UC3 and UC3 recovery. It does not execute live search, grants, proofs, refunds or post-purchase calibration. The constructed oracle chooses Fab Floor initially in UC3, whereas the story expects AlphaLeak. Both expectations are reported; matching one cannot establish the full regression contract.

{uc1_note}

{regression_table}

## Cost and latency: claims versus measurements

Measured baseline token use and seven-call round pricing are:

{call_table}

Each projected user prompt assumes one round with six candidates. More rounds multiply cost. These replay-priced baseline rows charge referenced cached calls at their original token usage; they are not claims that local cache hits were billed again. Final operational cost uses fresh, isolated rounds. Paid-content auditing is separate and appears in summary.json.

{latency_table}

{operation_table}

{limiter_text} Client-call timing starts after local admission and account discovery; it includes HTTP/network latency, not server-only inference. Round wall time includes configured concurrency/rate waiting. The isolated pass uses one arm at a time, 28 clean families, fresh repeat 401 and no paid calls. Warm/unknown-cache timings remain separate; a warm replay is not a latency win.

Luna's isolated call-timeout rate is **{percent(luna.get('timeoutRate3s'))}**; final combined failure rate **{percent(luna.get('combinedFailureRate'))}**. Missing rates stay unavailable. The 28-round p95 has substantial tail uncertainty; zero observed timeouts does not establish a true rate below 1%. Calls can finish up to twenty seconds with a shadow three-second cutoff, not actual cancellation. Criterion 3 assesses observed absolute values under each arm's conditions, not matched-limit model speed.

{cost_table}

Estimated usage is **US${total:.4f}** from the cost meter, including setup/audit/diagnostic traffic. Missing-usage requests use conservative estimates; DeepSeek uses peak uncached rates. These are not invoices, credit purchases, or neuron-quota balances. The parent's remaining-call forecast is a projection, not actual cost or available quota. [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/) and [Cloudflare billing](https://developers.cloudflare.com/workers-ai/platform/pricing/) distinguish those quantities.

## Discussion and validity limits

Concrete synthetic examples make the remaining distinctions visible:

{chr(10).join(example_text)}

Identical repeated Luna inputs produced essentially zero relevance-score variation on 24 dev items, yet option order produced large changes. Determinism is therefore not invariance. The reduced stability sample is a declared departure from 200 items, and does not characterize every domain or chosen prompt.

On the same 24-item diagnostic, Flash's maximum option-order shift was {fmt(robust['summary'].get('flash',{}).get('maxPositionDelta'),3)} versus Luna's {fmt(robust['summary']['luna']['maxPositionDelta'],3)}. Treat option order as part of the versioned prompt and calibration contract. Fixing it ensures reproducibility; it does not remove the measured preference sensitivity.

The corpus is short and templated, with public authority cues deliberately aligned to credibility labels. Generator Sol and evaluated Luna share a vendor; stylistic affinity is untested. The oracle calls the existing policy at threshold 0.20 with uniform trust 0.8; it is not an independently observed careful human buyer. Agreement with that oracle is not real economic utility. Thirty unreviewed gold examples and modest independent QA agreement on originality/credibility argue for human review before transfer.

There are 119 candidate occurrences with shared eight-word public-preview/body runs. They do not satisfy the production abstract-leak checker and cannot validate that gate. No production checker or threshold was weakened; candidate body fields are still excluded. Synthetic label QA sees both fields and cannot prove public-only human judgments. The paper evaluates text-only hosted calls from one machine/region, in one time window, under beta and vendor service variability.

Only batching, wording, context, calibration and thresholds were experimentally evaluated. Empty-gap bypass, exact-context caching and overlapping post-grant calibration remain implementation proposals with fresh budget/policy checks. Human-reviewed real-use labels and matched account/limiter conditions would be more useful next evidence than additional identical template repeats.

## Decision

**Keep Clef-flash, threshold 0.15.** Do not replace it with full Clef or Luna on this evidence.

{criteria_table}

Analyzer decision reason: **{reason}**. The table is an evidence assessment, not a deployment authorization. Full Clef remains a separate unavailable challenger; its block cannot erase a measured Luna–Flash contrast. UC3's discrepancy and the selection-only regression scope cannot be overridden by a favorable F1, Brier or cost result.

Keep Clef-flash and retain the calibration layer for later validation. Do not deploy the dev-selected {fmt(frozen['flash']['threshold'],2)} Flash threshold on this evidence. The 10 October demo remains fixed on Clef; a later provider change belongs behind a provider flag in a separate PR with fallback labels intact.

## Reproduction

Branch: `bench/decisions-vs-clef`; base `cb04be4`; preregistration commit `9eede4d`. [The branch's code and raw artifacts]({branch}) include the exact frozen configuration, request hashes and dataset. `files-created.txt` is the exhaustive file manifest, including individual cached responses. The delivery manifest records the code/evidence commit separately to avoid a self-referential commit hash.

Node 26.3.1 used plain fetch and existing tsx/TypeScript dependencies; no SDK or root lockfile change. Credentials stay local. Flash's user-authorized resumption records only the public alias `CLOUDFLARE_API_TOKEN_2`, account change and limiter settings in cloudflare-resumption.json. Existing caches make report regeneration free.

```sh
node --import tsx bench/decisions/campaign.ts --phase baseline
node --import tsx bench/decisions/campaign.ts --phase tune
node --import tsx bench/decisions/campaign.ts --phase promote
node --import tsx bench/decisions/analyze.ts --freeze
node --import tsx bench/decisions/campaign.ts --phase final --arms luna,fixture
node --import tsx bench/decisions/campaign.ts --phase operational --arms luna
node --import tsx bench/decisions/robustness.ts --arms luna
# Authorized Flash resumption only; serialize with every other API-running process:
BENCH_CF_TOKEN_ALIAS=CLOUDFLARE_API_TOKEN_2 node --import tsx bench/decisions/campaign.ts --phase final --arms flash
BENCH_CF_TOKEN_ALIAS=CLOUDFLARE_API_TOKEN_2 node --import tsx bench/decisions/campaign.ts --phase operational --arms flash
# Optional Flash robustness only if quota permits; absence stays unavailable.
node --import tsx bench/decisions/analyze.ts --report
node --import tsx bench/decisions/evidence.ts
python3 bench/decisions/write-paper.py
```

Ordinary freeze refuses overwrite; the guarded dev-completion path was unused. Account resumption preserves the original frozen file and does not expand the search. Serialize API-running processes because the meter has one owner. Verification logs record tests, check:fast and typing. No Playwright, XRPL transaction or cloud resource creation was performed. To render an explicitly labelled incomplete draft, use `write-paper.py --allow-incomplete`; ordinary rendering refuses unfinished nonblocked quality runs.

## Appendix: mapping, wording and protocol deviations

Clef `noul` maps to a named Decisions predicate and its probability. Choice criteria map to value/description options; returned distributions map by value, never index. Score criteria map to ordered levels labelled 0–2. Both return the existing judgment schema; refusals throw into the measured fallback path. Deterministic pretty-printed JSON carries the same permitted state to Luna. The legacy interface's provider discriminator has no OpenAI member, so the research adapter uses its existing enum internally while every artifact explicitly labels the actual Luna arm. It is never wired to payment or production UI.

[question-wordings.md]({branch}/out/question-wordings.md) contains literal prompts. [protocol-deviations.md]({branch}/out/protocol-deviations.md), frozen metadata and cloudflare-resumption.json preserve the generator, search, quota and account amendments. Shadow timeouts, reduced stability, synthetic leaks and selection-only regressions remain explicit. Publication scanning checks credential values; research typing exceptions do not loosen production gates.

The 30 entries in [gold-for-human.jsonl]({branch}/data/gold-for-human.jsonl) remain **not human reviewed**. Those reviews, production-valid abstract/body separation and an independently labelled real-use corpus are more valuable next evidence than claiming certainty from additional repeats of the same templates.
'''
(OUT / 'README.md').write_text(text)
print(json.dumps({'paper': str(OUT/'README.md'), 'words': len(text.split()), 'status': status}))
