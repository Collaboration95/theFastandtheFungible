import { publicWriterPath } from './writers.js'
import { timingSafeEqual } from 'node:crypto'
import { isIP, BlockList } from 'node:net'
import type { RequestHandler } from 'express'
import type { HostedLimits } from './limits.js'
import { hostedExecution } from './execution.js'
const cookieName = '__Host-ra_session'
/** Public, read-only proof-of-refusal pages (lane W1): a link preview or a stranger reads them with no session. */
export const publicProofPath = (path: string) => /^\/proof\/[a-f0-9]{32}(?:\/(?:receipts\.json|card\.html))?\/?$/.test(path)
export function sessionGuard(limits: HostedLimits): RequestHandler {
  const origin = new URL(limits.config.HOSTED_ORIGIN!)
  const trusted = new BlockList()
  const proxy = limits.config.HOSTED_TRUSTED_PROXY!
  trusted.addAddress(proxy, isIP(proxy) === 6 ? 'ipv6' : 'ipv4')
  return (req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Vary': 'Cookie, Origin', 'X-Content-Type-Options': 'nosniff' })
    for (const key of Object.keys(req.headers)) if (key === 'authorization' || key === 'forwarded' || key.includes('principal') || key.startsWith('x-agent') || key.startsWith('x-internal') || key === 'x-forwarded-host' || key === 'x-forwarded-proto') delete req.headers[key]
    if (req.headers.host !== origin.host || (req.get('Origin') && req.get('Origin') !== origin.origin)) { res.status(403).json({ error: 'origin_denied' }); return }
    const address = req.socket.remoteAddress?.replace(/^::ffff:/, '') || ''
    let ip = address
    const forwarded = req.get('X-Forwarded-For')
    if (forwarded) {
      // Exactly one trusted proxy, which must overwrite XFF with one validated client address.
      if (!isIP(address) || !trusted.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4') || !isIP(forwarded.trim()) || forwarded.includes(',')) { res.status(403).json({ error: 'proxy_denied' }); return }
      ip = forwarded.trim()
    }
    res.locals.hostedIp = ip
    if (['/livez','/startupz','/readyz','/readyz/funds'].includes(req.path)) { next(); return }
    // A shared proof is public by the sharer's choice: reading it mints no session and sets no cookie.
    if (['GET','HEAD'].includes(req.method) && publicProofPath(req.path)) { next(); return }
    const cookies = (req.get('Cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(cookieName + '='))
    const session = limits.session(cookies.length === 1 ? cookies[0].slice(cookieName.length + 1) : undefined, ip)
    if (session.token) res.cookie(cookieName, session.token, { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400000 })
    res.locals.hostedSession = session
    if (!['GET','HEAD'].includes(req.method)) {
      const csrf = req.get('X-CSRF-Token') || ''
      if (session.token || req.get('Origin') !== origin.origin || (req.get('Sec-Fetch-Site') && req.get('Sec-Fetch-Site') !== 'same-origin') || csrf.length !== session.csrf.length || !timingSafeEqual(Buffer.from(csrf),Buffer.from(session.csrf))) { res.status(403).json({ error: 'csrf_denied' }); return }
    }
    hostedExecution.run({ limits, holdId: '', principal: session.principal }, next)
  }
}
export function accessGuard(limits: HostedLimits): RequestHandler {
  const reads = new Map<string, { at: number; n: number }>()
  return (req,res,next) => {
    // Deny by default, including alternate case, encoded slashes and trailing-path aliases.
    const path = req.path
    const publicReads = ['/api/demo/status','/api/health','/health','/api/runs','/api/reputation','/api/writers/status','/api/writers/earnings','/livez','/startupz','/readyz','/readyz/funds']
    if (['GET','HEAD'].includes(req.method) && (publicWriterPath(path) || path === '/api/writers/earnings' || publicProofPath(path))) {
      if (Object.keys(req.query).length) return res.status(404).json({ error: 'Not found.' })
      const now = Date.now(), key = limits.ipKey(res.locals.hostedIp)
      for (const [k, value] of reads) if (now - value.at >= 60000) reads.delete(k)
      const value = reads.get(key) ?? { at: now, n: 0 }
      if (value.n >= 120 || (!reads.has(key) && reads.size >= 5000)) return res.status(429).json({ error: 'read_rate' })
      value.n++; reads.set(key, value); next(); return
    }
    const run = path.match(/^\/(?:api\/)?runs\/([a-zA-Z0-9-]+)(?:\/(?:events|stop|retry-delivery|rating|receipts\.json|report\.json|report\.(?:pdf|html)|report|pin|proof|intents\/([a-zA-Z0-9-]+)\/key-reveal-proof\.json))?$/)
    const deny = () => res.status(404).json({ error: 'Not found.' })
    if (run) {
      const id = run[1], principal = res.locals.hostedSession?.principal
      const hold = limits.forRun(id)
      const hidden = limits.store.hostedState(db => db.prepare('SELECT hidden FROM run_meta WHERE run_id=?').get(id)?.hidden)
      if (!hold || hold.principal !== principal || hidden || hold.created + 86400000 <= limits.now() || limits.store.runPrincipal(id)?.principal !== principal) { deny(); return }
      const intentId = run[2] || (path.endsWith('/retry-delivery') ? req.body?.intentId : undefined)
      if (intentId && limits.store.getIntent(String(intentId))?.runId !== id) { deny(); return }
      if (/\/(?:report|report\.pdf|report\.html)$/.test(path)) { deny(); return }
      next(); return
    }
    if ((['GET','HEAD'].includes(req.method) && publicReads.includes(path) && !Object.keys(req.query).length) || (req.method === 'POST' && ['/runs','/api/scope'].includes(path))) { next(); return }
    deny()
  }
}
