import express, { type ErrorRequestHandler, type Response } from 'express'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { z } from 'zod'
import { AskSchema, SIMULATED_LABEL, XRPL_LABEL, type ModeLabels, type TraceEvent } from '../shared/contracts/index.js'
import { XrplPayer } from './xrpl.js'
import { Store } from './store.js'
import { PublisherClient } from './publisher-client.js'
import { PurchaseManager } from './purchases.js'
import { RunLoop } from './agents/loop.js'
import { ClefDecisionProvider } from './agents/clef.js'
import { type DecisionProvider } from './agents/decision.js'
import { buildReport, renderReport } from './agents/report.js'
import { isLlmConfigured, llmLabel, researchModel } from './agents/llm.js'

export type ApiOptions = { payer?: XrplPayer; dbPath?: string; publisherUrl?: string; secret?: string; reportDir?: string; provider?: DecisionProvider }
export async function createApiApp(options: ApiOptions = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next() })
  const streams = new Map<string, Set<Response>>()
  const publish = (event: TraceEvent) => {
    for (const res of streams.get(event.runId) ?? []) {
      res.write(`event: trace\ndata: ${JSON.stringify(event)}\n\n`)
      res.write(`event: snapshot\ndata: ${JSON.stringify(store.getRun(event.runId))}\n\n`)
    }
  }
  const store = new Store(options.dbPath ?? process.env.APP_DB ?? 'data/app.db', publish)
  const client = new PublisherClient({ baseUrl: options.publisherUrl ?? process.env.PUBLISHER_URL, secret: options.secret ?? process.env.PUBLISHER_SECRET })
  // XRPL Testnet settlement needs both the rail flag and a payer seed; otherwise simulated, labelled.
  const payer = options.payer ?? (process.env.SETTLEMENT_RAIL === 'xrpl-testnet' && process.env.XRPL_PAYER_SEED ? XrplPayer.fromEnv() : undefined)
  const purchases = new PurchaseManager(store, client, payer)
  let provider = options.provider
  if (!provider && process.env.DECISION_PROVIDER === 'cloudflare') {
    const clef = new ClefDecisionProvider({ allowLive: true })
    // The promise caches account discovery; failure falls back visibly in decide().
    try { await clef.resolveAccount() } catch { /* A fixture decision remains available. */ }
    provider = clef
  }
  const loop = new RunLoop(store, client, purchases, undefined, { provider })
  const reportDir = resolve(options.reportDir ?? process.env.REPORT_DIR ?? 'data/reports')
  const reportJobs = new Map<string, Promise<{ format: 'PDF' | 'HTML'; path: string }>>()
  const timers = new Set<ReturnType<typeof setInterval>>()
  const publisherUrl = options.publisherUrl ?? process.env.PUBLISHER_URL ?? 'http://127.0.0.1:8790'
  const labels: ModeLabels = { research: isLlmConfigured() ? `${llmLabel()} · ${researchModel()} (pending)` : 'fixture · extractive-fixture', decision: provider?.name === 'cloudflare' ? `Cloudflare · ${provider.model} (pending)` : 'fixture · metadata-fixture', publisher: /\.run\.app(?:\/|$)/.test(publisherUrl) ? 'Cloud Run' : process.env.K_SERVICE ? 'Cloud Run · same container' : 'local', settlement: payer ? XRPL_LABEL : SIMULATED_LABEL }
  const progress = (runId: string, label: string) => {
    const timer = setInterval(() => {
      try { store.appendEvent(runId, { type: 'PROGRESS', label }) } catch { /* Shutdown or missing run. */ }
    }, 2000)
    timers.add(timer)
    return () => { clearInterval(timer); timers.delete(timer) }
  }
  const launch = (runId: string, job: () => Promise<void>) => {
    const done = progress(runId, 'Working with accessible evidence; spending policy remains enforced.')
    void job().catch(() => {
      store.updateRun(runId, { phase: 'FAILED', error: 'Run interrupted; start a new ask or retry a settled delivery.' })
    }).finally(() => {
      done()
      const run = store.getRun(runId)
      if (!run.answers.length) {
        store.addAnswer(runId, { conclusion: 'No accessible evidence was read. The publisher is unavailable; start a new ask when it is ready.', claims: [], openGaps: [{ text: 'No accessible evidence is available.', facet: 'grid-energisation' }], version: 1, provider: 'fixture', model: 'extractive-fixture' })
        store.updateRun(runId, { labels: { ...run.labels, research: 'fixture · extractive-fixture' } })
      }
      store.appendEvent(runId, { type: 'SNAPSHOT', label: 'Latest validated answer and ledger saved.' })
    })
  }
  const faultsAvailable = process.env.PUBLISHER_FAULTS === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(publisherUrl).hostname)
  app.get(['/health', '/api/health'], (_req, res) => res.json({ status: 'ok', labels, faults: faultsAvailable }))
  if (faultsAvailable) app.post('/api/demo/faults', async (req, res) => {
    z.object({ failNextDelivery: z.literal(true) }).parse(req.body)
    const response = await fetch(new URL('/__faults', publisherUrl), {
      method: 'POST', signal: AbortSignal.timeout(3000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.secret ?? process.env.PUBLISHER_SECRET}` },
      body: JSON.stringify({ failNextDelivery: true }),
    })
    if (!response.ok) return res.status(502).json({ error: 'Local publisher fault control is unavailable.' })
    res.json({ failNextDelivery: true, label: 'SIMULATED fault · no real funds' })
  })
  app.post('/runs', (req, res) => {
    const input = AskSchema.parse(req.body)
    const run = store.createRun(input.question, input.budgetMinor, labels)
    res.status(201).json(run)
    launch(run.runId, () => loop.start(run.runId))
  })
  app.get('/runs/:id', (req, res) => res.json(store.getRun(String(req.params.id))))
  app.post('/runs/:id/stop', (req, res) => { loop.stop(String(req.params.id)); res.json(store.getRun(String(req.params.id))) })
  app.post('/runs/:id/retry-delivery', (req, res) => {
    const runId = String(req.params.id)
    const { intentId } = z.object({ intentId: z.string().min(1) }).parse(req.body)
    const intent = store.getIntent(intentId)
    if (!intent || intent.runId !== runId || !['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED'].includes(intent.status)) return res.status(409).json({ error: 'No settled delivery can be retried for this run.' })
    res.status(202).json(store.getRun(runId))
    launch(runId, () => loop.retryDelivery(runId, intentId))
  })
  app.get('/runs/:id/events', (req, res) => {
    const runId = String(req.params.id)
    const snapshot = store.getRun(runId)
    res.set({ 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
    res.flushHeaders()
    streams.set(runId, streams.get(runId) ?? new Set())
    streams.get(runId)!.add(res)
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000)
    req.on('close', () => { clearInterval(heartbeat); streams.get(runId)?.delete(res) })
  })
  app.post('/runs/:id/report', async (req, res) => {
    const runId = String(req.params.id)
    const run = store.getRun(runId)
    if (!run.answers.length) return res.status(409).json({ error: 'Wait for a validated answer before requesting a report.' })
    let job = reportJobs.get(runId)
    if (!job) {
      store.updateRun(runId, { reportStatus: 'GENERATING' })
      store.appendEvent(runId, { type: 'REPORT', label: 'Rendering a cited report with persisted decisions and receipts.' })
      const done = progress(runId, 'Report generation is in progress; validated passages and receipts are preserved.')
      job = buildReport(run).then(report => renderReport(report, resolve(reportDir, `${runId}.pdf`))).then(result => {
        store.updateRun(runId, { reportStatus: result.format })
        store.appendEvent(runId, { type: 'REPORT', label: result.format === 'PDF' ? 'PDF report ready.' : 'Chromium unavailable; HTML print fallback ready.' })
        return result
      }).catch(error => { store.updateRun(runId, { reportStatus: 'FAILED' }); throw error }).finally(() => { done(); reportJobs.delete(runId) })
      reportJobs.set(runId, job)
    }
    const result = await job
    res.json({ format: result.format, url: `/runs/${runId}/report.${result.format.toLowerCase()}` })
  })
  for (const extension of ['pdf', 'html']) app.get(`/runs/:id/report.${extension}`, (req, res) => {
    const runId = String(req.params.id)
    store.getRun(runId)
    const path = resolve(reportDir, `${runId}.${extension}`)
    if (!existsSync(path)) return res.status(404).json({ error: 'Create the report first.' })
    res.type(extension === 'pdf' ? 'application/pdf' : 'text/html').sendFile(path, { dotfiles: 'allow' })
  })
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const notFound = error instanceof Error && error.message === 'Run not found'
    res.status(notFound ? 404 : error instanceof z.ZodError ? 400 : 500).json({ error: notFound ? 'Run not found.' : error instanceof z.ZodError ? 'Invalid command.' : 'Operation failed; the last validated answer and ledger are preserved.' })
  }
  app.use(handleError)
  await purchases.reconcile()
  // Reconciliation happens before new spending. Existing stopped/done runs remain final.
  for (const run of store.listRuns()) if (!['DONE', 'STOPPED', 'FAILED'].includes(run.phase)) launch(run.runId, () => loop.start(run.runId))
  return { app, store, loop, close: () => { timers.forEach(clearInterval); for (const set of streams.values()) for (const res of set) res.end(); store.close(); void (payer?.ledger as { close?: () => Promise<void> } | undefined)?.close?.() } }
}
