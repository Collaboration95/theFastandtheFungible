import type { Store } from './store.js'
import { timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'
import type { Config } from './config.js'

export const loopback = (host: string) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host.toLowerCase())
export function validateBind(config: Config) {
  if (!loopback(config.HOST ?? '127.0.0.1') && !config.RA_API_TOKEN) {
    throw new Error('RA_API_TOKEN is required for a non-loopback HOST')
  }
}
export function admissionGuard(config: Config, store?: Store): RequestHandler {
  validateBind(config)
  const allowed = new Set(['localhost', '127.0.0.1', '[::1]',
    ...(config.RA_ALLOWED_HOSTS ?? '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)])
  const expected = config.RA_API_TOKEN
  const webOrigin = config.RA_WEB_ORIGIN || `http://127.0.0.1:${5100 + Number(config.DEMO_PORT_OFFSET || 0)}`
  return (req, res, next) => {
    // Ignore forwarded headers: this is the actual HTTP authority, not a proxy assertion.
    let host = ''
    try {
      const authority = req.headers.host ?? ''
      if (!/^(?:\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(?::\d+)?$/.test(authority)) throw new Error()
      host = new URL(`http://${authority}`).hostname.toLowerCase()
    } catch { /* invalid authority is denied below */ }
    if (!allowed.has(host)) { res.status(403).json({ error: 'Host is not allowed.' }); return }
    const origin = req.get('Origin')
    if (origin && origin !== webOrigin) { res.status(403).json({ error: 'Origin is not allowed.' }); return }
    const path = req.path.toLowerCase().replace(/\/+$/, '')
    const hasAgents = Boolean(store?.agentKeys.list().length)
    const privateAgentData = hasAgents && (path.startsWith('/runs/') || path.startsWith('/api/runs') || path === '/api/wallet/status')
    const protectedRoute = !['GET', 'HEAD', 'OPTIONS'].includes(req.method) || path.startsWith('/api/mcp/')
      || path.startsWith('/api/audit/') || privateAgentData || path === '/api/metrics' || (path === '/api/health' && req.query.deep === '1')
    const tokenOnly = path === '/api/wallet/pause'
    const supplied = req.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1]
    const valid = Boolean(expected && supplied && Buffer.byteLength(expected) === Buffer.byteLength(supplied)
      && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)))
    const agent = !valid && supplied ? store?.agentKeys.authenticate(supplied) : undefined
    if (agent) {
      if (agent.paused) { res.status(403).json({ error: 'Agent spending is paused.' }); return }
      res.locals.agent = agent
      // An agent can only use research endpoints and its own runs. No operator controls or wallet-wide export.
      const run = path.match(/^\/(?:api\/mcp\/)?runs\/([^/]+)(?:\/(?:events|stop|retry-delivery|receipts\.json))?$/)
      if (run) {
        let id: string
        try { id = decodeURIComponent(run[1]) } catch { res.sendStatus(400); return }
        if (store?.runPrincipal(id)?.principal !== agent.id) { res.status(404).json({ error: 'Run not found.' }); return }
      } else if (!['/runs', '/api/mcp/runs', '/api/mcp/status', '/api/mcp/search', '/api/scope', '/v1/ask'].includes(path)) {
        res.status(403).json({ error: 'Operator token required.' }); return
      }
      next(); return
    }
    // A supplied bad/revoked credential never falls back to anonymous loopback authority.
    if (supplied && !valid) { res.status(401).json({ error: 'Invalid bearer token.' }); return }
    if (!protectedRoute) { next(); return }
    if (!valid && (expected || hasAgents || tokenOnly || !loopback(host) || !loopback(req.socket.remoteAddress?.replace(/^::ffff:/, '') ?? ''))) {
      res.status(401).json({ error: 'A valid RA_API_TOKEN bearer token is required.' }); return
    }
    next()
  }
}
