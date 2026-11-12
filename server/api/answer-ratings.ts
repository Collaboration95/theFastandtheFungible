import { createHash } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import type { Store } from '../store.js'
export function answerRatingsRouter(store: Store) {
  const router=Router(), reads=new Map<string,{at:number;n:number}>()
  router.use('/runs/:id/rating',(req,res,next)=>{
    const at=Date.now(), key=createHash('sha256').update(res.locals.hostedSession?.principal ?? req.socket.remoteAddress ?? '').digest('hex')
    for(const [k,v] of reads) if(at-v.at>=60000) reads.delete(k)
    const rate=reads.get(key)??{at,n:0}
    if(rate.n>=30 || (!reads.has(key)&&reads.size>=5000)){res.set('Retry-After','60').status(429).json({error:'Please retry shortly.'});return}
    rate.n++;reads.set(key,rate);next()
  })
  router.get('/runs/:id/rating',(req,res)=>{
    const id=String(req.params.id)
    if(!store.canRateAnswer(id)){res.status(404).json({error:'Paid answer not available.'});return}
    res.json({yes:store.answerRating(id)})
  })
  router.post('/runs/:id/rating',(req,res)=>{
    const parsed=z.object({yes:z.boolean()}).strict().safeParse(req.body)
    if(!parsed.success){res.status(400).json({error:'Choose Yes or No.'});return}
    const id=String(req.params.id)
    if(!store.canRateAnswer(id)){res.status(404).json({error:'Paid answer not available.'});return}
    const yes=store.rateAnswer(id,parsed.data.yes)
    res.status(yes===parsed.data.yes?200:409).json({yes})
  })
  return router
}
