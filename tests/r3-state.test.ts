import { appendFileSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { resources } from './helpers/resource-scope'
import { join } from 'node:path'
import { atomicJson, readObservations, resumeState, lockLedger, assertRealCorpus, reserveModelCall, modelFallbacks, providerFailures, providerTaskKey, recordProviderAttempt } from '../eval/r3-state.js'
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

it('excludes labelled planner substitutions and fixture answers from live-only results', () => {
  const live = {labels:{plan:'DeepSeek · deepseek-flash'},answers:[{provider:'deepseek'}],events:[]}
  expect(modelFallbacks(live)).toMatchObject({fallbacks:0,liveOnly:true})
  expect(modelFallbacks({...live,labels:{plan:'fixture · scope-fixture · planner unavailable'}})).toMatchObject({plannerFallbacks:1,writerFallbacks:0,fallbacks:1,liveOnly:false})
  expect(modelFallbacks({...live,answers:[{provider:'fixture'}]})).toMatchObject({fixtureAnswers:1,liveOnly:false})
  expect(modelFallbacks({...live,answers:[{provider:'fixture'}],events:[{type:'MODEL_FALLBACK'}]})).toMatchObject({writerFallbacks:1,fixtureAnswers:1,fallbacks:1,liveOnly:false})
})

it('enforces a lower stop exposure before network admission without releasing old holds', () => {
  const costs = {actual:4.8,reserved:0.09,calls:10,missingUsage:2}
  reserveModelCall(costs,1000,4.90)
  const admitted = {...costs}
  expect(() => reserveModelCall(costs,10000,4.90)).toThrow('US$4.9 model-spend ceiling')
  expect(costs).toEqual(admitted)
  for (const cap of [0,-1,5.01,NaN,Infinity]) expect(() => reserveModelCall(costs,1,cap)).toThrow('Invalid model-spend ceiling')
})

it('does not count provider failures as completed live tasks, even before a later answer', () => {
  const live = {labels:{plan:'DeepSeek · deepseek-flash'},events:[]}
  expect(providerFailures(live)).toEqual([])
  expect(providerFailures({...live,events:[{type:'MODEL_FALLBACK',label:'LLM fallback (guard) · labelled fixture'}]})).toEqual([])
  expect(providerFailures({...live,events:[{type:'MODEL_FALLBACK',label:'LLM fallback (http) · labelled fixture'},{type:'MODEL_USAGE'}]})).toEqual(['writer http'])
  expect(providerFailures({labels:{plan:'fixture · scope-fixture · planner unavailable'},events:[]})).toEqual(['planner unavailable'])
  for (const reason of ['timeout','unavailable','invalid','cap']) expect(providerFailures({...live,events:[{type:'MODEL_FALLBACK',data:{reason}}]})).toEqual([`writer ${reason}`])
})

it('keeps retry admission identities distinct and stable without replaying the original task', () => {
  expect(providerTaskKey('paid','R34',0)).toBe('r3:paid:R34')
  expect(providerTaskKey('paid','R34',1)).toBe('r3:paid:R34:provider-retry:1')
  expect(providerTaskKey('paid','R34',1)).toBe(providerTaskKey('paid','R34',1))
  expect(providerTaskKey('paid','R34',2)).not.toBe(providerTaskKey('paid','R34',1))
  for (const attempt of [-1,0.5,NaN]) expect(()=>providerTaskKey('paid','R34',attempt)).toThrow()
})

it('retains failed calls outside results and retries only uncharged tasks without touching completed work', () => {
  const state={results:[{runId:'valid'}],excludedAttempts:[] as Record<string,unknown>[],providerAttempts:{} as Record<string,number>,runIds:{done:'valid',failed:'original'},started:{done:10,failed:20}}
  expect(recordProviderAttempt(state,'failed',{runId:'original'},['writer http'],false)).toBe(true)
  expect(state.results).toEqual([{runId:'valid'}])
  expect(state.runIds).toEqual({done:'valid'})
  expect(state.started).toEqual({done:10})
  expect(state.providerAttempts).toEqual({failed:1})
  expect(state.excludedAttempts).toEqual([{result:{runId:'original'},reasons:['writer http'],requiresSameRunRecovery:false}])
  expect(recordProviderAttempt(state,'failed',{runId:'retry'},[],false)).toBe(false)
  expect(state.results).toEqual([{runId:'valid'},{runId:'retry'}])
})

it('retains the original charged admission when provider recovery cannot safely replay it', () => {
  const state={results:[] as {runId:string}[],excludedAttempts:[] as Record<string,unknown>[],providerAttempts:{},runIds:{charged:'paid-run'},started:{charged:20}}
  expect(recordProviderAttempt(state,'charged',{runId:'paid-run'},['writer http'],true)).toBe(true)
  expect(state.results).toEqual([])
  expect(state.runIds).toEqual({charged:'paid-run'})
  expect(state.started).toEqual({charged:20})
  expect(state.providerAttempts).toEqual({})
})
