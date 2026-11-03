import { expect, it } from 'vitest'
import { candidateOf, loadWorld } from '../eval/decisions/world.js'
import { factMenuMismatch } from '../server/agents/scope-policy.js'
import { requestedPassageScores } from '../server/agents/fact-selection.js'
it('uses arbitrary entities and periods outside the old corpus range; unknown signatures stay unknown', async () => {
  const world = await loadWorld(), base = [...world.articles.values()].find(a => a.tier === 'PAID')!
  const make = (entity: string, period: string) => candidateOf(world, { ...base, articleId: `unit-${entity}`, title: `${entity} capacity register`, body: `${entity} capacity 73 in 2037.`, passages: [{ id: 'p1', text: `${entity} capacity 73 in 2037.` }], factMenu: { p1: { entity, measure: 'capacity', period } } })
  const right = make('Velvet', 'twenty thirty seven'), wrong = make('Indigo', 'twenty thirty seven')
  expect(factMenuMismatch('What capacity did Velvet report in 2037?', right)).toBe(false)
  expect(factMenuMismatch('What capacity did Velvet report in 2037?', wrong)).toBe(true)
  expect(factMenuMismatch('What capacity did Velvet report in 2038?', right)).toBe(true)
  expect(factMenuMismatch('What capacity did Velvet report in 2037?', { ...wrong, version: 'forged' })).toBe(false)
  expect(factMenuMismatch('What capacity did Velvet report in 2037?', { ...wrong, manifest: undefined })).toBe(false)
  expect(factMenuMismatch('What price did Velvet report?', right)).toBe(false)
  expect(factMenuMismatch('What price did Velvet report?', wrong)).toBe(true)
})
it('keeps arbitrary acronyms and mixed identifiers without treating their digits as a result', () => {
  const ps = ['XYZ throughput reached 73 units.', 'ABC throughput reached 81 units.', 'R7 throughput is undisclosed.']
  const scores = requestedPassageScores('XYZ throughput', ps)
  expect(scores[0]).toBeGreaterThan(scores[1])
  expect(requestedPassageScores('R7 throughput', [ps[2]])).toEqual([0])
})
