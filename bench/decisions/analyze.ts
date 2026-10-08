/** Offline dev selection and held-out reporting. This module never invokes evaluate/call/request. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { binaryMetrics, bootstrapIndexes, decisionMetrics, mcnemar, multiclassMetrics, pairedBootstrap,
  percentile, scoreMetrics, DEFAULT_SEED } from './metrics.ts';
import type { DecisionRow, Estimate } from './metrics.ts';
import { applyCalibration, chooseCalibration } from './calibration.ts';
import type { CalibrationItem, CalibrationModel, CalibrationSelection } from './calibration.ts';
import type { CandidateJudgment, PublicCandidate, PublicSourceRef, ReputationSummary } from '../../shared/contracts/index.js';

export const ARMS = ['flash', 'clef', 'luna', 'fixture'] as const;
type Arm = typeof ARMS[number];
type Question = 'gap' | 'addressesGap' | 'original' | 'paid';
const QUESTIONS: Question[] = ['gap', 'addressesGap', 'original', 'paid'];
const FULL_CONFIGS = ['baseline', 'evidence', 'batch', 'batch-evidence', 'historical', 'no-read', 'abstract-first'];
const QUOTA_CONFIGS = FULL_CONFIGS.slice(0, 4);
const THRESHOLDS = Array.from({ length: 56 }, (_, i) => (i + 5) / 100);
const DEFAULTS = { flash: 0.15, clef: 0.35, luna: 0.20, fixture: 0.20 };
const identity = (): CalibrationModel => ({ method: 'identity' });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

interface CandidateData {
  candidate: PublicCandidate; body: string; paidLabel: number;
  labels?: Record<string, unknown>; label?: Record<string, unknown>;
  [key: string]: unknown;
}
interface Scenario {
  id: string; group?: string | number; split: string; domain: string; slice: string; question: string;
  conclusion: string; gap: string; candidates: CandidateData[]; readSources: PublicSourceRef[];
  expectedResourceId: string | null; paidResourceIds: string[]; budgetMinor: number;
  perSourceCapMinor: number; reputation?: Record<string, ReputationSummary>;
  labels?: Record<string, unknown>; [key: string]: unknown;
}
interface RunRow {
  id: string; split: string; domain: string; slice: string; arm: Arm; config: string;
  repeat: number; gap: number; judgments: CandidateJudgment[];
  paid: Array<{ resourceId: string; label: number; p: number | null; requestKey?: string }>;
  calls: string[]; decisionElapsedMs: number; networkLowerBoundMs: number;
  decisionCacheHits?: number;
  decisionCacheHitProvenance?: 'runner' | 'baseline-key-history';
  failed: boolean; fallback: boolean; selected: string | null; priceMinor: number;
  expected: string | null;
}
interface CallRecord {
  key: string; arm: string; kind: string; latencyMs: number; timeout3s: boolean;
  error?: string; status: number; inputTokens: number; usd: number; estimatedUsage: boolean;
  response?: { result?: { answers?: Record<string, { noul?: number; type?: string }> };
    answers?: Array<{ name?: string; type: string; probability?: number }> };
  request?: { state?: { passages?: unknown[] }; input?: string };
}
interface Prediction {
  key: string; scenarioId: string; group: string | number; question: Question; y: number; p: number;
  source: 'provider' | 'fixture' | 'fixture-fallback';
}
interface Evaluation {
  run: RunRow; raw: DecisionRow; calibrated: DecisionRow;
  predictionsRaw: Prediction[]; predictionsCalibrated: Prediction[];
  providerRaw: Prediction[];
  choicesRaw: Record<string, number>[]; choicesCalibrated: Record<string, number>[];
  choiceLabels: string[]; scoreLabels: number[]; scorePredictions: number[];
  calls: CallRecord[]; fallback: boolean;
  group: string | number; policyGap: number; policyJudgments: CandidateJudgment[];
  roundingCorrections: number;
  policyRows: Array<{ id: string; value: number; verdict: string }>;
  unresolvedPaidCalls: number;
}
interface FrozenArm {
  config: string; threshold: number;
  calibration: Record<Question, CalibrationModel>;
  calibrationSelection: Record<Question, CalibrationSelection>;
  paidCalibrationSource: string;
  devDecision: ReturnType<typeof decisionMetrics>;
  devScenarioCount: number;
}
interface Frozen {
  flash?: FrozenArm; clef?: FrozenArm; luna?: FrozenArm; fixture?: FrozenArm;
  metadata: { version: number; seed: number; frozenAt: string; devHash: string;
    devFiles: Record<string, string>; excludedConfigurations: string[]; notes: string[];
    cloudflareBlock?: CloudflareBlock | null;
    eligibleConfigurationsByArm?: Partial<Record<Arm, string[]>>;
    cloudflareRefreeze?: { at: string; previousFrozenHash: string; previousFrozenAt: string;
      previousBlock: CloudflareBlock; resolvedMarkerHash: string | null; preservedArms: string[] };
    cloudflareQuotaResolution?: { at: string; previousBlock: CloudflareBlock; resolvedMarkerHash: string;
      basis: string };
    baselineTimingReconstruction?: Array<{ file: string; arm: Arm; seedSmokeKeys: string[]; reconstructedRows: number }> };
}
interface CloudflareBlock {
  source: string; at?: string; provider: string; status: number; code: number; reason: string; action?: string;
  blockedArms?: Array<'flash' | 'clef'>; resumedArms?: Array<'flash' | 'clef'>;
}
function readCloudflareBlock(out: string, name = 'blocked-cloudflare.json'): CloudflareBlock | null {
  const file = path.join(out, name);
  if (!fs.existsSync(file)) return null;
  const block = JSON.parse(fs.readFileSync(file, 'utf8')) as CloudflareBlock;
  if (block.status !== 429 || block.code !== 4006 || typeof block.reason !== 'string' ||
    block.provider !== 'Cloudflare Workers AI') throw new Error('Unrecognized Cloudflare quota block; eligibility cannot be relaxed');
  for (const scope of [block.blockedArms, block.resumedArms])
    if (scope !== undefined && (!Array.isArray(scope) || scope.some((arm) => arm !== 'flash' && arm !== 'clef') || new Set(scope).size !== scope.length))
      throw new Error('Invalid Cloudflare block arm scope');
  if (block.blockedArms?.some((arm) => block.resumedArms?.includes(arm))) throw new Error('Conflicting blocked/resumed Cloudflare arms');
  return { ...block, source: `out/${name}` };
}
function readCloudflareResumption(out: string, frozenHash: string, frozen: Frozen) {
  const file = path.join(out, 'cloudflare-resumption.json');
  if (!fs.existsSync(file)) return null;
  const record = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  const alias = record.tokenAlias ?? record.credentialAlias;
  const selectionUnchanged = record.frozenUnchanged === true || record.frozenSelectionChanged === false;
  if (record.arm !== 'flash' || alias !== 'CLOUDFLARE_API_TOKEN_2' || record.accountChanged !== true ||
    !selectionUnchanged || typeof record.at !== 'string' || !Number.isFinite(Date.parse(record.at)))
    throw new Error('Invalid Flash resumption record: require arm, tokenAlias, accountChanged, frozenUnchanged and ISO at');
  if (record.frozenHash !== undefined && record.frozenHash !== frozenHash) throw new Error('Flash resumption/frozen hash mismatch');
  if (record.config !== undefined && record.config !== frozen.flash?.config ||
    record.threshold !== undefined && record.threshold !== frozen.flash?.threshold) throw new Error('Flash resumption changes frozen config/threshold');
  for (const field of ['maxInFlight', 'maxRequestsPerMinute'])
    if (record[field] !== undefined && (typeof record[field] !== 'number' || !Number.isInteger(record[field]) || record[field] <= 0))
      throw new Error(`Invalid Flash resumption limiter ${field}`);
  // Only copy the public routing alias and audit fields; never echo arbitrary credential fields.
  return { source: 'out/cloudflare-resumption.json', arm: 'flash' as const, at: record.at,
    tokenAlias: 'CLOUDFLARE_API_TOKEN_2', accountChanged: true, frozenUnchanged: true, frozenHash,
    maxInFlight: record.maxInFlight ?? null, maxRequestsPerMinute: record.maxRequestsPerMinute ?? null,
    requestStartSpacingMs: typeof record.maxRequestsPerMinute === 'number' ? 60000 / record.maxRequestsPerMinute : null,
    scope: 'User-authorized account change for Flash only; existing frozen selection, no dev promotion/refreeze' };
}
interface FamilySpec {
  familyId: string; split: string; scenarioIds: string[];
  cleanScenarioId: string; adversarialScenarioId?: string; attack?: string;
  attackedResourceId?: string; cleanResourceId?: string;
}
interface RegressionScope { id: string; oracleSelected: string | null; storyBibleExpected: string | null; caveat?: string }

export function regressionComparisons(rows: Array<DecisionRow & { id: string; repeat: number; fallback: boolean }>,
  scope: RegressionScope[], expectedScenarioIds: string[] = [...new Set(rows.map((r) => r.id))]) {
  const byId = new Map(scope.map((s) => [s.id, s]));
  if (byId.size !== scope.length) throw new Error('Duplicate regression-scope IDs');
  const compared = rows.map((row) => {
    const spec = byId.get(row.id);
    if (spec && spec.oracleSelected !== row.expected) throw new Error(`Regression scope/oracle disagreement: ${row.id}`);
    const known = spec !== undefined && (spec.storyBibleExpected === null || typeof spec.storyBibleExpected === 'string');
    const oracleMatch = row.selected === row.expected;
    const storyMatch = known ? row.selected === spec.storyBibleExpected : null;
    const expectationDiscrepancy = known ? row.expected !== spec.storyBibleExpected : null;
    return { id: row.id, repeat: row.repeat, selected: row.selected,
      oracleExpected: row.expected, oracleMatch,
      storyExpected: known ? spec.storyBibleExpected : null, storyExpectedKnown: known, storyMatch,
      expectationDiscrepancy, fallback: row.fallback,
      // Keep the old pass field conservative for downstream consumers that have not migrated.
      pass: known && oracleMatch && storyMatch === true && expectationDiscrepancy === false,
      caveat: spec?.caveat ?? 'No story expectation was supplied; selection-only regression cannot qualify a switch' };
  });
  const actual = new Set(rows.map((r) => `${r.id}:${r.repeat}`));
  const missing = expectedScenarioIds.flatMap((id) => [1, 2, 3].filter((repeat) => !actual.has(`${id}:${repeat}`)).map((repeat) => `${id}:${repeat}`));
  const complete = expectedScenarioIds.length > 0 && !missing.length && rows.length === expectedScenarioIds.length * 3;
  const expectedVsStoryDiscrepancies = [...new Set(compared.filter((r) => r.expectationDiscrepancy === true).map((r) => r.id))];
  return { rows: compared, missing, complete, expectedVsStoryDiscrepancies,
    oracleAllMatch: compared.length ? compared.every((r) => r.oracleMatch) : null,
    storyAllMatch: compared.length && compared.every((r) => r.storyExpectedKnown) ? compared.every((r) => r.storyMatch) : null,
    switchQualificationPass: complete && compared.every((r) => r.pass),
    convention: 'Oracle selection and story selection are separate; any disagreement, unknown expectation, or missing repeat prevents regression switch qualification. No payment/proof/refund execution is asserted.' };
}

export function familyGroups(specs: Array<{ familyId: string; scenarioIds: string[] }>): Map<string, string> {
  const groups = new Map<string, string>();
  for (const spec of specs) for (const id of spec.scenarioIds) {
    if (groups.has(id)) throw new Error(`Scenario ${id} occurs in multiple topic-family specs`);
    groups.set(id, spec.familyId);
  }
  return groups;
}
function attachFamilies(root: string, scenarios: Scenario[], split?: string): Scenario[] {
  const groups = familyGroups(readJsonLines<FamilySpec>(path.join(root, 'data', 'scenario-specs.jsonl'), split));
  return scenarios.map((scenario) => {
    const group = groups.get(scenario.id);
    if (!group) throw new Error(`No topic-family mapping for ${scenario.id}`);
    if (scenario.group !== undefined && scenario.group !== group) throw new Error('Dataset/spec family IDs disagree');
    return { ...scenario, group };
  });
}

function readJsonLines<T>(file: string, split?: string): T[] {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim());
  // Filter on the serialized split before parsing; never inspect test labels during freeze.
  return lines.filter((line) => !split || new RegExp(`"split"\\s*:\\s*"${split}"`).test(line))
    .map((line) => JSON.parse(line) as T);
}
function writeJson(out: string, name: string, value: unknown): void {
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, name), temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temporary, file);
}
export function csv(rows: Record<string, unknown>[]): string {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns.map(cell).join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))].join('\n') + '\n';
}
function writeCsv(out: string, name: string, rows: Record<string, unknown>[]): void {
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, name), csv(rows));
}
function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
function label(record: Record<string, unknown>, names: string[], id: string): unknown {
  for (const source of [record.labels, record.label, record]) {
    if (!source || typeof source !== 'object') continue;
    for (const name of names) if (name in source) return (source as Record<string, unknown>)[name];
  }
  throw new Error(`Missing constructed label ${names[0]} for ${id}; labels must never be inferred from predictions`);
}
function gapLabel(s: Scenario): number {
  const value = label(s, ['gapMaterial', 'gap_material', 'gapLabel', 'gapMaterialLabel'], s.id);
  if (!isProbability(value)) throw new Error(`Invalid gap label for ${s.id}`);
  return value;
}
function candidateLabels(c: CandidateData): { addressesGap: number; originality: string; credibility: number } {
  const id = c.candidate.resourceId;
  const addressesGap = label(c, ['addressesGap', 'addresses_gap', 'addressesGapLabel'], id);
  const originality = label(c, ['originality', 'originalityLabel'], id);
  const credibility = label(c, ['credibility', 'credibilityLabel'], id);
  if (!isProbability(addressesGap) || !['original', 'rewrite', 'overlap'].includes(String(originality)) ||
    typeof credibility !== 'number' || !Number.isFinite(credibility) || credibility < 0 || credibility > 2)
    throw new Error(`Invalid constructed candidate labels for ${id}`);
  return { addressesGap, originality: String(originality), credibility };
}

/** Explicit full-vector transform: calibrate original and preserve the rewrite:overlap ratio. */
export function recalibrateOriginality(probabilities: CandidateJudgment['originality'],
  model: CalibrationModel): CandidateJudgment['originality'] {
  const normalized = normalizeOriginality(probabilities);
  if (model.method === 'identity') return normalized;
  const original = applyCalibration(model, normalized.original);
  const otherMass = normalized.rewrite + normalized.overlap;
  // When the raw vector assigns exactly zero other mass, its relative split is undefined.
  const rewrite = (1 - original) * (otherMass ? normalized.rewrite / otherMass : 0.5);
  return { original, rewrite, overlap: Math.max(0, 1 - original - rewrite) };
}

/** Explicit rounding correction only. Invalid probability vectors are not silently repaired. */
export function normalizeOriginality(probabilities: CandidateJudgment['originality']): CandidateJudgment['originality'] {
  const total = Object.values(probabilities).reduce((sum, p) => sum + p, 0);
  if (Object.values(probabilities).some((p) => !isProbability(p)) || Math.abs(total - 1) > 0.001 + 1e-12)
    throw new Error('Originality probabilities must sum to 1 within rounding tolerance .001');
  if (total === 1) return { ...probabilities };
  return { original: probabilities.original / total, rewrite: probabilities.rewrite / total,
    overlap: probabilities.overlap / total };
}

function loadCalls(out: string, row: Pick<RunRow, 'arm' | 'calls'>): CallRecord[] {
  return row.calls.map((key) => {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid cached call key');
    const record = JSON.parse(fs.readFileSync(path.join(out, 'cache', `${key}.json`), 'utf8')) as CallRecord;
    if (record.key !== key || record.arm !== row.arm) throw new Error(`Cached call identity mismatch: ${key}`);
    return record;
  });
}
function decisionFailed(row: RunRow, scenario: Scenario, calls: CallRecord[]): boolean {
  return row.failed || row.fallback || row.judgments.length !== scenario.candidates.length ||
    calls.some((call) => call.kind !== 'paid' && requestFailure(call).failed);
}

export function hasSemanticRefusal(call: CallRecord): boolean {
  return Array.isArray(call.response?.answers) && call.response.answers.some((answer) => answer.type === 'refusal') ||
    Object.values(call.response?.result?.answers ?? {}).some((answer) => answer.type === 'refusal');
}
function requestFailure(call: CallRecord) {
  const httpOrTransportFailure = Boolean(call.error) || call.status < 200 || call.status >= 300;
  const semanticRefusal = hasSemanticRefusal(call);
  const timeout = call.timeout3s;
  return { httpOrTransportFailure, semanticRefusal, timeout,
    failed: httpOrTransportFailure || semanticRefusal || timeout };
}
function clientCallTiming(calls: CallRecord[]) {
  const unique = [...new Map(calls.map((c) => [c.key, c])).values()];
  const timing = (subset: CallRecord[]) => ({ n: subset.length,
    p50Ms: percentile(subset.map((c) => c.latencyMs), 0.5),
    p95Ms: percentile(subset.map((c) => c.latencyMs), 0.95),
    p99Ms: percentile(subset.map((c) => c.latencyMs), 0.99) });
  return { ...timing(unique), byKind: Object.fromEntries([...new Set(unique.map((c) => c.kind))].sort()
    .map((kind) => [kind, timing(unique.filter((c) => c.kind === kind))])),
    population: 'Unique referenced decision request keys, including failures/timeouts. Client HTTP duration excludes local limiter/account-discovery waiting; it is not provider server-only latency.' };
}

/** Unique-request reliability: overlapping HTTP/refusal/timeout flags count once in the union. */
export function requestReliability(calls: readonly CallRecord[]) {
  const unique = [...new Map(calls.map((call) => [call.key, call])).values()];
  const flags = unique.map(requestFailure), n = unique.length;
  const httpOrTransportErrorCount = flags.filter((f) => f.httpOrTransportFailure).length;
  const semanticRefusalCount = flags.filter((f) => f.semanticRefusal).length;
  const timeoutCount3s = flags.filter((f) => f.timeout).length;
  const combinedFailureCount = flags.filter((f) => f.failed).length;
  return { n, httpOrTransportErrorCount, httpOrTransportErrorRate: n ? httpOrTransportErrorCount / n : null,
    semanticRefusalCount, semanticRefusalRate: n ? semanticRefusalCount / n : null,
    timeoutCount3s, timeoutRate3s: n ? timeoutCount3s / n : null,
    combinedFailureCount, combinedFailureRate: n ? combinedFailureCount / n : null,
    errorRate: n ? combinedFailureCount / n : null };
}

export function providerQualityCoverage(rows: Evaluation[]) {
  const hosted = rows.filter((row) => row.run.arm !== 'fixture');
  const expectedCandidateJudgments = hosted.reduce((sum, row) => sum + row.choiceLabels.length, 0);
  const availableCandidateJudgments = hosted.reduce((sum, row) => sum + row.providerRaw.filter((p) => p.question === 'addressesGap').length, 0);
  return { applicable: hosted.length > 0, expectedGapPredictions: hosted.length,
    availableRawGapPredictions: hosted.reduce((sum, row) => sum + row.providerRaw.filter((p) => p.question === 'gap').length, 0),
    expectedCandidateJudgments, availableCandidateJudgments,
    unavailableCandidateJudgments: expectedCandidateJudgments - availableCandidateJudgments,
    refusalAffectedRounds: hosted.filter((row) => row.calls.some((c) => c.kind !== 'paid' && hasSemanticRefusal(c))).length,
    wholeRoundFallbackRowsWithEmptyJudgments: hosted.filter((row) => row.fallback && !row.run.judgments.length).length,
    discardedCandidateSlotsOnWholeRoundFallback: hosted.filter((row) => row.fallback && !row.run.judgments.length)
      .reduce((sum, row) => sum + row.choiceLabels.length, 0),
    note: 'Production whole-round fallback serializes judgments=[] when a round/candidate parse fails. Otherwise successful cached candidate answers can therefore be absent from raw provider-quality metrics. They are not reconstructed to bypass refusals; policy metrics retain the entire fixture-substituted round.' };
}

/** Paid calls finish out of order. Match by explicit key, otherwise by exact granted input. */
export function resolvePaidCall(item: { requestKey?: string }, body: string, calls: CallRecord[]): CallRecord | null {
  const paid = [...new Map(calls.filter((call) => call.kind === 'paid').map((call) => [call.key, call])).values()];
  if (item.requestKey !== undefined) {
    const call = paid.find((call) => call.key === item.requestKey);
    if (!call) throw new Error('Paid requestKey is absent from the recorded paid-call keys');
    return call;
  }
  const matches = paid.filter((call) => {
    let passages = call.request?.state?.passages;
    if (!passages && typeof call.request?.input === 'string') {
      try { passages = (JSON.parse(call.request.input) as { passages?: unknown[] }).passages; }
      catch { return false; }
    }
    return Array.isArray(passages) && passages[0] === body;
  });
  // Distinct matching keys are ambiguous, even when their cached durations happen to agree.
  return matches.length === 1 ? matches[0] : null;
}
function predict(row: RunRow, scenario: Scenario, gap: number, judgments: CandidateJudgment[],
  paid: RunRow['paid'], source: Prediction['source']): Prediction[] {
  const prefix = `${row.id}:${row.repeat}`;
  const predictions: Prediction[] = [];
  const add = (question: Question, item: string, y: number, p: number) => {
    if (!isProbability(y) || !isProbability(p)) throw new Error(`Invalid prediction/label ${prefix}:${question}:${item}`);
    predictions.push({ key: `${prefix}:${question}:${item}`, scenarioId: row.id,
      group: scenario.group ?? row.id, question, y, p,
      source: question === 'paid' ? row.arm === 'fixture' ? 'fixture' : 'provider' : source });
  };
  if (isProbability(gap)) add('gap', 'round', gapLabel(scenario), gap);
  if (judgments.length === scenario.candidates.length) scenario.candidates.forEach((candidate, i) => {
    const truth = candidateLabels(candidate);
    if (isProbability(judgments[i].addressesGap)) add('addressesGap', candidate.candidate.resourceId, truth.addressesGap, judgments[i].addressesGap);
    if (isProbability(judgments[i].originality.original)) add('original', candidate.candidate.resourceId,
      Number(truth.originality === 'original'), judgments[i].originality.original);
  });
  paid.forEach((item) => {
    const candidate = scenario.candidates.find((c) => c.candidate.resourceId === item.resourceId);
    if (!candidate || item.label !== candidate.paidLabel) throw new Error(`Paid label mismatch for ${prefix}:${item.resourceId}`);
    if (item.p !== null) add('paid', item.resourceId, candidate.paidLabel, item.p);
  });
  return predictions;
}
function calibrateJudgments(judgments: CandidateJudgment[], models: Record<Question, CalibrationModel>): CandidateJudgment[] {
  return judgments.map((judgment) => ({ ...judgment,
    addressesGap: applyCalibration(models.addressesGap, judgment.addressesGap),
    originality: recalibrateOriginality(judgment.originality, models.original) }));
}
const identityModels = (): Record<Question, CalibrationModel> => ({ gap: identity(), addressesGap: identity(), original: identity(), paid: identity() });

async function reselectRows(rows: Evaluation[], scenarios: Map<string, Scenario>, threshold: number): Promise<Evaluation[]> {
  const { select } = await import('./run.ts');
  const result: Evaluation[] = [];
  for (const row of rows) {
    const selection = await select(scenarios.get(row.run.id)!, row.run.arm,
      row.policyGap, row.policyJudgments, threshold, row.fallback);
    result.push({ ...row, calibrated: { expected: row.raw.expected,
      selected: selection.selected, priceMinor: selection.priceMinor }, policyRows: selection.rows });
  }
  return result;
}

export async function evaluateRows(rows: RunRow[], scenarios: Map<string, Scenario>, out: string,
  models: Record<Question, CalibrationModel>, threshold: number): Promise<Evaluation[]> {
  // Import only the offline helper. evaluate(), call(), and request() are never used here.
  const { select } = await import('./run.ts');
  const { FixtureDecisionProvider } = await import('../../server/agents/decision.js');
  const fixture = new FixtureDecisionProvider();
  const evaluations: Evaluation[] = [];
  for (const row of rows) {
    const scenario = scenarios.get(row.id);
    if (!scenario || scenario.expectedResourceId !== row.expected) throw new Error(`Scenario/expected mismatch for ${row.id}`);
    const calls = loadCalls(out, row), failed = decisionFailed(row, scenario, calls);
    const source = row.arm === 'fixture' ? 'fixture' : failed ? 'fixture-fallback' : 'provider';
    // Paid failures have no recorded fallback in run.ts: keep them missing and report coverage.
    let unresolvedPaidCalls = 0;
    const validPaid = row.paid.filter((item) => {
      if (row.arm === 'fixture') return isProbability(item.p);
      const candidate = scenario.candidates.find((c) => c.candidate.resourceId === item.resourceId);
      if (!candidate) throw new Error(`Unknown paid resource ${item.resourceId}`);
      const call = resolvePaidCall(item, candidate.body, calls);
      if (!call) { unresolvedPaidCalls++; return false; }
      return isProbability(item.p) && !requestFailure(call).failed;
    });
    const normalizedRaw = row.judgments.map((j) => ({ ...j, originality: normalizeOriginality(j.originality) }));
    const roundCall = calls.find((c) => c.kind === 'round' || c.kind === 'batch');
    const observedGap = roundCall && !hasSemanticRefusal(roundCall)
      ? roundCall.response?.result?.answers?.gap_material?.noul ??
        roundCall.response?.answers?.find((a) => a.name === 'gap_material' && a.type === 'predicate')?.probability
      : undefined;
    // A runner-initialized zero after a parse failure is not a measured probability.
    const providerRaw = row.arm === 'fixture' ? [] : predict(row, scenario,
      isProbability(observedGap) ? observedGap : NaN, normalizedRaw,
      row.paid.filter((item) => item.p !== null), 'provider');
    const gap = failed ? (await fixture.judgeRound(scenario)).gapMaterial : row.gap;
    const judgments = failed ? await Promise.all(scenario.candidates.map((c) => fixture.judgeCandidate({
      question: scenario.question, gap: scenario.gap, readSources: scenario.readSources, candidate: c.candidate,
    }))) : normalizedRaw;
    const predictionsRaw = predict(row, scenario, gap, judgments, validPaid, source);
    const predictionsCalibrated = predictionsRaw.map((p) => ({ ...p,
      // Never calibrate fixture substitutes as though they were the failed provider.
      p: source === 'provider' || p.question === 'paid' && row.arm !== 'fixture'
        ? applyCalibration(models[p.question], p.p) : p.p }));
    const calibratedJudgments = !failed && row.arm !== 'fixture' ? calibrateJudgments(judgments, models) : judgments;
    const calibratedGap = !failed && row.arm !== 'fixture' ? applyCalibration(models.gap, gap) : gap;
    const selection = await select(scenario, row.arm, calibratedGap, calibratedJudgments, threshold, failed);
    const rawSelection = await select(scenario, row.arm, row.gap, row.judgments, DEFAULTS[row.arm], failed);
    if (rawSelection.selected !== row.selected || rawSelection.priceMinor !== row.priceMinor ||
      rawSelection.fallback !== row.fallback) throw new Error(`Offline raw replay disagrees with recorded selection for ${row.arm}:${row.id}:${row.repeat}`);
    const truth = scenario.candidates.map(candidateLabels);
    evaluations.push({ run: row,
      raw: { expected: row.expected, selected: row.selected, priceMinor: row.priceMinor },
      calibrated: { expected: row.expected, selected: selection.selected, priceMinor: selection.priceMinor },
      predictionsRaw, predictionsCalibrated, providerRaw,
      choicesRaw: judgments.map((j) => j.originality),
      choicesCalibrated: calibratedJudgments.map((j) => j.originality),
      choiceLabels: truth.map((t) => t.originality), scoreLabels: truth.map((t) => t.credibility),
      scorePredictions: judgments.map((j) => j.credibility), calls, fallback: failed,
      group: scenario.group ?? row.id, policyGap: calibratedGap, policyJudgments: calibratedJudgments,
      roundingCorrections: row.judgments.filter((j) =>
        Object.values(j.originality).reduce((sum, p) => sum + p, 0) !== 1).length,
      policyRows: selection.rows, unresolvedPaidCalls });
  }
  return evaluations;
}

function flattenPredictions(rows: Evaluation[], calibrated = true): Prediction[] {
  return rows.flatMap((row) => calibrated ? row.predictionsCalibrated : row.predictionsRaw);
}
function fourBrier(predictions: Prediction[]): Estimate {
  const scores = QUESTIONS.map((q) => {
    const subset = predictions.filter((p) => p.question === q);
    return subset.length ? subset.reduce((sum, p) => sum + (p.p - p.y) ** 2, 0) / subset.length : null;
  });
  return scores.every((score) => score !== null) ? scores.reduce<number>((sum, score) => sum + score!, 0) / 4 : null;
}
function resultRows(rows: Evaluation[], stage: string, config: string): Record<string, unknown>[] {
  if (!rows.length) return [];
  const arm = rows[0].run.arm, result: Record<string, unknown>[] = [];
  for (const calibrated of [false, true]) {
    const view = calibrated ? 'calibrated-policy' : 'raw-policy';
    const predictions = flattenPredictions(rows, calibrated);
    const decisions = decisionMetrics(rows.map((row) => calibrated ? row.calibrated : row.raw));
    const timing = roundTiming(rows.map((r) => r.run));
    const reliability = requestReliability(rows.flatMap((r) => r.calls).filter((c) => c.kind !== 'paid'));
    result.push({ stage, arm, config, view, question: 'decision', ...decisions,
      wastedSpendSgd: decisions.wastedSpend / 100, meanFourBrier: fourBrier(predictions),
      fallbackRounds: rows.filter((r) => r.fallback).length,
      originalityRoundingCorrections: rows.reduce((sum, r) => sum + r.roundingCorrections, 0),
      unresolvedPaidCalls: rows.reduce((sum, r) => sum + r.unresolvedPaidCalls, 0),
      coldDecisionRounds: timing.cold.n, coldDecisionP95Ms: timing.cold.p95,
      warmDecisionRounds: timing.warm.n, warmDecisionP95Ms: timing.warm.p95,
      legacyCacheUnknownRounds: timing.legacy.n, reconstructedCacheStatusRounds: timing.reconstructedRows,
      uniqueDecisionRequests: reliability.n, httpOrTransportErrorCount: reliability.httpOrTransportErrorCount,
      httpOrTransportErrorRate: reliability.httpOrTransportErrorRate,
      semanticRefusalCount: reliability.semanticRefusalCount, semanticRefusalRate: reliability.semanticRefusalRate,
      combinedFailureCount: reliability.combinedFailureCount, combinedFailureRate: reliability.combinedFailureRate,
      errorRate: reliability.errorRate, providerQualityCoverage: providerQualityCoverage(rows),
      nScenarios: new Set(rows.map((r) => r.run.id)).size });
    for (const question of QUESTIONS) {
      const subset = predictions.filter((p) => p.question === question);
      const metrics = binaryMetrics(subset.map((p) => p.y), subset.map((p) => p.p));
      result.push({ stage, arm, config, view, question, ...metrics,
        hardPositives: subset.filter((p) => p.y === 1).length,
        hardNegatives: subset.filter((p) => p.y === 0).length,
        softLabels: subset.filter((p) => p.y !== 0 && p.y !== 1).length,
        fixtureSubstitutions: subset.filter((p) => p.source === 'fixture-fallback').length });
    }
    result.push({ stage, arm, config, view, question: 'originality', ...multiclassMetrics(
      rows.flatMap((r) => r.choiceLabels), rows.flatMap((r) => calibrated ? r.choicesCalibrated : r.choicesRaw)) });
    result.push({ stage, arm, config, view, question: 'credibility', ...scoreMetrics(
      rows.flatMap((r) => r.scoreLabels), rows.flatMap((r) => r.scorePredictions)) });
  }
  const available = rows.flatMap((row) => row.providerRaw);
  for (const question of QUESTIONS) {
    const subset = available.filter((p) => p.question === question);
    result.push({ stage, arm, config, view: 'provider-parsed-including-late', question,
      ...binaryMetrics(subset.map((p) => p.y), subset.map((p) => p.p)) });
  }
  return result;
}

export function reconstructBaselineCacheHits<T extends { calls: string[]; decisionCacheHits?: number }>(
  rows: T[], kinds: ReadonlyMap<string, string>, smokeKeys: string[] = []): Array<T & {
    decisionCacheHits?: number;
    decisionCacheHitProvenance?: 'runner' | 'baseline-key-history';
  }> {
  const seen = new Set(smokeKeys);
  return rows.map((row) => {
    const decisionKeys = row.calls.filter((key) => {
      if (!kinds.has(key)) throw new Error('Missing call kind during baseline cache reconstruction');
      return kinds.get(key) !== 'paid';
    });
    const hits = decisionKeys.filter((key) => seen.has(key)).length;
    const result = row.decisionCacheHits !== undefined ? { ...row, decisionCacheHitProvenance: 'runner' as const }
      : decisionKeys.length ? { ...row, decisionCacheHits: hits,
        decisionCacheHitProvenance: 'baseline-key-history' as const } : { ...row };
    row.calls.forEach((key) => seen.add(key)); // Paid keys can later reappear too.
    return result;
  });
}

function smokeKeys(out: string, arm: Arm): string[] {
  const file = path.join(out, 'smoke', `${arm}.json`);
  if (!fs.existsSync(file)) return [];
  const record = JSON.parse(fs.readFileSync(file, 'utf8')) as { key?: string };
  if (record.key !== undefined && !/^[a-f0-9]{64}$/.test(record.key)) throw new Error('Invalid smoke request key');
  return record.key ? [record.key] : [];
}

function readRuns(out: string, mode: 'dev' | 'test'): Array<{ file: string; rows: RunRow[] }> {
  const directory = path.join(out, 'runs');
  if (!fs.existsSync(directory)) throw new Error('No run outputs available; analysis makes no provider calls');
  const pattern = mode === 'dev' ? /^(baseline|tune)-.*\.jsonl$/ : /^(test-baseline|final|operational)-.*\.jsonl$/;
  return fs.readdirSync(directory).filter((file) => pattern.test(file)).sort().map((file) => {
    let rows = readJsonLines<RunRow>(path.join(directory, file), mode === 'dev' ? 'dev' : undefined);
    const baseline = /^baseline-baseline-(flash|clef|luna)-0\.jsonl$/.exec(file);
    if (mode === 'dev' && baseline) {
      const kinds = new Map(rows.flatMap((row) => loadCalls(out, row)).map((call) => [call.key, call.kind]));
      rows = reconstructBaselineCacheHits(rows, kinds, smokeKeys(out, baseline[1] as Arm));
    }
    return { file, rows };
  });
}
function complete(rows: RunRow[], scenarios: Scenario[]): boolean {
  return rows.length === scenarios.length && new Set(rows.map((r) => r.id)).size === scenarios.length &&
    scenarios.every((s) => rows.some((r) => r.id === s.id));
}
function better(a: ReturnType<typeof decisionMetrics>, b: ReturnType<typeof decisionMetrics>): boolean {
  return a.f1 > b.f1 + 1e-12 || Math.abs(a.f1 - b.f1) <= 1e-12 && a.wastedSpend < b.wastedSpend;
}

export function enrichTuningLog(out: string, frozen: Partial<Record<Arm, Pick<FrozenArm, 'config'>>>,
  log: Record<string, unknown>[], runs: Array<Pick<RunRow, 'arm' | 'config' | 'repeat' | 'calls'>>) {
  const costs = new Map<string, { uniqueReferencedRequestCount: number; referencedUniqueRequestCostUsd: number }>();
  return log.map((row) => {
    if (!row.status) return row;
    const arm = row.arm as Arm, config = String(row.config), key = `${arm}:${config}`;
    if (!costs.has(key)) {
      const calls = [...new Map(runs.filter((r) => r.arm === arm && r.config === config && r.repeat === 0)
        .flatMap((r) => loadCalls(out, r)).map((c) => [c.key, c])).values()];
      if (calls.some((c) => !Number.isFinite(c.usd) || c.usd < 0)) throw new Error(`Invalid referenced request cost for ${key}`);
      costs.set(key, { uniqueReferencedRequestCount: calls.length,
        referencedUniqueRequestCostUsd: calls.reduce((sum, c) => sum + c.usd, 0) });
    }
    return { ...row, kept: row.status === 'eligible-full-dev' && frozen[arm]?.config === config, ...costs.get(key),
      requestCostConvention: 'Unique exact referenced cache keys for this dev configuration, including paid/error requests. Nonadditive across configurations because keys can be shared; replay-priced references, not incremental API billing or the experiment cost meter.' };
  });
}

/** Offline log enrichment only: frozen model/config/threshold entries are never rewritten. */
export function enrichSavedTuningLog(root = path.resolve('bench/decisions')) {
  const out = path.join(root, 'out');
  const frozen = JSON.parse(fs.readFileSync(path.join(out, 'frozen-config.json'), 'utf8')) as Frozen;
  const analysisFile = path.join(out, 'analysis-dev.json');
  const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf8')) as { frozen: Frozen; tuningLog: Record<string, unknown>[] };
  if (JSON.stringify(analysis.frozen) !== JSON.stringify(frozen)) throw new Error('Dev analysis/frozen snapshot mismatch; cannot enrich tuning log');
  const runs = Object.entries(frozen.metadata.devFiles).flatMap(([file, hash]) => {
    const runFile = path.join(out, 'runs', file);
    if (digest(fs.readFileSync(runFile, 'utf8')) !== hash) throw new Error(`Frozen dev run changed; cannot price its original references: ${file}`);
    return readJsonLines<RunRow>(runFile, 'dev');
  });
  analysis.tuningLog = enrichTuningLog(out, frozen, analysis.tuningLog, runs);
  writeCsv(out, 'tuning-log.csv', analysis.tuningLog);
  writeJson(out, 'analysis-dev.json', analysis);
  return analysis.tuningLog;
}

export async function freeze(root = path.resolve('bench/decisions')): Promise<Frozen> {
  return freezeDev(root, false);
}
export async function refreezeCloudflare(root = path.resolve('bench/decisions')): Promise<Frozen> {
  return freezeDev(root, true);
}
async function freezeDev(root: string, reviseCloudflare: boolean): Promise<Frozen> {
  const out = path.join(root, 'out'), frozenFile = path.join(out, 'frozen-config.json');
  if (!reviseCloudflare && fs.existsSync(frozenFile)) throw new Error('Freeze already exists; refusing to retune after held-out exposure');
  let previous: Frozen | undefined, previousText = '';
  if (reviseCloudflare) {
    if (!fs.existsSync(frozenFile)) throw new Error('Save the initial partial freeze before CF-only refreeze');
    previousText = fs.readFileSync(frozenFile, 'utf8');
    previous = JSON.parse(previousText) as Frozen;
    if (!previous.metadata.cloudflareBlock || previous.metadata.cloudflareRefreeze)
      throw new Error('CF-only refreeze requires an initial quota-blocked freeze; ordinary retuning is prohibited');
    const exposed = fs.readdirSync(path.join(out, 'runs')).filter((file) => /^(test-baseline|final|operational)-.*-(flash|clef)-\d+\.jsonl$/.test(file));
    // Check names only, never read held-out contents during dev refreeze. Even empty files lock the arm.
    if (exposed.length) throw new Error(`CF held-out run file exists; CF refreeze prohibited: ${exposed.join(', ')}`);
  }
  const dev = attachFamilies(root, readJsonLines<Scenario>(path.join(root, 'data', 'scenarios.jsonl'), 'dev'), 'dev');
  if (!dev.length) throw new Error('No dev scenarios available');
  if (previous && digest(JSON.stringify(dev)) !== previous.metadata.devHash) throw new Error('Dev data changed; CF refreeze cannot alter frozen data');
  const scenarios = new Map(dev.map((s) => [s.id, s]));
  if (scenarios.size !== dev.length) throw new Error('Duplicate scenario IDs');
  const files = readRuns(out, 'dev');
  const blockMarker = readCloudflareBlock(out);
  const allCfDev = files.flatMap((f) => f.rows).filter((r) => (r.arm === 'flash' || r.arm === 'clef') && r.repeat === 0);
  const fullCfParity = ['flash', 'clef'].every((arm) => FULL_CONFIGS.every((config) =>
    complete(allCfDev.filter((r) => r.arm === arm && r.config === config), dev)));
  const quotaCall = (c: CallRecord) => c.status === 429 && /4006/.test(`${JSON.stringify(c.response)} ${c.error ?? ''}`);
  if (blockMarker && fullCfParity && allCfDev.flatMap((r) => loadCalls(out, r)).some(quotaCall))
    throw new Error('CF dev still contains code 4006 quota-failure rows; parent must rerun those dev rows before restoring seven-config parity');
  const cloudflareBlock = reviseCloudflare || fullCfParity ? null : blockMarker;
  if (previous) {
    for (const file of files) {
      const cf = /-(flash|clef)-\d+\.jsonl$/.test(file.file);
      if (!cf && previous.metadata.devFiles[file.file] !== digest(fs.readFileSync(path.join(out, 'runs', file.file), 'utf8')))
        throw new Error(`Non-CF dev file changed; frozen Luna/fixture must be preserved: ${file.file}`);
    }
    for (const file of Object.keys(previous.metadata.devFiles))
      if (!/-(flash|clef)-\d+\.jsonl$/.test(file) && !files.some((f) => f.file === file))
        throw new Error(`Non-CF frozen dev file missing: ${file}`);
    for (const arm of ['flash', 'clef'] as const) {
      const rows = files.flatMap((f) => f.rows).filter((r) => r.arm === arm && r.repeat === 0);
      for (const config of FULL_CONFIGS)
        if (!complete(rows.filter((r) => r.config === config), dev)) throw new Error(`Incomplete ${arm}:${config} full dev; CF refreeze requires all seven configurations for both CF arms`);
      const quotaCalls = rows.filter((r) => FULL_CONFIGS.includes(r.config)).flatMap((r) => loadCalls(out, r))
        .filter(quotaCall);
      if (quotaCalls.length) throw new Error('CF dev still contains code 4006 quota-failure rows; parent must rerun those dev rows before CF refreeze');
    }
  }
  const tuningLog: Record<string, unknown>[] = [], curves: Record<string, unknown>[] = [], results: Record<string, unknown>[] = [], devLatency: Record<string, unknown>[] = [];
  const frozen: Frozen = { metadata: { version: 1, seed: DEFAULT_SEED, frozenAt: new Date().toISOString(),
    devHash: digest(JSON.stringify(dev)), devFiles: {}, excludedConfigurations: [], cloudflareBlock,
    eligibleConfigurationsByArm: {}, notes: [
      `Only dev results were inspected. Normally complete full-dev ${FULL_CONFIGS.join('/')} are eligible.`,
      '2026-10-08 pre-held-out dev-only amendment: historical/no-read/abstract-first screens promoted to full dev for every measured hosted arm, with the same seven-configuration budget per arm. Partial screens cannot qualify; parent launches freeze after promotion completes.',
      'CV/bootstrap grouping follows topic familyId from scenario-specs.jsonl, keeping clean/adversarial twins together.',
      'Originality probability sums within .001 of one are normalized as rounding; larger discrepancies throw. Corrections are counted.',
      'Legacy baseline cache hits are reconstructed in per-arm file order, seeded with smoke keys and updating all decision/paid keys. Other unknown-cache rounds are not operational evidence.',
      'Failed decision rounds retain actual whole-round fixture fallback; fallback outputs are not calibrated.',
      'Timed-out/invalid paid outputs stay missing; coverage is disclosed, with no invented paid fallback.',
      'Calibration selection uses grouped out-of-fold Brier per binary question; config/threshold selection uses dev decision F1 then wasted spend.',
      'Paid calibration follows final question wording: evidence/batch-evidence use evidence dev; baseline/batch/historical/no-read/abstract-first use baseline dev. Missing predictions never change the source wording.',
      ...(cloudflareBlock ? ['Pre-held-out quota amendment: Cloudflare HTTP 429 code 4006 daily free allocation exhausted. Flash/Clef eligibility is limited to four completed original configurations; incomplete promotion/quota rows remain logged. Luna retains seven full-dev configurations. This budget/configuration asymmetry precludes a certified cross-provider switch without held-out incumbent evidence; no Cloudflare fixture substitute is scored as provider evidence.'] : []),
      'Original calibration rescales remaining class mass proportionately; when both other raw probabilities are zero they split new other mass equally.',
      'This is original-only binary recalibration plus an explicit simplex transform, not a fitted multinomial calibrator.',
    ], baselineTimingReconstruction: files.filter((f) => f.rows.some((r) => r.decisionCacheHitProvenance === 'baseline-key-history'))
      .map((f) => ({ file: f.file, arm: f.rows[0].arm, seedSmokeKeys: smokeKeys(out, f.rows[0].arm),
        reconstructedRows: f.rows.filter((r) => r.decisionCacheHitProvenance === 'baseline-key-history').length })) } };
  for (const file of files) frozen.metadata.devFiles[file.file] = digest(fs.readFileSync(path.join(out, 'runs', file.file), 'utf8'));
  if (previous) {
    const priorDev = JSON.parse(fs.readFileSync(path.join(out, 'analysis-dev.json'), 'utf8')) as {
      frozen: Frozen; tuningLog: Record<string, unknown>[]; curves: Record<string, unknown>[];
      results: Record<string, unknown>[]; latency: Record<string, unknown>[];
    };
    if (JSON.stringify(priorDev.frozen) !== JSON.stringify(previous)) throw new Error('Prior dev analysis does not match frozen snapshot; refusing CF completion');
    const preserve = (rows: Record<string, unknown>[]) => rows.filter((r) => r.arm !== 'flash' && r.arm !== 'clef');
    tuningLog.push(...preserve(priorDev.tuningLog)); curves.push(...preserve(priorDev.curves));
    results.push(...preserve(priorDev.results)); devLatency.push(...preserve(priorDev.latency));
    frozen.metadata.excludedConfigurations.push(...previous.metadata.excludedConfigurations.filter((entry) => !/^(flash|clef):/.test(entry)));
  }
  for (const arm of ARMS) {
    if (previous && arm !== 'flash' && arm !== 'clef') {
      frozen[arm] = previous[arm];
      if (previous.metadata.eligibleConfigurationsByArm?.[arm])
        frozen.metadata.eligibleConfigurationsByArm![arm] = [...previous.metadata.eligibleConfigurationsByArm[arm]!];
      continue; // Do not refit/reselect Luna or fixture; preserve the dev log and frozen entry.
    }
    const armRows = files.flatMap((file) => file.rows).filter((r) => r.arm === arm && r.repeat === 0);
    if (!armRows.length) continue;
    const baseline = armRows.filter((r) => r.config === 'baseline');
    const eligibleConfigs = arm === 'fixture' ? ['baseline'] : cloudflareBlock && (arm === 'flash' || arm === 'clef') ? QUOTA_CONFIGS : FULL_CONFIGS;
    frozen.metadata.eligibleConfigurationsByArm![arm] = [...eligibleConfigs];
    if (!complete(baseline, dev)) throw new Error(`Incomplete ${arm} baseline dev; freeze requires every scenario, including failed rows`);
    if (arm !== 'fixture') for (const config of eligibleConfigs)
      if (!complete(armRows.filter((r) => r.config === config), dev))
        throw new Error(`Incomplete ${arm}:${config} full dev; finish full-dev configurations before freeze`);
    let best: FrozenArm | undefined;
    for (const config of eligibleConfigs) {
      const rows = armRows.filter((r) => r.config === config);
      if (!complete(rows, dev)) {
        frozen.metadata.excludedConfigurations.push(`${arm}:${config}: missing/incomplete full dev`);
        tuningLog.push({ arm, config, status: 'incomplete-not-eligible', n: rows.length, expectedN: dev.length });
        continue;
      }
      const raw = await evaluateRows(rows, scenarios, out, identityModels(), DEFAULTS[arm]);
      devLatency.push(...latencyRows(raw, config === 'baseline' ? 'baseline-dev' : `tune-dev:${config}`));
      // Final paid questions use evidence wording for both evidence configurations.
      // Select by wording, not by whether a particular dev run has valid paid outputs.
      const paidSource = config === 'evidence' || config === 'batch-evidence' ? 'evidence' : 'baseline';
      const paidSourceRows = armRows.filter((r) => r.config === paidSource);
      if (!complete(paidSourceRows, dev)) throw new Error(`Incomplete ${arm}:${paidSource} paid-calibration source dev`);
      const paidRaw = paidSource === config ? raw : await evaluateRows(paidSourceRows, scenarios, out, identityModels(), DEFAULTS[arm]);
      const calibrationSelection = {} as Record<Question, CalibrationSelection>;
      const calibration = identityModels();
      for (const question of QUESTIONS) {
        const source = question === 'paid' ? paidRaw : raw;
        const points: CalibrationItem[] = source.flatMap((r) => r.predictionsRaw)
          .filter((p) => p.question === question && p.source === 'provider')
          .map((p) => ({ p: p.p, y: p.y, group: p.group, split: 'dev' }));
        const selection = chooseCalibration(points, DEFAULT_SEED);
        calibrationSelection[question] = selection;
        if (arm !== 'fixture') calibration[question] = selection.model;
        tuningLog.push({ arm, config, question, paidSource: question === 'paid' ? paidSource : '',
          calibration: calibration[question].method, n: points.length, nGroups: selection.nGroups,
          folds: selection.foldCount, cvIdentity: selection.cvBrier.identity,
          cvPlatt: selection.cvBrier.platt, cvIsotonic: selection.cvBrier.isotonic });
      }
      let bestThreshold = DEFAULTS[arm], bestMetric: ReturnType<typeof decisionMetrics> | undefined;
      const calibratedRows = await evaluateRows(rows, scenarios, out, calibration, DEFAULTS[arm]);
      // Replays all rounds through the existing policy helper, including failed-provider fallback.
      for (const threshold of THRESHOLDS) {
        const evaluated = await reselectRows(calibratedRows, scenarios, threshold);
        const metric = decisionMetrics(evaluated.map((r) => r.calibrated));
        curves.push({ arm, config, threshold, ...metric, wastedSpendSgd: metric.wastedSpend / 100 });
        if (!bestMetric || better(metric, bestMetric)) { bestMetric = metric; bestThreshold = threshold; }
      }
      const candidate: FrozenArm = { config, threshold: bestThreshold, calibration, calibrationSelection,
        paidCalibrationSource: paidSource, devDecision: bestMetric!, devScenarioCount: dev.length };
      if (!best || better(candidate.devDecision, best.devDecision)) best = candidate;
      tuningLog.push({ arm, config, status: 'eligible-full-dev', threshold: bestThreshold,
        ...candidate.devDecision, paidCalibrationSource: paidSource });
      results.push(...resultRows(await reselectRows(calibratedRows, scenarios, bestThreshold), 'dev', config));
    }
    if (!best) throw new Error(`No eligible configuration for ${arm}`);
    frozen[arm] = best;
    // Keep excluded partial dev/quota runs visible without making them eligible.
    for (const config of [...new Set(armRows.map((r) => r.config))].filter((c) => !eligibleConfigs.includes(c))) {
      const rows = armRows.filter((r) => r.config === config);
      const quotaExcluded = Boolean(cloudflareBlock && (arm === 'flash' || arm === 'clef'));
      const reason = quotaExcluded ? 'Cloudflare quota block; promotion stopped, partial quota/screen rows excluded' : 'screening only';
      frozen.metadata.excludedConfigurations.push(`${arm}:${config}: ${reason}`);
      const excluded = await evaluateRows(rows, scenarios, out, identityModels(), DEFAULTS[arm]);
      tuningLog.push({ arm, config, status: quotaExcluded ? 'quota-blocked-dev-not-eligible' : 'screening-only-not-eligible',
        n: rows.length, expectedN: dev.length, reason, fallbackRounds: excluded.filter((r) => r.fallback).length,
        requestReliability: requestReliability(excluded.flatMap((r) => r.calls)) });
      results.push(...resultRows(excluded, quotaExcluded ? 'quota-excluded-dev' : 'screening-dev', config));
    }
  }
  if (!frozen.flash) throw new Error('Incumbent flash dev results are required to freeze');
  if (blockMarker && fullCfParity) {
    frozen.metadata.cloudflareQuotaResolution = { at: frozen.metadata.frozenAt, previousBlock: blockMarker,
      resolvedMarkerHash: digest(fs.readFileSync(path.join(out, 'blocked-cloudflare.json'), 'utf8')),
      basis: 'Both CF arms have all seven full-dev configurations with no remaining code 4006 dev rows; old block retained as historical provenance.' };
    frozen.metadata.notes.push('Cloudflare quota resolved before this dev freeze: all seven configurations have complete dev coverage for both CF arms and no remaining code 4006 dev rows. The old block marker is historical; configuration parity is restored.');
  }
  if (previous) {
    for (const arm of ['luna', 'fixture'] as const) {
      if (JSON.stringify(frozen[arm]) !== JSON.stringify(previous[arm])) throw new Error(`CF refreeze would change frozen ${arm}; refusing`);
      frozen[arm] = previous[arm];
    }
    frozen.metadata.cloudflareRefreeze = { at: frozen.metadata.frozenAt, previousFrozenHash: digest(previousText),
      previousFrozenAt: previous.metadata.frozenAt, previousBlock: previous.metadata.cloudflareBlock!,
      resolvedMarkerHash: blockMarker ? digest(fs.readFileSync(path.join(out, 'blocked-cloudflare.json'), 'utf8')) : null,
      preservedArms: ['luna', 'fixture'] };
    frozen.metadata.notes.push('CF-only dev refreeze after seven complete configurations for both CF arms and no remaining code 4006 dev rows. No CF held-out run file existed; Luna/fixture dev hashes and frozen calibrators/configurations/thresholds were preserved. The old quota marker is retained as historical provenance, not active held-out blocking evidence.');
    // Save the prior frozen object and prior dev log before replacing anything; keep historical exclusions auditable.
    writeJson(out, 'frozen-config-before-cloudflare-refreeze.json', previous);
    const priorAnalysis = path.join(out, 'analysis-dev.json');
    if (fs.existsSync(priorAnalysis)) fs.copyFileSync(priorAnalysis, path.join(out, 'analysis-dev-before-cloudflare-refreeze.json'));
  }
  const enrichedLog = enrichTuningLog(out, frozen, tuningLog, files.flatMap((f) => f.rows));
  writeCsv(out, 'tuning-log.csv', enrichedLog);
  writeCsv(out, 'threshold-curves.csv', curves);
  writeCsv(out, 'results-dev.csv', results);
  writeCsv(out, 'latency-dev.csv', devLatency);
  writeJson(out, 'analysis-dev.json', { frozen, results, curves, tuningLog: enrichedLog, latency: devLatency });
  // This is the last write: only its presence permits the parent runner to start held-out calls.
  writeJson(out, 'frozen-config.json', frozen);
  return frozen;
}

export function roundTiming(rows: Array<Pick<RunRow, 'decisionCacheHits' | 'decisionCacheHitProvenance' | 'decisionElapsedMs'>>): {
  cold: { n: number; p50: Estimate; p95: Estimate; p99: Estimate };
  warm: { n: number; p50: Estimate; p95: Estimate; p99: Estimate };
  legacy: { n: number; p50: Estimate; p95: Estimate; p99: Estimate };
  reconstructedRows: number;
} {
  rows.forEach((row) => {
    if (row.decisionCacheHits !== undefined && (!Number.isSafeInteger(row.decisionCacheHits) || row.decisionCacheHits < 0))
      throw new Error('Invalid decisionCacheHits');
  });
  const summary = (subset: typeof rows) => ({ n: subset.length,
    p50: percentile(subset.map((r) => r.decisionElapsedMs), 0.5),
    p95: percentile(subset.map((r) => r.decisionElapsedMs), 0.95),
    p99: percentile(subset.map((r) => r.decisionElapsedMs), 0.99) });
  return { cold: summary(rows.filter((r) => r.decisionCacheHits === 0)),
    warm: summary(rows.filter((r) => r.decisionCacheHits !== undefined && r.decisionCacheHits > 0)),
    legacy: summary(rows.filter((r) => r.decisionCacheHits === undefined)),
    reconstructedRows: rows.filter((r) => r.decisionCacheHitProvenance === 'baseline-key-history').length };
}

export function latencyRows(rows: Array<Pick<Evaluation, 'calls' | 'run' | 'fallback'>>, stage: string): Record<string, unknown>[] {
  if (!rows.length) return [];
  const arm = rows[0].run.arm;
  const uniqueCalls = [...new Map(rows.flatMap((r) => r.calls).map((c) => [c.key, c])).values()];
  const result: Record<string, unknown>[] = [];
  for (const kind of [...new Set(uniqueCalls.map((c) => c.kind))].sort()) {
    const calls = uniqueCalls.filter((c) => c.kind === kind), latencies = calls.map((c) => c.latencyMs);
    result.push({ stage, arm, kind, p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95), p99: percentile(latencies, 0.99),
      ...requestReliability(calls),
      meanInputTokens: calls.reduce((sum, c) => sum + c.inputTokens, 0) / calls.length,
      meanUsd: calls.reduce((sum, c) => sum + c.usd, 0) / calls.length,
      estimatedUsageCalls: calls.filter((c) => c.estimatedUsage).length,
      population: 'Unique referenced request keys; cached latencies counted once per stage' });
  }
  const timing = roundTiming(rows.map((r) => r.run)), cold = rows.filter((r) => r.run.decisionCacheHits === 0);
  result.push({ stage, arm, kind: 'round-wall-including-limiter', ...timing.cold,
    population: 'decisionCacheHits === 0 only; includes reconstructed baseline key history where labelled',
    excludedCacheWarm: timing.warm.n, excludedLegacyUnknown: timing.legacy.n,
    reconstructedCacheStatusRows: timing.reconstructedRows,
    fallbackRate: cold.length ? cold.filter((r) => r.fallback).length / cold.length : null });
  result.push({ stage, arm, kind: 'round-wall-cache-warm', ...timing.warm,
    population: 'Harness rounds with at least one reused decision-call key; not uncached operational timing' });
  result.push({ stage, arm, kind: 'round-wall-legacy-cache-status-unknown', ...timing.legacy,
    population: 'Unknown cache status; excluded from operational round timing' });
  result.push({ stage, arm, kind: 'max-call-lower-bound', n: cold.length,
    p50: percentile(cold.map((r) => r.run.networkLowerBoundMs), 0.5),
    p95: percentile(cold.map((r) => r.run.networkLowerBoundMs), 0.95),
    p99: percentile(cold.map((r) => r.run.networkLowerBoundMs), 0.99),
    population: 'No-cache rounds only; longest constituent call is a lower bound' });
  return result;
}

/** Isolated operational data never contribute predictions/decisions to the quality population. */
export function isolatedOperational(rows: RunRow[], expected: Array<{ id: string; group?: string | number }>,
  out: string, config: string) {
  const expectedIds = new Set(expected.map((s) => s.id));
  const seen = new Set<string>();
  const records = rows.map((row) => {
    if (row.split !== 'test' || row.slice !== 'clean' || row.repeat !== 401 || row.config !== config || !expectedIds.has(row.id))
      throw new Error('Operational rows must be held-out clean scenarios at repeat 401 using the frozen config');
    if (seen.has(row.id)) throw new Error('Duplicate isolated operational scenario');
    seen.add(row.id);
    const calls = loadCalls(out, row);
    if (row.paid.length || calls.some((call) => call.kind === 'paid')) throw new Error('Isolated operational runs must have withPaid=false');
    return { run: row, calls, fallback: row.failed || row.fallback || calls.some((c) => requestFailure(c).failed) };
  });
  const timing = roundTiming(rows), cold = records.filter((r) => r.run.decisionCacheHits === 0);
  const calls = [...new Map(records.flatMap((r) => r.calls).map((c) => [c.key, c])).values()];
  const reliability = requestReliability(calls);
  const missing = expected.filter((s) => !seen.has(s.id)).map((s) => s.id);
  const callsComplete = records.length > 0 && records.every((r) => r.calls.length > 0);
  const expectedFamilies = new Set(expected.map((s) => s.group ?? s.id));
  const evidenceComplete = expected.length > 0 && expectedIds.size === expected.length && expectedFamilies.size === expected.length &&
    !missing.length && records.length === expected.length &&
    timing.cold.n === expected.length && callsComplete;
  const p95Pass = timing.cold.p95 !== null ? timing.cold.p95 <= 2500 : null;
  const timeoutPass = reliability.timeoutRate3s !== null ? reliability.timeoutRate3s <= 0.01 : null;
  const meanRoundDecisionCostUsd = cold.length && cold.every((r) => r.calls.length > 0)
    ? cold.reduce((sum, r) => sum + [...new Map(r.calls.map((c) => [c.key, c])).values()].reduce((s, c) => s + c.usd, 0), 0) / cold.length : null;
  return { summary: { source: 'isolated-operational-repeat-401', expectedRounds: expected.length,
      observedRounds: rows.length, independentFamilies: new Set(expected.filter((s) => seen.has(s.id)).map((s) => s.group ?? s.id)).size,
      missing, evidenceComplete, callsComplete, timing, decisionP95Ms: timing.cold.p95,
      requestReliability: reliability, meanRoundDecisionCostUsd,
      clientCallLatency: clientCallTiming(calls),
      costPer1000DecisionRoundsUsd: meanRoundDecisionCostUsd === null ? null : meanRoundDecisionCostUsd * 1000,
      criterion3: { evidenceComplete, p95AtMost2500ms: p95Pass, timeoutRateAtMostOnePercent: timeoutPass,
        eligible: evidenceComplete && p95Pass === true && timeoutPass === true },
      queueConditions: 'One arm at a time per runner protocol. Configured local concurrency cap and token/rate limiter queues remain in round wall time; concurrent other-arm contention is excluded by protocol, external service contention is not measured.',
      tailLimitation: 'Protocol has only 28 clean held-out topic families, one repeat. The p95 tail is determined by very few rounds; this is a small-sample latency estimate, not a precise service SLO.',
      qualityPopulation: 'Excluded from main three-repeat F1/Brier, paired CIs, McNemar and regression quality results' },
    latency: rows.length ? latencyRows(records, 'isolated-operational') : [] };
}

/** Unpaired arm estimates, conditional on frozen tuning, resampling whole topic families. */
export function selfBootstrap(rows: Evaluation[]) {
  const groups = rows.map((r) => r.group);
  const decisions = rows.map((r) => r.calibrated);
  const losses = rows.map((r) => QUESTIONS.map((q) => {
    const subset = r.predictionsCalibrated.filter((p) => p.question === q);
    return { sum: subset.reduce((sum, p) => sum + (p.p - p.y) ** 2, 0), n: subset.length };
  }));
  const f1Samples: number[] = [], brierSamples: number[] = [];
  const questionSamples = QUESTIONS.map(() => [] as number[]);
  const questionEstimates = QUESTIONS.map((_, q) => {
    const n = losses.reduce((sum, r) => sum + r[q].n, 0);
    return n ? losses.reduce((sum, r) => sum + r[q].sum, 0) / n : null;
  });
  if (rows.length) for (const indexes of bootstrapIndexes(rows.length, 10000, DEFAULT_SEED, groups)) {
    f1Samples.push(decisionMetrics(indexes.map((i) => decisions[i])).f1);
    const means = QUESTIONS.map((_, q) => {
      let sum = 0, n = 0;
      for (const i of indexes) { sum += losses[i][q].sum; n += losses[i][q].n; }
      const mean = n ? sum / n : null;
      if (mean !== null) questionSamples[q].push(mean);
      return mean;
    });
    if (means.every((m) => m !== null)) brierSamples.push(means.reduce<number>((sum, m) => sum + m!, 0) / 4);
  }
  const interval = (estimate: Estimate, samples: number[]) => ({ estimate,
    ci: samples.length ? [percentile(samples, 0.025), percentile(samples, 0.975)] : null,
    iterations: 10000, validIterations: samples.length });
  return { nRounds: rows.length, nScenarios: new Set(rows.map((r) => r.run.id)).size,
    nIndependentGroups: new Set(groups).size, seed: DEFAULT_SEED,
    f1: interval(rows.length ? decisionMetrics(decisions).f1 : null, f1Samples),
    brier: interval(questionEstimates.every((m) => m !== null) ? questionEstimates.reduce<number>((sum, m) => sum + m!, 0) / 4 : null, brierSamples),
    perQuestionBrier: Object.fromEntries(QUESTIONS.map((q, i) => [q, { ...interval(questionEstimates[i], questionSamples[i]),
      observations: losses.reduce((sum, r) => sum + r[i].n, 0) }])),
    convention: '95% percentile CI from 10000 whole-topic-family resamples; all variants/candidates/repeats stay together. Brier is the equal mean of four binary question losses; missing-question estimates/resamples are undefined. Conditional on frozen dev tuning, not a provider contrast.' };
}

export function comparisons(a: Evaluation[], b: Evaluation[], view: 'raw' | 'calibrated' = 'calibrated') {
  const key = (r: Evaluation) => `${r.run.id}:${r.run.repeat}`;
  const byB = new Map(b.map((r) => [key(r), r]));
  const pairs = a.filter((r) => byB.has(key(r))).map((r) => [r, byB.get(key(r))!] as const);
  if (!pairs.length) return { pairedRounds: 0, omittedA: a.length, omittedB: b.length, f1: null, brier: null, mcnemar: null };
  const aa = pairs.map(([r]) => r), bb = pairs.map(([, r]) => r), groups = aa.map((r) => r.group);
  pairs.forEach(([a, b]) => { if (a.group !== b.group) throw new Error('Paired group IDs differ'); });
  const decision = (r: Evaluation) => view === 'calibrated' ? r.calibrated : r.raw;
  const predictions = (r: Evaluation) => view === 'calibrated' ? r.predictionsCalibrated : r.predictionsRaw;
  const f1 = pairedBootstrap(aa.map(decision), bb.map(decision),
    (rows) => decisionMetrics(rows).f1, 10000, DEFAULT_SEED, groups);
  // Match individual question/candidate/paid observations before macro-question Brier.
  let omittedPredictionsA = 0, omittedPredictionsB = 0;
  type Losses = Record<Question, { sum: number; n: number }>;
  const losses = (predictions: Prediction[]): Losses => Object.fromEntries(QUESTIONS.map((q) => {
    const subset = predictions.filter((p) => p.question === q);
    return [q, { sum: subset.reduce((sum, p) => sum + (p.p - p.y) ** 2, 0), n: subset.length }];
  })) as Losses;
  const lossA: Losses[] = [], lossB: Losses[] = [];
  for (const [left, right] of pairs) {
    const rightMap = new Map(predictions(right).map((p) => [p.key, p]));
    const matched = predictions(left).filter((p) => rightMap.has(p.key));
    matched.forEach((p) => { if (p.y !== rightMap.get(p.key)!.y) throw new Error('Paired labels differ'); });
    omittedPredictionsA += predictions(left).length - matched.length;
    omittedPredictionsB += predictions(right).length - matched.length;
    lossA.push(losses(matched)); lossB.push(losses(matched.map((p) => rightMap.get(p.key)!)));
  }
  const brier = pairedBootstrap(lossA, lossB, (rows) => {
    let total = 0;
    for (const q of QUESTIONS) {
      const n = rows.reduce((sum, r) => sum + r[q].n, 0);
      if (!n) return null;
      total += rows.reduce((sum, r) => sum + r[q].sum, 0) / n;
    }
    return total / 4;
  }, 10000, DEFAULT_SEED, groups);
  // One independent pair per scenario: correct only if every observed repeat is correct.
  const scenarioIds = [...new Set(groups)].sort();
  const correct = (rows: Evaluation[], id: string | number) => rows.filter((r) => r.group === id)
    .every((r) => decision(r).selected === decision(r).expected);
  return { pairedRounds: pairs.length, nScenarios: new Set(aa.map((r) => r.run.id)).size, nIndependentGroups: scenarioIds.length,
    omittedA: a.length - pairs.length, omittedB: b.length - pairs.length,
    omittedPredictionsA, omittedPredictionsB, f1, brier,
    mcnemar: { ...mcnemar(scenarioIds.map((id) => correct(aa, id)), scenarioIds.map((id) => correct(bb, id))),
      convention: 'Scenario family correct only when every paired variant/repeat selects the expected resource' } };
}

function injectionLift(rows: Evaluation[], specs: FamilySpec[]) {
  const byId = new Map(rows.map((r) => [`${r.run.id}:${r.run.repeat}`, r]));
  const pairs: Array<{ familyId: string; attack: string; repeat: number; delta: number; fallback: boolean }> = [];
  for (const spec of specs) {
    if (!spec.adversarialScenarioId || !spec.attackedResourceId || !spec.cleanResourceId) continue;
    for (const repeat of [1, 2, 3]) {
      const clean = byId.get(`${spec.cleanScenarioId}:${repeat}`);
      const adversarial = byId.get(`${spec.adversarialScenarioId}:${repeat}`);
      if (!clean || !adversarial) continue;
      const cleanValue = clean.policyRows.find((r) => r.id === spec.cleanResourceId)?.value;
      const attackedValue = adversarial.policyRows.find((r) => r.id === spec.attackedResourceId)?.value;
      if (cleanValue === undefined || attackedValue === undefined) throw new Error('Missing spec-mapped clean/adversarial resource');
      pairs.push({ familyId: spec.familyId, attack: spec.attack ?? 'unspecified', repeat,
        delta: attackedValue - cleanValue, fallback: clean.fallback || adversarial.fallback });
    }
  }
  if (!pairs.length) return null;
  return { meanDeltaValue: pairs.reduce((sum, p) => sum + p.delta, 0) / pairs.length,
    maximumDeltaValue: Math.max(...pairs.map((p) => p.delta)), nPairs: pairs.length,
    nFamilies: new Set(pairs.map((p) => p.familyId)).size,
    fallbackPairs: pairs.filter((p) => p.fallback).length, pairs,
    convention: 'Frozen calibrated policy value, attackedResourceId minus cleanResourceId from topic-family specs' };
}

export async function report(root = path.resolve('bench/decisions')): Promise<unknown> {
  const out = path.join(root, 'out'), frozenFile = path.join(out, 'frozen-config.json');
  if (!fs.existsSync(frozenFile)) throw new Error('Save frozen-config.json before reading held-out results');
  const frozenText = fs.readFileSync(frozenFile, 'utf8');
  const frozen = JSON.parse(frozenText) as Frozen;
  const currentMarker = path.join(out, 'blocked-cloudflare.json');
  const resolvedMarker = frozen.metadata.cloudflareQuotaResolution?.resolvedMarkerHash ?? frozen.metadata.cloudflareRefreeze?.resolvedMarkerHash;
  const sameResolvedMarker = (frozen.metadata.cloudflareQuotaResolution || frozen.metadata.cloudflareRefreeze) && (!fs.existsSync(currentMarker) ||
    resolvedMarker === digest(fs.readFileSync(currentMarker, 'utf8')));
  const currentBlock = sameResolvedMarker ? null : readCloudflareBlock(out);
  const historicalBlock = frozen.metadata.cloudflareBlock ?? null;
  const blockEvidence = currentBlock ?? (sameResolvedMarker ? null : historicalBlock);
  const cloudflareResumption = readCloudflareResumption(out, digest(frozenText), frozen);
  const secondAccountBlock = readCloudflareBlock(out, 'blocked-cloudflare-second.json');
  let blockedArms: Array<'flash' | 'clef'> = blockEvidence ? [...(blockEvidence.blockedArms ?? ['flash', 'clef'])] : [];
  if (cloudflareResumption) {
    const explicitlyReblocked = currentBlock?.blockedArms?.includes('flash') && !currentBlock.resumedArms?.includes('flash');
    const laterQuotaBlock = currentBlock?.at && Date.parse(currentBlock.at) >= Date.parse(cloudflareResumption.at) &&
      (currentBlock.blockedArms === undefined || currentBlock.blockedArms.includes('flash'));
    if (!explicitlyReblocked && !laterQuotaBlock) blockedArms = blockedArms.filter((arm) => arm !== 'flash');
    // The account-route amendment authorizes Flash only; preserve full Clef's original block.
    if (historicalBlock && !frozen.metadata.cloudflareQuotaResolution && !frozen.metadata.cloudflareRefreeze && !blockedArms.includes('clef')) blockedArms.push('clef');
    if (secondAccountBlock && !blockedArms.includes('flash')) blockedArms.push('flash');
  }
  const cloudflareBlock = blockEvidence && blockedArms.length ? { ...blockEvidence, blockedArms,
    resumedArms: cloudflareResumption && !blockedArms.includes('flash') ? ['flash'] : blockEvidence.resumedArms ?? [] } : null;
  const data = readJsonLines<Scenario>(path.join(root, 'data', 'scenarios.jsonl'));
  const testRaw = data.filter((s) => s.split === 'test');
  const lock = fs.readFileSync(path.join(out, 'test-lock.txt'), 'utf8').trim();
  if (digest(JSON.stringify(testRaw)) !== lock) throw new Error('Test lock mismatch');
  const test = attachFamilies(root, testRaw, 'test');
  const testSpecs = readJsonLines<FamilySpec>(path.join(root, 'data', 'scenario-specs.jsonl'), 'test');
  const regressionFile = path.join(root, 'data', 'regression.jsonl');
  const regression = fs.existsSync(regressionFile) ? readJsonLines<Scenario>(regressionFile) : [];
  const regressionScopeFile = path.join(root, 'data', 'regression-scope.json');
  const regressionScope = fs.existsSync(regressionScopeFile)
    ? JSON.parse(fs.readFileSync(regressionScopeFile, 'utf8')) as RegressionScope[] : [];
  const scenarios = new Map([...test, ...regression].map((s) => [s.id, s]));
  const dev = attachFamilies(root, data.filter((s) => s.split === 'dev'), 'dev');
  if (digest(JSON.stringify(dev)) !== frozen.metadata.devHash) throw new Error('Dev data changed after freeze');
  const files = readRuns(out, 'test'), finalByArm = new Map<Arm, Evaluation[]>(), baselineByArm = new Map<Arm, Evaluation[]>();
  const results: Record<string, unknown>[] = [], latency: Record<string, unknown>[] = [];
  const completeness: Record<string, unknown>[] = [];
  const finalRecords: Record<string, unknown> = {};
  const operationalRecords: Record<string, unknown> = {};
  for (const arm of ARMS) {
    const config = frozen[arm];
    if (cloudflareBlock && blockedArms.some((blocked) => blocked === arm)) {
      finalRecords[arm] = { status: 'blocked-cloudflare-quota', n: 0, measured: false,
        reason: cloudflareBlock.reason, blockSource: cloudflareBlock.source,
        expectedFinalRounds: (test.length + regression.length) * 3,
        decisions: null, meanFourBrier: null, confidenceIntervals: null, criterion3Eligible: false,
        fixtureSubstituted: false, switchQualificationPass: false };
      completeness.push({ arm, status: 'blocked-cloudflare-quota', observed: 0,
        expected: (test.length + regression.length) * 3, complete: false, blocked: true });
      results.push({ stage: 'final-test', arm, config: config?.config ?? null, question: 'status',
        status: 'blocked-cloudflare-quota', n: 0, reason: cloudflareBlock.reason, fixtureSubstituted: false });
      continue;
    }
    if (!config) continue;
    const operationalRows = files.filter((f) => f.file.startsWith('operational-')).flatMap((f) => f.rows).filter((r) => r.arm === arm);
    const operational = isolatedOperational(operationalRows, test.filter((s) => s.slice === 'clean'), out, config.config);
    operationalRecords[arm] = operational.summary;
    latency.push(...operational.latency);
    if (operationalRows.length) results.push({ stage: 'isolated-operational', arm, config: config.config,
      question: 'operational', nRounds: operational.summary.observedRounds,
      decisionP95Ms: operational.summary.decisionP95Ms, ...operational.summary.requestReliability,
      costPer1000DecisionRoundsUsd: operational.summary.costPer1000DecisionRoundsUsd,
      evidenceComplete: operational.summary.evidenceComplete,
      criterion3Eligible: operational.summary.criterion3.eligible, tailLimitation: operational.summary.tailLimitation });
    const baseline = files.filter((f) => f.file.startsWith('test-baseline-')).flatMap((f) => f.rows).filter((r) => r.arm === arm);
    if (baseline.length) {
      const evaluated = await evaluateRows(baseline, scenarios, out, identityModels(), DEFAULTS[arm]);
      baselineByArm.set(arm, evaluated);
      results.push(...resultRows(evaluated, 'test-baseline', 'baseline'));
      latency.push(...latencyRows(evaluated, 'test-baseline'));
    }
    const finalRows = files.filter((f) => f.file.startsWith('final-')).flatMap((f) => f.rows).filter((r) => r.arm === arm);
    if (finalRows.some((r) => r.config !== config.config)) throw new Error(`Final config differs from freeze for ${arm}`);
    const uniqueKeys = new Set(finalRows.map((r) => `${r.id}:${r.repeat}`));
    if (uniqueKeys.size !== finalRows.length) throw new Error(`Duplicate final rows for ${arm}`);
    const expectedN = (test.length + regression.length) * 3;
    const missing = [...test, ...regression].flatMap((s) => [1, 2, 3].filter((repeat) => !uniqueKeys.has(`${s.id}:${repeat}`)).map((repeat) => `${s.id}:${repeat}`));
    completeness.push({ arm, observed: finalRows.length, expected: expectedN, missing, complete: !missing.length && finalRows.length === expectedN });
    const evaluated = await evaluateRows(finalRows, scenarios, out, config.calibration, config.threshold);
    const heldOut = evaluated.filter((r) => r.run.split === 'test');
    const regressionRows = evaluated.filter((r) => r.run.split !== 'test');
    const regressionResult = regressionComparisons(regressionRows.map((r) => ({ ...r.calibrated,
      id: r.run.id, repeat: r.run.repeat, fallback: r.fallback })), regressionScope, regression.map((s) => s.id));
    finalByArm.set(arm, heldOut);
    results.push(...resultRows(heldOut, 'final-test', config.config));
    latency.push(...latencyRows(heldOut, 'final-test'));
    results.push(...resultRows(regressionRows, 'production-regression', config.config));
    results.push(...regressionResult.rows.map((r) => ({ stage: 'production-regression-expectations',
      arm, config: config.config, view: 'frozen-policy', question: 'selection', ...r })));
    const knownStory = regressionResult.rows.filter((r) => r.storyExpectedKnown);
    if (knownStory.length) results.push({ stage: 'production-regression-story', arm, config: config.config,
      view: 'frozen-policy', question: 'decision', ...decisionMetrics(knownStory.map((r) => ({
        expected: r.storyExpected, selected: r.selected,
        priceMinor: regressionRows.find((e) => e.run.id === r.id && e.run.repeat === r.repeat)!.calibrated.priceMinor,
      }))), switchQualificationPass: regressionResult.switchQualificationPass,
      expectationDiscrepancies: regressionResult.expectedVsStoryDiscrepancies });
    for (const slice of [...new Set(heldOut.map((r) => r.run.slice))].sort())
      results.push(...resultRows(heldOut.filter((r) => r.run.slice === slice), `test-slice:${slice}`, config.config));
    if (!heldOut.length) { finalRecords[arm] = { status: 'no-final-test-rows', n: 0, isolatedOperational: operational.summary }; continue; }
    const decisions = decisionMetrics(heldOut.map((r) => r.calibrated));
    const confidenceIntervals = selfBootstrap(heldOut);
    for (const [question, metric] of [['decision-f1', confidenceIntervals.f1], ['mean-four-brier', confidenceIntervals.brier],
      ...Object.entries(confidenceIntervals.perQuestionBrier).map(([q, m]) => [`${q}-brier`, m] as const)] as const)
      results.push({ stage: 'self-family-bootstrap', arm, config: config.config, question,
        nRounds: confidenceIntervals.nRounds, nIndependentGroups: confidenceIntervals.nIndependentGroups,
        estimate: metric.estimate, ciLow: metric.ci?.[0], ciHigh: metric.ci?.[1],
        bootstrapIterations: metric.iterations, validBootstrapIterations: metric.validIterations });
    const calls = [...new Map(heldOut.flatMap((r) => r.calls).map((c) => [c.key, c])).values()];
    const decisionCalls = calls.filter((c) => c.kind !== 'paid');
    const reliability = requestReliability(decisionCalls);
    const decisionKeysComplete = arm === 'fixture' || heldOut.every((r) => r.calls.some((c) => c.kind !== 'paid'));
    const timing = roundTiming(heldOut.map((r) => r.run));
    const cold = heldOut.filter((r) => r.run.decisionCacheHits === 0);
    const costRows = arm === 'fixture' ? heldOut : cold;
    const roundCost = costRows.length && costRows.every((r) => arm === 'fixture' || r.calls.some((c) => c.kind !== 'paid'))
      ? costRows.reduce((sum, r) => sum + [...new Map(r.calls.filter((c) => c.kind !== 'paid').map((c) => [c.key, c])).values()]
        .reduce((s, c) => s + c.usd, 0), 0) / costRows.length : null;
    const paidAuditCostUsd = calls.filter((c) => c.kind === 'paid').reduce((sum, c) => sum + c.usd, 0);
    const paidPredictions = flattenPredictions(heldOut).filter((p) => p.question === 'paid');
    finalRecords[arm] = { status: !missing.length && finalRows.length === expectedN ? 'measured-final-runs-complete' : 'partial-final-runs',
      config: config.config, threshold: config.threshold, decisions, confidenceIntervals,
      switchQualificationPass: regressionResult.switchQualificationPass ? null : false,
      meanFourBrier: fourBrier(flattenPredictions(heldOut)),
      decisionP95Ms: operational.summary.decisionP95Ms,
      decisionP95Source: 'isolated-operational-repeat-401', isolatedOperational: operational.summary,
      criterion3Eligible: operational.summary.criterion3.eligible,
      concurrentFinalDecisionP95Ms: timing.cold.p95, coldDecisionRounds: timing.cold.n,
      concurrentFinalTiming: { ...timing,
        queueConditions: cloudflareResumption ? 'Flash resumed on a user-authorized second account. Each arm has configured local concurrency/rate queues; cross-model or external-account contention cannot be inferred from pooled final files.' : cloudflareBlock ? 'Luna is the only hosted arm after the Cloudflare block; intrinsic local two-request cap/rate queues remain, with no concurrent other hosted model in the run protocol.' : 'Multi-arm final runs include local two-request provider cap/rate queues and cross-arm contention; flash and full Clef share a vendor limiter' },
      cacheWarmDecisionRounds: timing.warm.n, cacheWarmDecisionP95Ms: timing.warm.p95,
      legacyCacheUnknownRounds: timing.legacy.n, legacyCacheUnknownP95Ms: timing.legacy.p95,
      cacheStatusReconstructedRows: timing.reconstructedRows,
      operationalTimingEvidenceAvailable: operational.summary.evidenceComplete,
      timeoutRate3s: operational.summary.requestReliability.timeoutRate3s,
      timeoutRateSource: 'isolated-operational-repeat-401', concurrentFinalTimeoutRate3s: reliability.timeoutRate3s,
      errorRate: reliability.errorRate,
      httpOrTransportErrorRate: reliability.httpOrTransportErrorRate,
      semanticRefusalRate: reliability.semanticRefusalRate, combinedFailureRate: reliability.combinedFailureRate,
      requestReliability: reliability, providerQualityCoverage: providerQualityCoverage(heldOut),
      clientCallLatency: clientCallTiming(decisionCalls),
      fallbackRounds: heldOut.filter((r) => r.fallback).length,
      costPer1000DecisionRoundsUsd: arm === 'fixture' ? 0 : operational.summary.costPer1000DecisionRoundsUsd,
      costRoundPopulation: arm === 'fixture' ? 'Fixture has no paid provider requests' : 'Isolated operational clean rounds with decisionCacheHits === 0 only',
      costRoundCount: arm === 'fixture' ? costRows.length : operational.summary.timing.cold.n,
      concurrentFinalCostPer1000DecisionRoundsUsd: roundCost === null ? null : roundCost * 1000,
      referencedUniqueDecisionCostUsd: decisionCalls.reduce((sum, c) => sum + c.usd, 0),
      decisionKeysComplete,
      wastedSpendSgdPerRepeat: decisions.wastedSpend / 100 / 3,
      wastedSpendSgdPer1000Rounds: decisions.wastedSpend / 100 / heldOut.length * 1000,
      paidAuditCostUsd,
      paidAuditCostPer1000RoundsUsd: paidAuditCostUsd / heldOut.length * 1000,
      paidAuditCostPopulation: 'Unique referenced paid request keys, divided by all observed decision rounds',
      expectedPaidPredictions: heldOut.reduce((sum, r) => sum + scenarios.get(r.run.id)!.paidResourceIds.length, 0),
      observedTimelyPaidPredictions: paidPredictions.length,
      paidMissingOrLate: heldOut.reduce((sum, r) => sum + scenarios.get(r.run.id)!.paidResourceIds.length, 0) - paidPredictions.length,
      unresolvedPaidCalls: heldOut.reduce((sum, r) => sum + r.unresolvedPaidCalls, 0),
      regression: regressionResult.rows, regressionGate: { ...regressionResult, rows: undefined },
      injectionLift: injectionLift(heldOut, testSpecs), positionBias: null, stability: null,
      unmeasured: ['Option-permutation/stability outputs must be joined separately; they are not inferred from ordinary runs'] };
  }
  const flash = finalByArm.get('flash') ?? [], comparisonsByArm: Record<string, unknown> = {}, baselineComparisons: Record<string, unknown> = {};
  for (const arm of ARMS.filter((a) => a !== 'flash'))
    if (flash.length && finalByArm.get(arm)?.length) comparisonsByArm[arm] = comparisons(finalByArm.get(arm)!, flash);
  for (const arm of ARMS.filter((a) => a !== 'flash'))
    if (baselineByArm.get('flash')?.length && baselineByArm.get(arm)?.length)
      baselineComparisons[arm] = comparisons(baselineByArm.get(arm)!, baselineByArm.get('flash')!, 'raw');
  const comparisonsVsFixture: Record<string, ReturnType<typeof comparisons>> = {};
  if (finalByArm.get('luna')?.length && finalByArm.get('fixture')?.length)
    comparisonsVsFixture.luna = comparisons(finalByArm.get('luna')!, finalByArm.get('fixture')!);
  for (const [stage, records, reference] of [['paired-tuned-vs-flash', comparisonsByArm, 'flash'],
    ['paired-baseline-vs-flash', baselineComparisons, 'flash'], ['paired-tuned-vs-fixture', comparisonsVsFixture, 'fixture']] as const) {
    for (const [arm, record] of Object.entries(records)) {
      const comparison = record as ReturnType<typeof comparisons>;
      results.push({ stage, arm, comparison: reference, question: 'decision-f1',
        pairedRounds: comparison.pairedRounds, difference: comparison.f1?.difference,
        estimateA: comparison.f1?.estimateA, estimateB: comparison.f1?.estimateB,
        ciLow: comparison.f1?.ci?.[0], ciHigh: comparison.f1?.ci?.[1],
        ciArmLow: comparison.f1?.ciA?.[0], ciArmHigh: comparison.f1?.ciA?.[1],
        validBootstrapIterations: comparison.f1?.validIterations,
        mcnemarP: comparison.mcnemar?.pValue, discordants: comparison.mcnemar?.discordants,
        mcnemarAOnly: comparison.mcnemar?.b, mcnemarBOnly: comparison.mcnemar?.c });
      results.push({ stage, arm, comparison: reference, question: 'mean-four-brier',
        pairedRounds: comparison.pairedRounds, difference: comparison.brier?.difference,
        estimateA: comparison.brier?.estimateA, estimateB: comparison.brier?.estimateB,
        ciLow: comparison.brier?.ci?.[0], ciHigh: comparison.brier?.ci?.[1],
        ciArmLow: comparison.brier?.ciA?.[0], ciArmHigh: comparison.brier?.ciA?.[1],
        validBootstrapIterations: comparison.brier?.validIterations });
    }
  }
  const devAnalysisFile = path.join(out, 'analysis-dev.json');
  if (fs.existsSync(devAnalysisFile)) {
    const devAnalysis = JSON.parse(fs.readFileSync(devAnalysisFile, 'utf8')) as { latency?: Record<string, unknown>[] };
    if (devAnalysis.latency) latency.unshift(...devAnalysis.latency);
  }
  const qaFile = path.join(out, 'label-qa.json');
  const qa = fs.existsSync(qaFile) ? JSON.parse(fs.readFileSync(qaFile, 'utf8')) as {
    model: string; sampleCount: number; completed: number; agreement: unknown; note?: string;
  } : null;
  const robustnessFile = path.join(out, 'robustness.json');
  const robustness = fs.existsSync(robustnessFile) ? JSON.parse(fs.readFileSync(robustnessFile, 'utf8')) as {
    summary: Partial<Record<Arm, Record<string, unknown>>>; note?: string;
  } : null;
  const robustnessDiagnostics = Object.fromEntries(ARMS.map((arm) => {
    const measured = robustness?.summary?.[arm];
    const diagnostic = measured ? { source: 'out/robustness.json', label: 'baseline-wording-diagnostic',
      split: 'dev', configuration: 'baseline', frozenConfiguration: frozen[arm]?.config ?? null,
      finalConfigurationMeasurement: false, summary: measured, sourceNote: robustness?.note ?? null,
      convention: 'Raw individual-candidate baseline wording; stability repeats and cyclic originality option-order permutations. Separate dev diagnostic, not final batched/calibrated policy sensitivity or switch qualification.' } : null;
    if (finalRecords[arm]) (finalRecords[arm] as Record<string, unknown>).baselineWordingDiagnostic = diagnostic;
    return [arm, diagnostic];
  }));
  const incumbentComplete = completeness.some((c) => c.arm === 'flash' && c.complete === true);
  const latencyConditionsByArm = Object.fromEntries(ARMS.map((arm) => [arm, arm === 'fixture' || blockedArms.some((a) => a === arm) ? null :
    arm === 'flash' && cloudflareResumption ? { source: cloudflareResumption.source,
      accountChanged: true, maxInFlight: cloudflareResumption.maxInFlight,
      maxRequestsPerMinute: cloudflareResumption.maxRequestsPerMinute, requestStartSpacingMs: cloudflareResumption.requestStartSpacingMs,
      roundWallTimeIncludesLocalLimiter: true, clientCallTimeExcludesLocalLimiter: true } :
      { source: 'preregistered original route and transport.ts', accountChanged: false, maxInFlight: 2,
        maxRequestsPerMinuteCeiling: 150, requestStartSpacingMs: 410,
        roundWallTimeIncludesLocalLimiter: true, clientCallTimeExcludesLocalLimiter: true }]));
  for (const arm of ARMS) if (finalRecords[arm]) (finalRecords[arm] as Record<string, unknown>).latencyConditions = latencyConditionsByArm[arm];
  const regressionFailures = ARMS.filter((arm) => arm !== 'fixture' &&
    (finalRecords[arm] as { regressionGate?: { switchQualificationPass?: boolean } } | undefined)?.regressionGate?.switchQualificationPass === false);
  const regressionDiscrepancies = [...new Set(regressionFailures.flatMap((arm) =>
    (finalRecords[arm] as { regressionGate?: { expectedVsStoryDiscrepancies?: string[] } }).regressionGate?.expectedVsStoryDiscrepancies ?? []))];
  const retainIncumbent = !incumbentComplete || regressionFailures.length > 0;
  const qualificationReason = !incumbentComplete ? 'Incumbent held-out evidence is missing or incomplete; no switch can be certified.' :
    regressionFailures.length ? `Production regression qualification fails or is incomplete for ${regressionFailures.join('/')}${regressionDiscrepancies.length ? `; oracle/story discrepancy: ${regressionDiscrepancies.join('/')}` : ''}. Paired performance estimates cannot override this gate.` :
      'Parent must apply the full preregistered rule with separate QA/position/stability evidence.';
  const summary = { status: cloudflareBlock ? 'partial-cross-provider-quota' : completeness.every((c) => c.complete) && completeness.length ? 'measured-final-runs-complete' : 'partial-final-runs',
    frozenHash: digest(frozenText), testLock: lock, seed: DEFAULT_SEED, bootstrapIterations: 10000,
    synthetic: true, final: finalRecords, isolatedOperational: operationalRecords, robustnessDiagnostics,
    comparisonsVsFlash: comparisonsByArm, baselineComparisonsVsFlash: baselineComparisons, comparisonsVsFixture, completeness,
    cloudflareBlock, originalCloudflareBlock: historicalBlock, blockedArms,
    resumedArms: cloudflareBlock?.resumedArms ?? (cloudflareResumption ? ['flash'] : []), cloudflareResumption,
    secondAccountBlock, latencyConditionsByArm,
    latencyComparison: { comparableHarnessConditions: !cloudflareResumption,
      reason: cloudflareResumption ? 'Resumed Flash uses a different account and gentler one-in-flight/50-RPM route versus Luna two-in-flight/below-150-RPM. Round wall time includes limiter waiting; cross-arm round latency is not an intrinsic model speed comparison. Raw client-call timings are separate and still reflect network/account/time-window differences.' : 'Original routes used the preregistered shared concurrency/rate ceilings; topology and vendor/network differences still require qualification.' },
    eligibleConfigurationsByArm: frozen.metadata.eligibleConfigurationsByArm ?? null,
    cloudflareRefreeze: frozen.metadata.cloudflareRefreeze ?? null,
    cloudflareQuotaResolution: frozen.metadata.cloudflareQuotaResolution ?? null,
    switchQualification: { incumbent: 'flash', retainIncumbent, qualified: false, incumbentComplete,
      regressionFailures, regressionDiscrepancies, reason: qualificationReason },
    baselineTimingReconstruction: frozen.metadata.baselineTimingReconstruction ?? [],
    regressionScopeSource: fs.existsSync(regressionScopeFile) ? 'data/regression-scope.json' : null,
    labelQa: qa ? { source: 'out/label-qa.json', model: qa.model, sampleCount: qa.sampleCount,
      completed: qa.completed, agreement: qa.agreement, note: qa.note } : null,
    decision: retainIncumbent ? `Retain incumbent Flash: ${qualificationReason}` : 'No switch recommendation computed: the parent applies the preregistered rule and joins separate position/stability evidence; missing evidence cannot pass.',
    notes: [
      'Effect directions are arm minus named reference. Brier contrasts use matching observations and topic-family resampling; absent Flash evidence produces no Flash contrast.',
      'Per-arm F1/Brier 95% CIs resample 10000 whole topic families independently of any comparison arm. They remain conditional on frozen dev tuning and do not establish switch qualification.',
      ...(cloudflareBlock ? [`Cloudflare quota blocks only these held-out arms: ${blockedArms.join('/')}. Flash/Clef used four full dev configurations while Luna used seven: configuration/budget asymmetry is disclosed, and the study remains partial for blocked arms. No fixture substitute is presented as their provider evidence.`] : []),
      ...(cloudflareResumption ? ['The user explicitly authorized a second Cloudflare account for Flash only. Final/operational Flash uses its existing frozen calibration, evidence wording and threshold; no dev promotion or refreeze occurred. The public token alias is routing provenance, never a token value. Original account/quota history is preserved; account/time-window changes are a study limitation.'] : []),
      'F1 includes failed rounds with actual fixture fallback. Paid failure outputs are missing, never substituted or invented.',
      'HTTP-200 type:refusal responses are semantic failures. Unique-request HTTP/transport, refusal, and timeout counts are separate; their union is combinedFailureRate and compatibility errorRate.',
      'A refused round has no raw gap probability. Whole-round parsing can drop good candidate answers from serialized judgments=[]; raw provider-quality coverage is explicitly counted rather than reconstructed through a refusal.',
      'McNemar uses independent scenario families: every paired variant/repeat must be correct.',
      'Operational round wall time/cost use zero-cache-hit rows only. Warm and unknown-cache timings are separate; call latency deduplicates keys.',
      'Criterion 3 uses isolated one-arm-at-a-time clean test repeat 401 (28 families) with no paid audit calls. Concurrent final timing is separate; operational judgments never enter three-repeat quality estimates.',
      'Isolated wall time includes each arm\'s configured local concurrency and rate/token queues (resumed Flash one in flight/50 RPM, original Luna two/below-150 RPM). These are harness settings; the 28-family p95 tail has substantial small-sample uncertainty.',
      'Legacy baseline cache status is reconstructed in per-arm original row order with smoke keys seeded and all row keys added; reconstruction provenance is preserved.',
      'Regression oracle/story comparisons are separate; their UC3 discrepancy prevents regression switch qualification.',
      'Parent out/label-qa.json supersedes the standalone dataset notes about whether independent label QA was done; no absent agreement numbers are invented.',
      'Decision cost excludes paid post-grant audit calls; measured metered costs may be conservative estimates when usage is absent.',
      'Raw-policy rows use production/default thresholds; calibrated-policy rows use frozen threshold and calibrators.',
      'Robustness is a separately labelled baseline-wording dev diagnostic; absent arms remain null. It does not populate final-configuration position/stability evidence.',
      'Tuning-log status rows include kept and unique exact referenced request cost. Costs include paid/error references, are nonadditive across configurations with shared keys, and do not represent incremental API billing.',
    ] };
  if (fs.existsSync(devAnalysisFile)) enrichSavedTuningLog(root);
  writeCsv(out, 'results-test.csv', results); writeCsv(out, 'latency.csv', latency);
  writeJson(out, 'summary.json', summary);
  return summary;
}

async function main(): Promise<void> {
  const modes = ['--freeze', '--complete-cloudflare-freeze', '--refreeze-cloudflare', '--report'].filter((mode) => process.argv.includes(mode));
  if (modes.length !== 1) throw new Error('Choose exactly one of --freeze, --complete-cloudflare-freeze (alias --refreeze-cloudflare), or --report');
  if (modes[0] !== '--report') {
    const result = modes[0] === '--freeze' ? await freeze() : await refreezeCloudflare();
    console.log(JSON.stringify({ action: modes[0].slice(2), output: 'bench/decisions/out/frozen-config.json',
      arms: Object.fromEntries(ARMS.filter((arm) => result[arm]).map((arm) => [arm, {
        config: result[arm]!.config, threshold: result[arm]!.threshold,
        calibration: Object.fromEntries(QUESTIONS.map((q) => [q, result[arm]!.calibration[q].method])),
      }])) }, null, 2));
  } else {
    await report(); console.log(JSON.stringify({ action: 'report', output: 'bench/decisions/out/summary.json' }));
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
});
