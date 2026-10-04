// W3-LIVE only. Run: node --import tsx scripts/live-qualification.mjs [--resume]
// --bounded-finish completes five repeats/variant on default flash, preserving records.
// --compare-only measures both canonical decision tables without Groq calls.
// Opt-in live calls; publisher is a separate process, all buyer evidence uses HTTP.
import 'dotenv/config'
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { once } from 'node:events'
import { createApiApp } from '../server/routes.ts'
import { ClefDecisionProvider } from '../server/agents/clef.ts'
import { decide, FixtureDecisionProvider } from '../server/agents/decision.ts'
import { PublisherClient } from '../server/publisher-client.ts'
import { retrieve, writeAnswer } from '../server/agents/research.ts'
import { buildReport } from '../server/agents/report.ts'
import { resolveCitation } from '../server/agents/citations.ts'

const question = "Can Vertex Compute's announced 600 MW Johor–Singapore expansion actually be operating by 2028?"
const models = ['@cf/cloudflare/clef-flash', '@cf/cloudflare/clef']
const variants = ['canonical', 'open-sufficient', 'contradiction', 'unchanged']
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const output = process.env.QUALIFICATION_OUTPUT || 'tests/fixtures/live-qualification.json'
const freshEvidence = { at: new Date().toISOString(), label: 'Actual live attempts; fixture substitutions are not live successes. Synthetic corpus; SIMULATED SGD · no real funds.', counts: { groq: 0, clef: 0 }, http: [], probes: [], runs: [] }
const evidence = (process.argv.includes('--resume') || process.argv.includes('--bounded-finish') || process.argv.includes('--fixture-finish')) ? JSON.parse(await readFile(output, 'utf8')) : freshEvidence
const priorCounts = { groq: 9, clef: 0 } // Conservative allowance for interrupted, uncheckpointed Groq requests.
for (const artifact of ['tests/fixtures/live-qualification-initial.json', 'tests/fixtures/live-qualification-schema-failure.json', 'tests/fixtures/live-qualification.json', 'tests/fixtures/live-qualification-comparison.json']) {
  if (artifact === output) continue
  try {
    const recorded = JSON.parse(await readFile(artifact, 'utf8'))
    for (const provider of ['groq', 'clef']) priorCounts[provider] += recorded.counts?.[provider] ?? 0
  } catch { /* No earlier run on a fresh checkout. */ }
}
evidence.priorCountsIncludingInterruptedAllowance = priorCounts
if (process.argv.includes('--fixture-finish')) evidence.fixtureCompletionReason = 'Unchanged: five live attempts exceeded 240-second qualification deadline while providers/backoff were pending; fixture completions are not successful live output.'
const originalFetch = globalThis.fetch
// Record statuses only, never credentials, request contents or provider response bodies.
globalThis.fetch = async (url, init) => {
  const host = new URL(url).hostname
  const provider = host === 'api.groq.com' ? 'groq' : host === 'api.cloudflare.com' ? 'clef' : undefined
  if (!provider) return originalFetch(url, init)
  const limit = provider === 'groq' ? 299 : 999
  if (priorCounts[provider] + evidence.counts[provider] >= limit) throw new Error('Qualification request limit')
  evidence.counts[provider]++
  const start = Date.now()
  try {
    const response = await originalFetch(url, init)
    evidence.http.push({ provider, status: response.status, ms: Date.now() - start })
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n')
    return response
  } catch (error) {
    evidence.http.push({ provider, status: init?.signal?.aborted ? 'timeout' : 'transport failure', ms: Date.now() - start })
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n')
    throw error
  }
}
process.env.LLM_PROVIDER = process.argv.includes('--fixture-finish') ? 'fixture' : 'groq'
process.env.DECISION_PROVIDER = 'cloudflare'
const unavailable = new Map(evidence.probes.filter(p => p.attempt === 3 && p.status !== 'live success').map(p => [p.model, p.status]))
let publisher, api, server
async function stop() {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); server = undefined }
  api?.close(); api = undefined
  if (publisher && publisher.exitCode === null) { const exited = once(publisher, 'exit'); publisher.kill('SIGTERM'); await exited }
  publisher = undefined
}
async function startPublisher(variant) {
  publisher = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import { createPublisherApp } from './publisher/routes.ts';
    const app = createPublisherApp({ journal: ':memory:' });
    await app.locals.ready;
    const service = app.listen(0, '127.0.0.1', () => console.log('Publisher listening on port ' + service.address().port));
    process.on('SIGTERM', () => service.close(() => { app.locals.journal.close(); process.exit(0) }));
  `], {
    env: { ...process.env, PUBLISHER_PORT: '0', CORPUS_VARIANT: variant === 'canonical' ? '' : variant, PUBLISHER_SECRET: 'qualification-simulated-secret' },
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Publisher startup timeout')), 10000)
    publisher.stdout.on('data', chunk => {
      log += chunk.toString()
      const match = log.match(/Publisher listening on port (\d+)/)
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`) }
    })
    publisher.once('exit', () => { clearTimeout(timer); reject(new Error('Publisher startup failed')) })
  })
}
try {
  if (process.argv.includes('--compare-only')) {
    const publisherUrl = await startPublisher('canonical')
    const free = await retrieve(new PublisherClient({ baseUrl: publisherUrl }), question)
    process.env.LLM_PROVIDER = 'fixture'
    const { answer } = await writeAnswer({ question, ...free, version: 1 })
    evidence.comparison = []
    for (const model of models) {
      const table = await decide({ question, conclusion: answer.conclusion, gap: answer.openGaps[0]?.text ?? '', gapFacet: answer.openGaps[0]?.facet, candidates: free.candidates, readSources: free.candidates.filter(c => c.tier === 'FREE'), budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, provider: new ClefDecisionProvider({ allowLive: true, model }) })
      evidence.comparison.push({ requestedModel: model, inputResearchProvider: answer.provider, inputResearchModel: answer.model, table })
      await writeFile(output, JSON.stringify(evidence, null, 2) + '\n')
      console.log(JSON.stringify({ model, actualProvider: table.provider, actualModel: table.model, gapMaterial: table.gapMaterial, selectedResourceId: table.selectedResourceId, rows: table.rows.map(r => ({ resourceId: r.candidate.resourceId, ...r.judgment, value: r.value, verdict: r.verdict })), counts: evidence.counts }))
    }
  } else for (const variant of variants) {
    if (unavailable.size === 2 && evidence.runs.filter(r => r.variant === variant).length === 5) continue
    const publisherUrl = await startPublisher(variant)
    const client = new PublisherClient({ baseUrl: publisherUrl })
    const free = await retrieve(client, question)
    if (variant === 'canonical' && evidence.probes.length === 0) for (const model of models) {
      const clef = new ClefDecisionProvider({ allowLive: true, model })
      // Stop spending requests on a broken model after three independent logical probes.
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const judgment = await clef.judgeCandidate({ question, gap: 'No independent evidence on grid energisation dates.', readSources: free.candidates.filter(c => c.tier === 'FREE'), candidate: free.candidates.find(c => c.tier === 'PAID' && c.facets.includes('grid-energisation') && c.price.amountMinor <= 100 && !c.derivedFrom) })
          evidence.probes.push({ model, attempt, status: 'live success', judgment })
          break
        } catch (error) {
          const status = error.status || 'provider unavailable'
          evidence.probes.push({ model, attempt, status })
          console.log(JSON.stringify({ model, probe: attempt, status }))
          await writeFile(output, JSON.stringify(evidence, null, 2) + '\n')
          if (attempt === 3) unavailable.set(model, status)
          await wait(1000)
        }
      }
    }
    for (const model of models.slice(0, 1)) {
      const clef = new ClefDecisionProvider({ allowLive: true, model })
      // Identical metadata fixtures are not a second live model comparison.
      if (model === models[1] && unavailable.size === 2) continue
      api = await createApiApp({ dbPath: ':memory:', publisherUrl, secret: 'qualification-simulated-secret', provider: (unavailable.has(model) || process.argv.includes('--fixture-finish')) ? new FixtureDecisionProvider() : clef })
      server = api.app.listen(0, '127.0.0.1')
      await once(server, 'listening')
      const apiUrl = `http://127.0.0.1:${server.address().port}`
      const runRepeat = async repeat => {
        if (evidence.runs.some(r => r.variant === variant && r.requestedModel === model && r.repeat === repeat)) return
        const started = Date.now()
        const created = await fetch(`${apiUrl}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, budgetMinor: 200 }) }).then(r => r.json())
        let run
        do {
          await wait(100)
          run = await fetch(`${apiUrl}/runs/${created.runId}`).then(r => r.json())
          if (Date.now() - started > 240000) throw new Error('Qualification run timeout')
        } while (!['DONE', 'FAILED', 'STOPPED'].includes(run.phase))
        // Draft only: never invokes Playwright/Chromium or PDF rendering.
        const report = await buildReport(run)
        const valid = run.answers.every(a => a.claims.every(c => c.citations.every(ref => resolveCitation(ref, run.contents))))
        const grantBound = run.contents.every(c => run.candidates.some(m => m.resourceId === c.resourceId && m.version === c.version && m.tier === 'FREE') || run.grants.some(g => g.runId === run.runId && g.resourceId === c.resourceId && g.version === c.version))
        if (!valid || !grantBound || run.spentMinor + run.reservedMinor > run.budgetMinor) throw new Error('Qualification gate failure')
        evidence.runs.push({ variant, requestedModel: model, repeat, phase: run.phase, ms: Date.now() - started, labels: run.labels, answers: run.answers.map(a => ({ version: a.version, provider: a.provider, model: a.model, claims: a.claims.length })), report: { provider: report.provider, model: report.model, fallbackReason: report.fallbackReason }, spentMinor: run.spentMinor, grantCount: run.grants.length, impact: run.impact?.classification, citationBindingsValid: valid, grantBound, decisions: run.decisions })
        await writeFile(output, JSON.stringify(evidence, null, 2) + '\n')
        console.log(JSON.stringify({ variant, model, repeat, phase: run.phase, research: run.labels.research, decision: run.labels.decision, report: `${report.provider} · ${report.model}`, spentMinor: run.spentMinor, impact: run.impact?.classification, counts: evidence.counts }))
        await wait(1000)
      }
      if (process.argv.includes('--bounded-finish') || process.argv.includes('--fixture-finish')) await Promise.all([1, 2, 3, 4, 5].map(runRepeat))
      else for (const repeat of [1, 2, 3, 4, 5]) await runRepeat(repeat)
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); server = undefined
      api.close(); api = undefined
    }
    await stop()
  }
} finally {
  await stop()
  globalThis.fetch = originalFetch
  await writeFile(output, JSON.stringify(evidence, null, 2) + '\n')
}
