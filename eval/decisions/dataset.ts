// The per-candidate calibration dataset (#207): one JSONL row per candidate per decide() round, with the raw decision
// scores and labels from the question bank. Labels are eval-side ground truth (the harness may read article passages;
// the decision model never does). Rows group by question and by topic family (the bank's lane) for grouped CV.
//
// Labels, per row (1, 0, or null = unknown, left out of fitting that target):
// - addressesGap: 1 when the candidate is a listed source of the requested fact or one of its passages holds the fact's
//   needles; null when it shares a family with, or derives from, a listed source (it may paraphrase the figure);
//   0 otherwise.
// - original: 0 for a rewrite (derivedFrom) or a family already read; 1 otherwise.
// - buy: 1 when the fact is still open on the evidence read, the candidate is a PAID listed source (or the bank's
//   expect.buy) and original; 0 for the avoid list, a closed fact, or any other candidate; null when addressesGap is null.
import fs from 'node:fs'
import path from 'node:path'
import type { DecisionRound, PublicCandidate, PublicSourceRef } from '../../shared/contracts/index.js'
import { factHolds, type Fact, type Question } from '../questions/bank.js'
import type { World } from './world.js'

export const DATASET_SCHEMA = 'tftf.decision-dataset/v1'
export type Label = 0 | 1 | null
export type DatasetRow = {
  schema: typeof DATASET_SCHEMA
  questionId: string; family: string; kind: Question['kind']; factId: string | null; factOpen: boolean; gap: string; round: number; mode: 'sweep' | 'flow'
  resourceId: string; publisherSlug: string; priceMinor: number
  provider: string; model: string; promptVersion: string | null
  addressesGap: number; originality: { original: number; rewrite: number; overlap: number }; credibility: number
  gapMaterial: number; value: number; verdict: string; threshold: number
  labels: { addressesGap: Label; original: Label; buy: Label }; labelSource: string; unknown: boolean
}

/** Ground truth for one candidate against one requested fact (or the question's expectations when no fact is targeted). */
export function labelCandidate(world: World, q: Question, fact: Fact | undefined, factOpen: boolean, candidate: PublicCandidate, readSources: PublicSourceRef[]): Pick<DatasetRow, 'labels' | 'labelSource' | 'unknown'> {
  const article = world.articles.get(candidate.resourceId)
  const sources = fact ? fact.sources : q.requested.flatMap(f => f.sources)
  const sourceFamilies = new Set(sources.map(id => world.articles.get(id)?.family).filter(Boolean))
  const listed = sources.includes(candidate.resourceId)
  const holds = Boolean(article && (fact ? [fact] : q.requested).some(f => article.passages.some(p => factHolds(f, p.text))))
  const related = Boolean(candidate.derivedFrom && sources.includes(candidate.derivedFrom)) || sourceFamilies.has(candidate.family)
  const addressesGap: Label = listed || holds ? 1 : related ? null : 0
  const original: Label = candidate.derivedFrom || readSources.some(s => s.family === candidate.family) ? 0 : 1
  const avoid = q.expect.avoid?.includes(candidate.resourceId) ?? false
  const expected = q.expect.buy === candidate.resourceId && (!fact || fact.sources.includes(candidate.resourceId))
  const buy: Label = avoid || !factOpen ? 0 : addressesGap === null ? null : (listed || expected) && candidate.tier === 'PAID' && original === 1 ? 1 : 0
  const labelSource = avoid ? 'avoid' : listed ? 'sources' : expected ? 'expect.buy' : holds ? 'needles' : related ? 'related-to-source' : 'other'
  return { labels: { addressesGap, original, buy }, labelSource, unknown: addressesGap === null || buy === null }
}

/** One dataset row per candidate the model judged in this round (a round with no model call yields none). */
export function datasetRows(world: World, q: Question, decision: DecisionRound, context: { fact?: Fact; factOpen: boolean; readSources: PublicSourceRef[]; mode: DatasetRow['mode'] }): DatasetRow[] {
  if (!decision.gap.trim()) return []
  return decision.rows.map(row => ({
    schema: DATASET_SCHEMA, questionId: q.id, family: q.lane, kind: q.kind, factId: context.fact?.id ?? null, factOpen: context.factOpen, gap: decision.gap, round: decision.round, mode: context.mode,
    resourceId: row.candidate.resourceId, publisherSlug: row.candidate.publisherSlug ?? row.candidate.profileId, priceMinor: row.candidate.price.amountMinor,
    provider: decision.provider, model: decision.model, promptVersion: decision.promptVersion ?? null,
    addressesGap: row.judgment.addressesGap, originality: row.judgment.originality, credibility: row.judgment.credibility,
    gapMaterial: decision.gapMaterial, value: row.value, verdict: row.verdict, threshold: decision.threshold,
    ...labelCandidate(world, q, context.fact, context.factOpen, row.candidate, context.readSources),
  }))
}

export function writeJsonl(file: string, rows: unknown[]) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''))
  return path.resolve(file)
}
export const readJsonl = <T>(file: string): T[] => fs.readFileSync(file, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line) as T)
