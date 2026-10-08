// Ported from bench/decisions/calibration.ts on bench/decisions-vs-clef (c176f43) for #212; unchanged except imports.
import { binaryMetrics, DEFAULT_SEED, groupKey, seededRandom } from './metrics.js';
import type { Estimate, GroupId } from './metrics.js';

export type CalibrationMethod = 'identity' | 'platt' | 'isotonic';
export interface CalibrationPoint { p: number; y: number }
export interface CalibrationItem extends CalibrationPoint {
  group?: GroupId;
  scenarioId?: GroupId;
  /** If supplied, this must be dev. Caller owns split isolation when omitted. */
  split?: string;
}
export type CalibrationModel = { method: 'identity' }
  | { method: 'platt'; a: number; b: number }
  | { method: 'isotonic'; knots: number[]; values: number[] };

const EPSILON = 1e-6;
const RIDGE = 1e-4;
const clamp = (p: number) => Math.max(EPSILON, Math.min(1 - EPSILON, p));
const logit = (p: number) => Math.log(clamp(p) / (1 - clamp(p)));
const sigmoid = (z: number) => z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));

function validateProbability(p: number): void {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('Probability/target must be in [0, 1]');
}

function platt(points: CalibrationPoint[]): CalibrationModel {
  const x = points.map((point) => logit(point.p));
  const targetMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  if (points.every((point) => point.y === points[0].y))
    return { method: 'platt', a: 0, b: logit(targetMean) };
  // Minimize mean soft-label cross entropy plus a small ridge penalty.
  function loss(a: number, b: number): number {
    return points.reduce((sum, point, i) => {
      const z = a * x[i] + b;
      return sum + Math.max(z, 0) + Math.log1p(Math.exp(-Math.abs(z))) - point.y * z;
    }, 0) / points.length + RIDGE / 2 * (a * a + b * b);
  }
  let a = 1, b = 0;
  for (let iteration = 0; iteration < 100; iteration++) {
    let ga = RIDGE * a, gb = RIDGE * b, haa = RIDGE, hab = 0, hbb = RIDGE;
    points.forEach((point, i) => {
      const fitted = sigmoid(a * x[i] + b);
      const residual = (fitted - point.y) / points.length;
      const weight = fitted * (1 - fitted) / points.length;
      ga += residual * x[i]; gb += residual;
      haa += weight * x[i] * x[i]; hab += weight * x[i]; hbb += weight;
    });
    if (Math.max(Math.abs(ga), Math.abs(gb)) < 1e-9) break;
    const determinant = haa * hbb - hab * hab;
    const da = (hbb * ga - hab * gb) / determinant;
    const db = (haa * gb - hab * ga) / determinant;
    const previousLoss = loss(a, b);
    let step = 1;
    while (step > 1e-10 && loss(a - step * da, b - step * db) >
      previousLoss - 1e-4 * step * (ga * da + gb * db)) step /= 2;
    if (step <= 1e-10) break;
    a -= step * da; b -= step * db;
  }
  return { method: 'platt', a, b };
}

function isotonic(points: CalibrationPoint[]): CalibrationModel {
  const sorted = [...points].sort((a, b) => a.p - b.p);
  const knots: number[] = [], totals: number[] = [], weights: number[] = [];
  for (const point of sorted) {
    if (knots.length && knots[knots.length - 1] === point.p) {
      totals[totals.length - 1] += point.y;
      weights[weights.length - 1]++;
    } else { knots.push(point.p); totals.push(point.y); weights.push(1); }
  }
  const blocks: Array<{ start: number; end: number; total: number; weight: number }> = [];
  knots.forEach((_, i) => {
    blocks.push({ start: i, end: i, total: totals[i], weight: weights[i] });
    while (blocks.length > 1) {
      const right = blocks[blocks.length - 1], left = blocks[blocks.length - 2];
      if (left.total / left.weight <= right.total / right.weight) break;
      blocks.pop(); blocks.pop();
      blocks.push({ start: left.start, end: right.end,
        total: left.total + right.total, weight: left.weight + right.weight });
    }
  });
  const values = new Array<number>(knots.length);
  for (const block of blocks)
    for (let i = block.start; i <= block.end; i++) values[i] = block.total / block.weight;
  return { method: 'isotonic', knots, values };
}

export function fitCalibration(points: CalibrationPoint[], method: CalibrationMethod): CalibrationModel {
  points.forEach((point) => { validateProbability(point.p); validateProbability(point.y); });
  if (method === 'identity') return { method };
  if (method !== 'platt' && method !== 'isotonic') throw new RangeError('Unknown calibration method');
  if (!points.length) throw new RangeError('Cannot fit calibration without training points');
  return method === 'platt' ? platt(points) : isotonic(points);
}

/** Isotonic uses linear interpolation between PAV knots and constant endpoint extrapolation. */
export function applyCalibration(model: CalibrationModel, p: number): number {
  validateProbability(p);
  if (model.method === 'identity') return p;
  if (model.method === 'platt') {
    if (!Number.isFinite(model.a) || !Number.isFinite(model.b)) throw new RangeError('Invalid Platt model');
    return sigmoid(model.a * logit(p) + model.b);
  }
  if (model.method !== 'isotonic') throw new RangeError('Unknown calibration model');
  if (!model.knots.length || model.knots.length !== model.values.length)
    throw new RangeError('Invalid isotonic model');
  model.knots.forEach((knot, i) => {
    validateProbability(knot); validateProbability(model.values[i]);
    if (i && (knot <= model.knots[i - 1] || model.values[i] < model.values[i - 1]))
      throw new RangeError('Isotonic knots/values must be monotone');
  });
  if (p <= model.knots[0]) return model.values[0];
  const last = model.knots.length - 1;
  if (p >= model.knots[last]) return model.values[last];
  let low = 0, high = last;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (model.knots[mid] <= p) low = mid; else high = mid;
  }
  const fraction = (p - model.knots[low]) / (model.knots[high] - model.knots[low]);
  return model.values[low] * (1 - fraction) + model.values[high] * fraction;
}

export interface CalibrationSelection {
  method: CalibrationMethod;
  model: CalibrationModel;
  cvBrier: Record<CalibrationMethod, Estimate>;
  folds: Array<{ trainIndexes: number[]; testIndexes: number[] }>;
  foldCount: number;
  nGroups: number;
  reason: string;
}

/** Select by pooled out-of-fold dev Brier; ties prefer identity, then Platt, then isotonic. */
export function chooseCalibration(points: CalibrationItem[], seed = DEFAULT_SEED): CalibrationSelection {
  points.forEach((point) => {
    validateProbability(point.p); validateProbability(point.y);
    if (point.split !== undefined && point.split !== 'dev') throw new RangeError('Calibration selection accepts dev only');
    if (point.group !== undefined && point.scenarioId !== undefined &&
      groupKey(point.group) !== groupKey(point.scenarioId)) throw new RangeError('Conflicting scenario/group IDs');
  });
  const grouped = new Map<string, number[]>();
  points.forEach((point, i) => {
    const group = point.group ?? point.scenarioId;
    const key = group === undefined ? `item:${i}` : `group:${groupKey(group)}`;
    const indexes = grouped.get(key) ?? [];
    indexes.push(i); grouped.set(key, indexes);
  });
  const random = seededRandom(seed);
  const keys = [...grouped.keys()].sort();
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const cvBrier: Record<CalibrationMethod, Estimate> = { identity: null, platt: null, isotonic: null };
  if (keys.length < 2) return { method: 'identity', model: { method: 'identity' }, cvBrier,
    folds: [], foldCount: 0, nGroups: keys.length, reason: 'Fewer than two groups: no independent CV; identity retained' };
  const foldCount = Math.min(5, keys.length);
  const holdouts: number[][] = Array.from({ length: foldCount }, () => []);
  keys.forEach((key, i) => holdouts[i % foldCount].push(...grouped.get(key)!));
  const folds = holdouts.map((indexes) => {
    const heldOut = new Set(indexes);
    return { testIndexes: [...indexes].sort((a, b) => a - b),
      trainIndexes: points.map((_, i) => i).filter((i) => !heldOut.has(i)) };
  });
  const methods: CalibrationMethod[] = ['identity', 'platt', 'isotonic'];
  for (const method of methods) {
    const predictions = new Array<number>(points.length);
    for (const fold of folds) {
      const model = fitCalibration(fold.trainIndexes.map((i) => points[i]), method);
      fold.testIndexes.forEach((i) => { predictions[i] = applyCalibration(model, points[i].p); });
    }
    cvBrier[method] = binaryMetrics(points.map((point) => point.y), predictions).brier;
  }
  let method: CalibrationMethod = 'identity';
  for (const candidate of methods)
    if (cvBrier[candidate]! < cvBrier[method]! - 1e-12) method = candidate;
  return { method, model: fitCalibration(points, method), cvBrier, folds, foldCount,
    nGroups: keys.length, reason: 'Lowest pooled out-of-fold dev Brier; final model refit on all dev points' };
}
