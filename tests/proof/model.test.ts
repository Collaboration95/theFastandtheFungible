import { expect, it } from 'vitest'
import { checkModel, mutations } from '../../scripts/proof/model.js'
it.each(['key-reveal', 'conditional'] as const)('exhausts bounded %s protocol with crashes and retries', mode => {
  const result = checkModel({ intents: 2, crashes: 1, retries: 1, mode })
  expect(result.violations).toEqual([])
  expect(result.states).toBeGreaterThan(100)
  expect(result.transitions).toBeGreaterThan(result.states)
})
it.each(mutations)('detects seeded mutation %s with a counterexample', mutation => {
  const expected = { 'early-body':'G1', 'budget-race':'G2', 'llm-intent':'G2', 'invented-citation':'G4', 'missing-label':'G5', 'duplicate-charge':'G3', 'crash-double-charge':'G3' }
  const result = checkModel({ crashes: 1, retries: 1 }, mutation)
  expect(result.violations).toContain(expected[mutation])
  expect(result.trace.length).toBeGreaterThan(1)
  if (mutation === 'crash-double-charge') expect(result.trace.join(' ')).toMatch(/crash.*restart.*retry/)
})
