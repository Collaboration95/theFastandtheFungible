/** Child-process harness. No live credentials or external transports are permitted. */
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { once } from 'node:events'
import { createPublisherApp } from '../../publisher/routes.js'
import { ClefDecisionProvider } from '../../server/agents/clef.js'
import { FixtureDecisionProvider } from '../../server/agents/decision.js'
import type { Store } from '../../server/store.js'
import { validateWriterCorpus } from '../../shared/contracts/writers.js'

const mode = process.argv[2]
if (mode === 'publisher') {
  // The scenario corpus (v2 writers plus canaries) on the SIMULATED rail; no keys, keyword search.
  const writers = validateWriterCorpus(JSON.parse(readFileSync(process.env.SCENARIO_CORPUS!, 'utf8')), { relaxWordLimits: true })
  const app = createPublisherApp({ writers, journal: process.env.SCENARIO_JOURNAL!, secret: process.env.PUBLISHER_SECRET!, faults: false, rail: 'simulated', env: {} })
  await app.locals.ready
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  console.log(`PORT=${(server.address() as { port: number }).port}`)
  process.once('SIGTERM', () => server.close(() => { app.locals.journal.close(); process.exit(0) }))
} else if (mode === 'audit-api') {
  // Dynamic import keeps the harness compilable on the legacy branch too.
  const { createApiApp } = await import(pathToFileURL(resolve(process.env.SCENARIO_API_ROUTES ?? 'server/routes.ts')).href)
  const context: { store?: Store } = {}
  const audit = (kind: string, body: unknown) => {
    const run = context.store?.listRuns().at(-1)
    appendFileSync(process.env.SCENARIO_AUDIT!, JSON.stringify({ kind, body, runId: run?.runId, grants: run?.grants ?? [] }) + '\n')
  }
  const transport = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    // The only LLM transport is a local fixture server, configured by the parent.
    if (String(url).startsWith(process.env.LLM_BASE_URL!)) audit('groq', JSON.parse(String(options?.body)))
    if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(String(url))) throw new Error('Scenario external network forbidden')
    return transport(url, options)
  }
  const fixture = new FixtureDecisionProvider()
  // Clef sees a price-blind public view (abstract, tags); rebuild the candidate shape the fixture scores.
  const fromClefState = (c: { abstract: string; tags: string[] }) => ({ profileId: 'clef-state', version: 'v1', price: { amountMinor: 0, currency: 'SGD' }, license: { kind: 'SYNTHETIC', attribution: 'clef-state' }, ...c, preview: c.abstract, facets: c.tags })
  const fromPassages = (passages: string[]) => ({ profileId: 'clef-state', resourceId: 'granted', version: 'v1', title: 'granted', publisher: 'granted', body: passages.join(' '), spans: passages.map((text, i) => ({ id: `p${i}`, text })) })
  const provider = new ClefDecisionProvider({ accountId: 'fixture-account', token: 'fixture-token', fetch: async (_url, options) => {
    const payload = JSON.parse(String(options?.body))
    audit('clef', payload)
    // Slow scoring makes SSE coverage and Stop deterministic without changing app code.
    await new Promise(done => setTimeout(done, 40))
    const answers = payload.questions.gap_material
      ? { gap_material: { type: 'noul', noul: (await fixture.judgeRound(payload.state)).gapMaterial } }
      : !payload.questions.originality
        ? { addresses_gap: { type: 'noul', noul: (await fixture.judgePaidRelevance({ ...payload.state, content: fromPassages(payload.state.passages) })).observed } }
        : await fixture.judgeCandidate({ ...payload.state, candidate: fromClefState(payload.state.candidate) }).then(j => ({ addresses_gap: { type: 'noul', noul: j.addressesGap }, originality: { type: 'choice', choice: 'original', probabilities: j.originality }, credibility: { type: 'score', score: j.credibility } }))
    return Response.json({ success: true, result: { answers } })
  } })
  const api = await createApiApp({ provider })
  context.store = api.store
  const server = api.app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  console.log(`PORT=${(server.address() as { port: number }).port}`)
  process.once('SIGTERM', () => { api.close(); server.close(() => process.exit(0)) })
} else {
  throw new Error('Unknown scenario driver mode')
}
