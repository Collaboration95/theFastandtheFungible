import { expect, it } from 'vitest'
import { leadFinding } from '../shared/lead-finding'
import { ucRuns } from './fixtures/run'
import { validatedAnswers } from './components/Answer'

it('UC3 answers the trend with dated numbers instead of the author introduction', () => {
  const run = ucRuns.UC3
  const selected = leadFinding(run.question, validatedAnswers(run).at(-1)!.claims)
  expect(selected).toHaveLength(1)
  expect(selected[0].text).toMatch(/26 weeks to 18 weeks/)
  expect(selected[0].text).not.toMatch(/I run procurement/)
  expect(selected[0].claim.citations.every(ref => ref.resourceId.includes('fab-floor'))).toBe(true)
  expect(selected[0].claim.text).toContain(selected[0].text)
})
it('UC2 selects the analyst estimate and preserves decimal percentages', () => {
  const run = ucRuns.UC2
  expect(leadFinding(run.question, validatedAnswers(run).at(-1)!.claims)[0].text).toContain('55.2% from 58.5%')
})
it('UC1 answers both the policy change and yield reaction', () => {
  const run = ucRuns.UC1
  const text = leadFinding(run.question, validatedAnswers(run).at(-1)!.claims).map(i => i.text).join(' ')
  expect(text).toContain('0.75% to 1.00%')
  expect(text).toContain('+9 bp')
})
it('cannot select a paid finding after its grant is removed or its proof fails', () => {
  for (const change of ['grant','proof']) {
    const run = structuredClone(ucRuns.UC3)
    if (change === 'grant') run.grants = []
    else run.intents.forEach(i => { i.status = 'CLAIM_FAILED' })
    const selected = leadFinding(run.question, validatedAnswers(run).at(-1)!.claims)
    expect(selected.every(item => item.claim.citations.every(ref => run.candidates.find(c => c.resourceId === ref.resourceId)?.tier === 'FREE'))).toBe(true)
  }
  expect(leadFinding('Q?', [])).toEqual([])
})
