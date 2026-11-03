import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { createPublisherApp } from '../publisher/routes.js'
import { createApiApp } from '../server/routes.js'
import { vi } from 'vitest'
export const listen = async (server: Server) => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${(server.address() as { port: number }).port}` }
export const close = async (server: Server) => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
export async function fixture(stall = false) {
  let calls = 0, aborted = 0
  const fake = createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c
    const input = JSON.parse(body); calls++
    res.on('close', () => { aborted++ })
    if (stall) return
    const data = JSON.parse(input.messages[1].content)
    let result: unknown = { ok: true }
    if (data.question && data.answers) result = { subqueries: [data.question], requirements: ['Grid energisation dates'], requirementsKey: data.question }
    if (data.question && data.evidence) {
      const c = data.evidence.find((c: { spans: unknown[] }) => c.spans.length)
      result = { conclusion: c.spans[0].text, claims: [{ id: 'c1', text: c.spans[0].text, stance: 'SUPPORTS', citations: [{ resourceId: c.resourceId, version: c.version, spanId: c.spans[0].id }] }], openGaps: [] }
    }
    if (data.candidate) result = { addressesGap: 1, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 2 }
    else if (data.gap) result = { gapMaterial: 1 }
    if (input.stream) { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(result) } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } })}\n\ndata: [DONE]\n\n`) }
    else res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } }))
  })
  const base = await listen(fake)
  for (const [k,v] of Object.entries({ LLM_PROVIDER: 'openai-compatible', LLM_API_KEY: 'synthetic-c1-secret', LLM_BASE_URL: base, LLM_MODEL: 'synthetic-model', DECISION_PROVIDER: 'compatible', RA_API_TOKEN: 'synthetic-operator', SEARCH_EMBEDDINGS: 'off', SETTLEMENT_RAIL: 'simulated', ACTIVE_WORK_LIMIT: '4', LLM_SYNTHESIS_TIMEOUT_MS: '1500', MODEL_INPUT_USD_PER_MILLION: '2', MODEL_OUTPUT_USD_PER_MILLION: '4' })) vi.stubEnv(k,v)
  const pubApp = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} }); await pubApp.locals.ready; await pubApp.locals.writersReady
  const pub = pubApp.listen(0, '127.0.0.1'); await once(pub, 'listening')
  const pubUrl = `http://127.0.0.1:${(pub.address() as { port: number }).port}`
  const api = await createApiApp({ dbPath: ':memory:', publisherUrl: pubUrl })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const headers = { Authorization: 'Bearer synthetic-operator', 'Content-Type': 'application/json' }
  return { fake, base, api, url, headers, calls: () => calls, aborted: () => aborted,
    post: (path: string, body: unknown, key?: string) => fetch(url + path, { method: 'POST', headers: { ...headers, ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(body) }),
    close: async () => { await api.close(); await close(server); await close(pub); await close(fake) } }
}
