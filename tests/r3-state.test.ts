import { appendFileSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { resources } from './helpers/resource-scope'
import { join } from 'node:path'
import { atomicJson, readObservations, resumeState, lockLedger, assertRealCorpus, reserveModelCall } from '../eval/r3-state.js'
it('retains completed runs and refuses a changed bank, provider or corpus on resume', () => {
  const dir = resources().tempDir('r3-resume-'), path = join(dir, 'results.json')
  const identity = { bank: 'bank-v1', decision: 'fixture', corpus: 'real' }
  {
    expect(resumeState(path, identity)).toBeUndefined()
    atomicJson(path, { identity, results: [{ arm: 'paid', id: 'Q01', runId: 'durable' }] })
    expect(resumeState(path, identity)).toMatchObject({ results: [{ runId: 'durable' }] })
    for (const changed of [{ bank: 'bank-v2' }, { decision: 'openai' }, { corpus: 'synthetic' }]) {
      expect(() => resumeState(path, { ...identity, ...changed })).toThrow('configuration changed')
    }
  }
})

it('recovers complete wire observations after a killed partial append', () => {
  const path = join(resources().tempDir('r3-wire-'), 'wire.jsonl')
  appendFileSync(path, '{"id":1}\n{"id":2}\n{"id":')
  expect(readObservations(path)).toEqual([{ id: 1 }, { id: 2 }])
  appendFileSync(path, '{"id":3}\n')
  expect(readObservations(path)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  expect(readFileSync(path, 'utf8')).not.toContain('"id":{"id"')
})

it('recovers two identical questions by their separate task keys across store restart', async () => {
  const { Store } = await import('../server/store.js')
  const { admit } = await import('../server/spend-policy.js')
  const path = join(resources().tempDir('r3-identical-'), 'runs.db')
  let store = new Store(path)
  const input = { surface: 'web' as const, principal: 'operator', question: 'Same question in two bank rows', requestedMinor: 0, maxMinor: 500 }
  const a = admit(store, { ...input, idempotencyKey: 'r3:free:Q09' }).run
  const b = admit(store, { ...input, idempotencyKey: 'r3:free:Q10' }).run
  expect(a.runId).not.toBe(b.runId)
  store.close(); store = new Store(path)
  try {
    expect(store.admissionRun('web', 'operator', 'r3:free:Q09')?.runId).toBe(a.runId)
    expect(store.admissionRun('web', 'operator', 'r3:free:Q10')?.runId).toBe(b.runId)
    expect(store.listRuns()).toHaveLength(2)
  } finally { store.close() }
})

it('serializes owners of the cumulative model-spend ledger', () => {
  const path = join(resources().tempDir('r3-cost-lock-'), 'cost.json')
  const unlock = lockLedger(path)
  try { expect(() => lockLedger(path)).toThrow('already in use') } finally { unlock() }
  const unlockAgain = lockLedger(path)
  unlockAgain()
})

it('refuses an old/default corpus even when the caller sets real-profile flags', () => {
  const real = { publishers: ['xrpl-docs', 'x402-docs', 'ledger-analytics'].map(slug => ({slug, synthetic:false})) }
  expect(() => assertRealCorpus(real)).not.toThrow()
  expect(() => assertRealCorpus({publishers:real.publishers.slice(1)})).toThrow('Real profile unavailable')
  expect(() => assertRealCorpus({publishers:[...real.publishers,{slug:'fictional',synthetic:true}]})).toThrow('fictional publishers')
  expect(() => assertRealCorpus({publishers:[...real.publishers,{slug:'unlabelled'}]})).toThrow('fictional publishers')
})

it('counts prior charges and interrupted-call holds against the shared US$5 ceiling', () => {
  const costs = {actual:4.90,reserved:0.09,calls:1275,missingUsage:8}
  reserveModelCall(costs,1000)
  reserveModelCall(costs,1000)
  const admitted = {...costs}
  expect(costs.actual + costs.reserved).toBeLessThanOrEqual(5)
  expect(() => reserveModelCall(costs,1000)).toThrow('US$5 model-spend ceiling')
  expect(costs).toEqual(admitted)
  expect(costs).toMatchObject({actual:4.90,calls:1277,missingUsage:10})
  // A larger input cannot consume a hold that remains after a killed call.
  expect(() => reserveModelCall(costs,1_000_000)).toThrow('US$5 model-spend ceiling')
  expect(costs).toEqual(admitted)
})
