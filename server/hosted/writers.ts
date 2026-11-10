import { Router } from 'express'
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
