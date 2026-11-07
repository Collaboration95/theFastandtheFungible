// Story-bible UC1–UC3 in fixture mode (#139): the fixture answer names the bible's
// gap in free text, and the fixture decision gives the bible's verdicts.
import { writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { ContentEnvelope, PublicCandidate } from '../shared/contracts/index.js'
import { decide } from '../server/agents/decision.js'
import { writeAnswer } from '../server/agents/research.js'

type BibleArticle = { articleId: string; publisherSlug: string; writerSlug: string; tier: 'FREE' | 'PAID'; priceMinor: number; family: string; derivedFrom?: string; title: string; tags: string[]; facts: { text: string }[]; expectedRelevance?: number }
type UseCase = { id: string; question: string; articles: BibleArticle[]; expectedPicks: { round1: string | null; round2: string | null; skippedRewrite: string } }
const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8')) as { useCases: UseCase[] }
// Credibility from the publisher kind, as retrieval maps it.
const authority = (slug: string) => ({ records: 2, masthead: 1.5, independent: 1 } as Record<string, number>)[(JSON.parse(readFileSync(`data/writers/${slug}.json`, 'utf8')) as { publisher: { kind: string } }).publisher.kind]
const candidate = (a: BibleArticle): PublicCandidate => ({
  profileId: a.publisherSlug, resourceId: a.articleId, version: 'v1', title: a.title, publisher: a.publisherSlug, preview: a.title, price: { amountMinor: a.priceMinor, currency: 'SGD' },
  family: a.family, ...(a.derivedFrom ? { derivedFrom: a.derivedFrom } : {}), facets: a.tags, authority: authority(a.publisherSlug), tier: a.tier,
  license: { kind: 'SYNTHETIC', attribution: a.publisherSlug }, publisherSlug: a.publisherSlug, relevance: a.expectedRelevance ?? 0.5,
})
const content = (a: BibleArticle): ContentEnvelope => ({ profileId: a.publisherSlug, resourceId: a.articleId, version: 'v1', title: a.title, publisher: a.publisherSlug, body: a.facts.map(f => f.text).join(' '), spans: a.facts.map((f, i) => ({ id: `p${i}`, text: f.text })) })
function setup(id: string) {
  const useCase = bible.useCases.find(u => u.id === id)!
  const candidates = useCase.articles.map(candidate)
  const free = useCase.articles.filter(a => a.tier === 'FREE' && a.facts.length)
  return { useCase, candidates, contents: free.map(content), readSources: candidates.filter(c => c.tier === 'FREE') }
}
async function round(id: string, boughtResourceIds: string[] = []) {
  const { useCase, candidates, contents, readSources } = setup(id)
  const { answer } = await writeAnswer({ question: useCase.question, candidates, contents, version: 1 })
  const decision = await decide({ question: useCase.question, conclusion: answer.conclusion, gap: answer.openGaps[0]?.text ?? '', candidates, readSources, budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, boughtResourceIds })
  return { useCase, answer, decision, verdict: (resourceId: string) => decision.rows.find(r => r.candidate.resourceId === resourceId)?.verdict }
}

const grid = [0.10,0.15,0.20,0.26,0.281,0.30]
const rows: Record<string, {sha256: string; decisions: unknown}> = {}
for (const threshold of grid) {
 process.env.BUY_THRESHOLD=String(threshold)
 const decisions=[]
 for (const id of ['UC1','UC2','UC3']) {
  const first=await round(id); decisions.push({id,round:1,rows:first.decision.rows})
  if(id==='UC3') decisions.push({id,round:2,rows:(await round(id,[first.useCase.expectedPicks.round1!])).decision.rows})
 }
 const bytes=JSON.stringify(decisions)
 rows[String(threshold)]={sha256:createHash('sha256').update(bytes).digest('hex'),decisions}
}
assert.equal(new Set(Object.values(rows).map(r => r.sha256)).size, 1, 'UC decision row bytes changed')
writeFileSync('docs/evidence/p1-threshold/uc-rows.json',JSON.stringify(rows,null,2)+'\n')
