import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Answer from '../src/components/Answer'
import Verification from '../src/components/Verification'
import { exampleRun, exampleCandidate, exampleAnswer } from '../shared/contracts/examples.js'
import type { PurchaseIntent } from '../shared/contracts/index.js'

const cite = [{ resourceId: 'example-free', version: 'v1', spanId: 'demand-1' }]
it('hides uncertain claims below the relevance floor but keeps related ones', () => {
  const run = { ...exampleRun, phase: 'DONE' as const, question: 'Can the fictional operator expansion be operating by 2028?', answers: [{ ...exampleAnswer, claims: [
    { id: 'on', text: 'The fictional operator expansion operating by 2028 is unclear.', stance: 'UNCERTAIN' as const, citations: cite },
    { id: 'off', text: "The Bank of Japan's gathering on 2026-09-30 was no exception.", stance: 'UNCERTAIN' as const, citations: cite },
  ] }] }
  const html = renderToStaticMarkup(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} />)
  expect(html).toContain('A fictional operator announces a 600 MW expansion supported by contracted demand.')
  expect(html).not.toContain('Unclear')
  expect(html).not.toContain('Bank of Japan')
})

it('lists promises with digit years, no duplicates, capped at five', () => {
  const claims = ['twenty twenty seven', 'twenty twenty seven', 'twenty twenty eight', 'twenty twenty eight', 'twenty twenty nine', 'twenty twenty six', 'twenty twenty five', 'twenty twenty four'].map((period, i) => ({ id: `c${i}`, covers: { entity: 'Kestrel', measure: 'prepayment', period }, kind: 'dated-figure' }))
  const intent = { ...exampleRun.intents[0], intentId: 'i', profileId: exampleCandidate.profileId, resourceId: exampleCandidate.resourceId, version: 'v1', status: 'VERIFIED' } as unknown as PurchaseIntent
  const run = { ...exampleRun, intents: [intent], candidates: [{ ...exampleCandidate, manifest: { claims } }] } as unknown as typeof exampleRun
  const html = renderToStaticMarkup(<Verification run={run} intent={intent} />)
  expect(html).not.toContain('twenty twenty')
  expect(html).toContain('Mentions Kestrel and prepayment in 2027')
  expect(html.match(/Mentions Kestrel and prepayment in 2027/g)).toHaveLength(1)
  expect(html.match(/<li/g)).toHaveLength(6)
  expect(html).toContain('and 1 more')
})
