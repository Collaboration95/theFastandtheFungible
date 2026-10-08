/** Offline benchmark statistics. Undefined estimates are null, never fabricated. */
export type Estimate = number | null;
export type GroupId = string | number;
export const DEFAULT_SEED = 20261008;

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function probability(value: number, name: string): void {
  finite(value, name);
  if (value < 0 || value > 1) throw new RangeError(`${name} must be in [0, 1]`);
}

function paired(y: readonly number[], p: readonly number[], bounded: boolean): void {
  if (y.length !== p.length) throw new RangeError('Array lengths must match');
  y.forEach((v) => bounded ? probability(v, 'target') : finite(v, 'target'));
  p.forEach((v) => bounded ? probability(v, 'prediction') : finite(v, 'prediction'));
}

const mean = (values: readonly number[]): Estimate => values.length
  ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

export interface ReliabilityBin { n: number; predicted: number; observed: number }

/** Equal-mass bins, reduced to ceil(sqrt(n)) for small n; do not split ties. */
function reliabilityBins(y: readonly number[], p: readonly number[]): ReliabilityBin[] {
  const order = p.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const count = Math.min(15, Math.ceil(Math.sqrt(p.length)));
  const bins: ReliabilityBin[] = [];
  let start = 0;
  for (let bin = 1; bin <= count && start < order.length; bin++) {
    let end = Math.ceil(bin * order.length / count);
    if (end <= start) continue;
    while (end < order.length && order[end].value === order[end - 1].value) end++;
    const items = order.slice(start, end);
    bins.push({ n: items.length,
      predicted: items.reduce((sum, row) => sum + row.value, 0) / items.length,
      observed: items.reduce((sum, row) => sum + y[row.index], 0) / items.length });
    start = end;
  }
  return bins;
}

export function binaryMetrics(y: number[], p: number[]): {
  n: number; brier: Estimate; logLoss: Estimate; ece: Estimate;
  auroc: Estimate; auprc: Estimate; bins: ReliabilityBin[];
} {
  paired(y, p, true);
  const n = y.length;
  const bins = reliabilityBins(y, p);
  const brier = mean(y.map((target, i) => (p[i] - target) ** 2));
  const logLoss = mean(y.map((target, i) =>
    -(target ? target * Math.log(Math.max(1e-15, p[i])) : 0)
    - (target < 1 ? (1 - target) * Math.log(Math.max(1e-15, 1 - p[i])) : 0)));
  const ece = n ? bins.reduce((sum, bin) =>
    sum + bin.n / n * Math.abs(bin.predicted - bin.observed), 0) : null;

  // Fractional targets are meaningful for loss, but have no binary class membership.
  const hard = y.map((target, i) => ({ target, p: p[i] }))
    .filter((row) => row.target === 0 || row.target === 1).sort((a, b) => b.p - a.p);
  const positives = hard.filter((row) => row.target === 1).length;
  const negatives = hard.length - positives;
  let tp = 0, fp = 0, concordance = 0, averagePrecision = 0;
  for (let start = 0; start < hard.length;) {
    let end = start + 1;
    while (end < hard.length && hard[end].p === hard[start].p) end++;
    let pos = 0;
    for (let i = start; i < end; i++) pos += hard[i].target;
    const neg = end - start - pos;
    // Higher-score positives beat this negative block; within-block ties get half credit.
    concordance += neg * (tp + pos / 2);
    tp += pos;
    fp += neg;
    if (positives) averagePrecision += pos / positives * tp / (tp + fp);
    start = end;
  }
  return { n, brier, logLoss, ece,
    auroc: positives && negatives ? concordance / (positives * negatives) : null,
    auprc: positives ? averagePrecision : null, bins };
}

export function multiclassMetrics(labels: string[], probabilities: Record<string, number>[]): {
  brier: Estimate; macroF1: Estimate; perClassEce: Record<string, Estimate>;
} {
  if (labels.length !== probabilities.length) throw new RangeError('Array lengths must match');
  const classes = [...new Set([...labels, ...probabilities.flatMap((row) => Object.keys(row))])].sort();
  probabilities.forEach((row) => {
    Object.values(row).forEach((v) => probability(v, 'class probability'));
    if (Math.abs(Object.values(row).reduce((sum, v) => sum + v, 0) - 1) > 1e-6)
      throw new RangeError('Class probabilities must sum to 1');
  });
  const predictions = probabilities.map((row) => classes.reduce((best, c) =>
    (row[c] ?? 0) > (row[best] ?? 0) ? c : best, classes[0]));
  const perClassEce: Record<string, Estimate> = {};
  const f1 = classes.map((c) => {
    let tp = 0, fp = 0, fn = 0;
    labels.forEach((label, i) => {
      if (label === c && predictions[i] === c) tp++;
      else if (predictions[i] === c) fp++;
      else if (label === c) fn++;
    });
    // Define absent-class F1 as zero, with the class universe disclosed in the notes.
    perClassEce[c] = binaryMetrics(labels.map((label) => Number(label === c)),
      probabilities.map((row) => row[c] ?? 0)).ece;
    return 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0;
  });
  return {
    brier: mean(labels.map((label, i) => classes.reduce((sum, c) =>
      sum + ((probabilities[i][c] ?? 0) - Number(label === c)) ** 2, 0))),
    macroF1: mean(f1), perClassEce,
  };
}

function ranks(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  for (let start = 0; start < order.length;) {
    let end = start + 1;
    while (end < order.length && order[end].value === order[start].value) end++;
    for (let i = start; i < end; i++) result[order[i].index] = (start + end - 1) / 2;
    start = end;
  }
  return result;
}

export function scoreMetrics(y: number[], p: number[]): { mae: Estimate; spearman: Estimate } {
  paired(y, p, false);
  const a = ranks(y), b = ranks(p), center = (y.length - 1) / 2;
  let covariance = 0, varA = 0, varB = 0;
  a.forEach((v, i) => {
    covariance += (v - center) * (b[i] - center);
    varA += (v - center) ** 2;
    varB += (b[i] - center) ** 2;
  });
  return { mae: mean(y.map((v, i) => Math.abs(v - p[i]))),
    spearman: varA && varB ? covariance / Math.sqrt(varA * varB) : null };
}

export interface DecisionRow { expected: string | null; selected: string | null; priceMinor: number }

export function decisionMetrics(rows: DecisionRow[]): {
  precision: number; recall: number; f1: number; wastedSpend: number;
  missedValue: number; exactMatch: Estimate; n: number;
} {
  let tp = 0, buys = 0, expected = 0, wastedSpend = 0, correct = 0;
  rows.forEach((row) => {
    if (!Number.isSafeInteger(row.priceMinor) || row.priceMinor < 0)
      throw new RangeError('priceMinor must be a nonnegative safe integer');
    if (row.expected !== null) expected++;
    if (row.selected !== null) {
      buys++;
      if (row.selected === row.expected) tp++;
      else wastedSpend += row.priceMinor;
    }
    if (row.selected === row.expected) correct++;
  });
  if (!Number.isSafeInteger(wastedSpend)) throw new RangeError('Total spend exceeds safe integer range');
  return { precision: buys ? tp / buys : 0, recall: expected ? tp / expected : 0,
    f1: buys + expected ? 2 * tp / (buys + expected) : 0,
    wastedSpend, missedValue: expected - tp, exactMatch: rows.length ? correct / rows.length : null,
    n: rows.length };
}

/** Linear interpolation at index (n - 1) * p, without mutating arr. */
export function percentile(arr: number[], p: number): Estimate {
  probability(p, 'percentile');
  arr.forEach((v) => finite(v, 'sample'));
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p, low = Math.floor(index), fraction = index - low;
  return sorted[low] * (1 - fraction) + sorted[Math.ceil(index)] * fraction;
}

/** Mulberry32: reproducible pseudo-randomness for resampling, not cryptography. */
export function seededRandom(seed: number = DEFAULT_SEED): () => number {
  if (!Number.isSafeInteger(seed)) throw new RangeError('seed must be a safe integer');
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function groupKey(group: GroupId): string {
  if (typeof group !== 'string' && typeof group !== 'number') throw new TypeError('Invalid group ID');
  if (typeof group === 'number') finite(group, 'group ID');
  return `${typeof group}:${group}`;
}

/** Yield original row indexes; draws entire clusters with replacement when groups are supplied. */
export function* bootstrapIndexes(n: number, iterations = 10000, seed = DEFAULT_SEED,
  groups?: readonly GroupId[]): Generator<number[]> {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('n must be a nonnegative integer');
  if (!Number.isSafeInteger(iterations) || iterations < 1) throw new RangeError('iterations must be positive');
  if (groups && groups.length !== n) throw new RangeError('Group count must match row count');
  const random = seededRandom(seed);
  const clusters = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = groups ? groupKey(groups[i]) : `row:${i}`;
    const indexes = clusters.get(key) ?? [];
    indexes.push(i);
    clusters.set(key, indexes);
  }
  const units = [...clusters.values()];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const indexes: number[] = [];
    for (let draw = 0; draw < units.length; draw++) {
      for (const index of units[Math.floor(random() * units.length)]) indexes.push(index);
    }
    yield indexes;
  }
}

type Interval = [number, number] | null;
function interval(samples: number[]): Interval {
  return samples.length ? [percentile(samples, 0.025)!, percentile(samples, 0.975)!] : null;
}

/** Paired percentile CIs, with effect direction A minus B. Rows must already be aligned by item. */
export function pairedBootstrap<T>(rowsA: readonly T[], rowsB: readonly T[],
  metric: (rows: T[]) => Estimate, iterations = 10000, seed = DEFAULT_SEED,
  groups?: readonly GroupId[]): {
    estimateA: Estimate; estimateB: Estimate; difference: Estimate;
    ciA: Interval; ciB: Interval; ci: Interval; iterations: number; validIterations: number;
  } {
  if (rowsA.length !== rowsB.length) throw new RangeError('Paired rows must have equal length');
  function evaluate(rows: T[]): Estimate {
    const value = metric(rows);
    if (value !== null) finite(value, 'metric estimate');
    return value;
  }
  const estimateA = evaluate([...rowsA]), estimateB = evaluate([...rowsB]);
  const samplesA: number[] = [], samplesB: number[] = [], differences: number[] = [];
  for (const indexes of bootstrapIndexes(rowsA.length, iterations, seed, groups)) {
    const a = evaluate(indexes.map((i) => rowsA[i])), b = evaluate(indexes.map((i) => rowsB[i]));
    if (a === null || b === null) continue;
    samplesA.push(a); samplesB.push(b); differences.push(a - b);
  }
  return { estimateA, estimateB,
    difference: estimateA !== null && estimateB !== null ? estimateA - estimateB : null,
    ciA: estimateA !== null ? interval(samplesA) : null,
    ciB: estimateB !== null ? interval(samplesB) : null,
    ci: estimateA !== null && estimateB !== null ? interval(differences) : null,
    iterations, validIterations: differences.length };
}

/** Two-sided exact McNemar binomial test, evaluated in log space for large discordance counts. */
export function mcnemar(correctA: boolean[], correctB: boolean[]): {
  b: number; c: number; discordants: number; pValue: number; n: number;
} {
  if (correctA.length !== correctB.length) throw new RangeError('Array lengths must match');
  let b = 0, c = 0;
  correctA.forEach((value, i) => {
    if (typeof value !== 'boolean' || typeof correctB[i] !== 'boolean') throw new TypeError('Expected booleans');
    if (value && !correctB[i]) b++;
    if (!value && correctB[i]) c++;
  });
  const discordants = b + c;
  let logTerm = -discordants * Math.LN2, logSum = logTerm;
  for (let k = 1; k <= Math.min(b, c); k++) {
    logTerm += Math.log(discordants - k + 1) - Math.log(k);
    const max = Math.max(logSum, logTerm);
    logSum = max + Math.log(Math.exp(logSum - max) + Math.exp(logTerm - max));
  }
  return { b, c, discordants, pValue: discordants ? Math.min(1, 2 * Math.exp(logSum)) : 1,
    n: correctA.length };
}
