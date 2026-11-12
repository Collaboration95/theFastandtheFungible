import { Router, json } from 'express'
import { boundedBody } from '../../server/body-limit.js'
import { confirmedSale } from '../../server/hosted/writers.js'
import type { Store } from '../../server/store.js'
/** Mount after session/CSRF validation and before the hosted read allowlist. No arbitrary proxy paths. */
export function publishingGateway(env: NodeJS.ProcessEnv, store: Store) {
  const router = Router()
  if (env.WEB_PUBLISHING !== 'on') { router.get('/api/publishing/config', (_req,res) => res.json({enabled:false})); return router }
  router.all(/^\/api\/publishing\/(?:config|notes(?:\/[a-f0-9]{32})?|operator\/(?:queue|[a-f0-9]{32}\/(?:approve|reject)))$/, json({ limit:'32kb' }), async (req,res) => {
    if (!['GET','POST'].includes(req.method) || Object.keys(req.query).length) return res.sendStatus(404)
    try {
      const headers: Record<string,string> = { 'Content-Type':'application/json' }
      for (const name of ['X-Publishing-Key','X-Operator-Token']) { const value = req.get(name); if (value) headers[name]=value }
      const upstream = await fetch(new URL(req.path, env.PUBLISHER_URL ?? 'http://127.0.0.1:8790'), { method:req.method, headers, ...(req.method === 'POST' ? {body:JSON.stringify(req.body)} : {}), redirect:'error', signal:AbortSignal.timeout(60000) })
      const data = JSON.parse((await boundedBody(upstream,req.path === '/api/publishing/operator/queue' ? 4*1024*1024 : 128*1024)).toString('utf8'))
      if (upstream.ok && req.method === 'GET' && /^\/api\/publishing\/notes\//.test(req.path)) {
        const sales = store.listIntents().filter(i => i.profileId === data.slug && i.resourceId === data.articleId && (confirmedSale(i) || !!i.receiptId && !!i.settledAt) && i.quote?.payment?.rail === 'xrpl-testnet' && i.quote.payment.payTo === data.address)
        data.bought = sales.length; data.earnedMinor = sales.reduce((n,i) => n + Math.max(0, i.amountMinor - (i.refund?.amountMinor ?? 0)),0)
        data.ledger = sales.slice(-100).flatMap(i => [i.escrow?.finishHash ?? i.txHash, i.refund?.txHash].filter(Boolean))
      }
      res.status(upstream.status).json(data)
    } catch { res.status(503).json({ error:'Publishing is temporarily unavailable. Keep your status link and retry shortly.' }) }
  })
  return router
}
