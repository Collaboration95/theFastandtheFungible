import { afterEach, expect, it, vi } from 'vitest'
import { requestedPassageScores } from '../server/agents/fact-selection.js'
import { loadBank } from '../eval/questions/bank.js'
import { candidateOf, loadWorld } from '../eval/decisions/world.js'
import { factMenuMismatch } from '../server/agents/scope-policy.js'
import { decide, type DecisionProvider } from '../server/agents/decision.js'
afterEach(() => vi.unstubAllEnvs())
it('preserves arbitrary short process identifiers while ranking accessible passages', () => {
  const passages = ['N8 prices in 2027: $100 versus $80 in 2026.', 'N9 prices in 2027: $120 versus $90 in 2026.', 'Wafer prices changed in 2027 versus 2026.']
  for (const [i, node] of ['N8', 'N9'].entries()) {
    const scores = requestedPassageScores(`How did ${node} wafer prices change between 2026 and 2027?`, passages)
    expect(scores.indexOf(Math.max(...scores))).toBe(i)
  }
  expect(requestedPassageScores('N9 wafer prices', ['N9 wafer prices are undisclosed.'])[0]).toBe(0)
})
it.each(['Q09', 'Q13', 'Q35'])('dev %s: wafer price scope rejects energy even with perfect scores and keeps the intended source', async id => {
  const w = await loadWorld(), q = loadBank().questions.find(q => q.id === id)!
  const gap = q.requested.find(f => /wafer/.test(f.need))!.need
  const correct = candidateOf(w, w.articles.get(q.expect.buy!)!)
  const wrong = candidateOf(w, w.articles.get('notfinancialtimes-malaysia-renewable-energy-integration-into-grid-challenges')!)
  const provider: DecisionProvider = { name: 'fixture', model: 'test', judgeRound: async () => ({ gapMaterial: 1 }), judgeCandidate: async () => ({ addressesGap: 1, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 2 }) }
  const input = { question: q.question, conclusion: '', gap, requirement: true, accessibleEvidence: [], readSources: [], budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, provider }
  expect(factMenuMismatch(gap, wrong)).toBe(true)
  expect((await decide({ ...input, candidates: [wrong] })).selectedResourceId).toBeUndefined()
  expect(factMenuMismatch(gap, correct)).toBe(false)
  expect((await decide({ ...input, candidates: [correct] })).selectedResourceId).toBe(correct.resourceId)
  expect(factMenuMismatch(gap, { ...wrong, manifest: undefined })).toBe(false)
  expect(factMenuMismatch(gap, { ...wrong, version: 'forged' })).toBe(false)
})
