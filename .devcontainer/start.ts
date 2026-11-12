import { startEngine } from '../server/engine.js'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

/** Fixture-only equivalent of make run, with the exact forwarded origin retained. */
export async function startFixture({ webPort = Number(process.env.DEMO_WEB_PORT || 5100), apiPort = Number(process.env.DEMO_API_PORT || 8788), publisherPort = Number(process.env.DEMO_PUBLISHER_PORT || 8790), dataDir = process.env.RA_DATA_DIR || 'scratch/codespaces', codespace = process.env.CODESPACE_NAME, domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN } = {}) {
  Object.assign(process.env, { LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SETTLEMENT_RAIL: 'simulated', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0' })
  const forwardedHost = codespace && domain ? `${codespace}-${webPort}.${domain}` : undefined
  if (forwardedHost && !/^[a-z0-9.-]+$/i.test(forwardedHost)) throw new Error('Invalid Codespaces forwarding hostname')
  // Only the computed Codespace origin is opted in; no wildcard host or origin bypass.
  Object.assign(process.env, { RA_CLIENT_LAN: forwardedHost ? '1' : '0', RA_ALLOWED_HOSTS: forwardedHost ?? '', RA_WEB_ORIGIN: forwardedHost ? `https://${forwardedHost}` : `http://127.0.0.1:${webPort}` })
  const engine = await startEngine({ apiPort, publisherPort, dataDir })
  Object.assign(process.env, { PORT: new URL(engine.apiUrl).port, PUBLISHER_PORT: new URL(engine.publisherUrl).port, PUBLISHER_URL: engine.publisherUrl, RA_API_TOKEN: engine.apiToken })
  try {
    const { createServer } = await import('vite')
    const web = await createServer({ envFile: false, server: { host: '127.0.0.1', port: webPort, strictPort: true } })
    try {
      // Vite treats port 0 as its default 5173. Bind the public HTTP server
      // directly so concurrent fixtures receive genuine OS-assigned ports.
      if (webPort === 0) {
        const listening = once(web.httpServer!, 'listening')
        web.httpServer!.listen(0, '127.0.0.1')
        await listening
      } else await web.listen()
    } catch (error) { await web.close(); throw error }
    return { web, engine, forwardedHost, close: async () => { await web.close(); await engine.close() } }
  } catch (error) { await engine.close(); throw error }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixture = await startFixture()
  console.log('ResearchAgent ready: fixture · SIMULATED SGD · no real funds')
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { fixture.close().then(() => process.exit(0)) })
}
