import { Router } from 'express'
import type { Store } from '../store.js'
import { sandboxPopulation, settledReceipts } from './population.js'
import type { PurchaseIntent } from '../../shared/contracts/index.js'
/** A sale confirmed on the ledger: the writer's EscrowFinish revealed the key in a validated ledger (key reveal only). */
export const confirmedSale = (intent: PurchaseIntent) => Boolean(intent.escrow?.finishHash && intent.escrow.revealLedger && /^[A-F0-9]{64}$/i.test(intent.escrow.finishHash))
/**
 * H9-15: confirmed sales per article across every visitor of the hosted demo, so a new visitor's Writers tab shows that
 * writers do get paid instead of a row of zeros. Counts only, keyed by public article id: never who bought, which run,
 * a transaction hash or an amount.
 */
export function demoSalesByArticle(intents: PurchaseIntent[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const intent of intents) if (confirmedSale(intent)) counts.set(`${intent.profileId}/${intent.resourceId}`, (counts.get(`${intent.profileId}/${intent.resourceId}`) ?? 0) + 1)
  return counts
}
/** Same date, admission, rail and settled-receipt population as /api/demo/stats; counts only. */
export function sandboxSalesByArticle(store: Store): Map<string, number> {
  return store.hostedState(db => {
    const runs = new Map(sandboxPopulation(db).map(r => [String(r.id), { intents: [] as PurchaseIntent[], receipts: [] as { intentId: string }[] }]))
    for (const row of db.prepare('SELECT run_id,json FROM intents').iterate()) runs.get(String(row.run_id))?.intents.push(JSON.parse(String(row.json)))
    for (const row of db.prepare("SELECT json_extract(json,'$.runId') AS run_id,json FROM receipts").iterate()) runs.get(String(row.run_id))?.receipts.push(JSON.parse(String(row.json)))
    const counts = new Map<string, number>()
    for (const { intents, receipts } of runs.values()) {
      const byId = new Map(intents.map(i => [i.intentId, i]))
      for (const receipt of settledReceipts(receipts, intents)) {
        const intent = byId.get(receipt.intentId)!
        const key = `${intent.profileId}/${intent.resourceId}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return counts
  })
}
/** Exact read-only site allowlist. Agent purchase/search/facilitator routes never pass this boundary. */
export const publicWriterPath = (path: string) => /^\/w\/?$/.test(path) || path === '/w/site.css' || /^\/w\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/(?:about|contact|\.well-known\/agent-publisher\.json|blog\/[A-Za-z0-9._-]+))?\/?$/.test(path)
export function hostedWriterPages(publisherUrl: string) {
  const router = Router()
  router.get(/^\/w(?:\/|$)/, async (req, res) => {
    if (!publicWriterPath(req.path) || Object.keys(req.query).length) return res.status(404).end()
    try {
      const upstream = await fetch(new URL(req.path, publisherUrl), { signal: AbortSignal.timeout(5000), redirect: 'error' })
      if (!upstream.ok) return res.status(404).end()
      const reader = upstream.body?.getReader(), chunks: Uint8Array[] = []; let size = 0
      if (reader) try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 512 * 1024) throw new Error('Public page too large'); chunks.push(part.value) } } finally { await reader.cancel() }
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'")
      res.type(req.path.endsWith('.json') ? 'json' : req.path.endsWith('.css') ? 'css' : 'html').send(Buffer.concat(chunks))
    } catch { res.status(503).json({ error: 'Writer page unavailable.' }) }
  })
  return router
}
