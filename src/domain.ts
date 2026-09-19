export type AccessTier = 'OPEN' | 'PREMIUM'
export type FixtureLicense = {
  kind: 'SYNTHETIC_FIXTURE'
  label: string
  attribution: string
  bodyAccess: 'OPEN' | 'SERVER_ONLY_UNTIL_PURCHASE'
}
export type Decision = 'BUY' | 'SKIP' | 'BLOCKED' | 'DEFER' | 'PENDING'
export type Phase = 'DRAFT' | 'PLANNING' | 'DISCOVERING' | 'RANKING' | 'READING_OPEN' | 'GAP_ANALYSIS' | 'PURCHASE_PLANNING' | 'PURCHASED' | 'SYNTHESIZING' | 'DOSSIER_READY' | 'CANCELLED'
export type Source = {
  id: string; publisher: string; title: string; date: string; kind: 'ARTICLE' | 'REPORT' | 'DATASET_QUERY'; accessTier: AccessTier;
  priceCents: number; preview: string; tags: string[]; entities: string[]; authority: 'HIGH' | 'MEDIUM' | 'LOW'; originality: 'ORIGINAL' | 'DERIVATIVE';
  familyId: string; familyLabel: string; relevance: number; gapMatch: number; novelty: number; trustNote: string; license: FixtureLicense; fixture: true; siteKey?: string; xrpDrops?: number;
  decision?: Decision; reason?: string; purchasedAt?: string; evidenceSpans?: { id: string; label: string; text: string }[];
  payment?: { mode: 'fixture' | 'live'; network: string; amountDrops: number; transactionHash?: string; ledgerIndex?: number; explorerUrl?: string; settlement: string };
}
export type RuntimeStatus = {
  mode: 'fixture' | 'live';
  label: 'FIXTURE RESEARCH' | 'XRPL TESTNET RESEARCH';
  settlement: 'SIMULATION_NOT_SETTLED' | 'VALIDATED';
  network: 'fixture' | 'testnet';
}
export type Claim = { id: string; text: string; stance: 'SUPPORTS' | 'CHALLENGES' | 'UNCERTAIN'; materiality: 'MATERIAL' | 'CONTEXT'; sourceIds: string[]; familyCount: number; spanIds: string[] }
export type DossierDraft = {
  mode: 'GROQ RESEARCH' | 'FIXTURE RESEARCH'; title: string; conclusion: string;
  changedAfterPaidResearch: { before: string; afterNorthstar?: string; after: string }; afterLabel?: string;
  claims: Claim[]; uncertainty: string; method: string;
  provider: 'groq' | 'fixture'; model: string; status: 'LIVE' | 'FALLBACK';
}
export type ResearchConfig = {
  question: string;
  decision: string;
  horizon: string;
  tokenLimit: number;
  budgetCents: number;
  sourceTypes: string[];
  sourceAllowlist?: string[];
  walletMode: 'PARTNER_DEMO' | 'XRPL_TESTNET';
  approvalPolicy: 'MANUAL_APPROVAL_REQUIRED';
  perSourceCeilingCents: number;
}

/**
 * A finance-specific method is a visible, deterministic input to a research
 * run. It is deliberately not a model/persona identifier: the approach is
 * represented by the serializable priorities and steps in the plan artifact.
 */
export type ResearchApproach = 'BALANCED_DILIGENCE' | 'THESIS_STRESS_TEST' | 'BUDGET_FIRST_SCAN'

export type ResearchEvidencePriority = {
  id: string;
  label: string;
  rationale: string;
  signals: string[];
  minimumIndependentFamilies: number;
}

export type ResearchPlanStepKind = 'FRAME_QUESTION' | 'READ_OPEN_EVIDENCE' | 'MAP_EVIDENCE_FAMILIES' | 'IDENTIFY_GAP' | 'COMPARE_PREMIUM_METADATA' | 'REQUEST_MANUAL_APPROVAL' | 'RECORD_EVIDENCE_IMPACT' | 'SYNTHESIZE_CITED_DOSSIER'

export type ResearchPlanStep = {
  id: string;
  order: number;
  kind: ResearchPlanStepKind;
  title: string;
  objective: string;
  evidencePriorityIds: string[];
  guard: {
    access: 'NO_ACCESS_GRANT';
    payment: 'NO_PAYMENT_AUTHORIZATION';
  };
}

export type ResearchPlanStopCondition = {
  id: string;
  label: string;
  condition: string;
  outcome: 'STOP_AND_REPORT' | 'STOP_BEFORE_PREMIUM_REVIEW' | 'CONTINUE_WITH_UNCERTAINTY';
}

export type ResearchPlanConfig = Pick<ResearchConfig, 'question' | 'decision' | 'horizon' | 'tokenLimit' | 'budgetCents' | 'sourceTypes'> & {
  sourceAllowlist?: string[];
}

export type ResearchPlanArtifact = {
  artifact: 'RESEARCH_PLAN';
  version: 1;
  approach: ResearchApproach;
  config: ResearchPlanConfig;
  evidencePriorities: ResearchEvidencePriority[];
  steps: ResearchPlanStep[];
  stopConditions: ResearchPlanStopCondition[];
  budgetIntent: {
    totalBudgetCents: number;
    perSourceCeilingCents: number;
    strategy: 'BALANCE_EVIDENCE' | 'CHALLENGE_THESIS' | 'OPEN_BASELINE_FIRST';
    premiumGate: 'MANUAL_APPROVAL_REQUIRED';
    overBudget: 'BLOCK';
  };
  executionBoundary: {
    sourcePolicy: 'CANONICAL_FIXTURE_CATALOG';
    premiumBodies: 'SERVER_ONLY_UNTIL_PURCHASE';
    access: 'MANUAL_APPROVAL_REQUIRED';
    payment: 'MANUAL_APPROVAL_REQUIRED';
    runtimeLabels: ['FIXTURE RESEARCH', 'XRPL TESTNET RESEARCH'];
  };
}

/** Alias used by callers that refer to the artifact simply as a research plan. */
export type ResearchPlan = ResearchPlanArtifact

export type Run = {
  runId: string; version: number; phase: Phase; paused: boolean; cancelled: boolean; budgetCents: number; spentCents: number;
  sources: Source[]; events: { id: string; type: string; label: string; at: string }[]; gap: { question: string; importance: 'HIGH'; state: 'OPEN' | 'PARTIAL' | 'RESOLVED' };
  thesis: { open: string; afterNorthstar?: string; afterMeridian?: string; current: string }; claims: Claim[]; dossierReady: boolean; dossier?: DossierDraft; llm: { provider: string; status: string; model: string }; semanticStatus: 'precomputed' | 'unavailable';
  config: ResearchConfig; runtime: RuntimeStatus; plan?: ResearchPlanArtifact; purchaseKeys?: Record<string, string>; purchasePlan?: { sourceId: string; reason: string; gap: string; provider: 'groq' | 'fixture'; model: string; status: 'LIVE' | 'FALLBACK' };
}

export const QUESTION = 'Is the AI data-centre investment boom sustainable through 2028?'
export const XRP_TO_SGD_CENTS = 1000
export const CURRENT_XRP_BALANCE = 10
export const DEFAULT_BUDGET_CENTS = 200
export const MIN_BUDGET_CENTS = 50
export const MAX_BUDGET_CENTS = 1000
export const CANONICAL_THESIS = 'Announced demand and capital commitments support continued expansion, but the evidence is concentrated in company statements and does not resolve power-delivery constraints.'
export const AFTER_NORTHSTAR = 'Independent supplier reporting corroborates near-term demand while adding equipment-delivery bottlenecks.'
export const AFTER_MERIDIAN = 'The boom can continue, but operating capacity through 2028 is likely to lag announced spending in grid-constrained markets; interconnection and power availability are more material risks than the open-source baseline suggested.'
export const GAP_QUESTION = 'Independent reporting on grid-connection lead times and whether announced data-centre capacity can become operational by 2028.'

export function normalize(text: string): string[] { return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/).filter(Boolean) }
export function tfidfScore(query: string, source: Source): number { const q = new Set(normalize(query)); const d = new Set(normalize(`${source.title} ${source.preview} ${source.tags.join(' ')} ${source.entities.join(' ')}`)); return q.size ? [...q].filter((token) => d.has(token)).length / q.size : 0 }
export function rankSources(query = QUESTION, input: readonly Source[] = []): Source[] { return [...input].sort((a,b) => (b.relevance + b.gapMatch * 0.2 + tfidfScore(query,b)*20 - (b.originality === 'DERIVATIVE' ? 18 : 0)) - (a.relevance + a.gapMatch * 0.2 + tfidfScore(query,a)*20 - (a.originality === 'DERIVATIVE' ? 18 : 0))) }
export function utility(source: Source, remainingCents: number): number { const value = .24*(source.gapMatch/100)+.18*(source.relevance/100)+.16*(source.authority==='HIGH'?1:source.authority==='MEDIUM'?.65:.35)+.16*(source.novelty/100)+.12*(source.originality==='ORIGINAL'?1:.2)+.10*(source.gapMatch/100)+.04*.8-.20*(source.originality==='DERIVATIVE'?.9:.05); return Math.round(value*1000)/1000 }
