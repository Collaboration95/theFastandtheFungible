import { AsyncLocalStorage } from 'node:async_hooks'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router, type RequestHandler } from 'express'
import type { Config } from '../config.js'
export const runAudience = new AsyncLocalStorage<'internal'|'external'|'unclassified'>()
const equal = (a: string,b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b))
const cookie = '__Host-ra_operator'
/** Authenticates before the hosted guard strips Authorization. The token is never stored or returned. */
export function audienceMiddleware(config: Config): RequestHandler {
  return (req,res,next) => {
    if (config.HOSTED === '1' && config.AUDIENCE_COUNTS !== '1') { runAudience.run('unclassified',next); return }
    const secret=config.OPERATOR_TOKEN, at=Date.now(), supplied=req.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1]
    let operator=Boolean(secret && supplied && equal(secret,supplied))
    const parts=(req.get('Cookie')??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookie+'='))
    if(secret && parts.length===1) {
      const value=parts[0].slice(cookie.length+1), [expiry,signature]=value.split('.')
      if (/^\d{13}$/.test(expiry) && Number(expiry)>at && Number(expiry)<=at+86400000 && signature) operator ||= equal(createHmac('sha256',secret).update(expiry).digest('hex'),signature)
    }
    res.locals.runAudience=operator || config.HOSTED !== '1' || !req.get('Origin') ? 'internal' : 'external'
    runAudience.run(res.locals.runAudience,next)
  }
}
export function operatorSessionRouter(config: Config) {
  const router=Router({caseSensitive:true,strict:true})
  router.post('/api/operator/session',(req,res)=>{
    const secret=config.OPERATOR_TOKEN, supplied=req.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1]
    if(!secret || !supplied || !equal(secret,supplied)) {res.status(401).json({error:'Operator credential required.'});return}
    if(req.get('Origin') && req.get('Origin')!==config.HOSTED_ORIGIN && req.get('Origin')!==config.RA_WEB_ORIGIN) {res.status(403).json({error:'Origin denied.'});return}
    const expiry=String(Date.now()+86400000), signature=createHmac('sha256',secret).update(expiry).digest('hex')
    res.cookie(cookie,`${expiry}.${signature}`,{secure:true,httpOnly:true,sameSite:'strict',path:'/',maxAge:86400000}).set('Cache-Control','no-store').json({internal:true})
  })
  return router
}
