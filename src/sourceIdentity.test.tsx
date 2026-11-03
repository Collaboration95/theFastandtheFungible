import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { citationNumbers, getValidatedAnswer } from './components/Answer'
import { getAccessibleContent } from './components/Sources'
import { ReceiptBundleSchema } from '../shared/contracts/receipts.js'
import { RunSnapshotSchema } from '../shared/contracts/run.js'
import { exampleRun } from '../shared/contracts/examples.js'
import Sources from './components/Sources'
import { sourceKey } from '../shared/source-identity.js'
it('renders both collided origins and binds each passage and citation independently', () => {
  const b = ReceiptBundleSchema.parse(JSON.parse(readFileSync('docs/evidence/round2-f/receipt-v2.json','utf8')))
  const run = RunSnapshotSchema.parse({ ...exampleRun, runId: b.runId, candidates:b.candidates, contents:b.sources, answers:b.answers, grants:b.grants, intents:b.intents, receipts:b.receipts })
  const collided = run.candidates.filter(c => c.profileId === 'collision')
  expect(new Set(collided.map(sourceKey)).size).toBe(2)
  for(const c of collided) expect(getAccessibleContent(run,c)?.source).toEqual(c.source)
  expect(getValidatedAnswer(run, run.answers[0])?.claims.flatMap(c => c.citations).filter(c=>c.source?.profileId === 'collision')).toHaveLength(2)
  const markup = renderToStaticMarkup(<Sources run={run}/>)
  for(const c of collided) expect(markup).toContain(c.source!.origin)
  const refs = collided.map(c => ({source:c.source,resourceId:c.resourceId,version:c.version,spanId:'p1'}))
  expect(citationNumbers([{...run.answers[0],claims:[{id:'both',text:'evidence',stance:'SUPPORTS',citations:refs}]}]).size).toBe(2)
})
