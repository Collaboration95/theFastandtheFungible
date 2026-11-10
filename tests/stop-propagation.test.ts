import { afterEach, expect, it, vi } from 'vitest'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
import { fixture } from './byok-fixture.js'
import { streamJson } from '../server/agents/llm.js'
import { RunLoop } from '../server/agents/loop.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { exampleContent, exampleCandidate } from '../shared/contracts/examples.js'
afterEach(() => vi.unstubAllEnvs())
it('cancels a stalled provider through run Stop below 1s; preserves reservations', async () => {
  const f = await fixture(true)
  try {
    vi.stubEnv('LLM_SYNTHESIS_TIMEOUT_MS','150')
    // Baseline emulates the old caller: Stop has no signal to pass to transport.
    const start = performance.now(); const baseline = streamJson('JSON', {}).catch(() => undefined)
    await baseline; const beforeMs = performance.now()-start
    vi.stubEnv('LLM_SYNTHESIS_TIMEOUT_MS','5000')
    const store = new Store(':memory:'); const run = store.createRun('What is the contracted demand expansion?',200)
    const client = {} as PublisherClient
    const purchases = new PurchaseManager(store,client)
    let signatures = 0; vi.spyOn(purchases,'purchase').mockImplementation(async () => { signatures++; throw new Error('unexpected purchase') })
    const loop = new RunLoop(store,client,purchases,undefined,{ retrieve: async () => ({ candidates:[exampleCandidate], contents:[exampleContent] }) })
    const startedCalls = f.calls(); const work = loop.start(run.runId)
    while(f.calls()===startedCalls) await new Promise(resolve => setTimeout(resolve,2))
    const stop = performance.now(); loop.stop(run.runId); await work; const afterMs=performance.now()-stop
    expect(afterMs).toBeLessThan(1000); expect(signatures).toBe(0); expect(store.getRun(run.runId).stopped).toBe(true)
    store.close()
    if (process.env.C1_EVIDENCE === '1') writeFileSync('docs/evidence/round2-c1/stop-latency.json', JSON.stringify({ evidence:'local synthetic stalled SSE; baseline caller omits signal; deadline shortened to 150ms per attempt for measurement', beforeMs, afterMs, postStopSignatures: signatures, productionDeadlineMs:45000 },null,2)+'\n')
  } finally { await f.close() }
},15000)

it('aborts Clef discovery and both named judges, including uncooperative transports', async () => {
  const { ClefDecisionProvider } = await import('../server/agents/clef.js')
  const { OpenAIDecisionsProvider } = await import('../server/agents/openai-decisions.js')
  for (const kind of ['discovery','clef','luna']) {
    const controller = new AbortController(); let calls = 0; let signal: AbortSignal | undefined
    const transport: typeof fetch = async (_url, init) => { calls++; signal = init?.signal ?? undefined; return new Promise(() => {}) }
    const provider = kind === 'luna' ? new OpenAIDecisionsProvider({ apiKey:'synthetic', fetch:transport }) : new ClefDecisionProvider({ token:'synthetic', ...(kind === 'clef' ? { accountId:'synthetic-account' } : {}), fetch:transport })
    const promise = provider.judgeRound({ question:'Question?', conclusion:'Unknown', gap:'Missing fact', signal:controller.signal }).catch(() => undefined)
    await new Promise(resolve => setTimeout(resolve,10))
    const start=performance.now(); controller.abort(); await promise
    expect(performance.now()-start).toBeLessThan(1000); expect(signal?.aborted).toBe(true); expect(calls).toBe(1)
  }
})
