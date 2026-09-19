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
}
export type Run = {
  runId: string; version: number; phase: Phase; paused: boolean; cancelled: boolean; budgetCents: number; spentCents: number;
  sources: Source[]; events: { id: string; type: string; label: string; at: string }[]; gap: { question: string; importance: 'HIGH'; state: 'OPEN' | 'PARTIAL' | 'RESOLVED' };
  thesis: { open: string; afterNorthstar?: string; afterMeridian?: string; current: string }; claims: Claim[]; dossierReady: boolean; dossier?: DossierDraft; llm: { provider: string; status: string; model: string }; semanticStatus: 'precomputed' | 'unavailable';
  config: ResearchConfig; runtime: RuntimeStatus; purchaseKeys?: Record<string, string>; purchasePlan?: { sourceId: string; reason: string; gap: string; provider: 'groq' | 'fixture'; model: string; status: 'LIVE' | 'FALLBACK' };
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
