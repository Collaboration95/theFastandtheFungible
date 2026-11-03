import { expect, it, afterEach, vi } from 'vitest'
import { scopeContradiction } from '../server/agents/scope-policy.js'
import { loadWorld, candidateOf } from '../eval/decisions/world.js'
import { decide, type DecisionProvider } from '../server/agents/decision.js'
afterEach(() => vi.unstubAllEnvs())
it('rejects an explicit wrong-country source even with all-high scores, while preserving unknown and same-country scopes', async () => {
  const world = await loadWorld()
  const candidate = candidateOf(world, world.articles.get('marketpulse-vietnam-corporate-bond-market-outlook-trends-projections')!)
  expect(scopeContradiction('Singapore-dollar corporate bond issuance', candidate)).toBe(true)
  expect(scopeContradiction('Vietnam corporate bond issuance', candidate)).toBe(false)
  expect(scopeContradiction('Compare Vietnam and Singapore bond issuance', candidate)).toBe(false)
  expect(scopeContradiction('Corporate bond issuance', candidate)).toBe(false)
  expect(scopeContradiction('Singapore bond issuance', { ...candidate, manifest: undefined })).toBe(false)
  expect(scopeContradiction('Singapore bond issuance', { ...candidate, version: 'tampered' })).toBe(false)
  const provider: DecisionProvider = { name: 'fixture', model: 'test', judgeRound: async () => ({ gapMaterial: 1 }), judgeCandidate: async () => ({ addressesGap: 1, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 2 }) }
  const input = { question: 'Singapore corporate bonds', conclusion: '', gap: 'Singapore corporate bond issuance', requirement: true, candidates: [candidate], accessibleEvidence: [], readSources: [], budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, provider }
  expect((await decide(input)).selectedResourceId).toBeUndefined()
  vi.stubEnv('DECISION_SCOPE_POLICY', 'off')
  expect((await decide(input)).selectedResourceId).toBe(candidate.resourceId)
})
