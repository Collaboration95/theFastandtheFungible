/** Child-process harness. No live credentials or external transports are permitted. */
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { once } from 'node:events'
import { createPublisherApp } from '../../publisher/routes.js'
import { ClefDecisionProvider } from '../../server/agents/clef.js'
import { FixtureDecisionProvider } from '../../server/agents/decision.js'
import type { Store } from '../../server/store.js'

const mode = process.argv[2]
if (mode === 'publisher') {
  const app = createPublisherApp({ corpus: JSON.parse(readFileSync(process.env.SCENARIO_CORPUS!, 'utf8')), journal: process.env.SCENARIO_JOURNAL!, secret: process.env.PUBLISHER_SECRET!, faults: false })
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
  const fixture = new FixtureDecisionProvider('grid-energisation')
  const provider = new ClefDecisionProvider({ accountId: 'fixture-account', token: 'fixture-token', fetch: async (_url, options) => {
    const payload = JSON.parse(String(options?.body))
    audit('clef', payload)
    // Slow scoring makes SSE coverage and Stop deterministic without changing app code.
    await new Promise(done => setTimeout(done, 40))
    const answers = payload.questions.gap_material
      ? { gap_material: { type: 'noul', noul: (await fixture.judgeRound(payload.state)).gapMaterial } }
      : await fixture.judgeCandidate(payload.state).then(j => ({ addresses_gap: { type: 'noul', noul: j.addressesGap }, originality: { type: 'choice', choice: 'original', probabilities: j.originality }, credibility: { type: 'score', score: j.credibility } }))
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
