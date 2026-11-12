import { publicPaidRouter, bindPublicHire, finishPublicHire, publicHirePrincipal } from '../mcp/paid.js'
import { answerRatingsRouter } from './api/answer-ratings.js'
import { audienceMiddleware, operatorSessionRouter } from './hosted/audience.js'
import { publicFeedRouter } from './api/feed.js'
import { publishingGateway } from '../publisher/publishing/gateway.js'
import { publicMcpRouter } from '../mcp/public.js'
import { writeSse, endSse, sseBufferedBytes } from './api/sse.js'
import { writersRouter } from './api/writers.js'
import { hostedWriterPages } from './hosted/writers.js'
import { requestBodyStatus } from './body-limit.js'
import openapi from '../docs/api/openapi.json' with { type: 'json' }
import { validateHosted, hostedPayer, pausedShell } from './hosted/bootstrap.js'
import { HostedLimits } from './hosted/limits.js'
import { HostedQueue } from './hosted/queue.js'
import { sandboxStatsRouter, hostedRouter } from './hosted/routes.js'
import { HostedReadiness, PayerWatch } from './hosted/readiness.js'
import { sessionGuard, accessGuard } from './hosted/session.js'
import { hostedControl, HostedError } from './hosted/control.js'
import { hostedExecution } from './hosted/execution.js'
import { runSettled } from '../shared/anchor-status.js'
import { ownerSettingsRouter } from './owner-settings.js'
import { localWriterRegistrations } from './local-writer-discovery.js'
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
import { refusalProofRouter } from './api/refusal-proof.js'
import { budgetPolicy } from '../mcp/policy.js'
import express, { type ErrorRequestHandler, type Response } from 'express'
import { resolve } from 'node:path'
import { z } from 'zod'
import { SIMULATED_LABEL, XRPL_LABEL, decisionLabel, type ModeLabels, type TraceEvent } from '../shared/contracts/index.js'
import { XrplPayer } from './xrpl.js'
/** Longest a hosted run stream stays open; a page still showing the run reconnects with a fresh snapshot (H5). */
export const HOSTED_STREAM_MS = 10 * 60_000
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
export type ApiOptions = { payer?: XrplPayer; dbPath?: string; publisherUrl?: string; publisherUrls?: string[]; secret?: string; reportDir?: string; provider?: DecisionProvider; observe?: RelevanceObserver; reconcileIntervalMs?: number; hostedReadiness?: () => Promise<boolean>; hostedProbe?: () => Promise<boolean> }
export async function createApiApp(options: ApiOptions = {}) {
  if (process.env.HOSTED !== '1') return createConfiguredApi(options)
  try { validateHosted(loadConfig()); return await createConfiguredApi(options) }
  catch { return { app: pausedShell(), close: async () => {}, drain: async () => {} } as Awaited<ReturnType<typeof createConfiguredApi>> }
}
async function createConfiguredApi(options: ApiOptions = {}) {
  const config = loadConfig()
  if (config.SETTLEMENT_RAIL === 'xrpl-testnet' && !options.payer && !config.XRPL_PAYER_SEED) throw new Error('Testnet requires wallet configuration')
  const work = new ActiveWork(config.HOSTED === '1' ? 1 : Number(config.ACTIVE_WORK_LIMIT || 4))
  const mcpPolicy = budgetPolicy(config)
  const jobs = new Set<Promise<void>>()
  const activeRuns = new Map<string, Promise<void>>()
  const app = express()
  app.disable('x-powered-by')
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next() })
  if (config.AUDIENCE_COUNTS === '1') app.use(operatorSessionRouter(config))
  app.use(audienceMiddleware(config))
  const streams = new Map<string, Set<Response>>()
  const snapshotTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const lastSnapshot = new Map<string, number>()
  const terminalSnapshots = new Set<string>()
  const send = (runId: string, frame: string) => {
    const bytes = Buffer.byteLength(frame)
    for (const res of streams.get(runId) ?? []) {
      // Oversize snapshots close the stream; clients resync via the durable GET endpoint.
      if (res.writableEnded || res.destroyed || bytes > 256 * 1024 || sseBufferedBytes(res) + bytes > 256 * 1024) {
        streams.get(runId)?.delete(res); if (!streams.get(runId)?.size) { streams.delete(runId); clearTimeout(snapshotTimers.get(runId)); snapshotTimers.delete(runId); lastSnapshot.delete(runId); terminalSnapshots.delete(runId) }
        if (!res.writableEnded && !res.destroyed) endSse(res)
        continue
      }
      writeSse(res, frame)
    }
  }
  const snapshot = (runId: string) => {
    snapshotTimers.delete(runId)
    if (!streams.get(runId)?.size) { lastSnapshot.delete(runId); terminalSnapshots.delete(runId); return }
    lastSnapshot.set(runId, Date.now())
    const run = store.getRun(runId)
    if (['DONE','FAILED','STOPPED'].includes(run.phase)) terminalSnapshots.add(runId)
    send(runId, `event: snapshot\ndata: ${JSON.stringify(run)}\n\n`)
  }
  let anchors: AnswerAnchors | undefined
  const snapshotFloorMs = config.HOSTED === '1' ? 1000 : 250
  const publish = (event: TraceEvent) => {
    if (!streams.get(event.runId)?.size) return
    send(event.runId, `event: trace\ndata: ${JSON.stringify(event)}\n\n`)
    // A phase-only failure or a late final anchor also needs an immediate snapshot; ordinary SNAPSHOT progress coalesces.
    const changed = event.type === 'SNAPSHOT' ? store.getRun(event.runId) : undefined
    const terminal = ['DONE','STOPPED','FAILED'].includes(event.type) || (changed !== undefined && (config.HOSTED !== '1' || (!terminalSnapshots.has(event.runId) && ['DONE','FAILED','STOPPED'].includes(changed.phase)) || runSettled(changed)))
    if (terminal || Date.now() - (lastSnapshot.get(event.runId) ?? 0) >= snapshotFloorMs) {
      clearTimeout(snapshotTimers.get(event.runId)); snapshot(event.runId)
      // Hosted: once the last snapshot of a settled run is out, close its streams rather than hold them for a tab that
      // may already be gone behind the proxies. An open page's EventSource reconnects, gets 204 and stops (H5).
      if (terminal && config.HOSTED === '1' && runSettled(store.getRun(event.runId))) for (const res of streams.get(event.runId) ?? []) endSse(res)
    } else if (!snapshotTimers.has(event.runId)) snapshotTimers.set(event.runId, setTimeout(() => snapshot(event.runId), snapshotFloorMs - (Date.now() - lastSnapshot.get(event.runId)!)))
  }
  // Every durable event is also mirrored into the active Langfuse trace (a no-op when tracing is off).
  const store = new Store(options.dbPath ?? config.APP_DB ?? 'data/app.db', event => { try { traceEvent(event); logMoneyEvent(event, store) } catch { /* telemetry never blocks the run */ } publish(event) })
  const feed = config.PUBLIC_FEED === '1' ? publicFeedRouter(store) : undefined
  if (feed) app.use(feed.router)
  const reach = express.Router()
  app.use(reach)
  const hosted = config.HOSTED === '1' ? new HostedLimits(store, config) : undefined
  const queue = hosted ? new HostedQueue(config) : undefined
  if (hosted) {
    store.spendingGuard = () => hostedControl(config).spendingPaused
    app.use(sandboxStatsRouter(store))
    app.use(sessionGuard(hosted))
    app.use(publishingGateway(config, store))
    app.use(express.json({ limit: '16kb' }))
    app.use(accessGuard(hosted))
  } else { app.use(admissionGuard(config, store)); app.use(publishingGateway(config, store)) }
  app.get('/openapi.json', (_req, res) => res.json(openapi))
  app.post('/api/verify', express.json({ limit: '8mb' }), async (req, res) => {
    res.json(await verifyAnswer(req.body, { testnet: req.query.testnet === '1', expectHead: typeof req.query.expectHead === 'string' ? req.query.expectHead : undefined }))
  })
  app.use(express.json({ limit: '16kb' }))
  const client = new PublisherClient({ baseUrls: options.publisherUrls ?? (!options.publisherUrl && config.PUBLISHER_URLS ? config.PUBLISHER_URLS.split(',').map(s => s.trim()) : undefined), baseUrl: options.publisherUrl ?? config.PUBLISHER_URL, secret: options.secret ?? config.PUBLISHER_SECRET })
  // Requested Testnet never silently falls back to simulated settlement.
  const payer = options.payer ?? (config.SETTLEMENT_RAIL === 'xrpl-testnet' && config.XRPL_PAYER_SEED ? (hosted ? hostedPayer(config) : XrplPayer.fromEnv()) : undefined)
  if (config.ANCHOR_RAIL !== 'off' && payer instanceof XrplPayer) anchors = new AnswerAnchors(store, payer)
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
    const runJob = () => withModelUsage(usage => store.appendEvent(runId, { type: usage.fallback ? 'MODEL_FALLBACK' : 'MODEL_USAGE', label: usage.fallback ? `LLM fallback${typeof usage.reason === 'string' ? ` (${usage.reason})` : ''} · labelled fixture` : 'Provider-reported usage', data: usage }), job).catch(() => {
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
    const hold = hosted?.forRun(runId)
    const task = hosted && hold ? hostedExecution.run({ limits: hosted, holdId: hold.id, principal: hold.principal }, runJob) : runJob()
    activeRuns.set(runId, task)
    jobs.add(task)
    return task
  }
  const faultsAvailable = config.PUBLISHER_FAULTS === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(publisherUrl).hostname)
  const context: ApiContext = { work, store, client, payer, purchases, loop, reputation, labels, mcpPolicy, publisherUrl, launch, streams, trackWork: job => {
    // Planning has its own capacity, but shutdown must still wait for its final durable writes.
    const pending = job.then(() => {}, () => {})
    jobs.add(pending); void pending.then(() => jobs.delete(pending))
  }, sseGzip: config.HOSTED === '1' && config.HOSTED_SSE_GZIP !== '0', onStreamOpen: runId => { if (config.HOSTED === '1') { lastSnapshot.set(runId, Date.now()); if (['DONE','FAILED','STOPPED'].includes(store.getRun(runId).phase)) terminalSnapshots.add(runId) } }, onStreamEmpty: runId => { clearTimeout(snapshotTimers.get(runId)); snapshotTimers.delete(runId); lastSnapshot.delete(runId); terminalSnapshots.delete(runId) }, reportDir, reportJobs, progress }
  if (hosted) reach.use(express.json({ limit: '16kb' }), publicMcpRouter(context, config, hosted))
  const hire = hireService(context, { principal: publicHirePrincipal, admitted: bindPublicHire, finished: runId => finishPublicHire(hosted, runId) })
  let readiness: HostedReadiness | undefined
  if (hosted && queue) {
    const payerWatch = new PayerWatch()
    // Recovery is complete before startup health becomes available. Readiness is probed in the background (H7): a
    // request reads the last answer (at most 15 s old, see server/hosted/readiness.ts) and never waits for the ledgers.
    const probeReadiness = options.hostedProbe ?? (async () => {
      try {
        if (!hosted.available()) return false
        if (isLlmConfigured() && ['RESEARCH','DECISION'].some(profile => !Number.isFinite(Number(config[`HOSTED_${profile}_INPUT_USD_PER_MILLION`])) || Number(config[`HOSTED_${profile}_INPUT_USD_PER_MILLION`]) <= 0 || !Number.isFinite(Number(config[`HOSTED_${profile}_OUTPUT_USD_PER_MILLION`])) || Number(config[`HOSTED_${profile}_OUTPUT_USD_PER_MILLION`]) < 0)) return false
        store.checkWritable()
        const writers = await client.registry()
        if (!writers.length || !payer) return false
        const b = await payer.balance()
        if (b.ledgerAgeSeconds <= 30) payerWatch.record(b.balanceDrops)
        return b.ledgerAgeSeconds <= 30 && b.availableDrops > (store.walletStatus().reservedMinor + hosted.questionMinor) * 1000 + 2000 &&
          config.HOSTED_PROVIDERS_READY_UNTIL !== undefined && Date.parse(config.HOSTED_PROVIDERS_READY_UNTIL) > Date.now()
      } catch { return false }
    })
    if (!options.hostedReadiness) readiness = new HostedReadiness(probeReadiness)
    const ready = () => options.hostedReadiness ? options.hostedReadiness() : readiness!.ready()
    reach.use(publicPaidRouter(config, hosted, hire.router, ready))
    app.use(hostedRouter(context,config,hosted,queue,ready,async () => {
      try { store.checkWritable(); return (await client.registry()).length > 0 } catch { return false }
    }, () => payerWatch.state()))
    // Per-principal and global SSE connection ceilings include reconnects. Behind Cloud Run and nginx a closed tab's
    // stream stayed registered here, so on the live demo every later stream of that visitor got 429 (H5). Now: a settled
    // run answers 204 (EventSource stops; the client reads the run once), a visitor's newest stream replaces their
    // oldest, and every stream ends within 10 minutes (a page still open reconnects on its own).
    app.get('/runs/:id/events',(req,res,next)=>{
      const principal = res.locals.hostedSession.principal
      if (runSettled(store.getRun(String(req.params.id)))) return res.status(204).end()
      const own = [...streams].filter(([id])=>store.runPrincipal(id)?.principal===principal).flatMap(([id,set])=>[...set].map(stream=>({id,stream})))
      for (const { id, stream } of own.slice(0, Math.max(0, own.length - 1))) { streams.get(id)?.delete(stream); if (!streams.get(id)?.size) streams.delete(id); endSse(stream) }
      const total = [...streams.values()].reduce((n,set)=>n+set.size,0)
      if(total>=16) return res.status(429).json({error:'stream_limit'})
      const expires = setTimeout(() => endSse(res), Math.min(HOSTED_STREAM_MS, Math.max(1,res.locals.hostedSession.expires-Date.now())))
      res.on('close',()=>clearTimeout(expires))
      next()
    })
  }
  if (hosted) app.use(hostedWriterPages(publisherUrl))
  app.use(writersRouter(context, !!hosted))
  app.use(providersRouter(work))
  app.use(ownerSettingsRouter(context))
  app.use(walletRouter(context))
  app.use(operationsRouter(context))
  app.use(auditRouter(context))
  // Trust matrix (D6): public, engine-side, persisted across runs.
  app.get('/api/local-writers', (_req, res) => res.json({ writers: config.SETTLEMENT_RAIL === 'xrpl-testnet' ? localWriterRegistrations() : [] }))
  app.get('/api/reputation', (_req, res) => res.json({ publishers: reputation.list() }))
  app.post('/api/reputation/reset', (_req, res) => { reputation.reset(); res.json({ publishers: [] }) })
  // The web app asks this once at boot to learn whether it is the hosted judge demo. A local or desktop server answers
  // 200 {hosted:false} instead of a 404, so the browser console stays clean (the hosted gateway serves its own status above).
  if (!hosted) app.get('/api/demo/status', (_req, res) => res.json({ hosted: false }))
  app.get(['/health', '/api/health'], (_req, res) => res.json({ status: 'ok', ...(config.CORPUS_PROFILE === 'real' ? {corpusProfile:'real'} : {}), answerRatings: config.ANSWER_RATINGS === '1', labels: { ...labels, ...(['faucet_unavailable', 'validation_timeout', 'wallet_cache_unavailable', 'network_unavailable'].includes(process.env.RA_TESTNET_FALLBACK ?? '') ? { testnetFallback: process.env.RA_TESTNET_FALLBACK } : {}) }, faults: faultsAvailable }))

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
  app.use(hire.router)
  // Proof of refusal (W1): owner share routes under /api/runs/:id/proof, public read-only pages under /proof/:id.
  const refusal = refusalProofRouter(context, { hosted: !!hosted, origin: hosted ? config.HOSTED_ORIGIN : undefined })
  app.use(refusal.router)
  if (config.ANSWER_RATINGS === '1') app.use(answerRatingsRouter(store))
  app.use(runsRouter(context))
  app.use(mcpRouter(context))
  app.use(reportsRouter(context))
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const notFound = error instanceof Error && error.message === 'Run not found'
    const status = error instanceof HostedError ? error.status : requestBodyStatus(error) ?? (error instanceof OverloadedError ? 503 : error instanceof AgentDenied ? 403 : notFound ? 404 : error instanceof z.ZodError ? 400 : 500)
    if (error instanceof HostedError) { res.set('Retry-After','30').status(status).json({error:error.code}); return }
    res.status(status).json({ ...errorEnvelope(error instanceof OverloadedError ? 'overloaded' : status === 403 ? 'unauthorized' : notFound ? 'not_found' : [400,413].includes(status) ? 'invalid' : 'backend_unavailable', status), error: notFound ? 'Run not found.' : status === 413 ? 'Request body too large.' : status === 400 ? 'Invalid command.' : 'Operation failed; the last validated answer and ledger are preserved.' })
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
        await hire.reconcile()
        if (stopping) return
        // Existing durable runnable rows are retried on the next sweep when saturated;
        // this creates no new durable queue and never blocks signed reconciliation.
        for (const runId of hosted ? [] : store.runnableRunIds()) {
          if (activeRuns.has(runId)) continue
          try { const run = store.getRun(runId); void launch(runId, () => typeof run.checkpoint.recoveryIntentId === 'string' ? loop.recoverAnswer(runId, run.checkpoint.recoveryIntentId) : loop.start(runId)) } catch (error) { if (!(error instanceof OverloadedError)) throw error }
        }
        for (const runId of hosted ? [] : store.recoverableRunIds()) {
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
  if (hosted) {
    const retain = () => {
      hosted.expireDrafts()
      hosted.expireSessions()
      refusal.proofs.expire()
      store.prune({ olderThanDays: 1 })
      store.hostedState(db => {
        db.prepare("UPDATE hosted_holds SET scope_result=NULL,ip='' WHERE created<?").run(Date.now()-86400000)
        db.prepare('DELETE FROM hosted_reputation WHERE principal NOT IN (SELECT principal FROM hosted_sessions)').run()
      })
    }
    retain()
    const retentionTimer = setInterval(() => { try { retain() } catch { /* readiness probes fail closed on unavailable storage */ } },60000); retentionTimer.unref(); timers.add(retentionTimer)
    for (const runId of store.runnableRunIds(true)) {
      if (hosted.forRun(runId)) loop.stop(runId)
    }
    store.hostedState(db => {
      db.prepare("UPDATE hosted_holds SET state='interrupted' WHERE state IN ('active','queued')").run()
      db.prepare('UPDATE hosted_holds SET scope_result=NULL WHERE created<?').run(Date.now()-86400000)
    })
    store.prune({ olderThanDays: 1 })
  }
  await reconcileOnce()
  const reconcileTimer = setInterval(() => { void reconcileOnce().catch(() => undefined) }, options.reconcileIntervalMs ?? Number(config.RECONCILE_INTERVAL_MS || 15000))
  reconcileTimer.unref()
  const stopReconciler = () => { stopping = true; clearInterval(reconcileTimer) }
  let closing: Promise<void> | undefined
  // Reconciliation happens before new spending. Existing stopped/done runs remain final.
  for (const runId of hosted ? [] : store.runnableRunIds()) { const run = store.getRun(runId); try { launch(runId, () => typeof run.checkpoint.recoveryIntentId === 'string' ? loop.recoverAnswer(runId, run.checkpoint.recoveryIntentId) : loop.start(runId)) } catch (error) { if (!(error instanceof OverloadedError)) throw error } }
  const drain = async () => {
    stopReconciler()
    queue?.close()
    readiness?.close()
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
    snapshotTimers.clear(); lastSnapshot.clear(); terminalSnapshots.clear()
    for (const set of streams.values()) for (const res of set) endSse(res)
    hire.close()
    feed?.close(); store.close()
    await (payer?.ledger as { close?: () => Promise<void> } | undefined)?.close?.()
  })() }
}
