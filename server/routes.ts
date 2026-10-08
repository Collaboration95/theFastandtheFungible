import express, { type ErrorRequestHandler, type Response } from 'express'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { z } from 'zod'
import { AskSchema, DROPS_PER_MINOR, LedgerViewSchema, SIMULATED_LABEL, XRPL_LABEL, type LedgerView, type ModeLabels, type TraceEvent } from '../shared/contracts/index.js'
import { XrplPayer } from './xrpl.js'
import { scoreTrace, traceEvent, traceRun } from './telemetry.js'
import { startActiveObservation } from '@langfuse/tracing'
import { Store } from './store.js'
import { PublisherClient } from './publisher-client.js'
import { PurchaseManager } from './purchases.js'
import { Reputation } from './reputation.js'
import { RunLoop } from './agents/loop.js'
import { ClefDecisionProvider } from './agents/clef.js'
import { type DecisionProvider } from './agents/decision.js'
import { buildReport, renderReport } from './agents/report.js'
import { isLlmConfigured, llmLabel, researchModel } from './agents/llm.js'
import { plan as planSearch, scope } from './agents/scope.js'

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
  // Every durable event is also mirrored into the active Langfuse trace (a no-op when tracing is off).
  const store = new Store(options.dbPath ?? process.env.APP_DB ?? 'data/app.db', event => { try { traceEvent(event) } catch { /* telemetry never blocks the run */ } publish(event) })
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
  const reputation = new Reputation(store)
  const loop = new RunLoop(store, client, purchases, undefined, { provider, reputation })
  const reportDir = resolve(options.reportDir ?? process.env.REPORT_DIR ?? 'data/reports')
  const reportJobs = new Map<string, Promise<{ format: 'PDF' | 'HTML'; path: string }>>()
  const timers = new Set<ReturnType<typeof setInterval>>()
  const publisherUrl = options.publisherUrl ?? process.env.PUBLISHER_URL ?? 'http://127.0.0.1:8790'
  const labels: ModeLabels = { research: isLlmConfigured() ? `${llmLabel()} · ${researchModel()} (pending)` : 'fixture · extractive-fixture', decision: provider?.name === 'cloudflare' ? `Cloudflare · ${provider.model} (pending)` : 'fixture · metadata-fixture', publisher: /\.run\.app(?:\/|$)/.test(publisherUrl) ? 'Cloud Run' : 'local', settlement: payer ? XRPL_LABEL : SIMULATED_LABEL }
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
        store.addAnswer(runId, { conclusion: 'No accessible evidence was read. The publisher is unavailable; start a new ask when it is ready.', claims: [], openGaps: [{ text: 'No accessible evidence is available.' }], version: 1, provider: 'fixture', model: 'extractive-fixture' })
        store.updateRun(runId, { labels: { ...run.labels, research: 'fixture · extractive-fixture' } })
      }
      store.appendEvent(runId, { type: 'SNAPSHOT', label: 'Latest validated answer and ledger saved.' })
    })
  }
  const faultsAvailable = process.env.PUBLISHER_FAULTS === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(publisherUrl).hostname)
  // Read-only Testnet view for the ledger panel: public addresses, live balances, receipts per payee.
  let ledgerCache: { at: number; view: Promise<LedgerView> } | undefined
  const ledgerView = async (): Promise<LedgerView> => {
    if (!payer?.address) return { rail: 'simulated' }
    // Paid publishers are the registry entries with a wallet (#138).
    const publishers = (await client.registry()).filter(p => p.wallet).map(p => [p.wallet!, p.name] as const)
    const runs = store.listRuns()
    const receipts = runs.flatMap(run => run.receipts).filter(r => r.xrpl)
    const refundedDrops = (intentId: string) => (runs.flatMap(run => run.intents).find(i => i.intentId === intentId)?.refund?.amountMinor ?? 0) * DROPS_PER_MINOR
    const balance = async (address: string) => {
      try { return String((await payer.ledger.request({ command: 'account_info', account: address, ledger_index: 'validated' })).result.account_data.Balance) }
      catch { return null }
    }
    const wallet = async (role: 'buyer' | 'publisher', name: string, address: string) => {
      const mine = receipts.filter(r => (role === 'buyer' ? r.xrpl!.payer : r.xrpl!.payTo) === address)
      return { role, name, address, balanceDrops: await balance(address), receivedDrops: String(role === 'buyer' ? 0 : Math.max(0, mine.reduce((sum, r) => sum + Number(r.xrpl!.amountDrops) - refundedDrops(r.intentId), 0))), payments: mine.length }
    }
    return LedgerViewSchema.parse({ rail: 'xrpl-testnet', network: 'xrpl:1', accountExplorer: 'https://testnet.xrpl.org/accounts', updatedAt: new Date().toISOString(),
      wallets: await Promise.all([wallet('buyer', 'ResearchAgent (buyer)', payer.address), ...publishers.map(([address, name]) => wallet('publisher', name, address))]) })
  }
  app.get('/api/ledger', async (_req, res) => {
    if (!ledgerCache || Date.now() - ledgerCache.at > 5000) ledgerCache = { at: Date.now(), view: ledgerView() }
    try { res.json(await ledgerCache.view) } catch { ledgerCache = undefined; res.status(503).json({ error: 'Ledger view unavailable.' }) }
  })
  // Trust matrix (D6): public, engine-side, persisted across runs.
  app.get('/api/reputation', (_req, res) => res.json({ publishers: reputation.list() }))
  app.post('/api/reputation/reset', (_req, res) => { reputation.reset(); res.json({ publishers: [] }) })
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
  // Clarify (D8/D9): questions and a plan only; this route cannot spend. clarify=never skips the questions.
  app.post('/api/scope', async (req, res) => {
    const input = z.object({ question: AskSchema.shape.question, clarify: z.enum(['never', 'auto']).optional() }).parse(req.body)
    const never = input.clarify === 'never' || req.query.clarify === 'never'
    res.json(await scope(input.question, never ? { clarify: 'never' } : {}))
  })
  // The 5 s modal is UI only: calling this starts the run. The budget, not the plan, is the spending authorization (gate 2).
  app.post('/runs', (req, res) => {
    const input = AskSchema.parse(req.body)
    const run = store.createRun(input.question, input.budgetMinor, labels)
    res.status(201).json(run)
    launch(run.runId, async () => {
      // No plan from the UI: the server plans itself, so tests and API users need no UI.
      // The planner label stays visible (gate 5): client, live model, or the fixture fallback.
      const { label: planLabel, ...plan } = input.plan ? { ...input.plan, label: 'client plan' } : await planSearch(input.question, input.answers)
      const current = store.getRun(run.runId)
      store.updateRun(run.runId, { labels: { ...current.labels, plan: planLabel }, checkpoint: { ...current.checkpoint, plan, ...(input.answers ? { answers: input.answers } : {}) } })
      if (input.answers && Object.keys(input.answers).length) store.appendEvent(run.runId, { type: 'CLARIFY', label: `Clarified: ${Object.values(input.answers).join(' · ')}`, data: { answers: input.answers } })
      store.appendEvent(run.runId, { type: 'PLAN', label: `Search plan (${planLabel}): ${plan.subqueries.join(' · ')}`, data: { plan, planner: planLabel } })
      await loop.start(run.runId)
    })
  })
  app.get('/api/runs', (_req, res) => res.json(store.listPastRuns()))
  app.post('/api/runs/:id/pin', (req, res) => { store.setRunMeta(String(req.params.id), { pinned: z.object({ pinned: z.boolean() }).parse(req.body).pinned }); res.json(store.listPastRuns()) })
  app.delete('/api/runs/:id', (req, res) => {
    const run = store.getRun(String(req.params.id))
    if (!run.stopped && !['DONE', 'FAILED', 'STOPPED'].includes(run.phase)) return res.status(409).json({ error: 'Stop the run before deleting it.' })
    store.setRunMeta(run.runId, { hidden: true, pinned: false })
    res.json(store.listPastRuns())
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
      let rendered: { format: string; findings: number; provider: string } | undefined
      const render = () => buildReport(run).then(report => startActiveObservation('render-report', async observation => {
        const result = await renderReport(report, resolve(reportDir, `${runId}.pdf`))
        rendered = { format: result.format, findings: report.findings.length, provider: report.provider }
        observation.update({ output: rendered })
        return result
      }))
      const scoreReport = () => {
        if (!rendered) return
        scoreTrace('report-format', rendered.format)
        if (isLlmConfigured()) scoreTrace('report-fallback', rendered.provider === 'fixture')
      }
      // A separate trace in the run's session: the draft-report generation plus PDF rendering.
      job = traceRun('research-report', run, render, () => rendered ?? { format: 'FAILED' }, scoreReport).then(result => {
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
  return { app, store, loop, reputation, close: () => { timers.forEach(clearInterval); for (const set of streams.values()) for (const res of set) res.end(); store.close(); void (payer?.ledger as { close?: () => Promise<void> } | undefined)?.close?.() } }
}
