import { Router } from 'express'
import { z } from 'zod'
import type { ApiContext } from '../api/context.js'
import { AskSchema } from '../../shared/contracts/index.js'
import { isLlmConfigured } from '../agents/llm.js'
import { scope, plan as planSearch, freezeRequirements } from '../agents/scope.js'
import { HostedLimits, LIMITS, digest, type Hold } from './limits.js'
import { HostedQueue } from './queue.js'
import { hostedExecution } from './execution.js'
import { HostedError, hostedControl, requireAdmissions } from './control.js'
import type { Config } from '../config.js'
export type DemoStatus = {
  state: 'ready' | 'paused' | 'busy' | 'degraded' | 'ended';
  capabilities: { ask: boolean; scope: boolean; history: boolean; receipts: boolean; pdf: false; settings: false; faultControls: false };
  questionCapMinor: number;
  remaining: { questions: number; minor: number }; labels: { models: string; rail: string };
  links: { repo: string; deck: string; video: string; progress: string; replay: string };
  csrfToken?: string; queue?: { runId: string; position: number | null; expiresAt: string }[]
}
const keyOf = (value: unknown) => z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).parse(value)
const questionOf = (value: unknown) => {
  const question = z.string().trim().min(1).max(LIMITS.questionChars).parse(value)
  if (/-----BEGIN .*PRIVATE KEY|\b(?:sk-|ra_agent_)[A-Za-z0-9_-]{16,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(question)) throw new HostedError(400, 'private_input')
  return question
}
export function hostedRouter(context: ApiContext, config: Config, limits: HostedLimits, queue: HostedQueue, ready: () => Promise<boolean>, initialized: () => Promise<boolean>) {
  const router = Router(), { store, loop } = context
  const execute = <T>(hold: Hold, fn: () => T) => hostedExecution.run({ limits, holdId: hold.id, principal: hold.principal },fn)
  const ownHistory = (principal: string) => store.listPastRuns(Number.NaN,principal).filter(r => { const h = limits.forRun(r.runId); return h && h.created + 86400000 > limits.now() })
  const status = async (principal = ''): Promise<DemoStatus> => {
    const c = hostedControl(config), ended = Date.now() >= Date.parse(config.HOSTED_ADMISSIONS_UNTIL || '2026-11-19T16:00:00Z')
    const remaining = limits.remaining(principal)
    const state = ended ? 'ended' : c.admissionsPaused || c.spendingPaused ? 'paused' : !(await ready()) || !remaining.questions || !remaining.minor ? 'degraded' : queue.busy ? 'busy' : 'ready'
    return { state, questionCapMinor: limits.questionMinor, capabilities: { ask: (state === 'ready' || state === 'busy') && queue.canQueue, scope: state === 'ready', history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining,
      labels: { models: isLlmConfigured() ? 'live research configured · per-answer fallback labelled' : 'fixture models', rail: context.payer ? 'Shared XRPL Testnet demo · no real value' : 'SIMULATED · no real value' },
      links: { repo: 'https://github.com/Collaboration95/theFastandtheFungible', deck: config.HOSTED_DECK_URL || '', video: config.HOSTED_VIDEO_URL || '', progress: config.HOSTED_PROGRESS_URL || '', replay: config.HOSTED_REPLAY_URL || 'https://collaboration95.github.io/theFastandtheFungible/demo/' } }
  }
  router.get('/livez', (_req,res) => res.json({ status: 'ok' }))
  router.get('/startupz', async (_req,res) => { const ok=await initialized(); res.status(ok?200:503).json({status:ok?'ok':'paused'}) })
  router.get('/readyz', async (_req,res) => { const s = await status(); res.status(['ready','busy'].includes(s.state) && queue.canQueue ? 200 : 503).json({ status: s.state }) })
  router.get(['/health','/api/health'], async (_req,res) => res.json({ status: (await status()).state, labels: context.labels, faults: false }))
  router.get('/api/demo/status', async (_req,res) => {
    const principal = res.locals.hostedSession.principal
    const own = ownHistory(principal).map(r => limits.forRun(r.runId)!).filter(h => queue.position(h.run_id!) !== null)
    res.json({ ...await status(principal), csrfToken: res.locals.hostedSession.csrf, queue: own.map(h => ({ runId: h.run_id!, position: queue.position(h.run_id!), expiresAt: new Date(h.created+LIMITS.queueMs).toISOString() })) })
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
    if (queue.busy) throw new HostedError(429,'busy')
    if (!(await ready())) throw new HostedError(503,'demo_unavailable')
    const question = questionOf(req.body.question), key = keyOf(req.get('Idempotency-Key'))
    const hold = limits.reserve(res.locals.hostedSession.principal,key,question,res.locals.hostedIp,limits.questionMinor,'scope',req.body)
    if (hold.scope_result) return res.json(JSON.parse(hold.scope_result))
    if (hold.state !== 'draft') throw new HostedError(409,'scope_in_progress')
    requireAdmissions(config)
    limits.update(hold.id,{state:'active'})
    await new Promise<void>((resolve,reject) => {
      queue.enqueue(hold.id,async () => {
        let release: (()=>void) | undefined
        try { release=context.work.acquire(); const result = await execute(hold,() => scope(question,{ ...(req.body.clarify === 'never' ? {clarify:'never' as const}:{}),signal:context.work.signal })); limits.update(hold.id,{scope_result:JSON.stringify(result),state:'draft'}); res.json(result); resolve() }
        catch(error) { reject(error) } finally { release?.(); limits.update(hold.id,{state:'draft'}) }
      },()=>reject(new HostedError(503,'queue_expired')))
    })
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
    queue.enqueue(runId, () => execute(hold, async () => {
      limits.update(hold.id,{state:'active'})
      try { await context.launch(runId, async () => {
        const planned = await planSearch(input.question,input.answers,loop.signal(runId))
        if (loop.signal(runId).aborted) return
        const frozen = freezeRequirements(input.question,planned,input.answers)
        const {label,requirements:_r,requirementsKey:_k,...plan} = planned
        const run = store.getRun(runId)
        store.updateRun(runId,{labels:{...run.labels,plan:label},checkpoint:{...run.checkpoint,plan,requirements:frozen.requirements,requirementsBy:label,...(input.answers?{answers:input.answers}:{})}})
        await loop.start(runId)
      }) } finally { limits.update(hold.id,{state:'done'}); limits.settle(hold.id) }
    }),expired)
    store.appendEvent(runId,{type:'SNAPSHOT',label:'Your question is in the shared demo queue.',data:{position:queue.position(runId)}})
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
