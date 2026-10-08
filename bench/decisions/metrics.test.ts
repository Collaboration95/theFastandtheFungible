import test from 'node:test';
import assert from 'node:assert/strict';
import {
  binaryMetrics, bootstrapIndexes, decisionMetrics, mcnemar, multiclassMetrics,
  pairedBootstrap, percentile, scoreMetrics,
} from './metrics.ts';
import { applyCalibration, chooseCalibration, fitCalibration } from './calibration.ts';
import type { CalibrationItem, CalibrationMethod } from './calibration.ts';
import { csv, familyGroups, normalizeOriginality, recalibrateOriginality, evaluateRows, comparisons,
  freeze, refreezeCloudflare, report, enrichTuningLog, resolvePaidCall, reconstructBaselineCacheHits, roundTiming, latencyRows,
  regressionComparisons, requestReliability, providerQualityCoverage, hasSemanticRefusal, selfBootstrap } from './analyze.ts';
import { exampleCandidate } from '../../shared/contracts/examples.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

function close(actual: number | null, expected: number, tolerance = 1e-10): void {
  assert.ok(actual !== null && Math.abs(actual - expected) <= tolerance,
    `Expected ${expected}, received ${actual}`);
}

test('perfect and inverted predicates have known loss and discrimination', () => {
  const perfect = binaryMetrics([0, 0, 1, 1], [0, 0, 1, 1]);
  close(perfect.brier, 0); close(perfect.logLoss, 0); close(perfect.ece, 0);
  close(perfect.auroc, 1); close(perfect.auprc, 1);
  const inverted = binaryMetrics([0, 0, 1, 1], [1, 1, 0, 0]);
  close(inverted.brier, 1); close(inverted.ece, 1); close(inverted.auroc, 0);
  close(inverted.auprc, 0.5);
  assert.ok(inverted.logLoss! > 30 && Number.isFinite(inverted.logLoss));
});

test('AUROC gives half credit to ties; AP thresholds treat ties as a block', () => {
  const ties = binaryMetrics([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5]);
  close(ties.auroc, 0.5); close(ties.auprc, 0.5); close(ties.brier, 0.25);
  assert.deepEqual(ties.bins, [{ n: 4, predicted: 0.5, observed: 0.5 }]);
  const mixed = binaryMetrics([1, 0, 1, 0], [0.9, 0.8, 0.8, 0.2]);
  close(mixed.auroc, 0.875); close(mixed.auprc, 5 / 6);
});

test('hard one-class and empty predicate statistics are explicitly undefined', () => {
  assert.equal(binaryMetrics([1, 1], [0.7, 0.9]).auroc, null);
  close(binaryMetrics([1, 1], [0.7, 0.9]).auprc, 1);
  assert.equal(binaryMetrics([0, 0], [0.1, 0.2]).auprc, null);
  assert.deepEqual(binaryMetrics([], []), {
    n: 0, brier: null, logLoss: null, ece: null, auroc: null, auprc: null, bins: [],
  });
});

test('soft labels contribute to losses, but cannot become discrimination classes', () => {
  const result = binaryMetrics([0, 0.5, 1], [0.1, 1, 0.9]);
  close(result.brier, 0.09); close(result.auroc, 1); close(result.auprc, 1);
  assert.equal(result.n, 3);
  const soft = binaryMetrics([0.25, 0.5, 0.75], [0.25, 0.5, 0.75]);
  close(soft.brier, 0); close(soft.ece, 0);
  assert.equal(soft.auroc, null); assert.equal(soft.auprc, null);
  close(binaryMetrics([0.5], [0.5]).logLoss, Math.LN2);
});

test('reliability bins reduce count for small n, conserve rows and balance untied mass', () => {
  const result = binaryMetrics([0, 0, 0, 0, 1, 1, 1, 1],
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
  assert.deepEqual(result.bins.map((bin) => bin.n), [3, 3, 2]);
  close(result.ece, result.bins.reduce((sum, bin) =>
    sum + bin.n / result.n * Math.abs(bin.predicted - bin.observed), 0));
  const p = Array.from({ length: 300 }, (_, i) => i / 300);
  const large = binaryMetrics(p.map((v) => Number(v > 0.5)), p);
  assert.equal(large.bins.length, 15);
  assert.ok(large.bins.every((bin) => bin.n === 20));
});

test('multiclass Brier is the sum over classes, with macro F1 and deterministic ties', () => {
  const perfect = multiclassMetrics(['original', 'rewrite'],
    [{ original: 1, rewrite: 0 }, { original: 0, rewrite: 1 }]);
  close(perfect.brier, 0); close(perfect.macroF1, 1);
  assert.deepEqual(perfect.perClassEce, { original: 0, rewrite: 0 });
  const inverted = multiclassMetrics(['a', 'b'], [{ a: 0, b: 1 }, { a: 1, b: 0 }]);
  close(inverted.brier, 2); close(inverted.macroF1, 0);
  const tied = multiclassMetrics(['a', 'b'], [{ b: 0.5, a: 0.5 }, { a: 0.5, b: 0.5 }]);
  close(tied.brier, 0.5); close(tied.macroF1, 1 / 3);
  const absent = multiclassMetrics(['a'], [{ a: 1, b: 0 }]);
  close(absent.macroF1, 0.5);
  assert.deepEqual(multiclassMetrics([], []), { brier: null, macroF1: null, perClassEce: {} });
  close(multiclassMetrics(['b'], [{ a: 1 }]).brier, 2);
});

test('Spearman uses average ranks for ties and is null for constant vectors', () => {
  close(scoreMetrics([0, 1, 2], [0, 1, 2]).spearman, 1);
  close(scoreMetrics([0, 1, 2], [2, 1, 0]).spearman, -1);
  close(scoreMetrics([1, 1, 2, 3], [1, 2, 2, 3]).spearman, 5 / 6);
  close(scoreMetrics([0, 1, 2], [0.5, 1, 1.5]).mae, 1 / 3);
  assert.equal(scoreMetrics([1, 1], [0, 1]).spearman, null);
  assert.deepEqual(scoreMetrics([], []), { mae: null, spearman: null });
});

test('a wrong resource is both a false positive and a false negative', () => {
  const result = decisionMetrics([
    { expected: 'a', selected: 'a', priceMinor: 90 },
    { expected: 'b', selected: 'c', priceMinor: 25 },
    { expected: 'd', selected: null, priceMinor: 60 },
    { expected: null, selected: 'e', priceMinor: 10 },
    { expected: null, selected: null, priceMinor: 0 },
  ]);
  assert.deepEqual(result, { n: 5, precision: 1 / 3, recall: 1 / 3, f1: 1 / 3,
    wastedSpend: 35, missedValue: 2, exactMatch: 0.4 });
  const skipped = decisionMetrics([{ expected: null, selected: null, priceMinor: 0 }]);
  assert.equal(skipped.f1, 0); assert.equal(skipped.exactMatch, 1);
  assert.equal(decisionMetrics([]).exactMatch, null);
});

test('percentile interpolates, handles endpoints, and leaves its input unchanged', () => {
  const values = [30, 0, 20, 10];
  close(percentile(values, 0.25), 7.5); close(percentile(values, 0), 0);
  close(percentile(values, 1), 30); close(percentile([7], 0.37), 7);
  assert.deepEqual(values, [30, 0, 20, 10]); assert.equal(percentile([], 0.5), null);
});

test('bootstrap draws preserve all repeats/candidates within each sampled scenario', () => {
  const groups = ['a', 'a', 'b', 'b', 'b', 'c'];
  const samples = [...bootstrapIndexes(groups.length, 30, 123, groups)];
  assert.deepEqual(samples, [...bootstrapIndexes(groups.length, 30, 123, groups)]);
  assert.notDeepEqual(samples, [...bootstrapIndexes(groups.length, 30, 124, groups)]);
  for (const sample of samples) {
    const multiplicity = Array.from({ length: groups.length }, (_, i) => sample.filter((j) => j === i).length);
    assert.equal(multiplicity[0], multiplicity[1]);
    assert.equal(multiplicity[2], multiplicity[3]); assert.equal(multiplicity[3], multiplicity[4]);
    assert.equal(multiplicity[0] + multiplicity[2] + multiplicity[5], 3);
  }
  assert.ok(samples.some((sample) => sample.length !== groups.length));
  // Numeric and string IDs do not accidentally merge into a single cluster.
  assert.ok([...bootstrapIndexes(2, 30, 1, [1, '1'])].some((sample) => sample[0] === sample[1]));
});

test('paired bootstrap is reproducible and preserves pairing and effect direction', () => {
  const a = [1, 2, 3, 4], b = [0, 1, 2, 3];
  const metric = (rows: number[]) => rows.length ? rows.reduce((sum, v) => sum + v, 0) / rows.length : null;
  const result = pairedBootstrap(a, b, metric, 500, 42, ['a', 'a', 'b', 'b']);
  assert.deepEqual(result, pairedBootstrap(a, b, metric, 500, 42, ['a', 'a', 'b', 'b']));
  close(result.difference, 1); assert.deepEqual(result.ci, [1, 1]);
  assert.equal(result.validIterations, 500);
  assert.deepEqual(result.ciA, [1.5, 3.5]); assert.deepEqual(result.ciB, [0.5, 2.5]);
});

test('Brier CIs cluster scenarios rather than pretending repeats are independent', () => {
  const a = Array.from({ length: 20 }, (_, i) => ({ y: 0, p: i < 10 ? 0 : 1 }));
  const b = a.map((row) => ({ ...row, p: 0.5 }));
  const metric = (rows: typeof a) => binaryMetrics(rows.map((r) => r.y), rows.map((r) => r.p)).brier;
  const clustered = pairedBootstrap(a, b, metric, 1000, 3, a.map((_, i) => i < 10 ? 'a' : 'b'));
  assert.deepEqual(clustered.ciA, [0, 1]); assert.deepEqual(clustered.ci, [-0.25, 0.75]);
  const independent = pairedBootstrap(a, b, metric, 1000, 3);
  assert.ok(independent.ciA![1] - independent.ciA![0] < 1);
});

test('paired bootstrap reports undefined resamples instead of substituting zero', () => {
  const result = pairedBootstrap([0, 1], [0, 1], (rows) => binaryMetrics(rows, rows).auroc, 1000, 9);
  assert.ok(result.validIterations > 0 && result.validIterations < 1000);
  assert.deepEqual(result.ci, [0, 0]);
  const empty = pairedBootstrap([], [], () => null, 10);
  assert.equal(empty.difference, null); assert.equal(empty.ci, null); assert.equal(empty.validIterations, 0);
});

test('paired bootstrap supports decision F1 without detaching scenario rows', () => {
  const a = [{ expected: 'a', selected: 'a', priceMinor: 10 },
    { expected: 'b', selected: 'b', priceMinor: 20 }];
  const b = a.map((row) => ({ ...row, selected: null }));
  const result = pairedBootstrap<{ expected: string; selected: string | null; priceMinor: number }>(
    a, b, (rows) => decisionMetrics(rows).f1, 200, 7, ['a', 'b']);
  close(result.difference, 1); assert.deepEqual(result.ci, [1, 1]);
});

test('exact McNemar matches hand-computed binomial tails and ignores concordant rows', () => {
  const a = [true, true, true, true, true, false, true, false];
  const b = [false, false, false, false, false, true, true, false];
  const result = mcnemar(a, b);
  assert.deepEqual({ ...result, pValue: 0 }, { b: 5, c: 1, discordants: 6, pValue: 0, n: 8 });
  close(result.pValue, 0.21875);
  close(mcnemar([true, true, true, true, true], [false, false, false, false, false]).pValue, 0.0625);
  assert.equal(mcnemar([true, false], [true, false]).pValue, 1);
  close(mcnemar(b, a).pValue, mcnemar(a, b).pValue);
});

test('exact McNemar remains stable when the first binomial term underflows', () => {
  const a = [...Array<boolean>(1000).fill(true), ...Array<boolean>(1000).fill(false)];
  const b = a.map((v) => !v);
  close(mcnemar(a, b).pValue, 1);
  const unequalA = [...Array<boolean>(1040).fill(true), ...Array<boolean>(960).fill(false)];
  const p = mcnemar(unequalA, unequalA.map((v) => !v)).pValue;
  assert.ok(p > 0.07 && p < 0.09, `Large-n tail should be about 0.077, got ${p}`);
});

test('identity and serialized calibration models preserve prediction behavior', () => {
  const points = [{ p: 0.1, y: 0 }, { p: 0.9, y: 1 }];
  for (const method of ['identity', 'platt', 'isotonic'] as CalibrationMethod[]) {
    const model = fitCalibration(points, method);
    const restored = JSON.parse(JSON.stringify(model));
    for (const p of [0, 0.1, 0.5, 0.9, 1]) {
      assert.equal(applyCalibration(model, p), applyCalibration(restored, p));
      assert.ok(applyCalibration(model, p) >= 0 && applyCalibration(model, p) <= 1);
    }
  }
  assert.deepEqual(fitCalibration([], 'identity'), { method: 'identity' });
  close(applyCalibration(fitCalibration(points, 'identity'), 0.2), 0.2);
});

test('Platt handles inverted scores, separability, soft targets and constant targets', () => {
  const inverted = [{ p: 0.1, y: 1 }, { p: 0.9, y: 0 }];
  const model = fitCalibration(inverted, 'platt');
  assert.equal(model.method, 'platt');
  if (model.method === 'platt') assert.ok(model.a < 0);
  assert.ok(applyCalibration(model, 0.1) > 0.99);
  assert.ok(applyCalibration(model, 0.9) < 0.01);
  const soft = fitCalibration([{ p: 0.5, y: 0.25 }, { p: 0.5, y: 0.75 }], 'platt');
  close(applyCalibration(soft, 0.5), 0.5);
  for (const target of [0, 0.3, 1]) {
    const constant = fitCalibration([{ p: 0, y: target }, { p: 1, y: target }], 'platt');
    close(applyCalibration(constant, 0.4), Math.max(1e-6, Math.min(1 - 1e-6, target)));
  }
});

test('isotonic PAV pools violations and gives duplicate probabilities their true weight', () => {
  const model = fitCalibration([
    { p: 0.1, y: 0 }, { p: 0.2, y: 1 }, { p: 0.2, y: 1 },
    { p: 0.3, y: 0 }, { p: 0.9, y: 1 },
  ], 'isotonic');
  close(applyCalibration(model, 0.2), 2 / 3); close(applyCalibration(model, 0.3), 2 / 3);
  close(applyCalibration(model, 0), 0); close(applyCalibration(model, 1), 1);
  close(applyCalibration(model, 0.6), 5 / 6);
  const predictions = Array.from({ length: 101 }, (_, i) => applyCalibration(model, i / 100));
  assert.ok(predictions.every((p, i) => i === 0 || p >= predictions[i - 1]));
  const inverted = fitCalibration([{ p: 0, y: 1 }, { p: 1, y: 0 }], 'isotonic');
  close(applyCalibration(inverted, 0.8), 0.5);
});

test('deterministic CV keeps all scenario candidates/repeats isolated from training', () => {
  const points: CalibrationItem[] = Array.from({ length: 30 }, (_, i) => ({
    p: i % 2 ? 0.8 : 0.2, y: i % 2, scenarioId: `scenario-${Math.floor(i / 3)}`, split: 'dev',
  }));
  const selection = chooseCalibration(points, 8);
  assert.deepEqual(selection, chooseCalibration(points, 8));
  assert.equal(selection.foldCount, 5); assert.equal(selection.nGroups, 10);
  const covered: number[] = [];
  for (const fold of selection.folds) {
    const trainGroups = new Set(fold.trainIndexes.map((i) => points[i].scenarioId));
    assert.ok(fold.testIndexes.every((i) => !trainGroups.has(points[i].scenarioId)));
    assert.equal(fold.trainIndexes.length + fold.testIndexes.length, points.length);
    covered.push(...fold.testIndexes);
  }
  assert.deepEqual(covered.sort((a, b) => a - b), points.map((_, i) => i));
});

test('CV selects calibration from held-out predictions and refits the model on dev', () => {
  const points: CalibrationItem[] = Array.from({ length: 40 }, (_, i) => ({
    p: i % 2 ? 0.2 : 0.8, y: i % 2, group: `g-${i}`, split: 'dev',
  }));
  const selection = chooseCalibration(points, 8);
  assert.equal(selection.method, 'platt');
  assert.ok(selection.cvBrier.platt! < selection.cvBrier.identity!);
  assert.deepEqual(selection.model, fitCalibration(points, selection.method));
  // Perfect predictions cannot be improved; exact or near ties retain identity.
  const perfect = points.map((point) => ({ ...point, p: point.y }));
  assert.equal(chooseCalibration(perfect).method, 'identity');
});

test('CV degrades explicitly for small group counts and rejects held-out test data', () => {
  const oneGroup = chooseCalibration([{ p: 0.9, y: 0, group: 'one' }, { p: 0.1, y: 1, group: 'one' }]);
  assert.equal(oneGroup.method, 'identity'); assert.equal(oneGroup.foldCount, 0);
  assert.deepEqual(oneGroup.cvBrier, { identity: null, platt: null, isotonic: null });
  assert.equal(chooseCalibration([]).nGroups, 0);
  assert.equal(chooseCalibration([{ p: 0.1, y: 0 }, { p: 0.9, y: 1 }]).foldCount, 2);
  assert.throws(() => chooseCalibration([{ p: 0.5, y: 1, split: 'test' }]), /dev only/);
  assert.throws(() => chooseCalibration([{ p: 0.5, y: 1, group: 'a', scenarioId: 'b' }]), /Conflicting/);
});

test('invalid inputs fail rather than silently clamp or normalize benchmark data', () => {
  assert.throws(() => binaryMetrics([0], []), /length/);
  assert.throws(() => binaryMetrics([0.5], [1.1]), /\[0, 1\]/);
  assert.throws(() => binaryMetrics([NaN], [0.5]), /finite/);
  assert.throws(() => scoreMetrics([0], [Infinity]), /finite/);
  assert.throws(() => multiclassMetrics(['a'], [{ a: 0.7, b: 0.4 }]), /sum to 1/);
  assert.throws(() => decisionMetrics([{ expected: null, selected: 'a', priceMinor: -1 }]), /priceMinor/);
  assert.throws(() => percentile([1], 25), /\[0, 1\]/);
  assert.throws(() => percentile([Infinity], 0.5), /finite/);
  assert.throws(() => [...bootstrapIndexes(3, 10, 1, ['a'])], /Group count/);
  assert.throws(() => [...bootstrapIndexes(3, 0)], /iterations/);
  assert.throws(() => pairedBootstrap([1], [], () => 1), /equal length/);
  assert.throws(() => pairedBootstrap([1], [2], () => NaN), /finite/);
  assert.throws(() => mcnemar([true], []), /length/);
  assert.throws(() => fitCalibration([], 'platt'), /training/);
  assert.throws(() => fitCalibration([{ p: 2, y: 1 }], 'identity'), /\[0, 1\]/);
  assert.throws(() => applyCalibration({ method: 'isotonic', knots: [0.5, 0.4], values: [0, 1] }, 0.2), /monotone/);
});

test('analyzer normalizes only disclosed rounding tolerance and preserves other class ratios', () => {
  const raw = { original: 0.6, rewrite: 0.3, overlap: 0.0999 };
  const normalized = normalizeOriginality(raw);
  close(normalized.original + normalized.rewrite + normalized.overlap, 1);
  close(normalized.original, 0.6 / 0.9999);
  assert.deepEqual(raw, { original: 0.6, rewrite: 0.3, overlap: 0.0999 });
  assert.throws(() => normalizeOriginality({ original: 0.6, rewrite: 0.3, overlap: 0.05 }), /tolerance/);
  const transformed = recalibrateOriginality(raw, { method: 'platt', a: 0, b: 0 });
  close(transformed.original, 0.5);
  close(transformed.rewrite / transformed.overlap, raw.rewrite / raw.overlap);
  close(Object.values(transformed).reduce((sum, p) => sum + p, 0), 1);
  assert.deepEqual(recalibrateOriginality({ original: 1, rewrite: 0, overlap: 0 },
    { method: 'platt', a: 0, b: 0 }), { original: 0.5, rewrite: 0.25, overlap: 0.25 });
});

test('topic-family mappings retain clean/adversarial twins and detect ambiguous assignments', () => {
  const groups = familyGroups([{ familyId: 'f1', scenarioIds: ['clean', 'attack', 'zero-budget'] },
    { familyId: 'f2', scenarioIds: ['other'] }]);
  assert.equal(groups.get('clean'), groups.get('attack'));
  assert.notEqual(groups.get('clean'), groups.get('other'));
  assert.throws(() => familyGroups([{ familyId: 'f1', scenarioIds: ['s'] },
    { familyId: 'f2', scenarioIds: ['s'] }]), /multiple/);
});

test('report CSV quotes nested data, commas, quotes and newlines, and leaves missing estimates empty', () => {
  assert.equal(csv([{ arm: 'luna', message: 'a,"b"\nc', missing: null }, { arm: 'clef', extra: [1, 2] }]),
    'arm,message,missing,extra\nluna,"a,""b""\nc",,\nclef,,,"[1,2]"\n');
});

test('offline analyzer applies frozen calibration/threshold and retains actual failed-round fallback', async () => {
  const candidate = { ...exampleCandidate, resourceId: 'bench-test-resource', family: 'bench-test-family',
    tier: 'PAID' as const, title: 'Coverage demand', preview: 'Coverage demand measurements',
    price: { amountMinor: 10, currency: 'SGD' as const } };
  const scenario = { id: 'bench-test-scenario', group: 'topic-family', split: 'dev', domain: 'test', slice: 'clean',
    question: 'Does coverage demand suffice?', conclusion: '', gap: 'coverage demand', gapLabel: 1,
    candidates: [{ candidate, body: 'Synthetic coverage demand measurements.', paidLabel: 1,
      labels: { addressesGap: 1, originality: 'original', credibility: 2 } }],
    readSources: [], expectedResourceId: candidate.resourceId, paidResourceIds: [candidate.resourceId],
    budgetMinor: 100, perSourceCapMinor: 100 };
  const row = { id: scenario.id, split: 'dev', domain: 'test', slice: 'clean', arm: 'flash' as const,
    config: 'baseline', repeat: 0, gap: 0.9,
    judgments: [{ addressesGap: 1, originality: { original: 0.9, rewrite: 0.03, overlap: 0.07 }, credibility: 2 }],
    paid: [{ resourceId: candidate.resourceId, label: 1, p: 0.8 }], calls: [],
    decisionElapsedMs: 1, networkLowerBoundMs: 0, failed: false, fallback: false,
    selected: candidate.resourceId, priceMinor: 10, expected: candidate.resourceId };
  const models = { gap: { method: 'platt' as const, a: 0, b: Math.log(0.01 / 0.99) },
    addressesGap: { method: 'identity' as const }, original: { method: 'identity' as const },
    paid: { method: 'identity' as const } };
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (() => { networkCalls++; throw new Error('Analyzer must stay offline'); }) as typeof fetch;
  try {
    const [normal] = await evaluateRows([row], new Map([[scenario.id, scenario]]), '/private/tmp/unused-analysis-test-output', models, 0.15);
    assert.equal(normal.raw.selected, candidate.resourceId);
    assert.equal(normal.calibrated.selected, null);
    const failedRow = { ...row, gap: 0, judgments: [], failed: true, fallback: true };
    const [failed] = await evaluateRows([failedRow], new Map([[scenario.id, scenario]]), '/private/tmp/unused-analysis-test-output', models, 0.15);
    assert.equal(failed.calibrated.selected, candidate.resourceId);
    assert.equal(failed.fallback, true);
    assert.equal(failed.predictionsCalibrated.find((p) => p.question === 'gap')?.p, 0.9);
    assert.equal(failed.predictionsCalibrated.some((p) => p.question === 'paid'), false);
    assert.equal(failed.unresolvedPaidCalls, 1);
    assert.equal(failed.providerRaw.find((p) => p.question === 'paid')?.source, 'provider');
    assert.equal(failed.providerRaw.some((p) => p.question === 'gap'), false);
    const measuredCall = { key: 'shared-request', arm: 'flash', kind: 'candidate', latencyMs: 250,
      timeout3s: false, status: 200, inputTokens: 100, usd: 0.001, estimatedUsage: false };
    const latency = latencyRows([
      { ...normal, calls: [measuredCall, measuredCall], run: { ...normal.run, decisionCacheHits: 0 } },
      { ...normal, calls: [measuredCall], run: { ...normal.run, decisionCacheHits: 1 } },
    ], 'isolated');
    assert.equal(latency.find((r) => r.kind === 'candidate')?.n, 1);
    assert.equal(latency.find((r) => r.kind === 'candidate')?.p95, 250);
    assert.equal(latency.find((r) => r.kind === 'round-wall-including-limiter')?.n, 1);
    assert.equal(latency.find((r) => r.kind === 'round-wall-cache-warm')?.n, 1);
    assert.equal(latency.find((r) => r.kind === 'max-call-lower-bound')?.n, 1);
    const [highThreshold] = await evaluateRows([failedRow], new Map([[scenario.id, scenario]]), '/private/tmp/unused-analysis-test-output', models, 0.9);
    assert.equal(highThreshold.calibrated.selected, null);
    // Family-clustered contrasts cannot turn two related scenarios into two McNemar trials.
    const normalTwin = { ...normal, run: { ...normal.run, id: 'twin' } };
    const failedTwin = { ...failed, run: { ...failed.run, id: 'twin' } };
    const contrast = comparisons([normal, normalTwin], [failed, failedTwin]);
    assert.equal(contrast.mcnemar?.n, 1);
    close(contrast.f1?.difference ?? null, -1);
    assert.deepEqual(contrast.f1?.ci, [-1, -1]);
    assert.equal(networkCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('legacy paid-call matching follows granted bodies rather than completion order', () => {
  const call = (key: string, body: string, timeout3s: boolean, openai = false) => ({
    key, arm: openai ? 'luna' : 'flash', kind: 'paid', latencyMs: timeout3s ? 4000 : 100,
    timeout3s, status: 200, inputTokens: 100, usd: 0.001, estimatedUsage: false,
    request: openai ? { input: JSON.stringify({ passages: [body] }) } : { state: { passages: [body] } },
  });
  const slow = call('slow', 'slow candidate body', true);
  const fast = call('fast', 'fast candidate body', false);
  const completionOrder = [fast, slow];
  assert.equal(resolvePaidCall({}, 'slow candidate body', completionOrder)?.timeout3s, true);
  assert.equal(resolvePaidCall({}, 'fast candidate body', completionOrder)?.timeout3s, false);
  const lunaSlow = call('luna-slow', 'slow candidate body', true, true);
  const lunaFast = call('luna-fast', 'fast candidate body', false, true);
  assert.equal(resolvePaidCall({}, 'slow candidate body', [lunaFast, lunaSlow])?.key, 'luna-slow');
  assert.equal(resolvePaidCall({ requestKey: 'fast' }, 'slow candidate body', completionOrder)?.key, 'fast');
  assert.throws(() => resolvePaidCall({ requestKey: 'missing' }, 'body', completionOrder), /absent/);
  assert.equal(resolvePaidCall({}, 'unknown body', completionOrder), null);
  assert.equal(resolvePaidCall({}, 'slow candidate body', [slow, { ...slow, key: 'another' }]), null);
  assert.equal(resolvePaidCall({}, 'slow candidate body', [slow, slow])?.key, 'slow');
  assert.equal(resolvePaidCall({}, 'slow candidate body', [{ ...slow, request: { input: 'invalid JSON' } }]), null);
});

test('offline replay excludes the correct timed-out paid item for reordered Clef and Luna calls', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tftf-paid-order-test-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('Paid-order replay must stay offline'); }) as typeof fetch;
  try {
    fs.mkdirSync(path.join(root, 'cache'));
    const primary = { ...exampleCandidate, resourceId: 'slow-paid', tier: 'PAID' as const,
      price: { amountMinor: 10, currency: 'SGD' as const }, family: 'slow-family' };
    const secondary = { ...primary, resourceId: 'fast-paid', family: 'fast-family' };
    const scenario = { id: 'paid-order', group: 'paid-order-family', split: 'dev', domain: 'test', slice: 'clean',
      question: 'Coverage demand?', conclusion: '', gap: 'coverage demand', gapLabel: 1,
      candidates: [{ candidate: primary, body: 'slow granted text', paidLabel: 1,
        labels: { addressesGap: 1, originality: 'original', credibility: 2 } },
      { candidate: secondary, body: 'fast granted text', paidLabel: 0,
        labels: { addressesGap: 0, originality: 'rewrite', credibility: 1 } }],
      readSources: [], expectedResourceId: primary.resourceId, paidResourceIds: [primary.resourceId, secondary.resourceId],
      budgetMinor: 100, perSourceCapMinor: 100 };
    const models = { gap: { method: 'identity' as const }, addressesGap: { method: 'identity' as const },
      original: { method: 'identity' as const }, paid: { method: 'identity' as const } };
    for (const arm of ['flash', 'luna'] as const) {
      const records = scenario.candidates.map((c, i) => ({ key: createHash('sha256').update(`${arm}:${c.body}`).digest('hex'),
        arm, kind: 'paid', latencyMs: i === 0 ? 4000 : 100, timeout3s: i === 0,
        status: 200, inputTokens: 100, usd: 0.001, estimatedUsage: false,
        request: arm === 'luna' ? { input: JSON.stringify({ passages: [c.body] }) } : { state: { passages: [c.body] } } }));
      for (const record of records) fs.writeFileSync(path.join(root, 'cache', `${record.key}.json`), JSON.stringify(record));
      const row = { id: scenario.id, split: 'dev', domain: 'test', slice: 'clean', arm, config: 'baseline', repeat: 0,
        gap: 0.9, judgments: [{ addressesGap: 1, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 2 },
          { addressesGap: 0, originality: { original: 0, rewrite: 1, overlap: 0 }, credibility: 1 }],
        paid: [{ resourceId: primary.resourceId, label: 1, p: 0.8 }, { resourceId: secondary.resourceId, label: 0, p: 0.2 }],
        calls: [records[1].key, records[0].key], failed: false, fallback: false,
        decisionElapsedMs: 100, networkLowerBoundMs: 100, selected: primary.resourceId, priceMinor: 10, expected: primary.resourceId };
      const [legacy] = await evaluateRows([row], new Map([[scenario.id, scenario]]), root, models, 0.2);
      const paid = legacy.predictionsRaw.filter((p) => p.question === 'paid');
      assert.equal(paid.length, 1); assert.ok(paid[0].key.endsWith(secondary.resourceId)); close(paid[0].p, 0.2);
      assert.equal(legacy.unresolvedPaidCalls, 0);
      assert.equal(legacy.providerRaw.filter((p) => p.question === 'paid').length, 2);
      const keyed = { ...row, paid: row.paid.map((p, i) => ({ ...p, requestKey: records[i].key })) };
      const [direct] = await evaluateRows([keyed], new Map([[scenario.id, scenario]]), root, models, 0.2);
      assert.deepEqual(direct.predictionsRaw, legacy.predictionsRaw);
    }
  } finally { globalThis.fetch = originalFetch; fs.rmSync(root, { recursive: true, force: true }); }
});

test('baseline cache reconstruction seeds smoke and walks original order including paid keys', () => {
  const kinds = new Map([['smoke', 'candidate'], ['round', 'round'], ['candidate', 'candidate'], ['paid', 'paid'], ['fresh', 'batch']]);
  const rows = [
    { id: 'first', calls: ['smoke', 'round', 'candidate', 'paid'] },
    { id: 'second', calls: ['round', 'candidate', 'paid'] },
    { id: 'third', calls: ['fresh'] },
    { id: 'explicit', calls: ['fresh'], decisionCacheHits: 0 },
  ];
  const result = reconstructBaselineCacheHits(rows, kinds, ['smoke']);
  assert.deepEqual(result.map((r) => r.decisionCacheHits), [1, 2, 0, 0]);
  assert.deepEqual(result.map((r) => r.decisionCacheHitProvenance),
    ['baseline-key-history', 'baseline-key-history', 'baseline-key-history', 'runner']);
  assert.equal('decisionCacheHits' in rows[0], false);
  assert.throws(() => reconstructBaselineCacheHits([{ calls: ['unknown'] }], kinds), /Missing call kind/);
});

test('operational wall-time excludes cache-warm and unknown rows and preserves reconstruction provenance', () => {
  const result = roundTiming([
    { decisionCacheHits: 0, decisionElapsedMs: 200 },
    { decisionCacheHits: 0, decisionElapsedMs: 100, decisionCacheHitProvenance: 'baseline-key-history' },
    { decisionCacheHits: 2, decisionElapsedMs: 1 },
    { decisionElapsedMs: 0.01 },
  ]);
  assert.equal(result.cold.n, 2); close(result.cold.p95, 195);
  assert.equal(result.warm.n, 1); close(result.warm.p95, 1);
  assert.equal(result.legacy.n, 1); close(result.legacy.p95, 0.01);
  assert.equal(result.reconstructedRows, 1);
  assert.equal(roundTiming([{ decisionElapsedMs: 1 }]).cold.p95, null);
  assert.throws(() => roundTiming([{ decisionCacheHits: -1, decisionElapsedMs: 1 }]), /Invalid/);
});

test('regression story/oracle discrepancy cannot become a false switch pass', () => {
  const scope = [{ id: 'UC3', oracleSelected: 'fab-floor', storyBibleExpected: 'alphaleak' }];
  const oracleRows = [1, 2, 3].map((repeat) => ({ id: 'UC3', repeat, expected: 'fab-floor',
    selected: 'fab-floor', priceMinor: 25, fallback: false }));
  const oracle = regressionComparisons(oracleRows, scope);
  assert.equal(oracle.complete, true); assert.equal(oracle.oracleAllMatch, true);
  assert.equal(oracle.storyAllMatch, false); assert.equal(oracle.switchQualificationPass, false);
  assert.deepEqual(oracle.expectedVsStoryDiscrepancies, ['UC3']);
  assert.ok(oracle.rows.every((r) => r.oracleMatch && !r.storyMatch && !r.pass));
  const story = regressionComparisons(oracleRows.map((r) => ({ ...r, selected: 'alphaleak' })), scope);
  assert.equal(story.storyAllMatch, true); assert.equal(story.oracleAllMatch, false);
  assert.equal(story.switchQualificationPass, false);
  const unknown = regressionComparisons(oracleRows, []);
  assert.equal(unknown.storyAllMatch, null); assert.equal(unknown.switchQualificationPass, false);
  assert.throws(() => regressionComparisons(oracleRows, [{ ...scope[0], oracleSelected: null }]), /scope\/oracle/);
});

test('unique-request reliability counts HTTP-200 refusals separately and unions overlapping failures', () => {
  const valid = { key: 'valid', arm: 'luna', kind: 'round', status: 200, latencyMs: 100,
    timeout3s: false, inputTokens: 100, usd: 0.001, estimatedUsage: false };
  const refusal = { ...valid, key: 'refusal', response: { answers: [{ type: 'refusal', name: 'gap_material' }] } };
  const refusedAndLate = { ...refusal, key: 'refusal-late', timeout3s: true };
  const http = { ...valid, key: 'http-error-without-error-field', status: 503 };
  const transport = { ...valid, key: 'transport', status: 0, error: 'AbortError' };
  const result = requestReliability([valid, refusal, refusal, refusedAndLate, http, transport]);
  assert.equal(result.n, 5);
  assert.equal(result.semanticRefusalCount, 2); close(result.semanticRefusalRate, 0.4);
  assert.equal(result.httpOrTransportErrorCount, 2); close(result.httpOrTransportErrorRate, 0.4);
  assert.equal(result.timeoutCount3s, 1); close(result.timeoutRate3s, 0.2);
  assert.equal(result.combinedFailureCount, 4); close(result.combinedFailureRate, 0.8);
  close(result.errorRate, 0.8);
  assert.equal(hasSemanticRefusal(refusal), true);
  assert.equal(hasSemanticRefusal(valid), false);
  assert.equal(requestReliability([]).combinedFailureRate, null);
});

test('refused gaps have no raw probability and whole-round fallback does not recover dropped candidate judgments', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tftf-refusal-test-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('Refusal analysis must stay offline'); }) as typeof fetch;
  try {
    fs.mkdirSync(path.join(root, 'cache'));
    const candidate = { ...exampleCandidate, resourceId: 'refusal-paid-resource', family: 'refusal-paid-family',
      title: 'Coverage demand', preview: 'Coverage demand measurements', tier: 'PAID' as const,
      price: { amountMinor: 10, currency: 'SGD' as const } };
    const scenario = { id: 'refusal-a', group: 'refusal-family', split: 'dev', domain: 'test', slice: 'clean',
      question: 'Coverage demand?', conclusion: '', gap: 'coverage demand', gapLabel: 1,
      candidates: [{ candidate, body: 'Synthetic granted coverage demand.', paidLabel: 1,
        labels: { addressesGap: 1, originality: 'original', credibility: 2 } }],
      readSources: [], expectedResourceId: candidate.resourceId, paidResourceIds: [], budgetMinor: 100, perSourceCapMinor: 100 };
    const scenarios = [scenario, { ...scenario, id: 'refusal-b' }, { ...scenario, id: 'http-error' }];
    const key = (name: string) => createHash('sha256').update(name).digest('hex');
    const base = { arm: 'luna', status: 200, latencyMs: 100, timeout3s: false, inputTokens: 100, usd: 0.001, estimatedUsage: false };
    const refused = { ...base, key: key('refused-round'), kind: 'round',
      response: { answers: [{ name: 'gap_material', type: 'refusal' }] } };
    const httpError = { ...base, key: key('http-error-round'), kind: 'round', status: 503 };
    const goodCandidate = { ...base, key: key('good-candidate'), kind: 'candidate',
      response: { answers: [{ name: 'addresses_gap', type: 'predicate', probability: 1 }] } };
    for (const call of [refused, httpError, goodCandidate]) fs.writeFileSync(path.join(root, 'cache', `${call.key}.json`), JSON.stringify(call));
    const rows = scenarios.map((s, i) => ({ id: s.id, split: 'dev', domain: 'test', slice: 'clean', arm: 'luna' as const,
      config: 'baseline', repeat: 0, gap: 0, judgments: [], paid: [],
      calls: [i === 2 ? httpError.key : refused.key, goodCandidate.key], decisionCacheHits: i === 0 ? 0 : 1,
      decisionElapsedMs: 100, networkLowerBoundMs: 100, failed: true, fallback: true,
      selected: candidate.resourceId, priceMinor: 10, expected: candidate.resourceId }));
    const models = { gap: { method: 'identity' as const }, addressesGap: { method: 'identity' as const },
      original: { method: 'identity' as const }, paid: { method: 'identity' as const } };
    const evaluated = await evaluateRows(rows, new Map(scenarios.map((s) => [s.id, s])), root, models, 0.2);
    assert.equal(decisionMetrics(evaluated.map((r) => r.calibrated)).n, 3);
    assert.ok(evaluated.every((r) => r.fallback && r.calibrated.selected === candidate.resourceId));
    assert.ok(evaluated.every((r) => r.providerRaw.length === 0));
    const coverage = providerQualityCoverage(evaluated);
    assert.equal(coverage.refusalAffectedRounds, 2);
    assert.equal(coverage.expectedCandidateJudgments, 3);
    assert.equal(coverage.availableCandidateJudgments, 0);
    assert.equal(coverage.discardedCandidateSlotsOnWholeRoundFallback, 3);
    const requests = requestReliability(evaluated.flatMap((r) => r.calls));
    assert.equal(requests.n, 3); assert.equal(requests.semanticRefusalCount, 1);
    assert.equal(requests.httpOrTransportErrorCount, 1); assert.equal(requests.combinedFailureCount, 2);
    const roundStats = latencyRows(evaluated, 'refusal-test').find((r) => r.kind === 'round');
    assert.equal(roundStats?.n, 2); assert.equal(roundStats?.semanticRefusalRate, 0.5);
    assert.equal(roundStats?.combinedFailureRate, 1);
  } finally { globalThis.fetch = originalFetch; fs.rmSync(root, { recursive: true, force: true }); }
});

test('isolated offline freeze/report generates verified artifacts and refuses held-out tuning', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tftf-analysis-test-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('Pipeline analysis must make no network calls'); }) as typeof fetch;
  try {
    fs.mkdirSync(path.join(root, 'data'));
    fs.mkdirSync(path.join(root, 'out', 'runs'), { recursive: true });
    const candidate = { ...exampleCandidate, resourceId: 'isolated-resource', family: 'isolated-article',
      title: 'Coverage demand', preview: 'Coverage demand measurements', tier: 'PAID' as const,
      price: { amountMinor: 10, currency: 'SGD' as const } };
    const makeScenario = (id: string, split: string) => ({ id, split, domain: 'test', slice: 'clean',
      question: 'Coverage demand?', conclusion: '', gap: 'coverage demand', gapLabel: 1,
      candidates: [{ candidate, body: 'Synthetic coverage demand.', paidLabel: 1,
        labels: { addressesGap: 1, originality: 'original', credibility: 2 } }],
      readSources: [], expectedResourceId: candidate.resourceId, paidResourceIds: [candidate.resourceId],
      budgetMinor: 100, perSourceCapMinor: 100 });
    const dev = [makeScenario('dev-a', 'dev'), makeScenario('dev-b', 'dev')];
    const heldOut = [makeScenario('test-a', 'test'), makeScenario('test-b', 'test')];
    const specs = [...dev, ...heldOut].map((s) => ({ familyId: `family-${s.id}`, scenarioIds: [s.id],
      cleanScenarioId: s.id, split: s.split }));
    const jsonl = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    fs.writeFileSync(path.join(root, 'data', 'scenarios.jsonl'), jsonl([...dev, ...heldOut]));
    fs.writeFileSync(path.join(root, 'data', 'scenario-specs.jsonl'), jsonl(specs));
    fs.writeFileSync(path.join(root, 'out', 'test-lock.txt'), createHash('sha256').update(JSON.stringify(heldOut)).digest('hex'));
    const makeRow = (scenario: typeof dev[number], arm: 'flash' | 'fixture', config: string, repeat: number) => ({
      id: scenario.id, split: scenario.split, domain: scenario.domain, slice: scenario.slice, arm, config, repeat,
      gap: 0.9, judgments: [{ addressesGap: 1, originality: { original: 0.9, rewrite: 0.03, overlap: 0.07 }, credibility: 2 }],
      paid: [{ resourceId: candidate.resourceId, label: 1, p: 0.8 }], calls: [], decisionElapsedMs: 1,
      networkLowerBoundMs: 0, failed: false, fallback: false, selected: candidate.resourceId,
      priceMinor: 10, expected: candidate.resourceId,
    });
    const runFile = (name: string, rows: unknown[]) => fs.writeFileSync(path.join(root, 'out', 'runs', `${name}.jsonl`), jsonl(rows));
    runFile('baseline-baseline-flash-0', dev.map((s) => makeRow(s, 'flash', 'baseline', 0)));
    runFile('baseline-baseline-fixture-0', dev.map((s) => makeRow(s, 'fixture', 'baseline', 0)));
    await assert.rejects(report(root), /before reading held-out/);
    await assert.rejects(freeze(root), /Incomplete flash:evidence/);
    assert.equal(fs.existsSync(path.join(root, 'out', 'frozen-config.json')), false);
    for (const config of ['evidence', 'batch', 'batch-evidence'])
      runFile(`tune-${config}-flash-0`, dev.map((s) => makeRow(s, 'flash', config, 0)));
    await assert.rejects(freeze(root), /Incomplete flash:historical/);
    for (const config of ['historical', 'no-read'])
      runFile(`tune-${config}-flash-0`, dev.map((s) => makeRow(s, 'flash', config, 0)));
    runFile('tune-abstract-first-flash-0', [makeRow(dev[0], 'flash', 'abstract-first', 0)]);
    await assert.rejects(freeze(root), /Incomplete flash:abstract-first/);
    assert.equal(fs.existsSync(path.join(root, 'out', 'frozen-config.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'out', 'tuning-log.csv')), false);
    runFile('tune-abstract-first-flash-0', dev.map((s) => makeRow(s, 'flash', 'abstract-first', 0)));
    fs.mkdirSync(path.join(root, 'out', 'cache'));
    // Different paid distributions reveal any accidental baseline borrowing by batch-evidence.
    for (const config of ['baseline', 'evidence']) {
      const rows = dev.map((s) => {
        const key = createHash('sha256').update(`dev-paid:${config}:${s.id}`).digest('hex');
        fs.writeFileSync(path.join(root, 'out', 'cache', `${key}.json`), JSON.stringify({ key,
          arm: 'flash', kind: 'paid', status: 200, latencyMs: 1, timeout3s: false,
          inputTokens: 1, usd: 0, estimatedUsage: false }));
        return { ...makeRow(s, 'flash', config, 0), calls: [key],
          paid: [{ resourceId: candidate.resourceId, label: 1, p: config === 'evidence' ? 0.2 : 0.8, requestKey: key }] };
      });
      runFile(`${config === 'baseline' ? 'baseline' : 'tune'}-${config}-flash-0`, rows);
    }
    for (const config of ['batch', 'batch-evidence', 'historical', 'no-read', 'abstract-first'])
      runFile(`tune-${config}-flash-0`, dev.map((s) => ({ ...makeRow(s, 'flash', config, 0), paid: [] })));
    // Invalid held-out JSON must be invisible to the dev-only freeze.
    runFile('test-baseline-baseline-flash-0', []);
    fs.writeFileSync(path.join(root, 'out', 'runs', 'test-baseline-baseline-flash-0.jsonl'), 'invalid held-out sentinel');
    const frozen = await freeze(root);
    assert.equal(frozen.flash?.config, 'baseline');
    assert.ok(frozen.metadata.notes.some((note) => note.includes('pre-held-out dev-only amendment')));
    assert.equal(frozen.metadata.excludedConfigurations.length, 0);
    const tuningLog = fs.readFileSync(path.join(root, 'out', 'tuning-log.csv'), 'utf8');
    assert.equal(tuningLog.split('\n').filter((line) => line.startsWith('flash,') && line.includes('eligible-full-dev')).length, 7);
    const analysis = JSON.parse(fs.readFileSync(path.join(root, 'out', 'analysis-dev.json'), 'utf8'));
    for (const config of ['baseline', 'evidence', 'batch', 'batch-evidence', 'historical', 'no-read', 'abstract-first']) {
      const paid = analysis.tuningLog.find((row: Record<string, unknown>) => row.arm === 'flash' && row.config === config && row.question === 'paid');
      const source = config === 'evidence' || config === 'batch-evidence' ? 'evidence' : 'baseline';
      assert.equal(paid.paidSource, source, config);
      assert.equal(paid.n, 2, config);
      close(paid.cvIdentity, source === 'evidence' ? 0.64 : 0.04);
      assert.equal(analysis.tuningLog.find((row: Record<string, unknown>) => row.arm === 'flash' && row.config === config && row.status === 'eligible-full-dev').paidCalibrationSource, source);
    }
    close(frozen.flash?.threshold ?? null, 0.05);
    for (const file of ['frozen-config.json', 'tuning-log.csv', 'threshold-curves.csv', 'results-dev.csv', 'analysis-dev.json'])
      assert.ok(fs.existsSync(path.join(root, 'out', file)), file);
    await assert.rejects(freeze(root), /refusing to retune/);
    for (const arm of ['flash', 'fixture'] as const) {
      runFile(`test-baseline-baseline-${arm}-0`, heldOut.map((s) => makeRow(s, arm, 'baseline', 0)));
      for (const repeat of [1, 2, 3])
        runFile(`final-baseline-${arm}-${repeat}`, heldOut.map((s) => makeRow(s, arm, 'baseline', repeat)));
    }
    const operational = heldOut.map((s, i) => {
      const calls = ['round', 'candidate'].map((kind) => ({ key: createHash('sha256').update(`${s.id}:${kind}:401`).digest('hex'),
        arm: 'flash', kind, status: 200, latencyMs: 100, timeout3s: false, inputTokens: 100, usd: 0.001, estimatedUsage: false }));
      for (const call of calls) fs.writeFileSync(path.join(root, 'out', 'cache', `${call.key}.json`), JSON.stringify(call));
      // Operational selections deliberately differ; they must not enter main quality estimates.
      return { ...makeRow(s, 'flash', 'baseline', 401), gap: 0, selected: null, priceMinor: 0,
        paid: [], calls: calls.map((c) => c.key), decisionCacheHits: 0, decisionElapsedMs: 2200 + i * 200 };
    });
    runFile('operational-baseline-flash-401', operational);
    await report(root);
    const summary = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.equal(summary.status, 'measured-final-runs-complete');
    assert.equal(summary.final.flash.decisions.n, 6);
    assert.equal(summary.final.flash.decisions.f1, 1);
    close(summary.final.flash.costPer1000DecisionRoundsUsd, 2);
    close(summary.final.flash.decisionP95Ms, 2390);
    assert.equal(summary.final.flash.decisionP95Source, 'isolated-operational-repeat-401');
    assert.equal(summary.final.flash.criterion3Eligible, true);
    assert.equal(summary.isolatedOperational.flash.observedRounds, 2);
    assert.equal(summary.isolatedOperational.flash.independentFamilies, 2);
    assert.equal(summary.final.flash.concurrentFinalDecisionP95Ms, null); // Legacy cache status cannot establish concurrent timing.
    assert.equal(summary.final.fixture.costPer1000DecisionRoundsUsd, 0);
    assert.equal(summary.comparisonsVsFlash.fixture.f1.iterations, 10000);
    assert.equal(summary.comparisonsVsFlash.fixture.nIndependentGroups, 2);
    assert.equal(summary.baselineComparisonsVsFlash.fixture.pairedRounds, 2);
    for (const file of ['results-test.csv', 'latency.csv']) assert.ok(fs.existsSync(path.join(root, 'out', file)));
    assert.ok(fs.readFileSync(path.join(root, 'out', 'latency.csv'), 'utf8').includes('isolated-operational'));
    assert.equal(summary.comparisonsVsFlash.fixture.pairedRounds, 6); // Operational repeat 401 never entered paired quality CIs.
    runFile('operational-baseline-flash-401', operational.map((r, i) => ({ ...r, decisionCacheHits: i === 0 ? 0 : 1 })));
    await report(root);
    const warmed = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.equal(warmed.final.flash.criterion3Eligible, false);
    assert.equal(warmed.isolatedOperational.flash.evidenceComplete, false);
    assert.equal(warmed.isolatedOperational.flash.timing.warm.n, 1);
    assert.equal(warmed.final.flash.decisions.n, 6);
    assert.equal(warmed.final.flash.decisions.f1, 1);
    runFile('operational-baseline-flash-401', operational.map((r) => ({ ...r,
      paid: [{ resourceId: candidate.resourceId, label: 1, p: 0.8 }] })));
    await assert.rejects(report(root), /withPaid=false/);
    runFile('operational-baseline-flash-401', operational);
    fs.writeFileSync(path.join(root, 'out', 'test-lock.txt'), 'invalid lock');
    await assert.rejects(report(root), /Test lock mismatch/);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tuning log prices exact unique referenced keys and flags the frozen winner without implying incremental billing', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tftf-tuning-cost-test-'));
  try {
    fs.mkdirSync(path.join(out, 'cache'));
    const shared = createHash('sha256').update('shared request').digest('hex');
    const extra = createHash('sha256').update('extra paid request').digest('hex');
    for (const [key, usd, kind] of [[shared, 0.002, 'candidate'], [extra, 0.003, 'paid']] as const)
      fs.writeFileSync(path.join(out, 'cache', `${key}.json`), JSON.stringify({ key, arm: 'luna', usd, kind }));
    const calibrationRow = { arm: 'luna', config: 'baseline', question: 'paid' };
    const log = enrichTuningLog(out, { luna: { config: 'batch-evidence' } }, [calibrationRow,
      { arm: 'luna', config: 'baseline', status: 'eligible-full-dev' },
      { arm: 'luna', config: 'batch-evidence', status: 'eligible-full-dev' },
      { arm: 'clef', config: 'historical', status: 'quota-blocked-dev-not-eligible' }], [
      { arm: 'luna', config: 'baseline', repeat: 0, calls: [shared, shared] },
      { arm: 'luna', config: 'baseline', repeat: 0, calls: [shared] },
      { arm: 'luna', config: 'batch-evidence', repeat: 0, calls: [shared, extra, shared] },
    ]);
    assert.deepEqual(log[0], calibrationRow);
    assert.equal(log[1].kept, false);
    assert.equal(log[1].uniqueReferencedRequestCount, 1);
    close(log[1].referencedUniqueRequestCostUsd as number, 0.002);
    assert.equal(log[2].kept, true);
    assert.equal(log[2].uniqueReferencedRequestCount, 2);
    close(log[2].referencedUniqueRequestCostUsd as number, 0.005);
    assert.equal(log[3].kept, false);
    assert.equal(log[3].referencedUniqueRequestCostUsd, 0);
    assert.match(String(log[2].requestCostConvention), /Nonadditive.*not incremental API billing/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('documented Cloudflare quota block restricts dev eligibility and reports Luna without invented incumbent evidence', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tftf-quota-test-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('Quota analysis must make no provider requests'); }) as typeof fetch;
  try {
    fs.mkdirSync(path.join(root, 'data'));
    fs.mkdirSync(path.join(root, 'out', 'runs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'out', 'cache'));
    const candidate = { ...exampleCandidate, resourceId: 'quota-resource', family: 'quota-article',
      title: 'Coverage demand', preview: 'Coverage demand measurements', tier: 'PAID' as const,
      price: { amountMinor: 10, currency: 'SGD' as const } };
    const scenario = (id: string, split: string) => ({ id, split, domain: 'test', slice: 'clean',
      question: 'Coverage demand?', conclusion: '', gap: 'coverage demand', gapLabel: 1,
      candidates: [{ candidate, body: 'Synthetic granted content.', paidLabel: 1,
        labels: { addressesGap: 1, originality: 'original', credibility: 2 } }], readSources: [],
      expectedResourceId: candidate.resourceId, paidResourceIds: [candidate.resourceId], budgetMinor: 100, perSourceCapMinor: 100 });
    const dev = [scenario('dev-a', 'dev'), scenario('dev-b', 'dev')];
    const testRows = [scenario('test-a', 'test'), scenario('test-b', 'test')];
    const jsonl = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    const writeRun = (name: string, rows: unknown[]) => fs.writeFileSync(path.join(root, 'out', 'runs', `${name}.jsonl`), jsonl(rows));
    fs.writeFileSync(path.join(root, 'data', 'scenarios.jsonl'), jsonl([...dev, ...testRows]));
    fs.writeFileSync(path.join(root, 'data', 'scenario-specs.jsonl'), jsonl([
      ...dev.map((s) => ({ familyId: `family-${s.id}`, scenarioIds: [s.id], cleanScenarioId: s.id, split: 'dev' })),
      { familyId: 'heldout-twins', scenarioIds: testRows.map((s) => s.id), cleanScenarioId: testRows[0].id, split: 'test' },
    ]));
    fs.writeFileSync(path.join(root, 'out', 'test-lock.txt'), createHash('sha256').update(JSON.stringify(testRows)).digest('hex'));
    fs.writeFileSync(path.join(root, 'out', 'blocked-cloudflare.json'), JSON.stringify({ provider: 'Cloudflare Workers AI',
      at: '2026-10-08T06:17:41.447Z', status: 429, code: 4006, reason: 'Daily free allocation of 10000 neurons exhausted; requires paid upgrade.', action: 'Stopped; no billing upgrade.' }));
    type TestArm = 'flash' | 'clef' | 'luna' | 'fixture';
    const makeRow = (s: typeof dev[number], arm: TestArm, config: string, repeat: number) => {
      const key = createHash('sha256').update(`${arm}:${config}:${s.id}:${repeat}:paid`).digest('hex');
      if (arm !== 'fixture') fs.writeFileSync(path.join(root, 'out', 'cache', `${key}.json`), JSON.stringify({
        key, arm, kind: 'paid', status: 200, latencyMs: 1, timeout3s: false, inputTokens: 1, usd: 0, estimatedUsage: false }));
      return { id: s.id, split: s.split, domain: s.domain, slice: s.slice, arm, config, repeat,
        gap: 0.9, judgments: [{ addressesGap: 1, originality: { original: 0.9, rewrite: 0.03, overlap: 0.07 }, credibility: 2 }],
        paid: [{ resourceId: candidate.resourceId, label: 1, p: 0.8, requestKey: key }], calls: arm === 'fixture' ? [] : [key],
        decisionElapsedMs: 1, networkLowerBoundMs: 0, failed: false, fallback: false,
        selected: candidate.resourceId, priceMinor: 10, expected: candidate.resourceId };
    };
    const firstFour = ['baseline', 'evidence', 'batch', 'batch-evidence'];
    const promoted = ['historical', 'no-read', 'abstract-first'];
    for (const arm of ['flash', 'clef', 'luna', 'fixture'] as const)
      for (const config of arm === 'fixture' ? ['baseline'] : firstFour)
        writeRun(`${config === 'baseline' ? 'baseline' : 'tune'}-${config}-${arm}-0`, dev.map((s) => makeRow(s, arm, config, 0)));
    const { select } = await import('./run.ts');
    for (const arm of ['flash', 'clef'] as const) {
      for (const config of promoted) {
        const row = makeRow(dev[0], arm, config, 0);
        if (config === 'historical') {
          const key = createHash('sha256').update(`${arm}:quota-round`).digest('hex');
          fs.writeFileSync(path.join(root, 'out', 'cache', `${key}.json`), JSON.stringify({ key, arm, kind: 'round',
            status: 429, latencyMs: 1, timeout3s: false, error: 'code 4006 quota', inputTokens: 0, usd: 0, estimatedUsage: false }));
          writeRun(`tune-${config}-${arm}-0`, [{ ...row, gap: 0, judgments: [], paid: [], calls: [key], failed: true,
            ...await select(dev[0], arm, 0, [], arm === 'flash' ? 0.15 : 0.35, true) }]);
        } else writeRun(`tune-${config}-${arm}-0`, [row]);
      }
    }
    for (const config of promoted)
      writeRun(`tune-${config}-luna-0`, (config === 'abstract-first' ? dev.slice(0, 1) : dev).map((s) => makeRow(s, 'luna', config, 0)));
    await assert.rejects(freeze(root), /Incomplete luna:abstract-first/);
    assert.equal(fs.existsSync(path.join(root, 'out', 'frozen-config.json')), false);
    writeRun('tune-abstract-first-luna-0', dev.map((s) => makeRow(s, 'luna', 'abstract-first', 0)));
    const frozen = await freeze(root);
    assert.deepEqual(frozen.metadata.eligibleConfigurationsByArm?.flash, firstFour);
    assert.deepEqual(frozen.metadata.eligibleConfigurationsByArm?.clef, firstFour);
    assert.equal(frozen.metadata.eligibleConfigurationsByArm?.luna?.length, 7);
    assert.equal(frozen.metadata.excludedConfigurations.length, 6);
    const analysis = JSON.parse(fs.readFileSync(path.join(root, 'out', 'analysis-dev.json'), 'utf8'));
    const excluded = analysis.tuningLog.find((r: Record<string, unknown>) => r.arm === 'clef' && r.config === 'historical');
    assert.equal(excluded.status, 'quota-blocked-dev-not-eligible');
    assert.equal(excluded.fallbackRounds, 1);
    assert.equal(excluded.requestReliability.httpOrTransportErrorCount, 1);
    for (const arm of ['luna', 'fixture'] as const)
      for (const repeat of [1, 2, 3])
        writeRun(`final-${frozen[arm]!.config}-${arm}-${repeat}`, testRows.map((s) => makeRow(s, arm, frozen[arm]!.config, repeat)));
    fs.writeFileSync(path.join(root, 'out', 'robustness.json'), JSON.stringify({ summary: {
      luna: { items: 24, meanAddressesGapStd: 0, maxPositionDelta: 0.94, failures: 0 },
    }, note: 'Dev-only raw diagnostic.' }));
    await report(root);
    const summary = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.equal(summary.status, 'partial-cross-provider-quota');
    assert.equal(summary.final.luna.status, 'measured-final-runs-complete');
    assert.equal(summary.final.luna.decisions.n, 6);
    assert.equal(summary.final.flash.status, 'blocked-cloudflare-quota');
    assert.equal(summary.final.clef.decisions, null);
    assert.equal(summary.final.flash.fixtureSubstituted, false);
    assert.deepEqual(summary.comparisonsVsFlash, {});
    assert.deepEqual(summary.baselineComparisonsVsFlash, {});
    assert.equal(summary.comparisonsVsFixture.luna.pairedRounds, 6);
    assert.equal(summary.comparisonsVsFixture.luna.nIndependentGroups, 1);
    assert.equal(summary.switchQualification.retainIncumbent, true);
    assert.equal(summary.switchQualification.qualified, false);
    assert.equal(summary.robustnessDiagnostics.luna.label, 'baseline-wording-diagnostic');
    assert.equal(summary.robustnessDiagnostics.luna.finalConfigurationMeasurement, false);
    assert.equal(summary.robustnessDiagnostics.flash, null);
    assert.equal(summary.robustnessDiagnostics.clef, null);
    assert.equal(summary.final.luna.positionBias, null);
    assert.equal(summary.final.luna.baselineWordingDiagnostic.summary.maxPositionDelta, 0.94);
    assert.equal(fs.readFileSync(path.join(root, 'out', 'frozen-config.json'), 'utf8'), JSON.stringify(frozen, null, 2) + '\n');
    const intervals = summary.final.luna.confidenceIntervals;
    assert.equal(intervals.nIndependentGroups, 1);
    assert.equal(intervals.f1.validIterations, 10000);
    assert.deepEqual(intervals.f1.ci, [1, 1]);
    assert.equal(intervals.brier.validIterations, 10000);
    assert.ok(intervals.brier.ci.every((v: number) => Number.isFinite(v)));
    const csvReport = fs.readFileSync(path.join(root, 'out', 'results-test.csv'), 'utf8');
    assert.ok(csvReport.includes('self-family-bootstrap'));
    assert.equal(csvReport.includes('paired-tuned-vs-flash'), false);
    await report(root);
    const again = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.deepEqual(again.final.luna.confidenceIntervals, intervals);
    const empty = selfBootstrap([]);
    assert.equal(empty.f1.estimate, null);
    assert.equal(empty.brier.ci, null);
    assert.equal(empty.brier.validIterations, 0);
    // User-authorized account resumption changes availability, never frozen selection or dev choices.
    const frozenBytes = fs.readFileSync(path.join(root, 'out', 'frozen-config.json'), 'utf8');
    const markerPath = path.join(root, 'out', 'blocked-cloudflare.json');
    const initialMarker = fs.readFileSync(markerPath, 'utf8');
    const resumptionPath = path.join(root, 'out', 'cloudflare-resumption.json');
    const resumption = { arm: 'flash', tokenAlias: 'CLOUDFLARE_API_TOKEN_2', accountChanged: true,
      frozenUnchanged: true, frozenHash: createHash('sha256').update(frozenBytes).digest('hex'), at: '2026-10-08T07:00:00Z' };
    fs.writeFileSync(resumptionPath, JSON.stringify({ ...resumption, frozenHash: 'wrong' }));
    await assert.rejects(report(root), /resumption\/frozen hash mismatch/);
    fs.writeFileSync(resumptionPath, JSON.stringify(resumption));
    for (const repeat of [1, 2, 3])
      writeRun(`final-${frozen.flash!.config}-flash-${repeat}`, testRows.map((s) => makeRow(s, 'flash', frozen.flash!.config, repeat)));
    // Legacy marker blocks both; the explicit resumption record removes Flash only.
    await report(root);
    const resumed = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.deepEqual(resumed.blockedArms, ['clef']);
    assert.equal(resumed.status, 'partial-cross-provider-quota');
    assert.equal(resumed.final.flash.decisions.n, 6);
    assert.equal(resumed.final.flash.config, frozen.flash!.config);
    assert.equal(resumed.final.flash.threshold, frozen.flash!.threshold);
    assert.equal(resumed.final.clef.decisions, null);
    assert.equal(resumed.comparisonsVsFlash.luna.pairedRounds, 6);
    assert.equal(resumed.comparisonsVsFlash.luna.nIndependentGroups, 1);
    assert.equal(resumed.switchQualification.incumbentComplete, true);
    assert.match(resumed.switchQualification.reason, /regression/);
    assert.doesNotMatch(resumed.decision, /incumbent.*missing/);
    assert.equal(resumed.cloudflareResumption.tokenAlias, 'CLOUDFLARE_API_TOKEN_2');
    assert.equal(resumed.originalCloudflareBlock.code, 4006);
    assert.equal(fs.readFileSync(path.join(root, 'out', 'frozen-config.json'), 'utf8'), frozenBytes);
    // The parent's actual audit schema uses these aliases and preserves limiter conditions.
    fs.writeFileSync(resumptionPath, JSON.stringify({ arm: 'flash', credentialAlias: 'CLOUDFLARE_API_TOKEN_2',
      accountChanged: true, userAuthorized: true, frozenSelectionChanged: false, at: resumption.at,
      config: frozen.flash!.config, threshold: frozen.flash!.threshold, maxInFlight: 1,
      maxRequestsPerMinute: 50, remainingBlockedArms: ['clef'] }));
    await report(root);
    const actualSchema = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.deepEqual(actualSchema.blockedArms, ['clef']);
    assert.equal(actualSchema.final.flash.latencyConditions.maxInFlight, 1);
    assert.equal(actualSchema.final.flash.latencyConditions.maxRequestsPerMinute, 50);
    assert.equal(actualSchema.final.flash.latencyConditions.requestStartSpacingMs, 1200);
    assert.equal(actualSchema.final.luna.latencyConditions.maxInFlight, 2);
    assert.equal(actualSchema.latencyComparison.comparableHarnessConditions, false);
    assert.equal(fs.readFileSync(path.join(root, 'out', 'frozen-config.json'), 'utf8'), frozenBytes);
    fs.writeFileSync(markerPath, JSON.stringify({ ...JSON.parse(initialMarker), blockedArms: ['clef'], resumedArms: ['flash'] }));
    await report(root);
    const scoped = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.equal(scoped.final.flash.decisions.n, 6);
    assert.deepEqual(scoped.blockedArms, ['clef']);
    // A later fresh quota block is not overridden forever by the old account-resumption record.
    fs.writeFileSync(markerPath, JSON.stringify({ ...JSON.parse(initialMarker), at: '2026-10-08T08:00:00Z', blockedArms: ['flash', 'clef'] }));
    await report(root);
    const reblocked = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.deepEqual(reblocked.blockedArms, ['flash', 'clef']);
    assert.deepEqual(reblocked.comparisonsVsFlash, {});
    fs.writeFileSync(markerPath, initialMarker);
    fs.rmSync(resumptionPath);
    for (const repeat of [1, 2, 3]) fs.rmSync(path.join(root, 'out', 'runs', `final-${frozen.flash!.config}-flash-${repeat}.jsonl`));
    // CF-only amendment may happen after Luna held-out, but never after CF held-out.
    const before = fs.readFileSync(path.join(root, 'out', 'frozen-config.json'), 'utf8');
    await assert.rejects(refreezeCloudflare(root), /Incomplete flash:historical/);
    const exposure = path.join(root, 'out', 'runs', 'final-baseline-flash-1.jsonl');
    fs.writeFileSync(exposure, 'invalid CF held-out sentinel must never be parsed');
    await assert.rejects(refreezeCloudflare(root), /CF held-out run file exists/);
    assert.equal(fs.readFileSync(path.join(root, 'out', 'frozen-config.json'), 'utf8'), before);
    fs.rmSync(exposure);
    const quotaRow = JSON.parse(fs.readFileSync(path.join(root, 'out', 'runs', 'tune-historical-clef-0.jsonl'), 'utf8'));
    for (const arm of ['flash', 'clef'] as const)
      for (const config of promoted)
        writeRun(`tune-${config}-${arm}-0`, dev.map((s) => makeRow(s, arm, config, 0)));
    writeRun('tune-historical-clef-0', [quotaRow, makeRow(dev[1], 'clef', 'historical', 0)]);
    await assert.rejects(refreezeCloudflare(root), /still contains code 4006/);
    writeRun('tune-historical-clef-0', dev.map((s) => makeRow(s, 'clef', 'historical', 0)));
    const lunaFile = path.join(root, 'out', 'runs', 'tune-evidence-luna-0.jsonl');
    const lunaDev = fs.readFileSync(lunaFile, 'utf8');
    fs.appendFileSync(lunaFile, '\n');
    await assert.rejects(refreezeCloudflare(root), /Non-CF dev file changed/);
    fs.writeFileSync(lunaFile, lunaDev);
    const lunaHeldOutFile = path.join(root, 'out', 'runs', `final-${frozen.luna!.config}-luna-1.jsonl`);
    const lunaHeldOutText = fs.readFileSync(lunaHeldOutFile, 'utf8');
    fs.writeFileSync(lunaHeldOutFile, 'invalid Luna held-out sentinel must never be read during CF completion');
    const revised = await refreezeCloudflare(root);
    fs.writeFileSync(lunaHeldOutFile, lunaHeldOutText);
    assert.deepEqual(revised.luna, frozen.luna);
    assert.deepEqual(revised.fixture, frozen.fixture);
    assert.equal(revised.metadata.eligibleConfigurationsByArm?.flash?.length, 7);
    assert.equal(revised.metadata.eligibleConfigurationsByArm?.clef?.length, 7);
    assert.equal(revised.metadata.cloudflareBlock, null);
    assert.equal(revised.metadata.cloudflareRefreeze?.previousFrozenHash, createHash('sha256').update(before).digest('hex'));
    assert.ok(fs.existsSync(path.join(root, 'out', 'analysis-dev-before-cloudflare-refreeze.json')));
    const revisedAnalysis = JSON.parse(fs.readFileSync(path.join(root, 'out', 'analysis-dev.json'), 'utf8'));
    const nonCfLog = (rows: Record<string, unknown>[]) => rows.filter((r) => r.arm === 'luna' || r.arm === 'fixture');
    assert.deepEqual(nonCfLog(revisedAnalysis.tuningLog), nonCfLog(analysis.tuningLog));
    await report(root);
    const parity = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.equal(parity.status, 'partial-final-runs'); // CF dev complete still does not manufacture CF final results.
    assert.equal(parity.cloudflareBlock, null); // Unchanged old block marker remains historical, not reactivated.
    assert.equal(parity.final.luna.decisions.n, 6);
    assert.deepEqual(parity.comparisonsVsFlash, {});
    assert.equal(parity.switchQualification.retainIncumbent, true);
    // If quota resolves before the first freeze, all seven CF configurations are eligible directly.
    const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'tftf-parity-test-'));
    try {
      fs.cpSync(path.join(root, 'data'), path.join(fresh, 'data'), { recursive: true });
      fs.mkdirSync(path.join(fresh, 'out', 'runs'), { recursive: true });
      fs.cpSync(path.join(root, 'out', 'cache'), path.join(fresh, 'out', 'cache'), { recursive: true });
      fs.copyFileSync(path.join(root, 'out', 'blocked-cloudflare.json'), path.join(fresh, 'out', 'blocked-cloudflare.json'));
      for (const file of fs.readdirSync(path.join(root, 'out', 'runs')).filter((f) => /^(baseline|tune)-/.test(f)))
        fs.copyFileSync(path.join(root, 'out', 'runs', file), path.join(fresh, 'out', 'runs', file));
      const firstParity = await freeze(fresh);
      assert.equal(firstParity.metadata.eligibleConfigurationsByArm?.flash?.length, 7);
      assert.equal(firstParity.metadata.eligibleConfigurationsByArm?.clef?.length, 7);
      assert.equal(firstParity.metadata.cloudflareBlock, null);
      assert.ok(firstParity.metadata.cloudflareQuotaResolution);
      assert.equal(firstParity.metadata.cloudflareRefreeze, undefined);
    } finally { fs.rmSync(fresh, { recursive: true, force: true }); }
    await assert.rejects(refreezeCloudflare(root), /initial quota-blocked freeze/);
    const markerFile = path.join(root, 'out', 'blocked-cloudflare.json');
    const newBlock = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
    fs.writeFileSync(markerFile, JSON.stringify({ ...newBlock, at: 'later-new-quota-exhaustion' }));
    await report(root);
    const blockedAgain = JSON.parse(fs.readFileSync(path.join(root, 'out', 'summary.json'), 'utf8'));
    assert.equal(blockedAgain.status, 'partial-cross-provider-quota');
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
