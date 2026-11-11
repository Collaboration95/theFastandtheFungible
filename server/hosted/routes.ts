import { Router } from 'express'
import { z } from 'zod'
import type { ApiContext } from '../api/context.js'
import { AskSchema, PlanSchema } from '../../shared/contracts/index.js'
import type { Plan } from '../../shared/contracts/index.js'
import { isLlmConfigured } from '../agents/llm.js'
import { scope, plan as planSearch, freezeRequirements, boundRequirements, type ScopeResult } from '../agents/scope.js'
import { HostedLimits, LIMITS, digest, type Hold } from './limits.js'
import { HostedQueue, HostedPlanLane } from './queue.js'
import { hostedExecution } from './execution.js'
import { HostedError, hostedControl, requireAdmissions } from './control.js'
import type { Config } from '../config.js'
import { readHostedLinks } from './links.js'
import type { PayerFunds } from './readiness.js'
export type DemoStatus = {
  state: 'ready' | 'paused' | 'busy' | 'degraded' | 'ended';
  capabilities: { ask: boolean; scope: boolean; history: boolean; receipts: boolean; pdf: false; settings: false; faultControls: false };
  questionCapMinor: number;
  remaining: { questions: number; minor: number }; labels: { models: string; rail: string };
  links: { repo: string; deck: string; video: string; progress: string; replay: string; proof?: string };
  csrfToken?: string; queue?: { runId: string; position: number | null; expiresAt: string; estimateSeconds?: number }[]
  /** Who a new question would wait for: how many are ahead of it, and whether the asker's own last run is among them.
   * `estimateSeconds` (H7) is how long until it would start, from recent runs; absent when none has finished yet. */
  wait?: { ahead: number; own: boolean; estimateSeconds?: number }
}
const REPO = 'https://github.com/Collaboration95/theFastandtheFungible', PAGES = 'https://collaboration95.github.io/theFastandtheFungible'
/** The environment indicator's model words. A fixture decision model is a substitution (hard gate 5): it is named here,
 * not only inside Show work, because it decides every purchase on this demo. */
export const modelsLabel = (research: boolean, decisions: boolean) => !research ? 'fixture models'
  : decisions ? 'live research and purchase decisions · per-answer fallback labelled' : 'live research · fixture purchase decisions · per-answer fallback labelled'
/**
 * H9-04: the search plan a hosted visitor confirmed, from the scope result this server stored on the question's hold
 * (the scope and the submit share one Idempotency-Key, and reserve() already refused a different question). Its label
 * is kept, so a fallback plan stays labelled on the run. None when there is no stored research plan (a chat reply, an
 * expired scope) or when the visitor answered clarify questions, which re-plans with the answers as the local route does.
 */
export function confirmedPlan(hold: Pick<Hold, 'scope_result'>, question: string, answers?: Record<string, string>): (Plan & { label: string }) | undefined {
  if (!hold.scope_result || Object.values(answers ?? {}).some(answer => answer.trim())) return undefined
  try {
    const stored = z.object({ plan: PlanSchema, label: z.string().min(1), chat: z.unknown().optional() }).parse(JSON.parse(hold.scope_result))
    if (stored.chat !== undefined) return undefined
    // Requested facts count only when they were frozen for exactly this question (#208); otherwise freezeRequirements derives them.
    const { requirements, requirementsKey, ...plan } = stored.plan
    return { ...plan, ...(boundRequirements(question, stored.plan) ? { requirements, requirementsKey } : {}), label: stored.label }
  } catch { return undefined }
}
/**
 * The hosted scope, and the plan the visitor will confirm (H9-04). When the scope's live plan was refused by a guard,
 * one dedicated planner call is made before the labelled fallback stands (H9-12): the scope model wrote "budget" itself
 * in 2 of 2 live calls for "Can the language model in ResearchAgent spend money on its own?", and running the fallback
 * plan that the visitor confirmed declined a question the planner's own plan answers. The guard is unchanged and checks
 * the new plan too; a refused or failed call keeps the fallback and its label.
 */
export async function scopeWithPlanner(question: string, options: Parameters<typeof scope>[1] = {}, planner: typeof planSearch = planSearch, scoper: typeof scope = scope): Promise<ScopeResult> {
  const scoped = await scoper(question, options)
  if (scoped.chat || !/· (?:spending|subject) guard$/.test(scoped.label)) return scoped
  const { label, ...plan } = await planner(question, {}, options.signal)
  return label.startsWith('fixture') ? scoped : { ...scoped, plan, label }
}
const keyOf = (value: unknown) => z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).parse(value)
const questionOf = (value: unknown) => {
  const question = z.string().trim().min(1).max(LIMITS.questionChars).parse(value)
  if (/-----BEGIN .*PRIVATE KEY|\b(?:sk-|ra_agent_)[A-Za-z0-9_-]{16,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(question)) throw new HostedError(400, 'private_input')
  return question
}
export function hostedRouter(context: ApiContext, config: Config, limits: HostedLimits, queue: HostedQueue, ready: () => Promise<boolean>, initialized: () => Promise<boolean>, payerFunds: () => PayerFunds = () => 'unknown') {
  const router = Router(), { store, loop } = context
  const planning = new HostedPlanLane()
  const execute = <T>(hold: Hold, fn: () => T) => hostedExecution.run({ limits, holdId: hold.id, principal: hold.principal },fn)
  const ownHistory = (principal: string) => store.listPastRuns(Number.NaN,principal).filter(r => { const h = limits.forRun(r.runId); return h && h.created + 86400000 > limits.now() })
  const status = async (principal = ''): Promise<DemoStatus> => {
    const c = hostedControl(config), ended = Date.now() >= Date.parse(config.HOSTED_ADMISSIONS_UNTIL || '2026-11-19T16:00:00Z')
    const remaining = limits.remaining(principal), links = readHostedLinks(config)
    const state = ended ? 'ended' : c.admissionsPaused || c.spendingPaused ? 'paused' : !(await ready()) || !remaining.questions || !remaining.minor ? 'degraded' : queue.busy ? 'busy' : 'ready'
    return { state, questionCapMinor: limits.questionMinor, capabilities: { ask: (state === 'ready' || state === 'busy') && queue.canQueue, scope: state === 'ready' || state === 'busy', history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining,
      labels: { models: modelsLabel(isLlmConfigured(), !context.labels.decision.startsWith('fixture')), rail: context.payer ? 'Shared XRPL Testnet demo · no real value' : 'SIMULATED · no real value' },
      // The operator's links file (state disk, no redeploy) wins over the environment; `proof` is optional and absent until set.
      links: { repo: REPO, deck: config.HOSTED_DECK_URL || `${REPO}/blob/main/docs/submission/ResearchAgent-SFF-deck.pdf`, video: links.video || config.HOSTED_VIDEO_URL || '', progress: config.HOSTED_PROGRESS_URL || `${PAGES}/progress/`, replay: config.HOSTED_REPLAY_URL || `${PAGES}/demo/`, ...(links.proof ? { proof: links.proof } : {}) } }
  }
  router.get('/livez', (_req,res) => res.json({ status: 'ok' }))
  router.get('/startupz', async (_req,res) => { const ok=await initialized(); res.status(ok?200:503).json({status:ok?'ok':'paused'}) })
  // A full queue (one running, two waiting) is normal busy-ness: visitors see "busy" and are told to wait, and an uptime
  // check that failed on it would page the owner for a healthy demo (H7). Only a state that cannot take work (paused,
  // ended, degraded) answers 503; a full queue stays 200 with `queue: 'full'` so a reader can still tell.
  router.get('/readyz', async (_req,res) => { const s = await status(); res.status(['ready','busy'].includes(s.state) ? 200 : 503).json({ status: s.state, ...(queue.canQueue ? {} : { queue: 'full' }) }) })
  // The shared payer's balance against 30 XRP, for the owner's alert only (H7). It never changes what a visitor sees:
  // readiness and the ask gate do not read it. 503 only for a reading below the line; no reading is 200 `unknown`.
  router.get('/readyz/funds', (_req,res) => { const funds = payerFunds(); res.status(funds === 'low' ? 503 : 200).json({ funds }) })
  router.get(['/health','/api/health'], async (_req,res) => res.json({ status: (await status()).state, labels: context.labels, faults: false }))
  router.get('/api/demo/status', async (_req,res) => {
    const principal = res.locals.hostedSession.principal
    const own = ownHistory(principal).map(r => limits.forRun(r.runId)!).filter(h => queue.position(h.run_id!) !== null)
    const seconds = (value: number | undefined) => value === undefined ? {} : { estimateSeconds: value }
    const estimate = (position: number | null) => position === null ? {} : seconds(queue.estimateSeconds(position))
    res.json({ ...await status(principal), csrfToken: res.locals.hostedSession.csrf, queue: own.map(h => ({ runId: h.run_id!, position: queue.position(h.run_id!), expiresAt: new Date(h.created+LIMITS.queueMs).toISOString(), ...estimate(queue.position(h.run_id!)) })), wait: { ahead: queue.depth, own: own.length > 0, ...(queue.depth ? seconds(queue.estimateSeconds()) : {}) } })
  })
  let writerCache: { at: number; value: Promise<unknown> } | undefined
  router.get('/api/writers/status',async (_req,res) => {
    if (!writerCache || Date.now()-writerCache.at>5000) writerCache={at:Date.now(),value:context.client.registry().then(writers => ({publishers:writers.slice(0,50).map(p=>({name:p.name,address:p.wallet,credential:p.verification,followed:false}))}))}
    try {res.json(await writerCache.value)} catch {writerCache=undefined;res.status(503).json({error:'Writer status unavailable.'})}
  })
  router.get('/api/runs', (_req,res) => res.json(ownHistory(res.locals.hostedSession.principal)))
  router.post('/api/runs/:id/pin', (req,res) => { store.setRunMeta(String(req.params.id),{ pinned: z.object({pinned:z.boolean()}).strict().parse(req.body).pinned }); res.json(ownHistory(res.locals.hostedSession.principal)) })
  router.delete('/api/runs/:id', (req,res) => { const run = store.getRun(String(req.params.id)); if (!run.stopped && !['DONE','FAILED','STOPPED'].includes(run.phase)) return res.status(409).json({error:'Stop the run before deleting it.'}); store.setRunMeta(run.runId,{hidden:true,pinned:false}); res.json(ownHistory(res.locals.hostedSession.principal)) })
  router.post('/runs/:id/stop', (req,res) => { const id = String(req.params.id); queue.cancel(id); loop.stop(id); res.json(store.getRun(id)) })
  router.post('/api/scope', async (req,res) => {
    const old = limits.existing(res.locals.hostedSession.principal,keyOf(req.get('Idempotency-Key')),'scope',req.body)
    if(old?.scope_result) return res.json(JSON.parse(old.scope_result))
    if (!(await ready())) throw new HostedError(503,'demo_unavailable')
    const question = questionOf(req.body.question), key = keyOf(req.get('Idempotency-Key'))
    const hold = limits.reserve(res.locals.hostedSession.principal,key,question,res.locals.hostedIp,limits.questionMinor,'scope',req.body)
    if (hold.scope_result) return res.json(JSON.parse(hold.scope_result))
    if (hold.state !== 'draft') throw new HostedError(409,'scope_in_progress')
    requireAdmissions(config)
    // H7: planning does not wait for the one running question (it took 9 to 21 s, or answered 429 `busy`, whenever another
    // visitor's run held the demo). It is one model call that moves no money, inside this hold's model-dollar envelope; only
    // a question's start queues. A small separate lane bounds how many plans run at once.
    limits.update(hold.id,{state:'active'})
    try {
      const result = await planning.run(() => {
        requireAdmissions(config)
        if (context.work.signal.aborted) throw new HostedError(503,'demo_unavailable')
        return execute(hold,() => scopeWithPlanner(question,{ ...(req.body.clarify === 'never' ? {clarify:'never' as const}:{}),signal:context.work.signal }))
      })
      limits.update(hold.id,{scope_result:JSON.stringify(result)})
      res.json(result)
    } finally { limits.update(hold.id,{state:'draft'}) }
  })
  router.post('/runs', async (req,res) => {
    limits.existing(res.locals.hostedSession.principal,keyOf(req.get('Idempotency-Key')),'submit',req.body)
    const input = AskSchema.parse({...req.body,question:questionOf(req.body.question)})
    const key = keyOf(req.get('Idempotency-Key')), principal = res.locals.hostedSession.principal
    // Read durable identity before queue capacity, including reconnect after a lost response.
    const previous = limits.existing(principal,key,'submit',req.body)
    if (previous?.run_id) return res.status(200).json(store.getRun(previous.run_id))
    queue.capacity(); requireAdmissions(config)
    if (!(await ready())) throw new HostedError(503,'demo_unavailable')
    // Reserve after the async readiness probe, then bind and enqueue without another await.
    const hold = limits.reserve(principal,key,input.question,res.locals.hostedIp,input.budgetMinor,'submit',req.body)
    if (hold.run_id) return res.status(200).json(store.getRun(hold.run_id))
    const admitted = store.admit({surface:'web',principal,question:input.question,requestedMinor:input.budgetMinor,idempotencyKey:key,maxMinor:limits.questionMinor,labels:context.labels})
    const runId = admitted.run.runId
    limits.update(hold.id,{run_id:runId,state:admitted.reused?'interrupted':'queued'})
    if (admitted.reused) return res.status(200).json(store.getRun(runId))
    const expired = () => { loop.stop(runId); limits.update(hold.id,{state:'expired'}); limits.settle(hold.id); store.appendEvent(runId,{type:'SNAPSHOT',label:'The waiting time ended. No new work will start.'}) }
    // H9-04: the plan the visitor confirmed in the 5 s modal is the plan that runs. It is the scope result this server
    // stored on the same hold (never the client's body); a clarify answer re-plans, as the local route does.
    const confirmed = confirmedPlan(hold, input.question, input.answers)
    queue.enqueue(runId, () => execute(hold, async () => {
      limits.update(hold.id,{state:'active'})
      try { await context.launch(runId, async () => {
        const planned = confirmed ?? await planSearch(input.question,input.answers,loop.signal(runId))
        if (loop.signal(runId).aborted) return
        const frozen = freezeRequirements(input.question,planned,input.answers)
        const {label,requirements:_r,requirementsKey:_k,...plan} = planned
        const requirementsBy = frozen.source === 'plan' ? label : 'fixture · scope-fixture'
        const run = store.getRun(runId)
        store.updateRun(runId,{labels:{...run.labels,plan:label},checkpoint:{...run.checkpoint,plan,requirements:frozen.requirements,requirementsBy,...(input.answers?{answers:input.answers}:{})}})
        if (input.answers && Object.keys(input.answers).length) store.appendEvent(runId,{type:'CLARIFY',label:`Clarified: ${Object.values(input.answers).join(' · ')}`,data:{answers:input.answers}})
        store.appendEvent(runId,{type:'PLAN',label:`Search plan (${label}): ${plan.subqueries.join(' · ')}`,data:{plan,planner:label,requirements:frozen.requirements.map(r => r.text),requirementsBy,confirmed:Boolean(confirmed)}})
        await loop.start(runId)
      }) } finally { limits.update(hold.id,{state:'done'}); limits.settle(hold.id) }
    }),expired)
    const position = queue.position(runId), wait = position === null ? undefined : queue.estimateSeconds(position)
    store.appendEvent(runId,{type:'SNAPSHOT',label:`Your question is in the shared demo queue${wait ? ` (about ${wait} s until it starts)` : ''}.`,data:{position,...(wait ? { estimateSeconds: wait } : {})}})
    res.status(201).json(store.getRun(runId))
  })
  const retryJobs = new Map<string,Promise<void>>()
  router.post('/runs/:id/retry-delivery',(req,res) => {
    const runId = String(req.params.id), hold = limits.forRun(runId)!, key = keyOf(req.get('Idempotency-Key'))
    const intentId = z.string().min(1).parse(req.body.intentId), intent = store.getIntent(intentId)!
    if (!['SETTLED','DELIVERY_PENDING','DELIVERY_FAILED','VERIFIED'].includes(intent.status)) return res.status(409).json({error:'No settled delivery can be retried for this run.'})
    const identity = `retry:${runId}:${key}`
    // Durable retry digest; reuse the remaining per-question envelope, never a new purchase.
    const saved = store.hostedState(db => {db.exec('CREATE TABLE IF NOT EXISTS hosted_retries (id TEXT PRIMARY KEY, intent TEXT NOT NULL)');return db.prepare('SELECT intent FROM hosted_retries WHERE id=?').get(identity)})
    if(!saved) { queue.capacity(); limits.reserveRetry(hold.id) }
    const reused = store.hostedState(db => { db.exec('CREATE TABLE IF NOT EXISTS hosted_retries (id TEXT PRIMARY KEY, intent TEXT NOT NULL)'); const old = db.prepare('SELECT intent FROM hosted_retries WHERE id=?').get(identity); if(old && old.intent!==digest(req.body)) throw new HostedError(409,'idempotency_conflict'); if(!old) {requireAdmissions(config); queue.capacity(); db.prepare('INSERT INTO hosted_retries VALUES (?,?)').run(identity,digest(req.body))} return Boolean(old) })
    if(!reused && !retryJobs.has(identity)) { queue.capacity(); queue.enqueue(runId,()=>execute(hold,async()=>{try { await context.launch(runId,()=>loop.retryDelivery(runId,intentId)) } finally { limits.update(hold.id,{state:'done'});limits.settle(hold.id) }}),()=>{limits.update(hold.id,{state:'expired'});limits.settle(hold.id)}); retryJobs.set(identity,Promise.resolve()) }
    res.status(202).json(store.getRun(runId))
  })
  return router
}
