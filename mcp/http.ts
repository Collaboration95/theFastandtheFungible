import { createServer } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from './tools.js'
import type { Store } from '../server/store.js'

/** Stateless transports: every request authenticates against the durable principal registry. */
export async function startMcpHttp({ apiUrl, store, port = 0 }: { apiUrl: string; store: Store; port?: number }) {
  const active = new Set<ReturnType<typeof createMcpServer>>()
  const http = createServer(async (req, res) => {
    const deny = (status: number) => { res.writeHead(status, { 'Cache-Control': 'no-store' }); res.end() }
    if (req.headers.host !== `127.0.0.1:${req.socket.localPort}` || req.headers.origin) return deny(403)
    if (req.url !== '/mcp') return deny(404)
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')
    const agent = match && store.agentKeys.authenticate(match[1])
    if (!agent || agent.paused) return deny(401)
    if (req.method !== 'POST') return deny(405)
    store.recordMcpCall(agent.id)
    const server = createMcpServer(apiUrl, match![1], { allowRemoteHire: false })
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    active.add(server)
    res.once('close', () => { active.delete(server); void server.close() })
    try { await server.connect(transport); await transport.handleRequest(req, res) }
    catch { if (!res.headersSent) deny(500); else res.end() }
  })
  http.requestTimeout = 60_000
  http.headersTimeout = 10_000
  await new Promise<void>((done, fail) => { http.once('error', fail); http.listen(port, '127.0.0.1', done) })
  return { url: `http://127.0.0.1:${(http.address() as { port: number }).port}/mcp`, close: async () => {
    // Engine crashes can leave an active POST without a backend response.
    // Break those sockets before waiting for the listener to close.
    http.closeAllConnections()
    await Promise.all([...active].map(s => s.close()))
    await new Promise<void>((done, fail) => http.close(error => error ? fail(error) : done()))
  } }
}
