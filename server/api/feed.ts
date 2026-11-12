import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { Router, type Response } from 'express'
import type { Store } from '../store.js'
import { PublicFeedExportSchema, PublicPurchaseSchema, type PublicFeed, type PublicPurchase } from '../../shared/public-feed.js'
import { openSse, writeSse, endSse, sseBufferedBytes } from './sse.js'

const hash = (s: unknown) => typeof s === 'string' && /^[a-f0-9]{64}$/i.test(s) ? s : null
const ledger = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null
// Question scope is deliberately a fixed public title, never LLM-generated wording or question text.
const topic = (facets: unknown) => Array.isArray(facets) && facets.some(f => /xrpl|x402|escrow|rlusd/i.test(String(f))) ? 'Agent payments' : 'Research purchase'

/** Bounded, whitelisted SQL projection: never selects question, content, secrets, reveal keys or IPs. */
export function feedSnapshot(store: Store, limit = 50, now = Date.now()): PublicFeed {
  return store.hostedState(db => {
    const rows = db.prepare(`SELECT i.id, i.run_id,
      json_extract(i.json,'$.resourceId') AS resource, json_extract(i.json,'$.profileId') AS profile,
      json_extract(i.json,'$.amountMinor') AS price, json_extract(i.json,'$.escrow') AS escrow,
      json_extract(r.json,'$.candidates') AS candidates,
      (SELECT json_object('at',at,'hash',json_extract(data,'$.txHash'),'ledger',json_extract(data,'$.ledgerIndex')) FROM audit_log WHERE intent_id=i.id AND kind='ESCROW_CREATE' ORDER BY seq DESC LIMIT 1) AS created,
      (SELECT at FROM audit_log WHERE intent_id=i.id AND kind IN ('ESCROW_FINISH','ESCROW_CANCEL') ORDER BY seq DESC LIMIT 1) AS ended
      FROM intents i JOIN runs r ON r.id=i.run_id
      WHERE json_extract(i.json,'$.escrow.createHash') IS NOT NULL
      ORDER BY i.rowid DESC LIMIT ?`).all(Math.max(1,Math.min(100,Math.floor(limit))))
    const purchases: PublicPurchase[] = []
    for (const row of rows) {
      const escrow = JSON.parse(String(row.escrow)), created = row.created ? JSON.parse(String(row.created)) : undefined
      if (!created || !hash(created.hash) || !Number.isFinite(Date.parse(created.at))) continue // signed is not validated
      const candidates = JSON.parse(String(row.candidates ?? '[]')) as { resourceId: string; profileId: string; title: string; publisher: string; facets?: string[] }[]
      const candidate = candidates.find(c => c.resourceId === row.resource && c.profileId === row.profile)
      const seconds = row.ended ? (Date.parse(String(row.ended)) - Date.parse(created.at))/1000 : null
      const keyCheck = escrow.mode !== 'key-reveal' ? 'unavailable' : escrow.keyVerified === false ? 'mismatch' : escrow.keyVerified === true ? 'match' : 'pending'
      const item = PublicPurchaseSchema.safeParse({ id: createHash('sha256').update(String(row.id)).digest('hex').slice(0,24), time: created.at,
        topic: topic(candidate?.facets), resourceTitle: candidate?.title?.slice(0,240) || 'Published article', writer: candidate?.publisher?.slice(0,120) || 'Writer', priceMinor: Number(row.price),
        createHash: hash(created.hash), createLedger: ledger(created.ledger), finishHash: escrow.state === 'RELEASED' ? hash(escrow.finishHash) : null,
        keyCheck, gate: keyCheck === 'mismatch' || escrow.proofOk === false || escrow.decryptVerified === false ? 'failed' : escrow.state === 'RELEASED' && escrow.proofOk === true && escrow.decryptVerified === true && keyCheck === 'match' ? 'verified' : escrow.mode !== 'key-reveal' ? 'unavailable' : 'pending',
        state: escrow.state === 'RELEASED' ? 'finished' : escrow.state === 'CANCELLED' ? 'cancelled' : 'locked', settlementSeconds: seconds !== null && Number.isFinite(seconds) && seconds >= 0 ? seconds : null })
      if (item.success) purchases.push(item.data)
    }
    return { rows: purchases, updatedAt: new Date(now).toISOString() }
  })
}

/** One shared two-second snapshot for every viewer; no ledger calls, per-client polling or unbounded buffers. */
export function publicFeedRouter(store: Store, now = Date.now, recordedPath = 'data/evidence/testnet-1000/feed.json') {
  const router = Router({ strict: true, caseSensitive: true }), clients = new Set<Response>()
  const reads = new Map<string,{ at: number; n: number }>()
  let cache: { expires: number; body: PublicFeed } | undefined, timer: ReturnType<typeof setInterval> | undefined, previous = ''
  const snapshot = () => { const at = now(); if (!cache || at >= cache.expires) cache = { expires: at+2000, body: feedSnapshot(store,100,at) }; return cache.body }
  router.get('/api/feed/recorded', (_req,res) => {
    if (!existsSync(recordedPath)) { res.status(404).json({ error: 'Recorded purchases are not available yet.' }); return }
    try { res.set('Cache-Control','public, max-age=60').json(PublicFeedExportSchema.parse(JSON.parse(readFileSync(recordedPath,'utf8')))) }
    catch { res.status(503).json({ error: 'Recorded purchases are unavailable.' }) }
  })
  router.get('/api/feed', (req,res) => {
    if (Object.keys(req.query).some(k => k !== 'limit') || (req.query.limit !== undefined && (typeof req.query.limit !== 'string' || !/^(?:[1-9]|[1-9]\d|100)$/.test(req.query.limit)))) { res.status(400).json({ error: 'Use limit=1…100.' }); return }
    res.vary('Accept')
    const stream = req.accepts(['application/json','text/event-stream']) === 'text/event-stream'
    if (stream && req.method === 'HEAD') { res.status(405).end(); return }
    const at = now(), key = createHash('sha256').update(req.socket.remoteAddress ?? '').digest('hex')
    for (const [k,v] of reads) if (at-v.at >= 60000) reads.delete(k)
    const rate = reads.get(key) ?? { at, n: 0 }
    if (rate.n >= 60 || (!reads.has(key) && reads.size >= 5000) || (stream && clients.size >= 100)) { res.set('Retry-After','60').status(429).json({ error: 'Please retry shortly.' }); return }
    rate.n++; reads.set(key,rate)
    let body: PublicFeed
    try { body = snapshot() } catch { res.status(503).json({ error: 'Purchases are unavailable.' }); return }
    const limit = Number(req.query.limit ?? 50)
    if (!stream) { res.set('Cache-Control','public, max-age=2').json({ ...body, rows: body.rows.slice(0,limit) }); return }
    res.set({ 'Cache-Control':'no-store', 'X-Accel-Buffering':'no' }); openSse(req,res,false)
    writeSse(res,`retry: 15000\nevent: snapshot\ndata: ${JSON.stringify(body)}\n\n`); clients.add(res)
    const expiry = setTimeout(() => endSse(res), 10*60000); expiry.unref()
    res.on('close',() => { clearTimeout(expiry); clients.delete(res); if (!clients.size) { clearInterval(timer); timer = undefined } })
    if (!timer) timer = setInterval(() => {
      try {
        const fresh = snapshot(), version = JSON.stringify(fresh.rows)
        const frame = version === previous ? ': keepalive\n\n' : `event: snapshot\ndata: ${JSON.stringify(fresh)}\n\n`
        previous = version
        for (const client of clients) { if (sseBufferedBytes(client)+Buffer.byteLength(frame) > 256*1024) endSse(client); else writeSse(client,frame) }
      } catch { for (const client of clients) endSse(client) }
    },2000)
  })
  router.all(['/api/feed','/api/feed/recorded'], (_req,res) => res.set('Allow','GET, HEAD').status(405).json({ error: 'Method not allowed.' }))
  return { router, close: () => { clearInterval(timer); for (const client of clients) endSse(client); clients.clear() } }
}
