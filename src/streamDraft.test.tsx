import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Answer, { validatedAnswers } from './components/Answer'
import { staged } from './stage'
import { ucRuns } from './fixtures/run'
import { exampleAnswer, exampleRun } from '../shared/contracts/examples'

const html = (run: typeof exampleRun) => renderToStaticMarkup(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} />)
it('shows the free draft until a checked answer arrives, with real citation links', () => {
  const run = { ...exampleRun, answers: [], events: [{ id: 1, runId: exampleRun.runId, type: 'FREE_DRAFT', label: 'Draft', at: '', data: { answer: exampleAnswer } }] }
  expect(html(run)).toContain('Draft · free sources only')
  expect(html(run)).toContain('exact passage')
  expect(validatedAnswers(run)).toEqual([exampleAnswer])
  expect(validatedAnswers({ ...run, contents: [] })).toEqual([])
})
it('every UC3 replay prefix withholds paid passages and citations until its grant; refunds never become claims', () => {
  const run = ucRuns.UC3
  const paid = run.contents.filter(c => run.candidates.some(p => p.tier === 'PAID' && p.resourceId === c.resourceId))
  expect(paid.length).toBeGreaterThan(0)
  for (const event of run.events) {
    const shown = staged(run, event.id)
    for (const content of paid) if (!shown.grants.some(g => g.resourceId === content.resourceId)) {
      expect(shown.contents.some(c => c.resourceId === content.resourceId)).toBe(false)
      for (const span of content.spans.filter(s => s.text.length > 100)) expect(html(shown)).not.toContain(span.text)
    }
    expect(validatedAnswers(shown).flatMap(a => a.claims.flatMap(c => c.citations)).some(c => c.resourceId.includes('alphaleak'))).toBe(false)
  }
  expect(html(run)).toContain('Updated with paid evidence')
  expect(html(run)).toContain('26 weeks to 18 weeks')
})
