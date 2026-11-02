import { admissionGuard } from './admission.js'
import { loadConfig } from './config.js'
import type { ApiContext } from './api/context.js'
import { walletRouter } from './api/wallet.js'
import { runsRouter } from './api/runs.js'
import { mcpRouter } from './api/mcp.js'
import { reportsRouter } from './api/reports.js'
import { budgetPolicy } from '../mcp/policy.js'
import express, { type ErrorRequestHandler, type Response } from 'express'
import { resolve } from 'node:path'
import { z } from 'zod'
import { SIMULATED_LABEL, XRPL_LABEL, decisionLabel, type ModeLabels, type TraceEvent } from '../shared/contracts/index.js'
import { XrplPayer } from './xrpl.js'
import { traceEvent } from './telemetry.js'
import { Store } from './store.js'
import { PublisherClient } from './publisher-client.js'
import { PurchaseManager } from './purchases.js'
import { cosineObserver, Reputation, type RelevanceObserver } from './reputation.js'
import { embeddingsLive, embedTexts } from '../publisher/search.js'
import { RunLoop } from './agents/loop.js'
import { ClefDecisionProvider } from './agents/clef.js'
import { OpenAIDecisionsProvider } from './agents/openai-decisions.js'
import { type DecisionProvider } from './agents/decision.js'
import { isLlmConfigured, llmLabel, researchModel } from './agents/llm.js'

/** `observe`: the trust check's relevance re-measure (#205); defaults to Workers AI embeddings when SEARCH_EMBEDDINGS=live. */
export type ApiOptions = { payer?: XrplPayer; dbPath?: string; publisherUrl?: string; secret?: string; reportDir?: string; provider?: DecisionProvider; observe?: RelevanceObserver }
export async function createApiApp(options: ApiOptions = {}) {
  const config = loadConfig()
  const mcpPolicy = budgetPolicy(config)
  const jobs = new Set<Promise<void>>()
  const app = express()
  app.disable('x-powered-by')
  app.use(admissionGuard(config))
  app.use(express.json({ limit: '16kb' }))
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next() })
  const streams = new Map<string, Set<Response>>()
  const publish = (event: TraceEvent) => {
    for (const res of streams.get(event.runId) ?? []) {
      res.write(`event: trace\ndata: ${JSON.stringify(event)}\n\n`)
      res.write(`event: snapshot\ndata: ${JSON.stringify(store.getRun(event.runId))}\n\n`)
    }
  }
  // Every durable event is also mirrored into the active Langfuse trace (a no-op when tracing is off).
  const store = new Store(options.dbPath ?? config.APP_DB ?? 'data/app.db', event => { try { traceEvent(event) } catch { /* telemetry never blocks the run */ } publish(event) })
  const client = new PublisherClient({ baseUrl: options.publisherUrl ?? config.PUBLISHER_URL, secret: options.secret ?? config.PUBLISHER_SECRET })
  // XRPL Testnet settlement needs both the rail flag and a payer seed; otherwise simulated, labelled.
  const payer = options.payer ?? (config.SETTLEMENT_RAIL === 'xrpl-testnet' && config.XRPL_PAYER_SEED ? XrplPayer.fromEnv() : undefined)
  const purchases = new PurchaseManager(store, client, payer)
  let provider = options.provider
  // DECISION_PROVIDER=openai: OpenAI Decisions (gpt-6-luna, #214); =cloudflare: Clef (the one-line revert); otherwise the labelled fixture.
  if (!provider && config.DECISION_PROVIDER === 'openai') provider = new OpenAIDecisionsProvider({ allowLive: true })
  if (!provider && config.DECISION_PROVIDER === 'cloudflare') {
    const clef = new ClefDecisionProvider({ allowLive: true })
    // Warm account discovery; a failed lookup is not cached and is retried on the next decision (#195).
    try { await clef.resolveAccount() } catch { /* A decision round that still cannot reach Clef fails and buys nothing (#197). */ }
    provider = clef
  }
  // The trust check re-measures a delivered article with the search's own embedder, after a verified grant only (gate 1).
  const reputation = new Reputation(store, { observe: options.observe ?? (embeddingsLive() ? cosineObserver((texts, signal) => embedTexts(texts, { signal })) : undefined) })
  const loop = new RunLoop(store, client, purchases, undefined, { provider, reputation })
  const reportDir = resolve(options.reportDir ?? config.REPORT_DIR ?? 'data/reports')
  const reportJobs = new Map<string, Promise<{ format: 'PDF' | 'HTML'; path: string }>>()
  const timers = new Set<ReturnType<typeof setInterval>>()
  const publisherUrl = options.publisherUrl ?? config.PUBLISHER_URL ?? 'http://127.0.0.1:8790'
  const labels: ModeLabels = { research: isLlmConfigured() ? `${llmLabel()} · ${researchModel()} (pending)` : 'fixture · extractive-fixture', decision: provider && provider.name !== 'fixture' ? `${decisionLabel({ provider: provider.name, model: provider.model })} (pending)` : 'fixture · metadata-fixture', publisher: /\.run\.app(?:\/|$)/.test(publisherUrl) ? 'Cloud Run' : 'local', settlement: payer ? XRPL_LABEL : SIMULATED_LABEL }
  const progress = (runId: string, label: string) => {
    const timer = setInterval(() => {
      try { store.appendEvent(runId, { type: 'PROGRESS', label }) } catch { /* Shutdown or missing run. */ }
    }, 2000)
    timers.add(timer)
    return () => { clearInterval(timer); timers.delete(timer) }
  }
  const launch = (runId: string, job: () => Promise<void>) => {
    const done = progress(runId, 'Working with accessible evidence; spending policy remains enforced.')
    const task = job().catch(() => {
      store.updateRun(runId, { phase: 'FAILED', error: 'Run interrupted; start a new ask or retry a settled delivery.' })
    }).finally(() => {
      done()
      const run = store.getRun(runId)
      if (!run.answers.length) {
        store.addAnswer(runId, { conclusion: 'No accessible evidence was read. The publisher is unavailable; start a new ask when it is ready.', claims: [], openGaps: [{ text: 'No accessible evidence is available.' }], version: 1, provider: 'fixture', model: 'extractive-fixture' })
        store.updateRun(runId, { labels: { ...run.labels, research: 'fixture · extractive-fixture' } })
      }
      store.appendEvent(runId, { type: 'SNAPSHOT', label: 'Latest validated answer and ledger saved.' })
      jobs.delete(task)
    })
    jobs.add(task)
  }
  const faultsAvailable = config.PUBLISHER_FAULTS === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(publisherUrl).hostname)
  const context: ApiContext = { store, client, payer, purchases, loop, reputation, labels, mcpPolicy, publisherUrl, launch, streams, reportDir, reportJobs, progress }
  app.use(walletRouter(context))
  // Trust matrix (D6): public, engine-side, persisted across runs.
  app.get('/api/reputation', (_req, res) => res.json({ publishers: reputation.list() }))
  app.post('/api/reputation/reset', (_req, res) => { reputation.reset(); res.json({ publishers: [] }) })
  app.get(['/health', '/api/health'], (_req, res) => res.json({ status: 'ok', labels, faults: faultsAvailable }))
  if (faultsAvailable) app.post('/api/demo/faults', async (req, res) => {
    z.object({ failNextDelivery: z.literal(true) }).parse(req.body)
    const response = await fetch(new URL('/__faults', publisherUrl), {
      method: 'POST', signal: AbortSignal.timeout(3000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.secret ?? config.PUBLISHER_SECRET}` },
      body: JSON.stringify({ failNextDelivery: true }),
    })
    if (!response.ok) return res.status(502).json({ error: 'Local publisher fault control is unavailable.' })
    res.json({ failNextDelivery: true, label: 'SIMULATED fault · no real funds' })
  })
  app.use(runsRouter(context))
  app.use(mcpRouter(context))
  app.use(reportsRouter(context))
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const notFound = error instanceof Error && error.message === 'Run not found'
    res.status(notFound ? 404 : error instanceof z.ZodError ? 400 : 500).json({ error: notFound ? 'Run not found.' : error instanceof z.ZodError ? 'Invalid command.' : 'Operation failed; the last validated answer and ledger are preserved.' })
  }
  app.use(handleError)
  await purchases.reconcile()
  // Reconciliation happens before new spending. Existing stopped/done runs remain final.
  for (const run of store.listRuns()) if (!['DONE', 'STOPPED', 'FAILED'].includes(run.phase)) launch(run.runId, () => loop.start(run.runId))
  return { app, store, loop, reputation, drain: async () => { for (const run of store.listRuns()) if (!['DONE', 'STOPPED', 'FAILED'].includes(run.phase)) loop.stop(run.runId); await Promise.allSettled(jobs) }, close: () => { timers.forEach(clearInterval); for (const set of streams.values()) for (const res of set) res.end(); store.close(); void (payer?.ledger as { close?: () => Promise<void> } | undefined)?.close?.() } }
}
