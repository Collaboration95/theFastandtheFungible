import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../../publisher/corpus.js'
import { assertNoLeaks, canary, type Observation } from './harness.js'
import type { Grant } from '../../shared/contracts/index.js'

// Poisoned responses prove that the process oracle would reject actual leaks;
// passing end-to-end runs alone cannot establish that the detector is effective.
describe('premium leak oracle', () => {
  it('gate-1: rejects raw/JSON-escaped paid spans and per-resource body canaries without grants', async () => {
    const resources = await loadCorpus()
    for (const resource of resources.filter(c => c.tier === 'PAID')) {
      for (const marker of [canary(resource.resourceId), ...resource.spans.map(s => s.text)]) {
        const response: Observation = { kind: 'poisoned SSE/model/API', runId: 'run-a', raw: JSON.stringify({ leaked: marker }), grants: [] }
        expect(() => assertNoLeaks([response], resources)).toThrow(`leaked ${resource.resourceId}`)
      }
    }
  })

  it('requires the grant to match the response run, resource and version', async () => {
    const resources = await loadCorpus()
    const resource = resources.find(c => c.resourceId === 'grid-operators-report')!
    const grant: Grant = { runId: 'run-a', resourceId: resource.resourceId, version: resource.version, intentId: 'intent-a', contentDigest: 'fixture-digest', grantedAt: new Date().toISOString() }
    const observation: Observation = { kind: 'poisoned request', runId: 'run-a', raw: canary(resource.resourceId), grants: [grant] }
    expect(() => assertNoLeaks([observation], resources)).not.toThrow()
    for (const change of [{ runId: 'run-b' }, { resourceId: 'northstar-wire' }, { version: 'not-this-version' }]) {
      expect(() => assertNoLeaks([{ ...observation, grants: [{ ...grant, ...change }] }], resources)).toThrow('leaked grid-operators-report')
    }
    expect(() => assertNoLeaks([{ ...observation, raw: canary('gridscope-asia') }], resources)).toThrow('leaked gridscope-asia')
  })

  it('allows independently public evidence repeated in the open-sufficient variant', async () => {
    const resources = await loadCorpus('open-sufficient')
    const publicSpan = resources.find(c => c.resourceId === 'equipment-orderbook')!.spans[1].text
    expect(() => assertNoLeaks([{ kind: 'free evidence', raw: publicSpan, grants: [] }], resources)).not.toThrow()
  })
})
