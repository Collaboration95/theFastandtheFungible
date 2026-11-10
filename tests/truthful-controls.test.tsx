import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RunActivity from '../src/components/RunActivity'
import { staged } from '../src/stage'
import { ucRuns } from '../src/fixtures/run'
import type { RunSnapshot } from '../shared/contracts'
const render = (run: RunSnapshot, actualTerminal: boolean) => renderToStaticMarkup(<RunActivity run={run} actualTerminal={actualTerminal} stopping={false} onStop={() => {}} onShowWork={() => {}} />)
it('actual terminal state disables Stop while an explicit replay is still searching', () => {
  const run = ucRuns.UC3
  const prefix = staged(run, run.events.find(e => e.type === 'SEARCH')!.id)
  expect(render(prefix, false)).toContain('Stop buying')
  expect(render(prefix, true)).not.toContain('Stop buying')
})
it.each([['CHALLENGED','Refund requested for'], ['CHALLENGE_REFUSED','Refund refused for'], ['CHALLENGE_REJECTED','Refund refused for']] as const)('%s cannot be labelled refunded by an old timeline row', (status, label) => {
  const run = structuredClone(ucRuns.UC3)
  for (const intent of run.intents) if (intent.status === 'REFUNDED') intent.status = status
  run.refundedMinor = 0
  const html = render(run, true)
  expect(html).toContain(label)
  expect(html).not.toContain('Refunded AlphaLeak')
})
