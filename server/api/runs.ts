import { Router, type RequestHandler } from 'express'
import type { ApiContext } from './context.js'
import { admit } from '../spend-policy.js'
import { BUDGET } from '../../shared/contracts/run.js'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { AskSchema } from '../../shared/contracts/index.js'
import { freezeRequirements, plan as planSearch, scope } from '../agents/scope.js'

export function runsRouter(context: ApiContext) {
  const router = Router()
  const { store, loop, launch, streams } = context
  // Clarify (D8/D9): questions and a plan only; this route cannot spend. clarify=never skips the questions.
  router.post('/api/scope', async (req, res) => {
    const input = z.object({ question: AskSchema.shape.question, clarify: z.enum(['never', 'auto']).optional() }).parse(req.body)
    const never = input.clarify === 'never' || req.query.clarify === 'never'
    res.json(await scope(input.question, never ? { clarify: 'never' } : {}))
  })
  router.post('/runs', startRun(context))
  router.get('/api/runs', (_req, res) => res.json(store.listPastRuns()))
  router.post('/api/runs/:id/pin', (req, res) => { store.setRunMeta(String(req.params.id), { pinned: z.object({ pinned: z.boolean() }).parse(req.body).pinned }); res.json(store.listPastRuns()) })
  router.delete('/api/runs/:id', (req, res) => {
    const run = store.getRun(String(req.params.id))
    if (!run.stopped && !['DONE', 'FAILED', 'STOPPED'].includes(run.phase)) return res.status(409).json({ error: 'Stop the run before deleting it.' })
    store.setRunMeta(run.runId, { hidden: true, pinned: false })
    res.json(store.listPastRuns())
  })
  router.get('/runs/:id', (req, res) => res.json(store.getRun(String(req.params.id))))
  router.post('/runs/:id/stop', (req, res) => { loop.stop(String(req.params.id)); res.json(store.getRun(String(req.params.id))) })
  router.post('/runs/:id/retry-delivery', (req, res) => {
    const runId = String(req.params.id)
    const { intentId } = z.object({ intentId: z.string().min(1) }).parse(req.body)
    const intent = store.getIntent(intentId)
    if (!intent || intent.runId !== runId || !['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED'].includes(intent.status)) return res.status(409).json({ error: 'No settled delivery can be retried for this run.' })
    res.status(202).json(store.getRun(runId))
    launch(runId, () => loop.retryDelivery(runId, intentId))
  })
  router.get('/runs/:id/events', (req, res) => {
    const runId = String(req.params.id)
    const snapshot = store.getRun(runId)
    res.set({ 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
    res.flushHeaders()
    streams.set(runId, streams.get(runId) ?? new Set())
    streams.get(runId)!.add(res)
    const frame = `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`
    if (Buffer.byteLength(frame) > 256 * 1024) { streams.get(runId)!.delete(res); if (!streams.get(runId)!.size) streams.delete(runId); res.end(); return }
    res.write(frame)
    const heartbeat = setInterval(() => { if (res.writableEnded || res.destroyed || res.writableLength > 256 * 1024 - 16) res.end(); else res.write(': heartbeat\n\n') }, 15000)
    const detach = () => { clearInterval(heartbeat); streams.get(runId)?.delete(res); if (!streams.get(runId)?.size) { streams.delete(runId); context.onStreamEmpty?.(runId) } }
    req.on('close', detach)
    res.on('error', () => { detach(); res.destroy() })
  })
  return router
}

// Both surfaces share the original admission handler and its policy-only launch path.
export function startRun(context: ApiContext, surface: 'web' | 'mcp' = 'web'): RequestHandler {
  const { store, loop, mcpPolicy, labels, launch } = context
  // The budget, not the plan, is the spending authorization (gate 2).
  return (req, res) => {
    const isMcp = surface === 'mcp'
    const input = AskSchema.parse(isMcp ? { question: req.body.question, budgetMinor: 0, escrow: req.body.escrow } : req.body)
    const request = isMcp ? z.object({ budget_sgd: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER / 100), idempotency_key: z.string().min(1).max(200).optional() }).parse(req.body) : undefined
    const agent = res.locals.agent as { id: string } | undefined
    const admitted = admit(store, { surface: agent ? 'agent' : isMcp ? 'mcp' : 'web', principal: agent?.id ?? 'operator',
      question: input.question, requestedMinor: request ? Math.floor(request.budget_sgd * 100 + 1e-7) : input.budgetMinor,
      idempotencyKey: request?.idempotency_key ?? z.string().min(1).max(200).optional().parse(req.get('Idempotency-Key')) ?? randomUUID(),
      maxMinor: agent ? BUDGET.maxMinor : isMcp ? mcpPolicy.maxMinor : BUDGET.maxMinor, ...(isMcp && !agent ? { dailyMinor: mcpPolicy.dailyMinor } : {}), labels })
    if (!admitted.reused && input.escrow !== undefined) store.updateRun(admitted.run.runId, { checkpoint: { ...admitted.run.checkpoint, escrow: input.escrow } })
    const run = store.getRun(admitted.run.runId)
    res.status(admitted.reused ? 200 : 201).json(run)
    if (admitted.reused) return
    launch(run.runId, async () => {
      // No plan from the UI: the server plans itself, so tests and API users need no UI. A clarify answer re-plans
      // on the server too (#208): the client's plan predates the answer, so the angle would never reach search.
      // The planner label stays visible (gate 5): client, live model, or the fixture fallback.
      const clarified = Object.values(input.answers ?? {}).some(answer => answer.trim())
      const planned = input.plan && !clarified ? { ...input.plan, label: 'client plan' } : await planSearch(input.question, input.answers)
      // Requested facts are frozen here, before any evidence is read (#208). An edited or legacy client plan carries
      // none bound to this question, so the server derives them from the question (and answers) instead.
      let frozen = freezeRequirements(input.question, planned, input.answers)
      let requirementsBy = frozen.source === 'plan' ? planned.label : 'fixture · scope-fixture'
      if (frozen.source === 'fixture' && planned.label === 'client plan') {
        const replanned = await planSearch(input.question, input.answers)
        const again = freezeRequirements(input.question, replanned, input.answers)
        if (again.source === 'plan') { frozen = again; requirementsBy = replanned.label }
      }
      const { label: planLabel, requirements: _texts, requirementsKey: _key, ...plan } = planned
      const current = store.getRun(run.runId)
      store.updateRun(run.runId, { labels: { ...current.labels, plan: planLabel }, checkpoint: { ...current.checkpoint, plan, requirements: frozen.requirements, requirementsBy, ...(input.answers ? { answers: input.answers } : {}) } })
      if (input.answers && Object.keys(input.answers).length) store.appendEvent(run.runId, { type: 'CLARIFY', label: `Clarified: ${Object.values(input.answers).join(' · ')}`, data: { answers: input.answers } })
      store.appendEvent(run.runId, { type: 'PLAN', label: `Search plan (${planLabel}): ${plan.subqueries.join(' · ')}`, data: { plan, planner: planLabel, requirements: frozen.requirements.map(r => r.text), requirementsBy } })
      await loop.start(run.runId)
    })
  }
}
