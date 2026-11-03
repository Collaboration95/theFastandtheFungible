import { AnswerAnchors } from './anchor.js'
import { ActiveWork, OverloadedError } from './agents/active-work.js'
import { providersRouter } from './api/providers.js'
import { JsonDecisionProvider } from './agents/json-decision.js'
import { errorEnvelope } from '../shared/contracts/errors.js'
import { reconcileRefunds } from './challenges.js'
import { verifyAnswer } from '../sdk/verify.js'
import { AgentDenied } from './agent-keys.js'
import { operationsRouter } from './api/operations.js'
import { auditRouter } from './api/audit.js'
import { withModelUsage, logMoneyEvent } from './telemetry.js'
import { hireService } from './hire/service.js'
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
export type ApiOptions = { payer?: XrplPayer; dbPath?: string; publisherUrl?: string; publisherUrls?: string[]; secret?: string; reportDir?: string; provider?: DecisionProvider; observe?: RelevanceObserver; reconcileIntervalMs?: number }
export async function createApiApp(options: ApiOptions = {}) {
  const config = loadConfig()
  if (config.SETTLEMENT_RAIL === 'xrpl-testnet' && !options.payer && !config.XRPL_PAYER_SEED) throw new Error('Testnet requires wallet configuration')
  const work = new ActiveWork(Number(config.ACTIVE_WORK_LIMIT || 4))
  const mcpPolicy = budgetPolicy(config)
  const jobs = new Set<Promise<void>>()
  const activeRuns = new Map<string, Promise<void>>()
  const app = express()
  app.disable('x-powered-by')
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next() })
  const streams = new Map<string, Set<Response>>()
  const snapshotTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const lastSnapshot = new Map<string, number>()
  const send = (runId: string, frame: string) => {
    const bytes = Buffer.byteLength(frame)
    for (const res of streams.get(runId) ?? []) {
      // Oversize snapshots close the stream; clients resync via the durable GET endpoint.
      if (res.writableEnded || res.destroyed || bytes > 256 * 1024 || res.writableLength + bytes > 256 * 1024) {
        streams.get(runId)?.delete(res); if (!streams.get(runId)?.size) { streams.delete(runId); clearTimeout(snapshotTimers.get(runId)); snapshotTimers.delete(runId); lastSnapshot.delete(runId) }
        if (!res.writableEnded && !res.destroyed) res.end()
        continue
      }
      res.write(frame)
    }
  }
  const snapshot = (runId: string) => {
    snapshotTimers.delete(runId)
    if (!streams.get(runId)?.size) { lastSnapshot.delete(runId); return }
    lastSnapshot.set(runId, Date.now())
    send(runId, `event: snapshot\ndata: ${JSON.stringify(store.getRun(runId))}\n\n`)
  }
  let anchors: AnswerAnchors | undefined
  const publish = (event: TraceEvent) => {
    if (!streams.get(event.runId)?.size) return
    send(event.runId, `event: trace\ndata: ${JSON.stringify(event)}\n\n`)
    const terminal = ['DONE','STOPPED','FAILED','SNAPSHOT'].includes(event.type)
    if (terminal || Date.now() - (lastSnapshot.get(event.runId) ?? 0) >= 250) {
      clearTimeout(snapshotTimers.get(event.runId)); snapshot(event.runId)
    } else if (!snapshotTimers.has(event.runId)) snapshotTimers.set(event.runId, setTimeout(() => snapshot(event.runId), 250 - (Date.now() - lastSnapshot.get(event.runId)!)))
  }
  // Every durable event is also mirrored into the active Langfuse trace (a no-op when tracing is off).
  const store = new Store(options.dbPath ?? config.APP_DB ?? 'data/app.db', event => { try { traceEvent(event); logMoneyEvent(event, store) } catch { /* telemetry never blocks the run */ } publish(event) })
  app.use(admissionGuard(config, store))
  app.post('/api/verify', express.json({ limit: '8mb' }), async (req, res) => {
    res.json(await verifyAnswer(req.body, { testnet: req.query.testnet === '1', expectHead: typeof req.query.expectHead === 'string' ? req.query.expectHead : undefined }))
  })
  app.use(express.json({ limit: '16kb' }))
  const client = new PublisherClient({ baseUrls: options.publisherUrls ?? (!options.publisherUrl && config.PUBLISHER_URLS ? config.PUBLISHER_URLS.split(',').map(s => s.trim()) : undefined), baseUrl: options.publisherUrl ?? config.PUBLISHER_URL, secret: options.secret ?? config.PUBLISHER_SECRET })
  // Requested Testnet never silently falls back to simulated settlement.
  const payer = options.payer ?? (config.SETTLEMENT_RAIL === 'xrpl-testnet' && config.XRPL_PAYER_SEED ? XrplPayer.fromEnv() : undefined)
  if (config.ANCHOR_RAIL === 'xrpl-testnet' && payer instanceof XrplPayer) anchors = new AnswerAnchors(store, payer)
  const purchases = new PurchaseManager(store, client, payer)
  let provider = options.provider
  // DECISION_PROVIDER=openai: OpenAI Decisions (gpt-6-luna, #214); =cloudflare: Clef (the one-line revert); otherwise the labelled fixture.
  if (!provider && config.DECISION_PROVIDER === 'compatible') provider = new JsonDecisionProvider()
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
  const launch = (runId: string, job: () => Promise<void>, lease?: () => void) => {
    const existing = activeRuns.get(runId)
    if (existing) { lease?.(); return existing }
    const release = lease ?? work.acquire()
    const done = progress(runId, 'Working with accessible evidence; spending policy remains enforced.')
    const task = withModelUsage(usage => store.appendEvent(runId, { type: usage.fallback ? 'MODEL_FALLBACK' : 'MODEL_USAGE', label: usage.fallback ? 'LLM fallback · labelled fixture' : 'Provider-reported usage', data: usage }), job).catch(() => {
      store.updateRun(runId, { phase: 'FAILED', error: 'Run interrupted; start a new ask or retry a settled delivery.' })
    }).finally(async () => {
      activeRuns.delete(runId)
      if (!reportJobs.has(runId)) loop.releaseSignal(runId)
      release()
      done()
      const run = store.getRun(runId)
      if (!run.answers.length) {
        store.addAnswer(runId, { conclusion: 'No accessible evidence was read. The publisher is unavailable; start a new ask when it is ready.', claims: [], openGaps: [{ text: 'No accessible evidence is available.' }], version: 1, provider: 'fixture', model: 'extractive-fixture' })
        store.updateRun(runId, { labels: { ...run.labels, research: 'fixture · extractive-fixture' } })
      }
      store.appendEvent(runId, { type: 'SNAPSHOT', label: 'Latest validated answer and ledger saved.' })
      await anchors?.ensure(runId).catch(() => undefined)
      jobs.delete(task)
    })
    activeRuns.set(runId, task)
    jobs.add(task)
    return task
  }
  const faultsAvailable = config.PUBLISHER_FAULTS === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(publisherUrl).hostname)
  const context: ApiContext = { work, store, client, payer, purchases, loop, reputation, labels, mcpPolicy, publisherUrl, launch, streams, onStreamEmpty: runId => { clearTimeout(snapshotTimers.get(runId)); snapshotTimers.delete(runId); lastSnapshot.delete(runId) }, reportDir, reportJobs, progress }
  app.use(providersRouter(work))
  app.use(walletRouter(context))
  app.use(operationsRouter(context))
  app.use(auditRouter(context))
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
  const hire = hireService(context)
  app.use(hire.router)
  app.use(runsRouter(context))
  app.use(mcpRouter(context))
  app.use(reportsRouter(context))
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const notFound = error instanceof Error && error.message === 'Run not found'
    const status = error instanceof OverloadedError ? 503 : error instanceof AgentDenied ? 403 : notFound ? 404 : error instanceof z.ZodError ? 400 : 500
    res.status(status).json({ ...errorEnvelope(error instanceof OverloadedError ? 'overloaded' : status === 403 ? 'unauthorized' : notFound ? 'not_found' : status === 400 ? 'invalid' : 'backend_unavailable', status), error: notFound ? 'Run not found.' : status === 400 ? 'Invalid command.' : 'Operation failed; the last validated answer and ledger are preserved.' })
  }
  app.use(handleError)
  const reconciliationJobs = new Set<Promise<void>>()
  let stopping = false
  let reconciliation: Promise<void> | undefined
  const reconcileOnce = () => {
    if (stopping) return Promise.resolve()
    // Payment work is single-flight per intent, so a slow writer cannot starve other obligations.
    // Coalesce the answer/refund recovery sweep separately from those independent deliveries.
    const task = purchases.reconcile().then(() => {
      if (stopping) return
      if (reconciliation) return reconciliation
      reconciliation = (async () => {
        await reconcileRefunds(purchases)
        await anchors?.reconcile()
        if (stopping) return
        // Existing durable runnable rows are retried on the next sweep when saturated;
        // this creates no new durable queue and never blocks signed reconciliation.
        for (const runId of store.runnableRunIds()) {
          if (activeRuns.has(runId)) continue
          try { const run = store.getRun(runId); void launch(runId, () => typeof run.checkpoint.recoveryIntentId === 'string' ? loop.recoverAnswer(runId, run.checkpoint.recoveryIntentId) : loop.start(runId)) } catch (error) { if (!(error instanceof OverloadedError)) throw error }
        }
        for (const runId of store.recoverableRunIds()) {
          if (activeRuns.has(runId)) continue
          const run = store.getRun(runId)
          try { await launch(runId, () => loop.recoverAnswer(runId, run.checkpoint.intentId!)) } catch (error) { if (!(error instanceof OverloadedError)) throw error }
        }
      })().finally(() => { reconciliation = undefined })
      return reconciliation
    }).finally(() => { reconciliationJobs.delete(task) })
    reconciliationJobs.add(task)
    return task
  }
  await reconcileOnce()
  const reconcileTimer = setInterval(() => { void reconcileOnce().catch(() => undefined) }, options.reconcileIntervalMs ?? Number(config.RECONCILE_INTERVAL_MS || 15000))
  reconcileTimer.unref()
  const stopReconciler = () => { stopping = true; clearInterval(reconcileTimer) }
  let closing: Promise<void> | undefined
  // Reconciliation happens before new spending. Existing stopped/done runs remain final.
  for (const runId of store.runnableRunIds()) { const run = store.getRun(runId); try { launch(runId, () => typeof run.checkpoint.recoveryIntentId === 'string' ? loop.recoverAnswer(runId, run.checkpoint.recoveryIntentId) : loop.start(runId)) } catch (error) { if (!(error instanceof OverloadedError)) throw error } }
  const drain = async () => {
    stopReconciler()
    work.controller.abort()
    loop.abortProviders()
    for (const runId of store.runnableRunIds(true)) loop.stop(runId)
    await Promise.allSettled(reconciliationJobs)
    await Promise.allSettled(jobs)
    await Promise.allSettled(reportJobs.values())
    await anchors?.drain()
    await purchases.drain()
    await hire.drain()
  }
  return { app, work, store, loop, reputation, purchases, reconcileOnce, drain, close: () => closing ??= (async () => {
    await drain()
    timers.forEach(clearInterval)
    snapshotTimers.forEach(clearTimeout)
    snapshotTimers.clear(); lastSnapshot.clear()
    for (const set of streams.values()) for (const res of set) res.end()
    hire.close()
    store.close()
    await (payer?.ledger as { close?: () => Promise<void> } | undefined)?.close?.()
  })() }
}
