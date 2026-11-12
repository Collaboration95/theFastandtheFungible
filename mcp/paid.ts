import { Router, type RequestHandler } from 'express'
import { AsyncLocalStorage } from 'node:async_hooks'
import { z } from 'zod'
import type { Config } from '../server/config.js'
import type { HostedLimits, Hold } from '../server/hosted/limits.js'
import { hostedExecution } from '../server/hosted/execution.js'
import { HostedError, requireAdmissions } from '../server/hosted/control.js'
import { publicAddress, publicIdentity } from './public.js'
const admission = new AsyncLocalStorage<{limits:HostedLimits;hold:Hold}>()
/** Public request ownership is independent of the verified payer receiving change. */
export function publicHirePrincipal() { return admission.getStore()?.hold.principal }
/** Called by hire only after its ordinary policy admission and before accepting the caller's money. */
export function bindPublicHire(runId:string) {
  const current=admission.getStore()
  if(current)current.limits.update(current.hold.id,{run_id:runId,state:'active'})
}
export function finishPublicHire(limits?:HostedLimits,runId?:string) {
  const current=admission.getStore() ?? (limits && runId ? {limits,hold:limits.forRun(runId)} : undefined)
  if(!current?.hold)return
  const {limits:scoped,hold}=current
  const row=scoped.store.hostedState(db=>db.prepare('SELECT run_id FROM hosted_holds WHERE id=?').get(hold.id))
  if(row?.run_id && ['DONE','FAILED','STOPPED'].includes(scoped.store.getRun(String(row.run_id)).phase)) {
    scoped.update(hold.id,{state:'done'});scoped.settle(hold.id)
  }
}
export function publicPaidRouter(config:Config,limits:HostedLimits,hire:RequestHandler,ready:()=>Promise<boolean>) {
  const router=Router(), reads=new Map<string,{at:number;n:number}>()
  router.post('/v1/ask',async(req,res,next)=>{
    if(config.PAID_ENDPOINT_PUBLIC!=='on')return res.status(404).end()
    try{
      const ip=publicAddress(req,config),now=Date.now(),ipKey=limits.ipKey(ip)
      for(const [k,v] of reads)if(now-v.at>=60000)reads.delete(k)
      const rate=reads.get(ipKey)??{at:now,n:0}
      if(rate.n>=120||(!reads.has(ipKey)&&reads.size>=5000))throw new HostedError(429,'paid_rate')
      rate.n++;reads.set(ipKey,rate)
      const session=publicIdentity(limits,ip)
      if(config.SETTLEMENT_RAIL!=='xrpl-testnet')throw new HostedError(503,'testnet_required')
      const input=z.object({question:z.string().trim().min(1).max(2000),budgetMinor:z.union([z.literal(100),z.literal(200)])}).strict().parse(req.body)
      if (/-----BEGIN .*PRIVATE KEY|\b(?:sk-|ra_agent_)[A-Za-z0-9_-]{16,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(input.question)) throw new HostedError(400,'private_input')
      const key=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).parse(req.get('Idempotency-Key'))
      if(input.budgetMinor>limits.questionMinor)throw new HostedError(400,'invalid_budget')
      requireAdmissions(config)
      if(!(await ready()))throw new HostedError(503,'demo_unavailable')
      const hold=limits.reserve(session.principal,`paid-${key}`,input.question,ip,input.budgetMinor,'submit',input)
      if (!hold.run_id && ['expired','interrupted'].includes(hold.state)) throw new HostedError(409,'quote_expired')
      // Namespace the existing durable hire invoice by the server-owned anonymous identity.
      req.headers['idempotency-key']=`reach:${session.principal}:${key}`
      admission.run({limits,hold},()=>hostedExecution.run({limits,holdId:hold.id,principal:session.principal},()=>hire(req,res,next)))
    }catch(error){next(error)}
  })
  return router
}
